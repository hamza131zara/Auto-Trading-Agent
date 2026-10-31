import {
  isSolanaPublicKey,
  validateCanonicalMarketSnapshot
} from "../index.js";
import type {
  AdapterNormalizationResult,
  CanonicalMarketSnapshot,
  MarketDataAdapter,
  MarketDataRequest,
  MarketDataSourceKind
} from "../index.js";
import { parseJsonPreservingNumericLexemes } from "../json-number-lexemes.js";

const PROVIDER_ID = "geckoterminal";
const ADAPTER_VERSION = "0.1.0";
const SCHEMA_VERSION = "ata.market-data.v1" as const;
const API_BASE_URL = "https://api.geckoterminal.com";
const API_VERSION = "20230203";
const MAX_RESPONSE_BYTES = 1_000_000;
// The official docs and support article conflict on the public API limit.
// A 7-second minimum spacing stays conservatively below the lower ~10/min figure.
export const GECKOTERMINAL_MIN_REQUEST_INTERVAL_MS = 7_000;

export interface GeckoTerminalRequestPacingAssessment {
  readonly canStartRequest: boolean;
  readonly nextAllowedAtMs: number;
  readonly reasonCode: "REQUEST_INTERVAL_ELAPSED" | "REQUEST_INTERVAL_ACTIVE" | "INVALID_PACING_INPUT";
}

/** Pure policy helper so pacing boundaries remain covered by deterministic tests. */
export function assessGeckoTerminalRequestPacing(
  nowMs: number,
  nextAllowedAtMs: number,
  minimumIntervalMs = GECKOTERMINAL_MIN_REQUEST_INTERVAL_MS
): GeckoTerminalRequestPacingAssessment {
  const invalid = !Number.isSafeInteger(nowMs) || nowMs < 0 ||
    !Number.isSafeInteger(nextAllowedAtMs) || nextAllowedAtMs < 0 ||
    !Number.isSafeInteger(minimumIntervalMs) || minimumIntervalMs < 1;
  if (invalid) {
    return {
      canStartRequest: false,
      nextAllowedAtMs: Number.MAX_SAFE_INTEGER,
      reasonCode: "INVALID_PACING_INPUT"
    };
  }
  if (nowMs < nextAllowedAtMs) {
    return {
      canStartRequest: false,
      nextAllowedAtMs,
      reasonCode: "REQUEST_INTERVAL_ACTIVE"
    };
  }
  return {
    canStartRequest: true,
    nextAllowedAtMs: nowMs + minimumIntervalMs,
    reasonCode: "REQUEST_INTERVAL_ELAPSED"
  };
}

let nextLiveRequestAllowedAtMs = 0;

const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.[0-9]{1,3})?Z$/;

export type GeckoTerminalFailureCode =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "NETWORK"
  | "HTTP"
  | "PARSE"
  | "AUTH"
  | "UNKNOWN";

export class GeckoTerminalAdapterError extends Error {
  readonly code: GeckoTerminalFailureCode;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(code: GeckoTerminalFailureCode, retryable: boolean, statusCode: number | null = null) {
    super("GeckoTerminal request failed (" + code +
      (statusCode === null ? "" : ", HTTP " + statusCode) + ").");
    this.name = "GeckoTerminalAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export interface GeckoTerminalPayloadEnvelope {
  readonly providerId: "geckoterminal";
  readonly requested: MarketDataRequest;
  readonly payload: unknown;
  readonly rawPayloadSha256: string;
  /** True only for injected-fetch tests/fixtures. */
  readonly synthetic: boolean;
}

interface DecimalMeasure {
  readonly value: string;
  readonly unit: "USD" | "USD_PER_BASE";
  readonly assetId: null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    UTC_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value));
}

