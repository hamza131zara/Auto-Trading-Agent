/**
 * Provider-neutral Phase 6 contract. This package performs no network calls and
 * has no wallet, signer, execution, or trading authorization capability.
 */

export type SolanaCluster = "mainnet-beta" | "devnet" | "testnet";

export type MarketDataSourceKind =
  | "ON_CHAIN_RPC"
  | "INDEXED_API"
  | "STREAM"
  | "REPLAY_FIXTURE";

export type DataFreshnessState = "FRESH" | "STALE" | "UNKNOWN" | "INVALID";

export type ProviderHealthState =
  | "UNKNOWN"
  | "HEALTHY"
  | "DEGRADED"
  | "UNAVAILABLE"
  | "CIRCUIT_OPEN";

export type MeasureUnit = "TOKEN" | "USD" | "USD_PER_BASE" | "QUOTE_PER_BASE";

export interface DecimalMeasure {
  /** Exact non-negative decimal string; exponent notation is deliberately disallowed. */
  readonly value: string;
  readonly unit: MeasureUnit;
  /** A Solana mint for TOKEN / QUOTE_PER_BASE; null for USD-denominated measures. */
  readonly assetId: string | null;
}

export interface MarketDataProvenance {
  /** Safe provider slug only; never an API key, URL containing credentials, or raw error body. */
  readonly providerId: string;
  readonly sourceKind: MarketDataSourceKind;
  readonly adapterVersion: string;
  readonly schemaVersion: "ata.market-data.v1";
  readonly requestId: string | null;
  readonly sourceEventId: string | null;
  /** Optional lowercase/uppercase SHA-256 digest of the source payload; raw data is not embedded. */
  readonly rawPayloadSha256: string | null;
  readonly synthetic: boolean;
}

export interface CanonicalMarketSnapshot {
  readonly schemaVersion: "ata.market-data.v1";
  readonly observationId: string;
  readonly chain: "solana";
  readonly cluster: SolanaCluster;
  /** The asset being observed and the paired quote asset. */
  readonly baseMint: string;
  readonly quoteMint: string;
  readonly poolAddress: string | null;
  readonly dexProgramAddress: string | null;
  readonly tokenProgramAddress: string | null;
  /** Unit price per one base-token unit; unit explicitly distinguishes quote-token and USD prices. */
  readonly price: DecimalMeasure | null;
  /** Liquidity may be reported in token units or USD; no implicit conversion occurs. */
  readonly liquidity: DecimalMeasure | null;
  /** Volume window is fixed at 24 hours; value/unit must be explicit. */
  readonly volume24h: DecimalMeasure | null;
  readonly buys24h: number | null;
  readonly sells24h: number | null;
  /** Source observation time if available. */
  readonly observedAt: string | null;
  /** Underlying source event time if available, distinct from retrieval time. */
  readonly sourceEventAt: string | null;
  /** Retrieval/receipt time at the local adapter boundary. */
  readonly retrievedAt: string;
  /** Optional Solana slot for source observations that actually provide one. */
  readonly slot: number | null;
  readonly provenance: MarketDataProvenance;
}

export interface ValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export interface FreshnessInput {
  readonly retrievedAt: string;
  readonly observedAt: string | null;
  readonly sourceEventAt: string | null;
  readonly nowAt: string;
  readonly maxAgeMs: number;
  readonly maxFutureSkewMs?: number;
}

export interface FreshnessAssessment {
  readonly state: DataFreshnessState;
  readonly ageMs: number | null;
  readonly maxAgeMs: number;
  readonly reasonCodes: readonly string[];
}

export type ProviderErrorClass =
  | "TIMEOUT"
  | "RATE_LIMIT"
  | "NETWORK"
  | "HTTP"
  | "PARSE"
  | "AUTH"
  | "UNKNOWN";

export interface ProviderHealthSnapshot {
  readonly providerId: string;
  readonly state: ProviderHealthState;
  readonly consecutiveFailures: number;
  readonly lastSuccessAt: string | null;
  readonly lastFailureAt: string | null;
  readonly lastRequestAt: string | null;
  readonly lastLatencyMs: number | null;
  readonly circuitOpenUntil: string | null;
  readonly lastErrorClass: ProviderErrorClass | null;
}

export interface ProviderHealthPolicy {
  readonly failureThreshold: number;
  readonly cooldownMs: number;
}

