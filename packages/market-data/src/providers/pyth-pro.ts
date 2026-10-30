import type { IndependentUsdPriceObservation } from "../index.js";

export const PYTH_PRO_PROVIDER_ID = "pyth-pro";
export const PYTH_PRO_INDEPENDENCE_GROUP_ID = "pyth-network";
export const PYTH_PRO_ADAPTER_VERSION = "1.0.0";
export const PYTH_PRO_SOL_USD_HERMES_FEED_ID =
  "ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
export const PYTH_PRO_USDC_USD_HERMES_FEED_ID =
  "eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a";
export const PYTH_PRO_WRAPPED_SOL_MINT = "So11111111111111111111111111111111111111112";
export const PYTH_PRO_USDC_MAINNET_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
export const PYTH_PRO_LATEST_PRICE_URL = "https://pyth-lazer.dourolabs.app/v1/latest_price";

const MAX_RESPONSE_BYTES = 256 * 1024;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.[0-9]{1,3})?Z$/;
const INTEGER_PATTERN = /^-?(?:0|[1-9][0-9]*)$/;
const UNSIGNED_INTEGER_PATTERN = /^(?:0|[1-9][0-9]*)$/;
const CHANNEL_RANK: Readonly<Record<PythProChannel, number>> = {
  "fixed_rate@1000ms": 0,
  "fixed_rate@200ms": 1,
  "fixed_rate@50ms": 2,
  real_time: 3
};

export type PythProChannel =
  | "real_time"
  | "fixed_rate@50ms"
  | "fixed_rate@200ms"
  | "fixed_rate@1000ms";

export type PythProMarketSession = "regular" | "preMarket" | "postMarket" | "overNight" | "closed";

export interface PythProFeedBinding {
  /** Stable numeric pyth_lazer_id obtained from reviewed Pyth symbology metadata. */
  readonly pythLazerId: number;
  /** Existing 32-byte Hermes/Core feed ID, retained as the canonical feed identity. */
  readonly hermesFeedId: string;
  readonly feedName: "SOL/USD" | "USDC/USD";
  readonly assetId: string;
  /** Feed-level min_publishers from the reviewed Pyth symbology response. */
  readonly minPublisherCount: number;
  /** Feed-level min_channel from the reviewed Pyth symbology response. */
  readonly minChannel: PythProChannel;
  /** Session-specific overrides from the reviewed feed metadata, when present. */
  readonly minPublisherCountBySession?: Readonly<Partial<Record<PythProMarketSession, number>>>;
}

export interface PythProUsdPriceObservation extends IndependentUsdPriceObservation {
  readonly schemaVersion: "ata.pyth-pro-reference.v1";
  readonly feedName: PythProFeedBinding["feedName"];
  readonly pythLazerId: number;
  readonly publisherCount: number;
  readonly minPublisherCount: number;
  readonly confidenceUsd: string;
  /** Exact Unix-microsecond feed-generation time from Pyth Pro. */
  readonly feedUpdateTimestampUnixMicros: string;
  /** Exact Unix-microsecond response/update time from Pyth Pro. */
  readonly updateTimestampUnixMicros: string;
  readonly rawPayloadSha256: string;
  readonly requestId: string;
  readonly adapterVersion: string;
  readonly channel: PythProChannel;
  readonly marketSession: PythProMarketSession;
}

export type PythProFailureCode =
  | "AUTH"
  | "RATE_LIMIT"
  | "TIMEOUT"
  | "NETWORK"
  | "HTTP"
  | "PARSE"
  | "INVALID_CONFIGURATION"
  | "INVALID_RESPONSE"
  | "MISSING_FEED"
  | "DUPLICATE_FEED"
  | "FEED_ID_MISMATCH"
  | "PRICE_INVALID"
  | "CONFIDENCE_INVALID"
  | "TIMESTAMP_MISSING"
  | "TIMESTAMP_INVALID"
  | "FEED_TIMESTAMP_MISSING"
  | "FEED_CARRIED_FORWARD"
  | "FEED_TIMESTAMP_AHEAD_OF_UPDATE"
  | "PUBLISHER_COUNT_INVALID"
  | "PUBLISHER_QUORUM_UNMET"
  | "UNKNOWN";

