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

const PROVIDER_ID = "dex-screener";
const ADAPTER_VERSION = "0.1.0";
const SCHEMA_VERSION = "ata.market-data.v1" as const;
const API_BASE_URL = "https://api.dexscreener.com";
const MAX_RESPONSE_BYTES = 1_000_000;
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.[0-9]{1,3})?Z$/;

export type DexScreenerFailureCode =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "NETWORK"
  | "HTTP"
  | "PARSE"
  | "AUTH"
  | "UNKNOWN";

export class DexScreenerAdapterError extends Error {
  readonly code: DexScreenerFailureCode;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(
    code: DexScreenerFailureCode,
    retryable: boolean,
    statusCode: number | null = null
  ) {
    super("DEX Screener request failed (" + code + (statusCode === null ? "" : ", HTTP " + statusCode) + ").");
    this.name = "DexScreenerAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export interface DexScreenerPayloadEnvelope {
  readonly providerId: "dex-screener";
  readonly requested: MarketDataRequest;
  readonly payload: unknown;
  readonly rawPayloadSha256: string;
  /** True only when constructed from a local deterministic fixture/test. */
  readonly synthetic: boolean;
}

interface NormalizationContext {
  readonly retrievedAt: string;
  readonly requestId: string | null;
}

interface DecimalMeasure {
  readonly value: string;
  readonly unit: "USD" | "USD_PER_BASE";
  readonly assetId: null;
}

/**
 * Parse JSON while preserving each numeric lexeme as a string. This avoids
 * routing source decimal values through IEEE-754 before canonical storage.
 * JSON syntax is still fully checked by JSON.parse after token-preserving scan.
 */
export function parseJsonPreservingNumericLexemes(text: string): unknown {
  let output = "";
  let inString = false;
  let escaped = false;
  let index = 0;

  while (index < text.length) {
    const character = text[index]!;

    if (inString) {
      output += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      index += 1;
      continue;
    }

    if (character === '"') {
      inString = true;
      output += character;
      index += 1;
      continue;
    }

    if (character === "-" || (character >= "0" && character <= "9")) {
      const match = text.slice(index).match(/^-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/);
      if (match === null) throw new SyntaxError("Invalid JSON numeric token.");
      output += JSON.stringify(match[0]);
      index += match[0].length;
      continue;
    }

    output += character;
    index += 1;
  }

  if (inString || escaped) throw new SyntaxError("Unterminated JSON string.");
  return JSON.parse(output) as unknown;
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
  if (typeof value !== "string") return null;
  if (DECIMAL_PATTERN.test(value)) return value;

  // Expand a valid exponent-form numeric lexeme exactly; never route through Number.
  const match = value.match(/^(0|[1-9][0-9]*)(?:\.([0-9]+))?[eE]([+-]?[0-9]+)$/);
  if (match === null) return null;
  const sourceIntegerPart = match[1];
  const exponentText = match[3];
  if (sourceIntegerPart === undefined || exponentText === undefined) return null;
  const exponent = Number(exponentText);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 64) return null;

  const fraction = match[2] ?? "";
  const digits = sourceIntegerPart + fraction;
  const decimalPosition = sourceIntegerPart.length + exponent;
  let expanded: string;

  if (decimalPosition <= 0) {
    expanded = "0." + "0".repeat(-decimalPosition) + digits;
  } else if (decimalPosition >= digits.length) {
    expanded = digits + "0".repeat(decimalPosition - digits.length);
  } else {
    expanded = digits.slice(0, decimalPosition) + "." + digits.slice(decimalPosition);
  }

  const [integerPart, fractionalPart] = expanded.split(".");
  const normalizedInteger = (integerPart ?? "0").replace(/^0+(?=[0-9])/, "");
  const normalized = fractionalPart === undefined
    ? normalizedInteger
    : normalizedInteger + "." + fractionalPart;
  return normalized.length <= 128 && DECIMAL_PATTERN.test(normalized) ? normalized : null;
}

function getOptionalRecord(record: Record<string, unknown>, key: string): Record<string, unknown> | null {
  const value = record[key];
  return isRecord(value) ? value : null;
}