export type ProviderResult =
  | {
      readonly kind: "SUCCESS";
      readonly at: string;
      readonly latencyMs: number;
    }
  | {
      readonly kind: "FAILURE";
      readonly at: string;
      readonly errorClass: ProviderErrorClass;
      readonly retryable: boolean;
      readonly latencyMs: number | null;
    };

export interface MarketDataRequest {
  readonly cluster: SolanaCluster;
  readonly baseMint: string;
  readonly quoteMint: string;
  readonly poolAddress: string | null;
  readonly requestedAt: string;
}

export interface AdapterNormalizationResult {
  readonly observations: readonly CanonicalMarketSnapshot[];
  /** Stable machine-readable codes only; never expose raw credentials or unbounded response bodies. */
  readonly errors: readonly string[];
}

export interface MarketDataAdapter {
  readonly providerId: string;
  readonly adapterVersion: string;
  readonly sourceKind: Exclude<MarketDataSourceKind, "REPLAY_FIXTURE">;
  /** Provider payload is untrusted and must be parsed/validated in normalize(). */
  fetchRaw(request: MarketDataRequest, signal: AbortSignal): Promise<unknown>;
  normalize(
    rawPayload: unknown,
    context: { readonly requestedAt: string; readonly retrievedAt: string; readonly requestId: string | null }
  ): AdapterNormalizationResult;
}

export interface MarketDataReplayCase {
  readonly caseId: string;
  readonly snapshot: unknown;
  readonly nowAt: string;
  readonly maxAgeMs: number;
  readonly maxFutureSkewMs?: number;
}

export interface MarketDataReplayResult {
  readonly caseId: string;
  readonly validation: ValidationResult;
  readonly freshness: FreshnessAssessment;
}

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_LOOKUP = new Map<string, number>(Array.from(BASE58_ALPHABET, (char, index): [string, number] => [char, index]));
const DECIMAL_PATTERN = /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.[0-9]{1,3})?Z$/;
const PROVIDER_ID_PATTERN = /^[a-z][a-z0-9._-]{0,63}$/;
const VERSION_PATTERN = /^[0-9A-Za-z][0-9A-Za-z.+_-]{0,63}$/;
const REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;
const SOURCE_KINDS = new Set<MarketDataSourceKind>([
  "ON_CHAIN_RPC",
  "INDEXED_API",
  "STREAM",
  "REPLAY_FIXTURE"
]);
const MEASURE_UNITS = new Set<MeasureUnit>(["TOKEN", "USD", "USD_PER_BASE", "QUOTE_PER_BASE"]);
const PROVIDER_ERRORS = new Set<ProviderErrorClass>([
  "TIMEOUT",
  "RATE_LIMIT",
  "NETWORK",
  "HTTP",
  "PARSE",
  "AUTH",
  "UNKNOWN"
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    UTC_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value));
}

function timestampMs(value: string): number {
  return Date.parse(value);
}

function isSafeSlug(value: unknown): value is string {
  return typeof value === "string" && PROVIDER_ID_PATTERN.test(value);
}

function isOptionalId(value: unknown): value is string | null {
  return value === null || (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 128 &&
    REQUEST_ID_PATTERN.test(value)
  );
}

function decodeBase58(value: string): number[] | null {
  const bytes: number[] = [];
  for (const character of value) {
    const digit = BASE58_LOOKUP.get(character);
    if (digit === undefined) return null;
    let carry = digit;
    for (let index = 0; index < bytes.length; index += 1) {
      carry += bytes[index]! * 58;
      bytes[index] = carry % 256;
      carry = Math.floor(carry / 256);
    }
    while (carry > 0) {
      bytes.push(carry % 256);
      carry = Math.floor(carry / 256);
    }
  }
  while (bytes.length > 0 && bytes[bytes.length - 1] === 0) bytes.pop();
  const leadingZeros = value.match(/^1*/)?.[0].length ?? 0;
  return [...Array<number>(leadingZeros).fill(0), ...bytes.reverse()];
}

/** Validates base58 alphabet and 32-byte decoded length; does not prove on-chain existence. */
export function isSolanaPublicKey(value: unknown): value is string {
  if (typeof value !== "string" || value.length < 32 || value.length > 44) return false;
  const decoded = decodeBase58(value);
  return decoded !== null && decoded.length === 32;
}

function validateTimestamp(value: unknown, path: string, allowNull: boolean, errors: string[]): void {
  if (allowNull && value === null) return;
  if (!isUtcTimestamp(value)) errors.push(path + ": expected ISO-8601 UTC timestamp ending in Z");
}