export class PythProAdapterError extends Error {
  readonly code: PythProFailureCode;
  readonly retryable: boolean;
  readonly statusCode: number | null;

  constructor(code: PythProFailureCode, retryable: boolean, statusCode: number | null = null) {
    super("Pyth Pro request failed (" + code + (statusCode === null ? "" : ", HTTP " + statusCode) + ").");
    this.name = "PythProAdapterError";
    this.code = code;
    this.retryable = retryable;
    this.statusCode = statusCode;
  }
}

export interface PythProNormalizationResult {
  readonly observations: readonly PythProUsdPriceObservation[];
  readonly errors: readonly PythProFailureCode[];
}

interface PythProEnvelope {
  readonly providerId: typeof PYTH_PRO_PROVIDER_ID;
  readonly adapterVersion: typeof PYTH_PRO_ADAPTER_VERSION;
  readonly channel: PythProChannel;
  readonly requestedFeeds: readonly PythProFeedBinding[];
  readonly requestedAt: string;
  readonly retrievedAt: string;
  readonly rawPayloadSha256: string;
  readonly payload: unknown;
  readonly synthetic: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" && UTC_PATTERN.test(value) && Number.isFinite(Date.parse(value));
}

function normalizeHexFeedId(value: unknown): string | null {
  if (typeof value !== "string" || !/^(?:0x)?[a-fA-F0-9]{64}$/.test(value)) return null;
  return value.replace(/^0x/i, "").toLowerCase();
}

function isChannel(value: unknown): value is PythProChannel {
  return typeof value === "string" && Object.hasOwn(CHANNEL_RANK, value);
}

function validateFeedBindings(value: unknown): value is readonly PythProFeedBinding[] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const bindings = value as unknown[];
  const sol = bindings.find((item) => isRecord(item) && item.feedName === "SOL/USD");
  const usdc = bindings.find((item) => isRecord(item) && item.feedName === "USDC/USD");
  if (!isRecord(sol) || !isRecord(usdc)) return false;

  const validateBinding = (
    binding: Record<string, unknown>,
    feedName: PythProFeedBinding["feedName"]
  ): boolean => {
    const expected = feedName === "SOL/USD"
      ? {
          hermesFeedId: PYTH_PRO_SOL_USD_HERMES_FEED_ID,
          assetId: PYTH_PRO_WRAPPED_SOL_MINT
        }
      : {
          hermesFeedId: PYTH_PRO_USDC_USD_HERMES_FEED_ID,
          assetId: PYTH_PRO_USDC_MAINNET_MINT
        };
    return binding.feedName === feedName &&
      typeof binding.pythLazerId === "number" &&
      Number.isSafeInteger(binding.pythLazerId) &&
      binding.pythLazerId > 0 &&
      normalizeHexFeedId(binding.hermesFeedId) === expected.hermesFeedId &&
      binding.assetId === expected.assetId &&
      typeof binding.minPublisherCount === "number" &&
      Number.isSafeInteger(binding.minPublisherCount) &&
      binding.minPublisherCount >= 1 &&
      isChannel(binding.minChannel) &&
      (binding.minPublisherCountBySession === undefined ||
        (isRecord(binding.minPublisherCountBySession) &&
          Object.entries(binding.minPublisherCountBySession).every(([session, count]) =>
            ["regular", "preMarket", "postMarket", "overNight", "closed"].includes(session) &&
            typeof count === "number" && Number.isSafeInteger(count) && count >= 1)));
  };

  return bindings.length === 2 &&
    validateBinding(sol, "SOL/USD") &&
    validateBinding(usdc, "USDC/USD") &&
    sol.pythLazerId !== usdc.pythLazerId;
}

function validateSelectedChannel(
  bindings: readonly PythProFeedBinding[],
  channel: PythProChannel
): boolean {
  const selectedRank = CHANNEL_RANK[channel];
  return bindings.every((binding) => selectedRank >= CHANNEL_RANK[binding.minChannel]);
}

