import type { IndependentUsdPriceObservation } from "../index.js";

export const PYTH_HERMES_PROVIDER_ID = "pyth-hermes";
export const PYTH_HERMES_INDEPENDENCE_GROUP_ID = "pyth-network";
export const PYTH_HERMES_ADAPTER_VERSION = "0.1.0";
export const PYTH_SOL_USD_FEED_ID = "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
export const PYTH_USDC_USD_FEED_ID = "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
export const WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
export const USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const HERMES_BASE_URL = "https://pyth.dourolabs.app/hermes";
const MAX_RESPONSE_BYTES = 256 * 1024;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.[0-9]{1,3})?Z$/;
const INTEGER_PATTERN = /^-?(?:0|[1-9][0-9]*)$/;
const UNSIGNED_INTEGER_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const FEED_ID_PATTERN = /^(?:0x)?[a-fA-F0-9]{64}$/;

export interface PythUsdFeedDefinition {
  readonly feedId: string;
  readonly feedName: "SOL/USD" | "USDC/USD";
  readonly assetId: string;
}

export const PYTH_SOL_USD_FEED: PythUsdFeedDefinition = {
  feedId: PYTH_SOL_USD_FEED_ID,
  feedName: "SOL/USD",
  assetId: WRAPPED_SOL_MINT
};

export const PYTH_USDC_USD_FEED: PythUsdFeedDefinition = {
  feedId: PYTH_USDC_USD_FEED_ID,
  feedName: "USDC/USD",
  assetId: USDC_MAINNET_MINT
};

export const PYTH_REFERENCE_FEEDS: readonly PythUsdFeedDefinition[] = [
  PYTH_SOL_USD_FEED,
  PYTH_USDC_USD_FEED
];

export type PythHermesFailureCode =
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP"
  | "PARSE"
  | "MISSING_FEED"
  | "DUPLICATE_FEED"
  | "INVALID_FEED"
  | "UNKNOWN";