function canonicalDecimal(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 128) return null;
  if (DECIMAL_PATTERN.test(value)) return value;

  // Expand exponent-form JSON numeric lexemes exactly; never route through Number.
  const match = value.match(/^(0|[1-9][0-9]*)(?:\\.([0-9]+))?[eE]([+-]?[0-9]+)$/);
  if (match === null) return null;
  const integerPart = match[1];
  const exponentText = match[3];
  if (integerPart === undefined || exponentText === undefined) return null;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 64) return null;

  const digits = integerPart + (match[2] ?? "");
  const point = integerPart.length + exponent;
  const expanded = point <= 0
    ? "0." + "0".repeat(-point) + digits
    : point >= digits.length
      ? digits + "0".repeat(point - digits.length)
      : digits.slice(0, point) + "." + digits.slice(point);
  return expanded.length <= 128 && DECIMAL_PATTERN.test(expanded) ? expanded : null;
}

function optionalMeasure(value: unknown, unit: DecimalMeasure["unit"]): DecimalMeasure | null | "INVALID" {
  if (value === undefined || value === null) return null;
  const decimal = canonicalDecimal(value);
  return decimal === null ? "INVALID" : { value: decimal, unit, assetId: null };
}

function optionalCount(value: unknown): number | null | "INVALID" {
  if (value === undefined || value === null) return null;
  if (typeof value === "number") {
    return Number.isSafeInteger(value) && value >= 0 ? value : "INVALID";
  }
  if (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value) && value.length <= 16) {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : "INVALID";
  }
  return "INVALID";
}

function getRecord(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function sha256Hex(text: string): Promise<string> {
  return globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((digest) =>
    Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
  );
}

async function readBoundedResponseText(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) &&
      Number(contentLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new GeckoTerminalAdapterError("PARSE", false);
  }

  if (response.body === null) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new GeckoTerminalAdapterError("PARSE", false);
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks: string[] = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      receivedBytes += result.value.byteLength;
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw new GeckoTerminalAdapterError("PARSE", false);
      }
      try {
        chunks.push(decoder.decode(result.value, { stream: true }));
      } catch {
        throw new GeckoTerminalAdapterError("PARSE", false);
      }
    }
    try {
      chunks.push(decoder.decode());
    } catch {
      throw new GeckoTerminalAdapterError("PARSE", false);
    }
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

function validateRequest(request: MarketDataRequest): void {
  if (request.cluster !== "mainnet-beta" ||
      !isSolanaPublicKey(request.baseMint) ||
      !isSolanaPublicKey(request.quoteMint) ||
      request.baseMint === request.quoteMint ||
      request.poolAddress === null ||
      !isSolanaPublicKey(request.poolAddress) ||
      !isUtcTimestamp(request.requestedAt)) {
    throw new GeckoTerminalAdapterError("PARSE", false);
  }
}

function normalizeEnvelope(value: unknown): GeckoTerminalPayloadEnvelope | null {
  if (!isRecord(value) ||
      value.providerId !== PROVIDER_ID ||
      !isRecord(value.requested) ||
      !/^[a-f0-9]{64}$/.test(String(value.rawPayloadSha256)) ||
      typeof value.synthetic !== "boolean" ||
      !("payload" in value)) {
    return null;
  }
  return value as unknown as GeckoTerminalPayloadEnvelope;
}


export interface GeckoTerminalOhlcvPriceEnvelope {
  readonly providerId: "geckoterminal";
  readonly requested: MarketDataRequest;
  readonly payload: unknown;
  readonly rawPayloadSha256: string;
  readonly synthetic: boolean;
}

export interface GeckoTerminalOhlcvPriceObservation {
  readonly providerId: "geckoterminal";
  readonly poolAddress: string;
  readonly baseMint: string;
  readonly quoteMint: string;
  readonly priceUsdPerBase: string;
  /** Timestamp of the one-minute candle's opening boundary, not the time of a specific trade. */
  readonly candleStartAt: string;
  readonly retrievedAt: string;
  readonly timeframe: "minute";
  readonly aggregate: 1;
  readonly requestId: string | null;
  readonly rawPayloadSha256: string;
  readonly synthetic: boolean;
}