function parseUnsignedInteger(value: unknown): string | null {
  if (typeof value === "string" && UNSIGNED_INTEGER_PATTERN.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

function parseSignedInteger(value: unknown): string | null {
  if (typeof value === "string" && INTEGER_PATTERN.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value)) return String(value);
  return null;
}

function microsecondsToIso(value: string): string | null {
  try {
    const milliseconds = BigInt(value) / 1_000n;
    const asNumber = Number(milliseconds);
    if (!Number.isSafeInteger(asNumber)) return null;
    const date = new Date(asNumber);
    return Number.isFinite(date.getTime()) ? date.toISOString() : null;
  } catch {
    return null;
  }
}

function pythScaledIntegerToDecimal(value: string, exponent: number, allowZero: boolean): string | null {
  if (!INTEGER_PATTERN.test(value) || !Number.isSafeInteger(exponent) || exponent < -30 || exponent > 30) {
    return null;
  }
  let integer: bigint;
  try {
    integer = BigInt(value);
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
    throw new PythProAdapterError("PARSE", false);
  }
  if (response.body === null) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw new PythProAdapterError("PARSE", false);
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
        throw new PythProAdapterError("PARSE", false);
      }
      try {
        chunks.push(decoder.decode(result.value, { stream: true }));
      } catch {
        throw new PythProAdapterError("PARSE", false);
      }
    }
    try {
      chunks.push(decoder.decode());
    } catch {
      throw new PythProAdapterError("PARSE", false);
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

function normalizeEnvelope(value: unknown): PythProEnvelope | null {
  if (!isRecord(value) ||
      value.providerId !== PYTH_PRO_PROVIDER_ID ||
      value.adapterVersion !== PYTH_PRO_ADAPTER_VERSION ||
      !isChannel(value.channel) ||
      !validateFeedBindings(value.requestedFeeds) ||
      !isUtcTimestamp(value.requestedAt) ||
      !isUtcTimestamp(value.retrievedAt) ||
      typeof value.rawPayloadSha256 !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(value.rawPayloadSha256) ||
      typeof value.synthetic !== "boolean" ||
      !("payload" in value)) return null;
  const feeds = value.requestedFeeds;
  if (!validateSelectedChannel(feeds, value.channel)) return null;
  return value as unknown as PythProEnvelope;
}

/**
 * Pyth Pro read-only latest-price adapter.
 *
 * It uses the feed-generation timestamp, not the message/retrieval timestamp, and
 * refuses carried-forward values or updates below the feed's reviewed minimum
 * publisher quorum. Feed IDs, min_publishers, min_channel and API entitlements
 * must be reviewed before this adapter is configured for a manual diagnostic.
 */
export class PythProUsdPriceAdapter {
  readonly providerId = PYTH_PRO_PROVIDER_ID;
  readonly independenceGroupId = PYTH_PRO_INDEPENDENCE_GROUP_ID;
  readonly adapterVersion = PYTH_PRO_ADAPTER_VERSION;

  private readonly apiKey: string;
  private readonly bindings: readonly PythProFeedBinding[];
  private readonly channel: PythProChannel;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => string;
  private readonly timeoutMs: number;
  private readonly synthetic: boolean;

  constructor(options: {
    readonly apiKey?: string;
    readonly feedBindings: readonly PythProFeedBinding[];
    readonly channel: PythProChannel;
    readonly fetchImpl?: typeof fetch;
    readonly now?: () => string;
    readonly timeoutMs?: number;
  }) {
    this.apiKey = options.apiKey ?? "";
    this.bindings = options.feedBindings;
    this.channel = options.channel;
    this.fetchImpl = options.fetchImpl ?? fetch;
    this.now = options.now ?? (() => new Date().toISOString());
    this.timeoutMs = options.timeoutMs ?? 5_000;
    this.synthetic = options.fetchImpl !== undefined;

    if (!validateFeedBindings(this.bindings) ||
        !isChannel(this.channel) ||
        !validateSelectedChannel(this.bindings, this.channel)) {
      throw new PythProAdapterError("INVALID_CONFIGURATION", false);
    }
    if (!Number.isSafeInteger(this.timeoutMs) || this.timeoutMs < 100 || this.timeoutMs > 30_000) {
      throw new PythProAdapterError("INVALID_CONFIGURATION", false);
    }
  }

  async fetchRaw(signal: AbortSignal = new AbortController().signal): Promise<PythProEnvelope> {
    if (this.apiKey.trim().length === 0) throw new PythProAdapterError("AUTH", false);
    const requestedAt = this.now();
    if (!isUtcTimestamp(requestedAt)) throw new PythProAdapterError("INVALID_CONFIGURATION", false);

    const requestBody = {
      priceFeedIds: this.bindings.map((binding) => binding.pythLazerId),
      channel: this.channel,
      formats: [],
      properties: ["price", "exponent", "confidence", "publisherCount", "feedUpdateTimestamp", "marketSession"]
    };
    const timeoutSignal = AbortSignal.timeout(this.timeoutMs);
    const combinedSignal = AbortSignal.any([signal, timeoutSignal]);

    let response: Response;
    try {
      response = await this.fetchImpl(PYTH_PRO_LATEST_PRICE_URL, {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          authorization: "Bearer " + this.apiKey
        },
        body: JSON.stringify(requestBody),
        redirect: "error",
        signal: combinedSignal
      });
    } catch {
      if (timeoutSignal.aborted) throw new PythProAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new PythProAdapterError("UNKNOWN", false);
      throw new PythProAdapterError("NETWORK", true);
    }

    if (!response.ok) {
      if (response.status === 429) throw new PythProAdapterError("RATE_LIMIT", true, 429);
      if (response.status === 408) throw new PythProAdapterError("TIMEOUT", true, 408);
      if (response.status === 401 || response.status === 403) {
        throw new PythProAdapterError("AUTH", false, response.status);
      }
      throw new PythProAdapterError("HTTP", response.status >= 500, response.status);
    }

    let text: string;
    try {
      text = await readBoundedText(response);
    } catch (error) {
      if (error instanceof PythProAdapterError) throw error;
      if (timeoutSignal.aborted) throw new PythProAdapterError("TIMEOUT", true);
      if (signal.aborted) throw new PythProAdapterError("UNKNOWN", false);
      throw new PythProAdapterError("NETWORK", true);
    }

    let payload: unknown;
    try {
      payload = JSON.parse(text) as unknown;
    } catch {
      throw new PythProAdapterError("PARSE", false);
    }

    let rawPayloadSha256: string;
    try {
      rawPayloadSha256 = await sha256Hex(text);
    } catch {
      throw new PythProAdapterError("UNKNOWN", false);
    }
    const retrievedAt = this.now();
    if (!isUtcTimestamp(retrievedAt)) throw new PythProAdapterError("INVALID_CONFIGURATION", false);

    return {
      providerId: PYTH_PRO_PROVIDER_ID,
      adapterVersion: PYTH_PRO_ADAPTER_VERSION,
      channel: this.channel,
      requestedFeeds: this.bindings,
      requestedAt,
      retrievedAt,
      rawPayloadSha256,
      payload,
      synthetic: this.synthetic
    };
  }

  normalize(rawPayload: unknown): PythProNormalizationResult {
    const envelope = normalizeEnvelope(rawPayload);
    if (envelope === null) return { observations: [], errors: ["INVALID_RESPONSE"] };

    const payload = isRecord(envelope.payload) ? envelope.payload : null;
    const parsed = isRecord(payload?.parsed) ? payload.parsed : null;
    if (parsed === null || !Array.isArray(parsed.priceFeeds)) {
      return { observations: [], errors: ["INVALID_RESPONSE"] };
    }

    const updateTimestampUs = parseUnsignedInteger(parsed.timestampUs);
    if (updateTimestampUs === null || microsecondsToIso(updateTimestampUs) === null) {
      return { observations: [], errors: ["TIMESTAMP_INVALID"] };
    }

    const priceFeeds = parsed.priceFeeds.filter(isRecord);
    const observations: PythProUsdPriceObservation[] = [];
    const errors: PythProFailureCode[] = [];

    for (const binding of envelope.requestedFeeds) {
      const matches = priceFeeds.filter((item) => item.priceFeedId === binding.pythLazerId);
      if (matches.length === 0) {
        errors.push("MISSING_FEED");
        continue;
      }
      if (matches.length !== 1) {
        errors.push("DUPLICATE_FEED");
        continue;
      }
      const item = matches[0]!;
      if (item.priceFeedId !== binding.pythLazerId) {
        errors.push("FEED_ID_MISMATCH");
        continue;
      }

      const marketSession = item.marketSession;
      if (typeof marketSession !== "string" ||
          !["regular", "preMarket", "postMarket", "overNight", "closed"].includes(marketSession)) {
        errors.push("INVALID_RESPONSE");
        continue;
      }
      const session = marketSession as PythProMarketSession;
      const sessionMinimum = binding.minPublisherCountBySession?.[session] ?? binding.minPublisherCount;
      const publisherCount = item.publisherCount;
      if (typeof publisherCount !== "number" || !Number.isSafeInteger(publisherCount) || publisherCount < 0) {
        errors.push("PUBLISHER_COUNT_INVALID");
        continue;
      }
      if (publisherCount < sessionMinimum) {
        errors.push("PUBLISHER_QUORUM_UNMET");
        continue;
      }

      const feedUpdateTimestampUs = parseUnsignedInteger(item.feedUpdateTimestamp);
      if (feedUpdateTimestampUs === null) {
        errors.push("FEED_TIMESTAMP_MISSING");
        continue;
      }
      if (feedUpdateTimestampUs !== updateTimestampUs) {
        const feedMs = BigInt(feedUpdateTimestampUs);
        const updateMs = BigInt(updateTimestampUs);
        errors.push(feedMs < updateMs ? "FEED_CARRIED_FORWARD" : "FEED_TIMESTAMP_AHEAD_OF_UPDATE");
        continue;
      }

      const price = parseSignedInteger(item.price);
      const confidence = parseSignedInteger(item.confidence);
      const exponent = item.exponent;
      if (price === null || typeof exponent !== "number" ||
          !Number.isSafeInteger(exponent) || exponent < -30 || exponent > 30 ||
          pythScaledIntegerToDecimal(price, exponent, false) === null) {
        errors.push("PRICE_INVALID");
        continue;
      }
      if (confidence === null ||
          pythScaledIntegerToDecimal(confidence, exponent, true) === null) {
        errors.push("CONFIDENCE_INVALID");
        continue;
      }

      const publishedAt = microsecondsToIso(feedUpdateTimestampUs);
      if (publishedAt === null) {
        errors.push("TIMESTAMP_INVALID");
        continue;
      }

      observations.push({
        schemaVersion: "ata.pyth-pro-reference.v1",
        assetId: binding.assetId,
        feedId: normalizeHexFeedId(binding.hermesFeedId)!,
        feedName: binding.feedName,
        providerId: PYTH_PRO_PROVIDER_ID,
        independenceGroupId: PYTH_PRO_INDEPENDENCE_GROUP_ID,
        priceUsd: pythScaledIntegerToDecimal(price, exponent, false)!,
        confidenceUsd: pythScaledIntegerToDecimal(confidence, exponent, true)!,
        publishedAt,
        retrievedAt: envelope.retrievedAt,
        synthetic: envelope.synthetic,
        pythLazerId: binding.pythLazerId,
        publisherCount,
        minPublisherCount: sessionMinimum,
        feedUpdateTimestampUnixMicros: feedUpdateTimestampUs,
        updateTimestampUnixMicros: updateTimestampUs,
        rawPayloadSha256: envelope.rawPayloadSha256.toLowerCase(),
        requestId: "pyth-pro:" + envelope.retrievedAt + ":" + envelope.rawPayloadSha256.slice(0, 12),
        adapterVersion: PYTH_PRO_ADAPTER_VERSION,
        channel: envelope.channel,
        marketSession
      });
    }

    if (errors.length > 0) return { observations: [], errors: [...new Set(errors)] };
    if (observations.length !== envelope.requestedFeeds.length) {
      return { observations: [], errors: ["INVALID_RESPONSE"] };
    }
    return { observations, errors: [] };
  }

  async fetchLatest(signal?: AbortSignal): Promise<PythProNormalizationResult> {
    const envelope = await this.fetchRaw(signal);
    return this.normalize(envelope);
  }
}