function parseMeasure(
  value: unknown,
  unit: "USD" | "USD_PER_BASE"
): DecimalMeasure | null | "INVALID" {
  if (value === undefined || value === null) return null;
  const decimal = canonicalDecimal(value);
  if (decimal === null) return "INVALID";
  return { value: decimal, unit, assetId: null };
}

function parseCount(value: unknown): number | null | "INVALID" {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(value)) return "INVALID";
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : "INVALID";
}

async function readBoundedResponseText(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) &&
      Number(contentLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new DexScreenerAdapterError("PARSE", false);
  }

  if (response.body === null) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new DexScreenerAdapterError("PARSE", false);
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
        throw new DexScreenerAdapterError("PARSE", false);
      }
      try {
        chunks.push(decoder.decode(result.value, { stream: true }));
      } catch {
        throw new DexScreenerAdapterError("PARSE", false);
      }
    }
    try {
      chunks.push(decoder.decode());
    } catch {
      throw new DexScreenerAdapterError("PARSE", false);
    }
    return chunks.join("");
  } finally {
    reader.releaseLock();
  }
}

function sha256Hex(text: string): Promise<string> {
  return globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)).then((digest) =>
    Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("")
  );
}

function validateRequest(request: MarketDataRequest): void {
  // DEX Screener indexes Solana mainnet pairs; devnet/testnet are not implied.
  if (request.cluster !== "mainnet-beta") {
    throw new DexScreenerAdapterError("UNKNOWN", false);
  }
  if (!isSolanaPublicKey(request.baseMint) ||
      !isSolanaPublicKey(request.quoteMint) ||
      request.baseMint === request.quoteMint ||
      request.poolAddress === null ||
      !isSolanaPublicKey(request.poolAddress) ||
      !isUtcTimestamp(request.requestedAt)) {
    throw new DexScreenerAdapterError("PARSE", false);
  }
}

function normalizeEnvelope(rawPayload: unknown): DexScreenerPayloadEnvelope | null {
  if (!isRecord(rawPayload) ||
      rawPayload.providerId !== PROVIDER_ID ||
      !isRecord(rawPayload.requested) ||
      !/^[a-fA-F0-9]{64}$/.test(String(rawPayload.rawPayloadSha256)) ||
      typeof rawPayload.synthetic !== "boolean" ||
      !("payload" in rawPayload)) {
    return null;
  }
  return rawPayload as unknown as DexScreenerPayloadEnvelope;
}

/**
 * Read-only reference adapter for evaluating DEX Screener indexed pair data.
 * It cannot assess token safety, generate trade intents, or access signing.
 */