export interface GeckoTerminalOhlcvNormalizationResult {
  readonly observation: GeckoTerminalOhlcvPriceObservation | null;
  readonly errors: readonly string[];
}

function expandJsonNumberDecimal(value: unknown): string | null {
  if (typeof value === "string") return canonicalDecimal(value);
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null;
  const text = String(value);
  if (DECIMAL_PATTERN.test(text)) return text;
  const match = /^([0-9]+(?:\.[0-9]+)?)[eE]([+-]?[0-9]+)$/.exec(text);
  if (match === null) return null;
  const exponent = Number(match[2]);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 100) return null;
  const decimalParts = match[1]!.split(".");
  const integerPart = decimalParts[0] ?? "0";
  const fractionPart = decimalParts[1] ?? "";
  const digits = integerPart + fractionPart;
  const point = integerPart.length + exponent;
  const expanded = point <= 0
    ? "0." + "0".repeat(-point) + digits
    : point >= digits.length
      ? digits + "0".repeat(point - digits.length)
      : digits.slice(0, point) + "." + digits.slice(point);
  return DECIMAL_PATTERN.test(expanded) ? expanded : null;
}

/**
 * Read-only timestamped price observation from GeckoTerminal's exact-pool one-minute OHLCV
 * endpoint. The returned timestamp is the candle-start boundary, not a transaction event time.
 * Freshness is assessed later against explicit policy; cached candles can be STALE.
 */
export class GeckoTerminalOhlcvPriceAdapter {
  readonly providerId = PROVIDER_ID;
  readonly adapterVersion = ADAPTER_VERSION;
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly synthetic: boolean;