function validateAddress(value: unknown, path: string, allowNull: boolean, errors: string[]): void {
  if (allowNull && value === null) return;
  if (!isSolanaPublicKey(value)) errors.push(path + ": expected a base58-encoded 32-byte Solana public key");
}

function validateMeasure(
  value: unknown,
  path: string,
  allowedUnits: readonly MeasureUnit[],
  expectedQuoteMint: string,
  errors: string[]
): void {
  if (value === null) return;
  if (!isRecord(value)) {
    errors.push(path + ": expected object or null");
    return;
  }
  if (typeof value.value !== "string" || !DECIMAL_PATTERN.test(value.value)) {
    errors.push(path + ".value: expected non-negative decimal string without exponent notation");
  }
  if (typeof value.unit !== "string" || !MEASURE_UNITS.has(value.unit as MeasureUnit) ||
      !allowedUnits.includes(value.unit as MeasureUnit)) {
    errors.push(path + ".unit: unsupported unit for this measure");
    return;
  }
  if (value.unit === "USD" || value.unit === "USD_PER_BASE") {
    if (value.assetId !== null) errors.push(path + ".assetId: USD measures must use null assetId");
    return;
  }
  if (value.unit === "QUOTE_PER_BASE") {
    if (value.assetId !== expectedQuoteMint) errors.push(path + ".assetId: price assetId must equal quoteMint");
    return;
  }
  if (!isSolanaPublicKey(value.assetId)) {
    errors.push(path + ".assetId: TOKEN measures must identify a valid Solana mint");
  }
}