export class DexScreenerPairsAdapter implements MarketDataAdapter {
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
    // Injected fetch implementations are for tests/fixtures and can never yield live evidence.
    this.synthetic = fetchImpl !== fetch;
  }

  async fetchRaw(request: MarketDataRequest, signal: AbortSignal): Promise<unknown> {
    validateRequest(request);
    const url = new URL(
      "/latest/dex/pairs/solana/" + encodeURIComponent(request.poolAddress!),
      API_BASE_URL
    );
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: { accept: "application/json" },
        redirect: "error",
        signal: combinedSignal
      });
    } catch {
      if (timeoutSignal.aborted) throw new DexScreenerAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new DexScreenerAdapterError("UNKNOWN", false);
      throw new DexScreenerAdapterError("NETWORK", true);
    }

    if (!response.ok) {
      if (response.status === 429) throw new DexScreenerAdapterError("RATE_LIMIT", true, 429);
      if (response.status === 408) throw new DexScreenerAdapterError("TIMEOUT", true, 408);
      if (response.status === 401 || response.status === 403) {
        throw new DexScreenerAdapterError("AUTH", false, response.status);
      }
      throw new DexScreenerAdapterError("HTTP", response.status >= 500, response.status);
    }

    let text: string;
    try {
      text = await readBoundedResponseText(response);
    } catch (error) {
      if (error instanceof DexScreenerAdapterError) throw error;
      if (timeoutSignal.aborted) throw new DexScreenerAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new DexScreenerAdapterError("UNKNOWN", false);
      throw new DexScreenerAdapterError("NETWORK", true);
    }

    let payload: unknown;
    try {
      payload = parseJsonPreservingNumericLexemes(text);
    } catch {
      throw new DexScreenerAdapterError("PARSE", false);
    }

    let rawPayloadSha256: string;
    try {
      rawPayloadSha256 = await sha256Hex(text);
    } catch {
      throw new DexScreenerAdapterError("UNKNOWN", false);
    }

    return {
      providerId: PROVIDER_ID,
      requested: request,
      payload,
      rawPayloadSha256,
      synthetic: this.synthetic
    } satisfies DexScreenerPayloadEnvelope;
  }

  normalize(
    rawPayload: unknown,
    context: { readonly requestedAt: string; readonly retrievedAt: string; readonly requestId: string | null }
  ): { readonly observations: readonly CanonicalMarketSnapshot[]; readonly errors: readonly string[] } {
    const envelope = normalizeEnvelope(rawPayload);
    if (envelope === null) return { observations: [], errors: ["INVALID_PROVIDER_ENVELOPE"] };
    const request = envelope.requested;
    try {
      validateRequest(request);
    } catch {
      return { observations: [], errors: ["INVALID_PROVIDER_REQUEST"] };
    }
    const requestedAt = context.requestedAt;
    const retrievedAt = context.retrievedAt;
    if (!isUtcTimestamp(requestedAt) || !isUtcTimestamp(retrievedAt) || requestedAt !== request.requestedAt) {
      return { observations: [], errors: ["INVALID_NORMALIZATION_TIMESTAMP"] };
    }

    if (!isRecord(envelope.payload) || !Array.isArray(envelope.payload.pairs)) {
      return { observations: [], errors: ["INVALID_PAIRS_RESPONSE"] };
    }

    const pair = envelope.payload.pairs.find((candidate: unknown) =>
      isRecord(candidate) && candidate.pairAddress === request.poolAddress
    );
    if (!isRecord(pair)) return { observations: [], errors: ["PAIR_NOT_FOUND"] };
    if (pair.chainId !== "solana") return { observations: [], errors: ["UNSUPPORTED_CHAIN"] };
    if (pair.pairAddress !== request.poolAddress) return { observations: [], errors: ["PAIR_IDENTITY_MISMATCH"] };

    const baseToken = getOptionalRecord(pair, "baseToken");
    const quoteToken = getOptionalRecord(pair, "quoteToken");
    if (baseToken === null || quoteToken === null ||
        baseToken.address !== request.baseMint ||
        quoteToken.address !== request.quoteMint) {
      return { observations: [], errors: ["PAIR_MINT_IDENTITY_MISMATCH"] };
    }

    const price = parseMeasure(pair.priceUsd, "USD_PER_BASE");
    const liquidityRecord = getOptionalRecord(pair, "liquidity");
    const volumeRecord = getOptionalRecord(pair, "volume");
    const liquidity = parseMeasure(liquidityRecord?.usd, "USD");
    const volume24h = parseMeasure(volumeRecord?.h24, "USD");
    const transactionsRecord = getOptionalRecord(pair, "txns");
    const h24Transactions = transactionsRecord === null ? null : getOptionalRecord(transactionsRecord, "h24");
    const buys24h = parseCount(h24Transactions?.buys);
    const sells24h = parseCount(h24Transactions?.sells);

    if (price === "INVALID" || liquidity === "INVALID" || volume24h === "INVALID" ||
        buys24h === "INVALID" || sells24h === "INVALID") {
      return { observations: [], errors: ["INVALID_MARKET_MEASURE"] };
    }

    const snapshot: CanonicalMarketSnapshot = {
      schemaVersion: SCHEMA_VERSION,
      observationId: "dexscreener:" + request.poolAddress + ":" + retrievedAt,
      chain: "solana",
      cluster: "mainnet-beta",
      baseMint: request.baseMint,
      quoteMint: request.quoteMint,
      poolAddress: request.poolAddress,
      // DEX identity is a provider label, not a verified on-chain program address.
      dexProgramAddress: null,
      tokenProgramAddress: null,
      price,
      liquidity,
      volume24h,
      buys24h,
      sells24h,
      // Pair creation time is not a market-snapshot event timestamp.
      observedAt: null,
      sourceEventAt: null,
      retrievedAt,
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
    return { observations: [snapshot], errors: [] } satisfies AdapterNormalizationResult;
  }
}