  constructor(fetchImpl: typeof fetch = fetch, timeoutMs = 5_000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
      throw new RangeError("timeoutMs must be an integer between 100 and 60000.");
    }
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.synthetic = this.fetchImpl !== fetch;
  }

  async fetchRaw(request: MarketDataRequest, signal: AbortSignal): Promise<unknown> {
    validateRequest(request);
    if (!this.synthetic) {
      const pacing = assessGeckoTerminalRequestPacing(Date.now(), nextLiveRequestAllowedAtMs);
      if (!pacing.canStartRequest) throw new GeckoTerminalAdapterError("RATE_LIMIT", true);
      nextLiveRequestAllowedAtMs = pacing.nextAllowedAtMs;
    }
    const url = new URL(
      "/api/v2/networks/solana/pools/" + encodeURIComponent(request.poolAddress!) + "/ohlcv/minute",
      API_BASE_URL
    );
    url.searchParams.set("aggregate", "1");
    url.searchParams.set("limit", "5");
    url.searchParams.set("currency", "usd");
    url.searchParams.set("token", "base");

    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);
    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json;version=" + API_VERSION },
        redirect: "error",
        signal: combinedSignal
      });
    } catch {
      if (timeoutSignal.aborted) throw new GeckoTerminalAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new GeckoTerminalAdapterError("UNKNOWN", false);
      throw new GeckoTerminalAdapterError("NETWORK", true);
    }

    if (!response.ok) {
      if (response.status === 429) throw new GeckoTerminalAdapterError("RATE_LIMIT", true, 429);
      if (response.status === 408) throw new GeckoTerminalAdapterError("TIMEOUT", true, 408);
      if (response.status === 401 || response.status === 403) {
        throw new GeckoTerminalAdapterError("AUTH", false, response.status);
      }
      throw new GeckoTerminalAdapterError("HTTP", response.status >= 500, response.status);
    }

    let text: string;
    try {
      text = await readBoundedResponseText(response);
    } catch (error) {
      if (error instanceof GeckoTerminalAdapterError) throw error;
      if (timeoutSignal.aborted) throw new GeckoTerminalAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new GeckoTerminalAdapterError("UNKNOWN", false);
      throw new GeckoTerminalAdapterError("NETWORK", true);
    }

    let payload: unknown;
    try {
      payload = parseJsonPreservingNumericLexemes(text);
    } catch {
      throw new GeckoTerminalAdapterError("PARSE", false);
    }
    let rawPayloadSha256: string;
    try {
      rawPayloadSha256 = await sha256Hex(text);
    } catch {
      throw new GeckoTerminalAdapterError("UNKNOWN", false);
    }
    return {
      providerId: PROVIDER_ID,
      requested: request,
      payload,
      rawPayloadSha256,
      synthetic: this.synthetic
    } satisfies GeckoTerminalOhlcvPriceEnvelope;
  }

  normalize(
    rawPayload: unknown,
    context: { readonly requestedAt: string; readonly retrievedAt: string; readonly requestId: string | null }
  ): GeckoTerminalOhlcvNormalizationResult {
    const fail = (code: string): GeckoTerminalOhlcvNormalizationResult => ({
      observation: null,
      errors: [code]
    });
    if (!isRecord(rawPayload) ||
        rawPayload.providerId !== PROVIDER_ID ||
        !isRecord(rawPayload.requested) ||
        !/^[a-f0-9]{64}$/.test(String(rawPayload.rawPayloadSha256)) ||
        typeof rawPayload.synthetic !== "boolean" ||
        !("payload" in rawPayload)) return fail("INVALID_OHLCV_ENVELOPE");

    const request = rawPayload.requested as unknown as MarketDataRequest;
    try {
      validateRequest(request);
    } catch {
      return fail("INVALID_OHLCV_REQUEST");
    }
    if (!isUtcTimestamp(context.requestedAt) ||
        !isUtcTimestamp(context.retrievedAt) ||
        context.requestedAt !== request.requestedAt) return fail("INVALID_OHLCV_CONTEXT");

    const body = getRecord(rawPayload.payload);
    const data = getRecord(body?.data);
    const attributes = getRecord(data?.attributes);
    const meta = getRecord(body?.meta);
    const base = getRecord(meta?.base);
    const quote = getRecord(meta?.quote);
    if (base?.address !== request.baseMint || quote?.address !== request.quoteMint) {
      return fail("OHLCV_MINT_IDENTITY_MISMATCH");
    }
    const list = attributes?.ohlcv_list;
    if (!Array.isArray(list) || list.length === 0 || list.length > 1000) {
      return fail("OHLCV_CANDLE_LIST_INVALID");
    }

    const validCandles: Array<{ timestampSeconds: number; close: string }> = [];
    for (const row of list as unknown[]) {
      if (!Array.isArray(row) || row.length < 6) return fail("OHLCV_CANDLE_INVALID");
      const timestampSeconds = typeof row[0] === "string" && /^(?:0|[1-9][0-9]*)$/.test(row[0])
        ? Number(row[0])
        : row[0];
      if (typeof timestampSeconds !== "number" ||
          !Number.isSafeInteger(timestampSeconds) ||
          timestampSeconds < 0) {
        return fail("OHLCV_CANDLE_INVALID");
      }
      const close = expandJsonNumberDecimal(row[4]);
      if (close === null || !/[1-9]/.test(close)) return fail("OHLCV_CLOSE_INVALID");
      const date = new Date(timestampSeconds * 1000);
      if (!Number.isFinite(date.getTime())) return fail("OHLCV_TIMESTAMP_INVALID");
      validCandles.push({ timestampSeconds, close });
    }
    validCandles.sort((left, right) => right.timestampSeconds - left.timestampSeconds);
    const newest = validCandles[0];
    if (newest === undefined) return fail("OHLCV_CANDLE_LIST_INVALID");
    if (validCandles.length > 1 && validCandles[1]!.timestampSeconds === newest.timestampSeconds &&
        validCandles[1]!.close !== newest.close) return fail("OHLCV_DUPLICATE_LATEST_CANDLE");

    return {
      observation: {
        providerId: PROVIDER_ID,
        poolAddress: request.poolAddress!,
        baseMint: request.baseMint,
        quoteMint: request.quoteMint,
        priceUsdPerBase: newest.close,
        candleStartAt: new Date(newest.timestampSeconds * 1000).toISOString(),
        retrievedAt: context.retrievedAt,
        timeframe: "minute",
        aggregate: 1,
        requestId: context.requestId,
        rawPayloadSha256: String(rawPayload.rawPayloadSha256),
        synthetic: rawPayload.synthetic
      },
      errors: []
    };
  }
}