export class PythHermesAdapterError extends Error {
  readonly code: PythHermesFailureCode;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(code: PythHermesFailureCode, retryable: boolean, statusCode: number | null = null) {
    super("Pyth Hermes request failed (" + code + (statusCode === null ? "" : ", HTTP " + statusCode) + ").");
    this.name = "PythHermesAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export interface PythHermesUsdPriceObservation extends IndependentUsdPriceObservation {
  readonly schemaVersion: "ata.pyth-hermes-reference.v1";
  readonly feedName: PythUsdFeedDefinition["feedName"];
  readonly confidenceUsd: string;
  readonly publishTimeUnixSeconds: number;
  readonly slot: number | null;
  readonly rawPayloadSha256: string;
  readonly requestId: string;
  readonly adapterVersion: string;
}

interface PythHermesRawEnvelope {
  readonly providerId: typeof PYTH_HERMES_PROVIDER_ID;
  readonly adapterVersion: typeof PYTH_HERMES_ADAPTER_VERSION;
  readonly requestedFeeds: readonly PythUsdFeedDefinition[];
  readonly requestedAt: string;
  readonly retrievedAt: string;
  readonly payload: unknown;
  readonly rawPayloadSha256: string;
  /** Injected fetch implementations are strictly test-only and remain synthetic. */
  readonly synthetic: boolean;
}

export interface PythHermesNormalizationResult {
  readonly observations: readonly PythHermesUsdPriceObservation[];
  readonly errors: readonly string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && UTC_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function normalizeFeedId(value: unknown): string | null {
  if (typeof value !== "string" || !FEED_ID_PATTERN.test(value)) return null;
  return value.replace(/^0x/i, "").toLowerCase();
}

function isSafeFeedDefinition(value: unknown): value is PythUsdFeedDefinition {
  if (!isRecord(value) ||
      typeof value.feedId !== "string" ||
      normalizeFeedId(value.feedId) === null ||
      typeof value.feedName !== "string" ||
      (value.feedName !== "SOL/USD" && value.feedName !== "USDC/USD") ||
      typeof value.assetId !== "string") return false;
  const expected = value.feedName === "SOL/USD" ? PYTH_SOL_USD_FEED : PYTH_USDC_USD_FEED;
  return normalizeFeedId(value.feedId) === expected.feedId &&
    value.assetId === expected.assetId;
}

/** Convert the signed Pyth integer plus exponent into a canonical decimal string exactly. */
export function pythScaledIntegerToDecimal(rawValue: unknown, exponent: unknown, allowZero = false): string | null {
  if (typeof rawValue !== "string" || !INTEGER_PATTERN.test(rawValue) ||
      typeof exponent !== "number" || !Number.isSafeInteger(exponent) ||
      exponent < -30 || exponent > 30) return null;
  let integer: bigint;
  try {
    integer = BigInt(rawValue);
  } catch {
    return null;
  }
  if (allowZero ? integer < 0n : integer <= 0n) return null;
  const negative = integer < 0n;
  const digits = (negative ? -integer : integer).toString();
  let expanded: string;
  if (exponent >= 0) {
    expanded = digits + "0".repeat(exponent);
  } else {
    const point = digits.length + exponent;
    expanded = point <= 0
      ? "0." + "0".repeat(-point) + digits
      : digits.slice(0, point) + "." + digits.slice(point);
  }
  let [whole = "0", fraction] = expanded.split(".");
  whole = whole.replace(/^0+(?=[0-9])/, "");
  if (fraction !== undefined) {
    fraction = fraction.replace(/0+$/, "");
    expanded = fraction.length === 0 ? whole : whole + "." + fraction;
  } else {
    expanded = whole;
  }
  if (expanded.length > 128) return null;
  return (negative ? "-" : "") + expanded;
}

async function readBoundedText(response: Response): Promise<string> {
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) &&
      Number(contentLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw new PythHermesAdapterError("PARSE", false);
  }
  if (response.body === null) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new PythHermesAdapterError("PARSE", false);
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
        throw new PythHermesAdapterError("PARSE", false);
      }
      try {
        chunks.push(decoder.decode(result.value, { stream: true }));
      } catch {
        throw new PythHermesAdapterError("PARSE", false);
      }
    }
    try {
      chunks.push(decoder.decode());
    } catch {
      throw new PythHermesAdapterError("PARSE", false);
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

function normalizeRawEnvelope(value: unknown): PythHermesRawEnvelope | null {
  if (!isRecord(value) ||
      value.providerId !== PYTH_HERMES_PROVIDER_ID ||
      value.adapterVersion !== PYTH_HERMES_ADAPTER_VERSION ||
      !Array.isArray(value.requestedFeeds) ||
      value.requestedFeeds.length !== PYTH_REFERENCE_FEEDS.length ||
      !isUtcTimestamp(value.requestedAt) ||
      !isUtcTimestamp(value.retrievedAt) ||
      typeof value.rawPayloadSha256 !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(value.rawPayloadSha256) ||
      typeof value.synthetic !== "boolean" ||
      !("payload" in value)) return null;
  const feeds = value.requestedFeeds as unknown[];
  if (!feeds.every(isSafeFeedDefinition) ||
      new Set(feeds.map((feed) => normalizeFeedId(feed.feedId))).size !== PYTH_REFERENCE_FEEDS.length) {
    return null;
  }
  return value as unknown as PythHermesRawEnvelope;
}

/**
 * Read-only Pyth Hermes adapter for the canonical Solana SOL/USD and USDC/USD feeds.
 * Hermes now requires a Pyth API key; the key is sent only in Authorization and is
 * never stored in a report, error message, or payload envelope.
 */
export class PythHermesUsdPriceAdapter {
  readonly providerId = PYTH_HERMES_PROVIDER_ID;
  readonly independenceGroupId = PYTH_HERMES_INDEPENDENCE_GROUP_ID;
  readonly adapterVersion = PYTH_HERMES_ADAPTER_VERSION;

  private readonly apiKey: string;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => string;
  private readonly timeoutMs: number;
  private readonly synthetic: boolean;

  constructor(options: {
    readonly apiKey?: string;
    readonly fetchImpl?: typeof fetch;
    readonly now?: () => string;
    readonly timeoutMs?: number;
  }) {
    this.apiKey = options.apiKey ?? "";
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date().toISOString());
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.synthetic = options.fetchImpl !== undefined;
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 30_000) {
      throw new RangeError("timeoutMs must be an integer between 100 and 30000.");
    }
  }

  async fetchRaw(signal: AbortSignal = new AbortController().signal): Promise<PythHermesRawEnvelope> {
    if (this.apiKey.trim().length === 0) throw new PythHermesAdapterError("AUTH", false);
    const requestedAt = this.now();
    if (!isUtcTimestamp(requestedAt)) throw new PythHermesAdapterError("UNKNOWN", false);

    const url = new URL("/hermes/v2/updates/price/latest", "https://pyth.dourolabs.app");
    for (const feed of PYTH_REFERENCE_FEEDS) url.searchParams.append("ids[]", "0x" + feed.feedId);
    url.searchParams.set("parsed", "true");
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetchImpl(url, {
        method: "GET",
        headers: {
          accept: "application/json",
          authorization: "Bearer " + this.apiKey
        },
        redirect: "error",
        signal: combinedSignal
      });
    } catch {
      if (timeoutSignal.aborted) throw new PythHermesAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new PythHermesAdapterError("UNKNOWN", false);
      throw new PythHermesAdapterError("NETWORK", true);
    }

    if (!response.ok) {
      if (response.status === 429) throw new PythHermesAdapterError("RATE_LIMIT", true, 429);
      if (response.status === 408) throw new PythHermesAdapterError("TIMEOUT", true, 408);
      if (response.status === 401 || response.status === 403) {
        throw new PythHermesAdapterError("AUTH", false, response.status);
      }
      throw new PythHermesAdapterError("HTTP", response.status >= 500, response.status);
    }

    let text: string;
    try {
      text = await readBoundedText(response);
    } catch (error) {
      if (error instanceof PythHermesAdapterError) throw error;
      if (timeoutSignal.aborted) throw new PythHermesAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new PythHermesAdapterError("UNKNOWN", false);
      throw new PythHermesAdapterError("NETWORK", true);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new PythHermesAdapterError("PARSE", false);
    }
    let rawPayloadSha256: string;
    try {
      rawPayloadSha256 = await sha256Hex(text);
    } catch {
      throw new PythHermesAdapterError("UNKNOWN", false);
    }
    const retrievedAt = this.now();
    if (!isUtcTimestamp(retrievedAt)) throw new PythHermesAdapterError("UNKNOWN", false);

    return {
      providerId: PYTH_HERMES_PROVIDER_ID,
      adapterVersion: PYTH_HERMES_ADAPTER_VERSION,
      requestedFeeds: PYTH_REFERENCE_FEEDS,
      requestedAt,
      retrievedAt,
      payload,
      rawPayloadSha256,
      synthetic: this.synthetic
    };
  }

  normalize(rawPayload: unknown): PythHermesNormalizationResult {
    const envelope = normalizeRawEnvelope(rawPayload);
    if (envelope === null) return { observations: [], errors: ["INVALID_PROVIDER_ENVELOPE"] };
    if (!isRecord(envelope.payload) || !Array.isArray(envelope.payload.parsed)) {
      return { observations: [], errors: ["INVALID_HERMES_RESPONSE"] };
    }
    const parsed = envelope.payload.parsed.filter(isRecord);
    const observations: PythHermesUsdPriceObservation[] = [];
    const errors: string[] = [];
    for (const requested of envelope.requestedFeeds) {
      const requestedId = normalizeFeedId(requested.feedId)!;
      const matches = parsed.filter((candidate) => normalizeFeedId(candidate.id) === requestedId);
      if (matches.length === 0) {
        errors.push("PYTH_FEED_MISSING");
        continue;
      }
      if (matches.length !== 1) {
        errors.push("PYTH_FEED_DUPLICATE");
        continue;
      }
      const record = matches[0]!;
      const price = isRecord(record.price) ? record.price : null;
      if (price === null ||
          typeof price.price !== "string" ||
          typeof price.conf !== "string" ||
          typeof price.expo !== "number" ||
          !Number.isSafeInteger(price.publish_time) ||
          (price.publish_time as number) < 0) {
        errors.push("PYTH_PRICE_RECORD_INVALID");
        continue;
      }
      const priceUsd = pythScaledIntegerToDecimal(price.price, price.expo);
      const confidenceUsd = pythScaledIntegerToDecimal(price.conf, price.expo, true);
      if (priceUsd === null || confidenceUsd === null) {
        errors.push("PYTH_PRICE_DECIMAL_INVALID");
        continue;
      }
      const publishedAt = new Date((price.publish_time as number) * 1000).toISOString();
      const metadata = isRecord(record.metadata) ? record.metadata : null;
      const slot = metadata !== null && Number.isSafeInteger(metadata.slot) &&
        (metadata.slot as number) >= 0 ? metadata.slot as number : null;
      observations.push({
        schemaVersion: "ata.pyth-hermes-reference.v1",
        assetId: requested.assetId,
        feedId: requestedId,
        feedName: requested.feedName,
        providerId: PYTH_HERMES_PROVIDER_ID,
        independenceGroupId: PYTH_HERMES_INDEPENDENCE_GROUP_ID,
        priceUsd,
        confidenceUsd,
        publishedAt,
        retrievedAt: envelope.retrievedAt,
        synthetic: envelope.synthetic,
        publishTimeUnixSeconds: price.publish_time as number,
        slot,
        rawPayloadSha256: envelope.rawPayloadSha256.toLowerCase(),
        requestId: "pyth-hermes:" + envelope.retrievedAt + ":" + envelope.rawPayloadSha256.slice(0, 12),
        adapterVersion: PYTH_HERMES_ADAPTER_VERSION
      });
    }
    if (errors.length > 0) return { observations: [], errors: [...new Set(errors)] };
    if (observations.length !== PYTH_REFERENCE_FEEDS.length) {
      return { observations: [], errors: ["PYTH_FEED_SET_INCOMPLETE"] };
    }
    return { observations, errors: [] };
  }

  async fetchLatest(signal?: AbortSignal): Promise<PythHermesNormalizationResult> {
    const envelope = await this.fetchRaw(signal);
    return this.normalize(envelope);
  }
}