/** Validates shape, address encoding, units and scalar bounds only; no RPC or authenticity check is performed. */
export function validateCanonicalMarketSnapshot(input: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(input)) return { valid: false, errors: ["snapshot: expected object"] };

  if (input.schemaVersion !== "ata.market-data.v1") errors.push("schemaVersion: unsupported schema version");
  if (input.chain !== "solana") errors.push("chain: only solana is supported");
  if (input.cluster !== "mainnet-beta" && input.cluster !== "devnet" && input.cluster !== "testnet") {
    errors.push("cluster: unsupported Solana cluster");
  }
  if (typeof input.observationId !== "string" || input.observationId.length < 1 || input.observationId.length > 128) {
    errors.push("observationId: expected non-empty ID up to 128 characters");
  }
  validateAddress(input.baseMint, "baseMint", false, errors);
  validateAddress(input.quoteMint, "quoteMint", false, errors);
  if (input.baseMint === input.quoteMint && typeof input.baseMint === "string") {
    errors.push("quoteMint: baseMint and quoteMint must differ");
  }
  validateAddress(input.poolAddress, "poolAddress", true, errors);
  validateAddress(input.dexProgramAddress, "dexProgramAddress", true, errors);
  validateAddress(input.tokenProgramAddress, "tokenProgramAddress", true, errors);

  validateMeasure(input.price, "price", ["QUOTE_PER_BASE", "USD_PER_BASE"], typeof input.quoteMint === "string" ? input.quoteMint : "", errors);
  validateMeasure(input.liquidity, "liquidity", ["TOKEN", "USD"], typeof input.quoteMint === "string" ? input.quoteMint : "", errors);
  validateMeasure(input.volume24h, "volume24h", ["TOKEN", "USD"], typeof input.quoteMint === "string" ? input.quoteMint : "", errors);

  for (const field of ["buys24h", "sells24h"] as const) {
    const count = input[field];
    if (count !== null && (!Number.isSafeInteger(count) || (count as number) < 0)) {
      errors.push(field + ": expected non-negative safe integer or null");
    }
  }
  if (input.slot !== null && (!Number.isSafeInteger(input.slot) || (input.slot as number) < 0)) {
    errors.push("slot: expected non-negative safe integer or null");
  }
  validateTimestamp(input.observedAt, "observedAt", true, errors);
  validateTimestamp(input.sourceEventAt, "sourceEventAt", true, errors);
  validateTimestamp(input.retrievedAt, "retrievedAt", false, errors);

  if (!isRecord(input.provenance)) {
    errors.push("provenance: expected object");
  } else {
    const provenance = input.provenance;
    if (!isSafeSlug(provenance.providerId)) errors.push("provenance.providerId: expected safe provider slug");
    if (typeof provenance.sourceKind !== "string" || !SOURCE_KINDS.has(provenance.sourceKind as MarketDataSourceKind)) {
      errors.push("provenance.sourceKind: unsupported source kind");
    }
    if (typeof provenance.adapterVersion !== "string" || !VERSION_PATTERN.test(provenance.adapterVersion)) {
      errors.push("provenance.adapterVersion: expected safe version string");
    }
    if (provenance.schemaVersion !== "ata.market-data.v1") errors.push("provenance.schemaVersion: version mismatch");
    if (!isOptionalId(provenance.requestId)) errors.push("provenance.requestId: expected safe request ID or null");
    if (!isOptionalId(provenance.sourceEventId)) errors.push("provenance.sourceEventId: expected safe event ID or null");
    if (provenance.rawPayloadSha256 !== null &&
        (typeof provenance.rawPayloadSha256 !== "string" || !/^[a-fA-F0-9]{64}$/.test(provenance.rawPayloadSha256))) {
      errors.push("provenance.rawPayloadSha256: expected SHA-256 hex digest or null");
    }
    if (typeof provenance.synthetic !== "boolean") errors.push("provenance.synthetic: expected boolean");
    if (provenance.sourceKind === "REPLAY_FIXTURE" && provenance.synthetic !== true) {
      errors.push("provenance.synthetic: replay fixtures must be explicitly marked synthetic");
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Pure freshness assessment. A recent retrieval cannot make an unknown source timestamp FRESH. */
export function assessFreshness(input: FreshnessInput): FreshnessAssessment {
  const maxAgeMs = input.maxAgeMs;
  const maxFutureSkewMs = input.maxFutureSkewMs ?? 0;
  const invalid = (reason: string): FreshnessAssessment => ({
    state: "INVALID",
    ageMs: null,
    maxAgeMs,
    reasonCodes: [reason]
  });

  if (!Number.isFinite(maxAgeMs) || maxAgeMs < 0 ||
      !Number.isFinite(maxFutureSkewMs) || maxFutureSkewMs < 0) {
    return invalid("INVALID_FRESHNESS_POLICY");
  }
  if (!isUtcTimestamp(input.nowAt)) return invalid("INVALID_CLOCK_TIMESTAMP");
  if (!isUtcTimestamp(input.retrievedAt)) return invalid("INVALID_RETRIEVAL_TIMESTAMP");
  if (input.observedAt !== null && !isUtcTimestamp(input.observedAt)) {
    return invalid("INVALID_OBSERVATION_TIMESTAMP");
  }
  if (input.sourceEventAt !== null && !isUtcTimestamp(input.sourceEventAt)) {
    return invalid("INVALID_SOURCE_EVENT_TIMESTAMP");
  }

  const now = timestampMs(input.nowAt);
  const retrievedAt = timestampMs(input.retrievedAt);
  const sourceTimestampText = input.sourceEventAt ?? input.observedAt;
  const sourceTimestamp = sourceTimestampText === null ? null : timestampMs(sourceTimestampText);

  if (retrievedAt > now + maxFutureSkewMs) return invalid("RETRIEVAL_TIMESTAMP_IN_FUTURE");
  if (sourceTimestamp !== null && sourceTimestamp > now + maxFutureSkewMs) {
    return invalid("SOURCE_TIMESTAMP_IN_FUTURE");
  }

  const retrievalAgeMs = Math.max(0, now - retrievedAt);
  const ageMs = sourceTimestamp === null ? retrievalAgeMs : Math.max(0, now - sourceTimestamp);

  if (retrievalAgeMs > maxAgeMs) {
    return { state: "STALE", ageMs, maxAgeMs, reasonCodes: ["RETRIEVAL_EXCEEDS_MAX_AGE"] };
  }
  if (sourceTimestamp === null) {
    return { state: "UNKNOWN", ageMs, maxAgeMs, reasonCodes: ["SOURCE_TIMESTAMP_MISSING"] };
  }
  if (ageMs > maxAgeMs) {
    return { state: "STALE", ageMs, maxAgeMs, reasonCodes: ["SOURCE_EXCEEDS_MAX_AGE"] };
  }
  return { state: "FRESH", ageMs, maxAgeMs, reasonCodes: ["SOURCE_WITHIN_MAX_AGE"] };
}

function assertSafeProviderId(providerId: string): void {
  if (!isSafeSlug(providerId)) throw new TypeError("providerId must be a safe lowercase slug");
}

function assertUtcTimestamp(at: string): void {
  if (!isUtcTimestamp(at)) throw new TypeError("timestamp must be ISO-8601 UTC ending in Z");
}

function assertHealthPolicy(policy: ProviderHealthPolicy): void {
  if (!Number.isSafeInteger(policy.failureThreshold) || policy.failureThreshold < 1) {
    throw new RangeError("failureThreshold must be a positive safe integer");
  }
  if (!Number.isSafeInteger(policy.cooldownMs) || policy.cooldownMs < 1) {
    throw new RangeError("cooldownMs must be a positive safe integer");
  }
}

export function initialProviderHealth(providerId: string): ProviderHealthSnapshot {
  assertSafeProviderId(providerId);
  return {
    providerId,
    state: "UNKNOWN",
    consecutiveFailures: 0,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastRequestAt: null,
    lastLatencyMs: null,
    circuitOpenUntil: null,
    lastErrorClass: null
  };
}

/** Deterministic reducer. Failure text/details are deliberately not part of this contract. */
export function recordProviderResult(
  previous: ProviderHealthSnapshot,
  result: ProviderResult,
  policy: ProviderHealthPolicy
): ProviderHealthSnapshot {
  assertSafeProviderId(previous.providerId);
  assertHealthPolicy(policy);
  assertUtcTimestamp(result.at);

  if (result.kind === "SUCCESS") {
    if (!Number.isFinite(result.latencyMs) || result.latencyMs < 0) {
      throw new RangeError("latencyMs must be a finite non-negative number");
    }
    return {
      providerId: previous.providerId,
      state: "HEALTHY",
      consecutiveFailures: 0,
      lastSuccessAt: result.at,
      lastFailureAt: previous.lastFailureAt,
      lastRequestAt: result.at,
      lastLatencyMs: result.latencyMs,
      circuitOpenUntil: null,
      lastErrorClass: null
    };
  }

  if (!PROVIDER_ERRORS.has(result.errorClass)) throw new TypeError("unsupported provider error class");
  if (result.latencyMs !== null && (!Number.isFinite(result.latencyMs) || result.latencyMs < 0)) {
    throw new RangeError("latencyMs must be null or a finite non-negative number");
  }
  if (typeof result.retryable !== "boolean") throw new TypeError("retryable must be boolean");

  const consecutiveFailures = previous.consecutiveFailures + 1;
  const unavailable = result.errorClass === "AUTH" || !result.retryable;
  const circuitOpen = !unavailable && consecutiveFailures >= policy.failureThreshold;
  const state: ProviderHealthState = unavailable
    ? "UNAVAILABLE"
    : circuitOpen
      ? "CIRCUIT_OPEN"
      : "DEGRADED";
  const circuitOpenUntil = circuitOpen
    ? new Date(timestampMs(result.at) + policy.cooldownMs).toISOString()
    : null;

  return {
    providerId: previous.providerId,
    state,
    consecutiveFailures,
    lastSuccessAt: previous.lastSuccessAt,
    lastFailureAt: result.at,
    lastRequestAt: result.at,
    lastLatencyMs: result.latencyMs,
    circuitOpenUntil,
    lastErrorClass: result.errorClass
  };
}

/** Deterministic replay helper used by fixture tests; it never accesses a provider or system clock. */
export function replayMarketDataCases(cases: readonly MarketDataReplayCase[]): readonly MarketDataReplayResult[] {
  return cases.map((replayCase) => {
    const validation = validateCanonicalMarketSnapshot(replayCase.snapshot);
    if (!validation.valid || !isRecord(replayCase.snapshot)) {
      return {
        caseId: replayCase.caseId,
        validation,
        freshness: {
          state: "INVALID",
          ageMs: null,
          maxAgeMs: replayCase.maxAgeMs,
          reasonCodes: ["OBSERVATION_INVALID"]
        }
      };
    }
    const snapshot = replayCase.snapshot as unknown as CanonicalMarketSnapshot;
    const freshnessInput: FreshnessInput = {
      retrievedAt: snapshot.retrievedAt,
      observedAt: snapshot.observedAt,
      sourceEventAt: snapshot.sourceEventAt,
      nowAt: replayCase.nowAt,
      maxAgeMs: replayCase.maxAgeMs,
      ...(replayCase.maxFutureSkewMs === undefined ? {} : { maxFutureSkewMs: replayCase.maxFutureSkewMs })
    };
    return {
      caseId: replayCase.caseId,
      validation,
      freshness: assessFreshness(freshnessInput)
    };
  });
}