/**
 * Read-only exact-pool GeckoTerminal adapter. The public endpoint is beta and the provider
 * documents one-minute caching. Pool creation time is never promoted to an observation timestamp.
 */
export class GeckoTerminalPoolAdapter implements MarketDataAdapter {
  readonly providerId = PROVIDER_ID;
  readonly adapterVersion = ADAPTER_VERSION;
  readonly sourceKind: Exclude<MarketDataSourceKind, "REPLAY_FIXTURE"> = "INDEXED_API";

  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;
  private readonly synthetic: boolean;

  constructor(fetchImpl: typeof fetch = fetch, timeoutMs = 5_000) {
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 100 || timeoutMs > 60_000) {
      throw new RangeError("timeoutMs must be an integer between 100 and 60000.");
    }
    this.fetchImpl = fetchImpl;
    this.timeoutMs = timeoutMs;
    this.synthetic = this.fetchImpl !== fetch;
  }

  async fetchRaw(request: MarketDataRequest, signal: AbortSignal): Promise<unknown> {
    validateRequest(request);
    if (!this.synthetic) {
      const pacing = assessGeckoTerminalRequestPacing(Date.now(), nextLiveRequestAllowedAtMs);
      if (!pacing.canStartRequest) {
        throw new GeckoTerminalAdapterError("RATE_LIMIT", true);
      }
      nextLiveRequestAllowedAtMs = pacing.nextAllowedAtMs;
    }
    const url = new URL(
      "/api/v2/networks/solana/pools/" + encodeURIComponent(request.poolAddress!),
      API_BASE_URL
    );
    url.searchParams.set("include", "base_token,quote_token,dex");
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json;version=" + API_VERSION },
        redirect: "error",
        signal: combinedSignal
      });
    } catch {
      if (timeoutSignal.aborted) throw new GeckoTerminalAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new GeckoTerminalAdapterError("UNKNOWN", false);
      throw new GeckoTerminalAdapterError("NETWORK", true);
    }

    if (!response.ok) {
      if (response.status === 429) throw new GeckoTerminalAdapterError("RATE_LIMIT", true, 429);
      if (response.status === 408) throw new GeckoTerminalAdapterError("TIMEOUT", true, 408);
      if (response.status === 401 || response.status === 403) {
        throw new GeckoTerminalAdapterError("AUTH", false, response.status);
      }
      throw new GeckoTerminalAdapterError("HTTP", response.status >= 500, response.status);
    }

    let text: string;
    try {
      text = await readBoundedResponseText(response);
    } catch (error) {
      if (error instanceof GeckoTerminalAdapterError) throw error;
      if (timeoutSignal.aborted) throw new GeckoTerminalAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new GeckoTerminalAdapterError("UNKNOWN", false);
      throw new GeckoTerminalAdapterError("NETWORK", true);
    }

    let payload: unknown;
    try {
      payload = parseJsonPreservingNumericLexemes(text);
    } catch {
      throw new GeckoTerminalAdapterError("PARSE", false);
    }

    let rawPayloadSha256: string;
    try {
      rawPayloadSha256 = await sha256Hex(text);
    } catch {
      throw new GeckoTerminalAdapterError("UNKNOWN", false);
    }

    return {
      providerId: PROVIDER_ID,
      requested: request,
      payload,
      rawPayloadSha256,
      synthetic: this.synthetic
    } satisfies GeckoTerminalPayloadEnvelope;
  }

  normalize(
    rawPayload: unknown,
    context: { readonly requestedAt: string; readonly retrievedAt: string; readonly requestId: string | null }
  ): AdapterNormalizationResult {
    const envelope = normalizeEnvelope(rawPayload);
    if (envelope === null) return { observations: [], errors: ["INVALID_PROVIDER_ENVELOPE"] };

    const request = envelope.requested;
    try {
      validateRequest(request);
    } catch {
      return { observations: [], errors: ["INVALID_PROVIDER_REQUEST"] };
    }
    if (!isUtcTimestamp(context.requestedAt) ||
        !isUtcTimestamp(context.retrievedAt) ||
        context.requestedAt !== request.requestedAt) {
      return { observations: [], errors: ["INVALID_NORMALIZATION_TIMESTAMP"] };
    }

    const payload = getRecord(envelope.payload);
    const data = getRecord(payload?.data);
    const attributes = getRecord(data?.attributes);
    const relationships = getRecord(data?.relationships);
    const baseRelationship = getRecord(relationships?.base_token);
    const quoteRelationship = getRecord(relationships?.quote_token);
    const baseData = getRecord(baseRelationship?.data);
    const quoteData = getRecord(quoteRelationship?.data);

    if (data?.type !== "pool" ||
        data.id !== "solana_" + request.poolAddress ||
        attributes?.address !== request.poolAddress) {
      return { observations: [], errors: ["POOL_IDENTITY_MISMATCH"] };
    }
    if (baseData?.id !== "solana_" + request.baseMint ||
        quoteData?.id !== "solana_" + request.quoteMint) {
      return { observations: [], errors: ["POOL_MINT_IDENTITY_MISMATCH"] };
    }

    const price = optionalMeasure(attributes.base_token_price_usd, "USD_PER_BASE");
    const reserveUsd = optionalMeasure(attributes.reserve_in_usd, "USD");
    const volume = optionalMeasure(getRecord(attributes.volume_usd)?.h24, "USD");
    const transactions = getRecord(attributes.transactions);
    const h24 = getRecord(transactions?.h24);
    const buys = optionalCount(h24?.buys);
    const sells = optionalCount(h24?.sells);

    if (price === "INVALID" || reserveUsd === "INVALID" || volume === "INVALID" ||
        buys === "INVALID" || sells === "INVALID") {
      return { observations: [], errors: ["INVALID_MARKET_MEASURE"] };
    }

    const snapshot: CanonicalMarketSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      observationId: "geckoterminal:" + request.poolAddress + ":" + context.retrievedAt,
      chain: "solana",
      cluster: "mainnet-beta",
      baseMint: request.baseMint,
      quoteMint: request.quoteMint,
      poolAddress: request.poolAddress,
      dexProgramAddress: null,
      tokenProgramAddress: null,
      price,
      liquidity: reserveUsd,
      volume24h: volume,
      buys24h: buys,
      sells24h: sells,
      observedAt: null,
      sourceEventAt: null,
      retrievedAt: context.retrievedAt,
      slot: null,
      provenance: {
        providerId: PROVIDER_ID,
        sourceKind: envelope.synthetic ? "REPLAY_FIXTURE" : "INDEXED_API",
        adapterVersion: ADAPTER_VERSION,
        schemaVersion: SCHEMA_VERSION,
        requestId: context.requestId,
        sourceEventId: null,
        rawPayloadSha256: envelope.rawPayloadSha256,
        synthetic: envelope.synthetic
      }
    };

    const validation = validateCanonicalMarketSnapshot(snapshot);
    if (!validation.valid) {
      return { observations: [], errors: ["INVALID_CANONICAL_OBSERVATION", ...validation.errors] };
    }
    return { observations: [snapshot], errors: [] };
  }
}
