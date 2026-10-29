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

/** A single timestamped asset/USD observation from an explicitly approved reference provider. */
export interface IndependentUsdPriceObservation {
  readonly assetId: string;
  readonly feedId: string;
  readonly providerId: string;
  readonly independenceGroupId: string;
  readonly priceUsd: string;
  readonly publishedAt: string;
  readonly retrievedAt: string;
  readonly synthetic: boolean;
}

/** Deliberately has no defaults: owner-approved freshness, feed identity and tolerance are mandatory. */
export interface IndependentReservePriceComparisonPolicy {
  readonly nowAt: string;
  readonly maxSourceAgeMs: number;
  readonly maxRetrievalAgeMs: number;
  readonly maxReferenceTimestampSkewMs: number;
  readonly maxFutureSkewMs: number;
  readonly maxDeviationBps: number;
  readonly approvedProviderId: string;
  readonly approvedIndependenceGroupId: string;
  readonly expectedBaseFeedId: string;
  readonly expectedQuoteFeedId: string;
  /** Optional owner-approved indexed source for candle/observation timestamps; both fields are required together. */
  readonly approvedIndexedProviderId?: string;
  readonly approvedIndexedIndependenceGroupId?: string;
  /** Test-only bypass for fixture arithmetic; never makes synthetic results operationally eligible. */
  readonly allowSyntheticForTests?: boolean;
}

export type IndependentPriceComparisonStatus =
  | "AGREED"
  | "DISAGREEMENT"
  | "INSUFFICIENT_EVIDENCE"
  | "INVALID_INPUT"
  | "NOT_ASSESSED";

export interface IndependentReservePriceComparisonInput {
  readonly baseMint: string;
  readonly quoteMint: string;
  readonly reserveRatioQuotePerBase: string;
  readonly indexedPriceUsdPerBase: string | null;
  readonly indexedProviderId: string;
  readonly indexedIndependenceGroupId: string;
  readonly indexedSourceEventAt: string | null;
  /** Conservative observation time such as an OHLCV candle start; never relabel as a transaction event. */
  readonly indexedSourceObservedAt?: string | null;
  readonly indexedRetrievedAt: string;
  readonly indexedSynthetic: boolean;
  readonly baseUsd: IndependentUsdPriceObservation;
  readonly quoteUsd: IndependentUsdPriceObservation;
  readonly policy: IndependentReservePriceComparisonPolicy;
}

export interface IndependentReservePriceComparisonResult {
  readonly status: IndependentPriceComparisonStatus;
  readonly reasonCodes: readonly string[];
  readonly reserveComparison: {
    readonly status: IndependentPriceComparisonStatus;
    readonly deviationBpsRounded: string | null;
    readonly toleranceBps: number;
  };
  readonly indexedPriceComparison: {
    readonly status: IndependentPriceComparisonStatus;
    readonly deviationBpsRounded: string | null;
    readonly toleranceBps: number;
  };
  readonly indexedSourceTimestampKind: "EVENT" | "OBSERVATION" | "MISSING";
  readonly referenceProviderId: string;
  readonly referenceIndependenceGroupId: string;
  readonly baseFeedId: string;
  readonly quoteFeedId: string;
  readonly sourceFreshness: "FRESH" | "STALE" | "UNKNOWN" | "INVALID";
  readonly maxReferenceTimestampSkewMs: number;
  readonly referenceTimestampSkewMs: number | null;
  readonly comparisonEvidenceComplete: boolean;
  /** This comparator only assesses evidence quality; it never authorizes a trade. */
  readonly tradingAuthorized: false;
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

export type ProviderAttemptPermissionStatus =
  | "ALLOW_INITIAL_REQUEST"
  | "ALLOW_REQUEST"
  | "ALLOW_RETRY"
  | "ALLOW_HEALTH_RECHECK"
  | "ALLOW_RECOVERY_PROBE"
  | "BLOCK_CIRCUIT_OPEN"
  | "BLOCK_RECOVERY_PROBE_IN_FLIGHT"
  | "BLOCK_UNAVAILABLE"
  | "INVALID_INPUT";

export interface ProviderAttemptPermissionAssessment {
  readonly status: ProviderAttemptPermissionStatus;
  readonly providerId: string | null;
  readonly providerState: ProviderHealthState | null;
  readonly reasonCodes: readonly string[];
  readonly canAttempt: boolean;
  /** Caller must atomically claim/serialize this one probe per provider before issuing it. */
  readonly requiresExclusiveProbe: boolean;
  readonly tradingAuthorized: false;
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

type ExactPriceDecimal = { readonly coefficient: bigint; readonly scale: number };

function parseExactPriceDecimal(value: unknown): ExactPriceDecimal | null {
  if (typeof value !== "string" || value.length > 128 || !DECIMAL_PATTERN.test(value)) return null;
  const [integerPart, fractionPart = ""] = value.split(".");
  if (fractionPart.length > 36) return null;
  try {
    return { coefficient: BigInt(integerPart + fractionPart), scale: fractionPart.length };
  } catch {
    return null;
  }
}

function powerOfTen(exponent: number): bigint {
  return 10n ** BigInt(exponent);
}

function absoluteBigInt(value: bigint): bigint {
  return value < 0n ? -value : value;
}

function alignedPriceDecimals(
  left: ExactPriceDecimal,
  right: ExactPriceDecimal
): readonly [bigint, bigint] {
  const scale = Math.max(left.scale, right.scale);
  return [
    left.coefficient * powerOfTen(scale - left.scale),
    right.coefficient * powerOfTen(scale - right.scale)
  ];
}

function comparePriceDeviationBps(
  observed: ExactPriceDecimal,
  reference: ExactPriceDecimal,
  toleranceBps: number
): { readonly status: "AGREED" | "DISAGREEMENT"; readonly deviationBpsRounded: string } {
  const [observedUnits, referenceUnits] = alignedPriceDecimals(observed, reference);
  const delta = absoluteBigInt(observedUnits - referenceUnits);
  const deviationBpsRounded = ((delta * 10_000n + referenceUnits / 2n) / referenceUnits).toString();
  return {
    status: delta * 10_000n <= referenceUnits * BigInt(toleranceBps) ? "AGREED" : "DISAGREEMENT",
    deviationBpsRounded
  };
}

/** Compares reserve*quoteUSD against baseUSD without floating-point division or rounded intermediate prices. */
function compareReserveRatioDeviationBps(
  reserveRatio: ExactPriceDecimal,
  baseUsd: ExactPriceDecimal,
  quoteUsd: ExactPriceDecimal,
  toleranceBps: number
): { readonly status: "AGREED" | "DISAGREEMENT"; readonly deviationBpsRounded: string } {
  const observedNumerator = reserveRatio.coefficient * quoteUsd.coefficient;
  const observedScale = reserveRatio.scale + quoteUsd.scale;
  const referenceNumerator = baseUsd.coefficient;
  const referenceScale = baseUsd.scale;
  const commonScale = Math.max(observedScale, referenceScale);
  const observedUnits = observedNumerator * powerOfTen(commonScale - observedScale);
  const referenceUnits = referenceNumerator * powerOfTen(commonScale - referenceScale);
  const delta = absoluteBigInt(observedUnits - referenceUnits);
  const deviationBpsRounded = ((delta * 10_000n + referenceUnits / 2n) / referenceUnits).toString();
  return {
    status: delta * 10_000n <= referenceUnits * BigInt(toleranceBps) ? "AGREED" : "DISAGREEMENT",
    deviationBpsRounded
  };
}

function validComparisonPolicy(policy: IndependentReservePriceComparisonPolicy): boolean {
  return isRecord(policy) &&
    isUtcTimestamp(policy.nowAt) &&
    Number.isSafeInteger(policy.maxSourceAgeMs) && policy.maxSourceAgeMs > 0 &&
    Number.isSafeInteger(policy.maxRetrievalAgeMs) && policy.maxRetrievalAgeMs > 0 &&
    Number.isSafeInteger(policy.maxReferenceTimestampSkewMs) &&
    policy.maxReferenceTimestampSkewMs >= 0 && policy.maxReferenceTimestampSkewMs <= 300_000 &&
    Number.isSafeInteger(policy.maxFutureSkewMs) && policy.maxFutureSkewMs >= 0 &&
    Number.isSafeInteger(policy.maxDeviationBps) &&
    policy.maxDeviationBps >= 0 && policy.maxDeviationBps <= 10_000 &&
    isSafeSlug(policy.approvedProviderId) &&
    isSafeSlug(policy.approvedIndependenceGroupId) &&
    typeof policy.expectedBaseFeedId === "string" &&
    REQUEST_ID_PATTERN.test(policy.expectedBaseFeedId) &&
    typeof policy.expectedQuoteFeedId === "string" &&
    REQUEST_ID_PATTERN.test(policy.expectedQuoteFeedId) &&
    policy.expectedBaseFeedId !== policy.expectedQuoteFeedId &&
    ((policy.approvedIndexedProviderId === undefined && policy.approvedIndexedIndependenceGroupId === undefined) ||
      (typeof policy.approvedIndexedProviderId === "string" &&
       isSafeSlug(policy.approvedIndexedProviderId) &&
       typeof policy.approvedIndexedIndependenceGroupId === "string" &&
       isSafeSlug(policy.approvedIndexedIndependenceGroupId))) &&
    (policy.allowSyntheticForTests === undefined || typeof policy.allowSyntheticForTests === "boolean");
}

function validateReferencePriceObservation(
  observation: IndependentUsdPriceObservation,
  expectedAssetId: string,
  expectedFeedId: string,
  policy: IndependentReservePriceComparisonPolicy
): readonly string[] {
  const errors: string[] = [];
  if (!isRecord(observation) ||
      typeof observation.assetId !== "string" ||
      !isSolanaPublicKey(observation.assetId) ||
      typeof observation.feedId !== "string" ||
      !REQUEST_ID_PATTERN.test(observation.feedId) ||
      !isSafeSlug(observation.providerId) ||
      !isSafeSlug(observation.independenceGroupId) ||
      typeof observation.priceUsd !== "string" ||
      parseExactPriceDecimal(observation.priceUsd) === null ||
      (parseExactPriceDecimal(observation.priceUsd)?.coefficient ?? 0n) <= 0n ||
      !isUtcTimestamp(observation.publishedAt) ||
      !isUtcTimestamp(observation.retrievedAt) ||
      typeof observation.synthetic !== "boolean") {
    errors.push("REFERENCE_OBSERVATION_INVALID");
    return errors;
  }
  if (observation.assetId !== expectedAssetId || observation.feedId !== expectedFeedId) {
    errors.push("REFERENCE_FEED_IDENTITY_MISMATCH");
  }
  if (observation.providerId !== policy.approvedProviderId ||
      observation.independenceGroupId !== policy.approvedIndependenceGroupId) {
    errors.push("REFERENCE_PROVIDER_NOT_APPROVED_BY_POLICY");
  }
  const nowMs = timestampMs(policy.nowAt);
  const publishedMs = timestampMs(observation.publishedAt);
  const retrievedMs = timestampMs(observation.retrievedAt);
  if (publishedMs > nowMs + policy.maxFutureSkewMs || retrievedMs > nowMs + policy.maxFutureSkewMs) {
    errors.push("REFERENCE_TIMESTAMP_IN_FUTURE");
  } else {
    if (Math.max(0, nowMs - publishedMs) > policy.maxSourceAgeMs) errors.push("REFERENCE_SOURCE_STALE");
    if (Math.max(0, nowMs - retrievedMs) > policy.maxRetrievalAgeMs) errors.push("REFERENCE_RETRIEVAL_STALE");
  }
  return errors;
}

/**
 * Provider-neutral, fail-closed comparison of an on-chain quote/base reserve ratio
 * against separately timestamped base/USD and quote/USD observations. It also compares
 * the indexed USD/base price only when that source has a trustworthy event timestamp.
 * All tolerances, feed IDs, source identity and freshness bounds are explicit inputs.
 */
export function assessIndependentReservePriceAgreement(
  input: IndependentReservePriceComparisonInput
): IndependentReservePriceComparisonResult {
  const result = (
    status: IndependentPriceComparisonStatus,
    reasonCodes: readonly string[],
    reserveStatus: IndependentPriceComparisonStatus = status,
    indexedStatus: IndependentPriceComparisonStatus = status,
    reserveDeviationBpsRounded: string | null = null,
    indexedDeviationBpsRounded: string | null = null,
    freshness: "FRESH" | "STALE" | "UNKNOWN" | "INVALID" = "UNKNOWN",
    evidenceComplete = false,
    referenceTimestampSkewMs: number | null = null
  ): IndependentReservePriceComparisonResult => ({
    status,
    reasonCodes: [...new Set(reasonCodes)],
    reserveComparison: {
      status: reserveStatus,
      deviationBpsRounded: reserveDeviationBpsRounded,
      toleranceBps: input?.policy?.maxDeviationBps ?? -1
    },
    indexedPriceComparison: {
      status: indexedStatus,
      deviationBpsRounded: indexedDeviationBpsRounded,
      toleranceBps: input?.policy?.maxDeviationBps ?? -1
    },
    referenceProviderId: input?.policy?.approvedProviderId ?? "",
    referenceIndependenceGroupId: input?.policy?.approvedIndependenceGroupId ?? "",
    baseFeedId: input?.policy?.expectedBaseFeedId ?? "",
    quoteFeedId: input?.policy?.expectedQuoteFeedId ?? "",
    indexedSourceTimestampKind:
      input?.indexedSourceEventAt !== null && input?.indexedSourceEventAt !== undefined
        ? "EVENT"
        : input?.indexedSourceObservedAt !== null && input?.indexedSourceObservedAt !== undefined
          ? "OBSERVATION"
          : "MISSING",
    sourceFreshness: freshness,
    maxReferenceTimestampSkewMs: input?.policy?.maxReferenceTimestampSkewMs ?? -1,
    referenceTimestampSkewMs,
    comparisonEvidenceComplete: evidenceComplete,
    tradingAuthorized: false
  });

  if (!isRecord(input) ||
      !validComparisonPolicy(input.policy) ||
      !isSolanaPublicKey(input.baseMint) ||
      !isSolanaPublicKey(input.quoteMint) ||
      input.baseMint === input.quoteMint ||
      typeof input.indexedProviderId !== "string" ||
      !isSafeSlug(input.indexedProviderId) ||
      typeof input.indexedIndependenceGroupId !== "string" ||
      !isSafeSlug(input.indexedIndependenceGroupId) ||
      typeof input.indexedRetrievedAt !== "string" ||
      !isUtcTimestamp(input.indexedRetrievedAt) ||
      (input.indexedSourceEventAt !== null && !isUtcTimestamp(input.indexedSourceEventAt)) ||
      (input.indexedSourceObservedAt !== undefined &&
       input.indexedSourceObservedAt !== null &&
       !isUtcTimestamp(input.indexedSourceObservedAt)) ||
      (input.indexedPriceUsdPerBase !== null &&
        (parseExactPriceDecimal(input.indexedPriceUsdPerBase) === null ||
         (parseExactPriceDecimal(input.indexedPriceUsdPerBase)?.coefficient ?? 0n) <= 0n)) ||
      typeof input.indexedSynthetic !== "boolean") {
    return result("INVALID_INPUT", ["INDEPENDENT_COMPARISON_INPUT_INVALID"], "INVALID_INPUT", "INVALID_INPUT", null, null, "INVALID", false);
  }

  const reserveRatio = parseExactPriceDecimal(input.reserveRatioQuotePerBase);
  if (reserveRatio === null || reserveRatio.coefficient <= 0n) {
    return result("INVALID_INPUT", ["RESERVE_RATIO_INVALID"], "INVALID_INPUT", "INVALID_INPUT", null, null, "INVALID", false);
  }

  if (input.policy.approvedProviderId === input.indexedProviderId ||
      input.policy.approvedIndependenceGroupId === input.indexedIndependenceGroupId) {
    return result("INSUFFICIENT_EVIDENCE", ["REFERENCE_SOURCE_NOT_INDEPENDENT"], "INSUFFICIENT_EVIDENCE", "INSUFFICIENT_EVIDENCE");
  }

  const baseErrors = validateReferencePriceObservation(
    input.baseUsd, input.baseMint, input.policy.expectedBaseFeedId, input.policy
  );
  const quoteErrors = validateReferencePriceObservation(
    input.quoteUsd, input.quoteMint, input.policy.expectedQuoteFeedId, input.policy
  );
  const referenceErrors = [...baseErrors, ...quoteErrors];
  if (referenceErrors.includes("REFERENCE_OBSERVATION_INVALID")) {
    return result("INVALID_INPUT", referenceErrors, "INVALID_INPUT", "INVALID_INPUT", null, null, "INVALID", false);
  }
  if (referenceErrors.includes("REFERENCE_TIMESTAMP_IN_FUTURE")) {
    return result("INVALID_INPUT", referenceErrors, "INVALID_INPUT", "INVALID_INPUT", null, null, "INVALID", false);
  }
  if (referenceErrors.length > 0) {
    const stale = referenceErrors.some(code => code === "REFERENCE_SOURCE_STALE" || code === "REFERENCE_RETRIEVAL_STALE");
    return result("INSUFFICIENT_EVIDENCE", referenceErrors, "INSUFFICIENT_EVIDENCE", "INSUFFICIENT_EVIDENCE", null, null, stale ? "STALE" : "UNKNOWN", false);
  }

  const referenceTimestampSkewMs = Math.abs(
    timestampMs(input.baseUsd.publishedAt) - timestampMs(input.quoteUsd.publishedAt)
  );
  if (referenceTimestampSkewMs > input.policy.maxReferenceTimestampSkewMs) {
    return result(
      "INSUFFICIENT_EVIDENCE",
      ["REFERENCE_SOURCE_TIMES_UNALIGNED"],
      "INSUFFICIENT_EVIDENCE",
      "INSUFFICIENT_EVIDENCE",
      null,
      null,
      "FRESH",
      false,
      referenceTimestampSkewMs
    );
  }

  const hasSyntheticReference = input.baseUsd.synthetic || input.quoteUsd.synthetic || input.indexedSynthetic;
  if (hasSyntheticReference && input.policy.allowSyntheticForTests !== true) {
    return result("INSUFFICIENT_EVIDENCE", ["SYNTHETIC_OBSERVATION_NOT_ELIGIBLE"], "INSUFFICIENT_EVIDENCE", "INSUFFICIENT_EVIDENCE", null, null, "FRESH", false);
  }

  const baseUsd = parseExactPriceDecimal(input.baseUsd.priceUsd)!;
  const quoteUsd = parseExactPriceDecimal(input.quoteUsd.priceUsd)!;
  const reserveComparison = compareReserveRatioDeviationBps(
    reserveRatio,
    baseUsd,
    quoteUsd,
    input.policy.maxDeviationBps
  );

  let indexedStatus: IndependentPriceComparisonStatus = "NOT_ASSESSED";
  let indexedDeviation: string | null = null;
  const reasonCodes: string[] = [];
  const indexedSourceTimestamp = input.indexedSourceEventAt ?? input.indexedSourceObservedAt ?? null;
  const usesObservationTimestamp =
    input.indexedSourceEventAt === null && input.indexedSourceObservedAt !== undefined &&
    input.indexedSourceObservedAt !== null;

  if (indexedSourceTimestamp === null) {
    reasonCodes.push("INDEXED_SOURCE_TIMESTAMP_MISSING");
  } else if (usesObservationTimestamp &&
      (input.policy.approvedIndexedProviderId !== input.indexedProviderId ||
       input.policy.approvedIndexedIndependenceGroupId !== input.indexedIndependenceGroupId)) {
    indexedStatus = "INSUFFICIENT_EVIDENCE";
    reasonCodes.push("INDEXED_PROVIDER_OBSERVATION_NOT_APPROVED");
  } else {
    const nowMs = timestampMs(input.policy.nowAt);
    const sourceMs = timestampMs(indexedSourceTimestamp);
    const retrievalMs = timestampMs(input.indexedRetrievedAt);
    if (sourceMs > nowMs + input.policy.maxFutureSkewMs || retrievalMs > nowMs + input.policy.maxFutureSkewMs) {
      indexedStatus = "INVALID_INPUT";
      reasonCodes.push("INDEXED_SOURCE_TIMESTAMP_IN_FUTURE");
    } else if (Math.max(0, nowMs - sourceMs) > input.policy.maxSourceAgeMs ||
               Math.max(0, nowMs - retrievalMs) > input.policy.maxRetrievalAgeMs) {
      indexedStatus = "INSUFFICIENT_EVIDENCE";
      reasonCodes.push("INDEXED_SOURCE_STALE");
    } else if (input.indexedPriceUsdPerBase === null) {
      indexedStatus = "INSUFFICIENT_EVIDENCE";
      reasonCodes.push("INDEXED_PRICE_MISSING");
    } else {
      const indexedPrice = parseExactPriceDecimal(input.indexedPriceUsdPerBase)!;
      const comparison = comparePriceDeviationBps(
        indexedPrice,
        baseUsd,
        input.policy.maxDeviationBps
      );
      indexedStatus = comparison.status;
      indexedDeviation = comparison.deviationBpsRounded;
      if (comparison.status === "DISAGREEMENT") reasonCodes.push("INDEXED_PRICE_OUTSIDE_TOLERANCE");
    }
  }

  const reserveStatus: IndependentPriceComparisonStatus = reserveComparison.status;
  if (reserveStatus === "DISAGREEMENT") reasonCodes.push("RESERVE_RATIO_OUTSIDE_TOLERANCE");
  const status: IndependentPriceComparisonStatus =
    reserveStatus === "DISAGREEMENT" || indexedStatus === "DISAGREEMENT"
      ? "DISAGREEMENT"
      : indexedStatus === "INVALID_INPUT"
        ? "INVALID_INPUT"
        : reserveStatus === "AGREED" && indexedStatus === "AGREED"
          ? "AGREED"
          : "INSUFFICIENT_EVIDENCE";
  const evidenceComplete = status === "AGREED" && !hasSyntheticReference;
  return result(
    status,
    reasonCodes,
    reserveStatus,
    indexedStatus,
    reserveComparison.deviationBpsRounded,
    indexedDeviation,
    "FRESH",
    evidenceComplete,
    referenceTimestampSkewMs
  );
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
  if (!isValidProviderHealthEvidence(previous, previous.providerId)) {
    throw new TypeError("previous must be a valid provider health snapshot");
  }
  if (previous.lastRequestAt !== null &&
      timestampMs(result.at) < timestampMs(previous.lastRequestAt)) {
    throw new RangeError("result.at must not precede previous lastRequestAt");
  }

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


/**
 * A provider attempt presented to the deterministic Phase 6 evidence gate.
 * Priority 0 is the preferred source; larger priorities are fallbacks.
 */
export interface ProviderEvidenceCandidate {
  readonly providerId: string;
  /** Upstream vendor/source family; aliases of the same upstream must share a group. */
  readonly independenceGroupId: string;
  readonly priority: number;
  readonly health: ProviderHealthSnapshot;
  readonly snapshot: unknown | null;
}

export interface ProviderAgreementPolicy {
  /** Injected evaluation clock; this function never reads the system clock. */
  readonly nowAt: string;
  /** Maximum age for canonical source observations. */
  readonly maxAgeMs: number;
  /** Separate explicit bound for the provider-health snapshot itself. */
  readonly maxHealthAgeMs: number;
  readonly maxFutureSkewMs?: number;
  /** Explicitly enables synthetic fixtures for tests; it never enables downstream use. */
  readonly allowSyntheticFixtures?: boolean;
}

export type ProviderAgreementStatus =
  | "AGREED"
  | "DISAGREEMENT"
  | "INSUFFICIENT_EVIDENCE"
  | "NO_ACCEPTABLE_PROVIDER"
  | "INVALID_INPUT";

export interface RejectedProviderEvidence {
  readonly providerId: string;
  readonly reasonCodes: readonly string[];
}

export interface ProviderAgreementAssessment {
  readonly status: ProviderAgreementStatus;
  /** Eligible independent providers in stable priority order. */
  readonly eligibleProviderIds: readonly string[];
  readonly rejectedProviders: readonly RejectedProviderEvidence[];
  readonly disagreementFields: readonly string[];
  readonly reasonCodes: readonly string[];
  /** True when only non-primary priorities contributed usable observations. */
  readonly fallbackUsed: boolean;
  /** True only after multi-provider agreement; still requires independent on-chain checks. */
  readonly canProceedToOnChainValidation: boolean;
  /** Phase 6 evidence assessment can never authorize an order. */
  readonly tradingAuthorized: false;
}

interface EvaluatedProviderEvidence {
  readonly providerId: string;
  readonly priority: number;
  readonly snapshot: CanonicalMarketSnapshot;
  readonly sourceTimestampMs: number;
}

const PROVIDER_HEALTH_STATES = new Set<ProviderHealthState>([
  "UNKNOWN", "HEALTHY", "DEGRADED", "UNAVAILABLE", "CIRCUIT_OPEN"
]);

function isValidAgreementPolicy(policy: ProviderAgreementPolicy): boolean {
  return isRecord(policy) &&
    isUtcTimestamp(policy.nowAt) &&
    typeof policy.maxAgeMs === "number" &&
    Number.isFinite(policy.maxAgeMs) &&
    policy.maxAgeMs >= 0 &&
    typeof policy.maxHealthAgeMs === "number" &&
    Number.isFinite(policy.maxHealthAgeMs) &&
    policy.maxHealthAgeMs >= 0 &&
    (policy.maxFutureSkewMs === undefined ||
      (typeof policy.maxFutureSkewMs === "number" &&
       Number.isFinite(policy.maxFutureSkewMs) &&
       policy.maxFutureSkewMs >= 0)) &&
    (policy.allowSyntheticFixtures === undefined || typeof policy.allowSyntheticFixtures === "boolean");
}


function isValidProviderHealthEvidence(input: unknown, expectedProviderId: string): input is ProviderHealthSnapshot {
  if (!isRecord(input) ||
      input.providerId !== expectedProviderId ||
      typeof input.state !== "string" ||
      !PROVIDER_HEALTH_STATES.has(input.state as ProviderHealthState) ||
      !Number.isSafeInteger(input.consecutiveFailures) ||
      (input.consecutiveFailures as number) < 0) {
    return false;
  }

  const timestampFields = ["lastSuccessAt", "lastFailureAt", "lastRequestAt", "circuitOpenUntil"] as const;
  for (const field of timestampFields) {
    const value = input[field];
    if (value !== null && !isUtcTimestamp(value)) return false;
  }
  if (input.lastLatencyMs !== null &&
      (typeof input.lastLatencyMs !== "number" ||
       !Number.isFinite(input.lastLatencyMs) ||
       input.lastLatencyMs < 0)) {
    return false;
  }
  if (input.lastErrorClass !== null &&
      (typeof input.lastErrorClass !== "string" ||
       !PROVIDER_ERRORS.has(input.lastErrorClass as ProviderErrorClass))) {
    return false;
  }

  if (input.state === "UNKNOWN") {
    return input.consecutiveFailures === 0 &&
      input.lastSuccessAt === null &&
      input.lastFailureAt === null &&
      input.lastRequestAt === null &&
      input.lastLatencyMs === null &&
      input.circuitOpenUntil === null &&
      input.lastErrorClass === null;
  }

  if (input.state === "HEALTHY") {
    return input.consecutiveFailures === 0 &&
      typeof input.lastSuccessAt === "string" &&
      input.lastRequestAt === input.lastSuccessAt &&
      input.lastLatencyMs !== null &&
      input.circuitOpenUntil === null &&
      input.lastErrorClass === null &&
      (input.lastFailureAt === null ||
       timestampMs(input.lastFailureAt as string) <= timestampMs(input.lastSuccessAt));
  }

  const failureState = input.state === "DEGRADED" ||
    input.state === "UNAVAILABLE" ||
    input.state === "CIRCUIT_OPEN";
  if (!failureState ||
      (input.consecutiveFailures as number) < 1 ||
      typeof input.lastFailureAt !== "string" ||
      input.lastRequestAt !== input.lastFailureAt ||
      input.lastErrorClass === null ||
      (input.lastSuccessAt !== null &&
       timestampMs(input.lastSuccessAt as string) > timestampMs(input.lastFailureAt as string))) {
    return false;
  }
  if (input.state === "CIRCUIT_OPEN") return typeof input.circuitOpenUntil === "string";
  return input.circuitOpenUntil === null;
}

/**
 * Pure request permission gate for a single provider.
 *
 * It does not issue requests or implement an atomic probe lock. A caller receiving
 * ALLOW_RECOVERY_PROBE must atomically claim and serialize that provider's probe,
 * passing recoveryProbeInFlight=true to competing evaluations until the probe finishes.
 */
export function assessProviderAttemptPermission(input: {
  readonly health: unknown;
  readonly nowAt: string;
  readonly maxHealthAgeMs: number;
  readonly recoveryProbeInFlight: boolean;
}): ProviderAttemptPermissionAssessment {
  const decision = (
    status: ProviderAttemptPermissionStatus,
    providerId: string | null,
    providerState: ProviderHealthState | null,
    reasonCodes: readonly string[],
    canAttempt: boolean,
    requiresExclusiveProbe = false
  ): ProviderAttemptPermissionAssessment => ({
    status,
    providerId,
    providerState,
    reasonCodes: [...reasonCodes],
    canAttempt,
    requiresExclusiveProbe,
    tradingAuthorized: false
  });

  if (!isRecord(input) ||
      !isUtcTimestamp(input.nowAt) ||
      !Number.isSafeInteger(input.maxHealthAgeMs) ||
      (input.maxHealthAgeMs as number) < 1 ||
      typeof input.recoveryProbeInFlight !== "boolean" ||
      !isRecord(input.health) ||
      typeof input.health.providerId !== "string" ||
      !isSafeSlug(input.health.providerId) ||
      !isValidProviderHealthEvidence(input.health, input.health.providerId)) {
    return decision("INVALID_INPUT", null, null, ["PROVIDER_ATTEMPT_POLICY_OR_HEALTH_INVALID"], false);
  }

  const health = input.health as unknown as ProviderHealthSnapshot;
  if (health.state === "UNKNOWN") {
    return decision(
      "ALLOW_INITIAL_REQUEST",
      health.providerId,
      health.state,
      ["PROVIDER_HEALTH_UNKNOWN_INITIAL_REQUEST"],
      true
    );
  }
  if (health.state === "UNAVAILABLE") {
    return decision(
      "BLOCK_UNAVAILABLE",
      health.providerId,
      health.state,
      ["PROVIDER_UNAVAILABLE_REQUIRES_OPERATOR_CORRECTION"],
      false
    );
  }
  if (health.state === "CIRCUIT_OPEN") {
    if (timestampMs(input.nowAt) < timestampMs(health.circuitOpenUntil!)) {
      return decision(
        "BLOCK_CIRCUIT_OPEN",
        health.providerId,
        health.state,
        ["PROVIDER_CIRCUIT_COOLDOWN_ACTIVE"],
        false
      );
    }
    if (input.recoveryProbeInFlight) {
      return decision(
        "BLOCK_RECOVERY_PROBE_IN_FLIGHT",
        health.providerId,
        health.state,
        ["PROVIDER_RECOVERY_PROBE_ALREADY_IN_FLIGHT"],
        false
      );
    }
    return decision(
      "ALLOW_RECOVERY_PROBE",
      health.providerId,
      health.state,
      ["PROVIDER_CIRCUIT_COOLDOWN_ELAPSED_PROBE_ONLY"],
      true,
      true
    );
  }

  const healthFreshness = assessFreshness({
    retrievedAt: health.lastRequestAt!,
    observedAt: health.lastRequestAt!,
    sourceEventAt: health.lastRequestAt!,
    nowAt: input.nowAt,
    maxAgeMs: input.maxHealthAgeMs
  });
  if (healthFreshness.state !== "FRESH") {
    return decision(
      "ALLOW_HEALTH_RECHECK",
      health.providerId,
      health.state,
      ["PROVIDER_HEALTH_" + healthFreshness.state + "_RECHECK_REQUIRED"],
      true
    );
  }
  if (health.state === "DEGRADED") {
    return decision(
      "ALLOW_RETRY",
      health.providerId,
      health.state,
      ["PROVIDER_DEGRADED_RETRY_ALLOWED"],
      true
    );
  }
  return decision(
    "ALLOW_REQUEST",
    health.providerId,
    health.state,
    ["PROVIDER_HEALTHY"],
    true
  );
}

/** Compares canonical non-negative decimals numerically, without binary floating-point conversion. */
function decimalStringsEqual(left: string, right: string): boolean {
  const normalize = (value: string): string => {
    const point = value.indexOf(".");
    const integer = point < 0 ? value : value.slice(0, point);
    if (point < 0) return integer;
    const originalFraction = value.slice(point + 1);
    let end = originalFraction.length;
    while (end > 0 && originalFraction[end - 1] === "0") end -= 1;
    const fraction = originalFraction.slice(0, end);
    return fraction.length === 0 ? integer : integer + "." + fraction;
  };
  return normalize(left) === normalize(right);
}

function measuresEqual(left: DecimalMeasure | null, right: DecimalMeasure | null): boolean {
  if (left === null || right === null) return left === right;
  return left.unit === right.unit &&
    left.assetId === right.assetId &&
    decimalStringsEqual(left.value, right.value);
}

/**
 * Fail-closed provider agreement gate for Phase 6.
 *
 * It validates each observation, independently recomputes freshness with an injected
 * clock, rejects unhealthy providers and unapproved synthetic evidence, and only
 * reports agreement when at least two distinct providers match identity, source-time
 * alignment, all listed measures and activity counts. It does not select a primary
 * provider, define numeric tolerances, perform on-chain verification, or authorize trading.
 */
export function assessProviderAgreement(
  candidates: readonly ProviderEvidenceCandidate[],
  policy: ProviderAgreementPolicy
): ProviderAgreementAssessment {
  const result = (
    status: ProviderAgreementStatus,
    eligibleProviderIds: readonly string[] = [],
    rejectedProviders: readonly RejectedProviderEvidence[] = [],
    disagreementFields: readonly string[] = [],
    reasonCodes: readonly string[] = [],
    fallbackUsed = false,
    canProceedToOnChainValidation = false
  ): ProviderAgreementAssessment => ({
    status,
    eligibleProviderIds: [...eligibleProviderIds],
    rejectedProviders: [...rejectedProviders],
    disagreementFields: [...disagreementFields],
    reasonCodes: [...reasonCodes],
    fallbackUsed,
    canProceedToOnChainValidation,
    tradingAuthorized: false
  });

  if (!Array.isArray(candidates) || candidates.length === 0 || !isValidAgreementPolicy(policy)) {
    return result("INVALID_INPUT", [], [], [], ["INVALID_CANDIDATES_OR_POLICY"]);
  }

  const providerIds = new Set<string>();
  const independenceGroups = new Set<string>();
  const priorities = new Set<number>();
  for (const candidate of candidates as readonly unknown[]) {
    if (!isRecord(candidate) ||
        typeof candidate.providerId !== "string" ||
        !isSafeSlug(candidate.providerId) ||
        typeof candidate.independenceGroupId !== "string" ||
        !isSafeSlug(candidate.independenceGroupId) ||
        !Number.isSafeInteger(candidate.priority) ||
        (candidate.priority as number) < 0 ||
        typeof candidate.snapshot === "undefined" ||
        !isValidProviderHealthEvidence(candidate.health, candidate.providerId)) {
      return result("INVALID_INPUT", [], [], [], ["INVALID_CANDIDATE_METADATA"]);
    }
    if (providerIds.has(candidate.providerId)) {
      return result("INVALID_INPUT", [], [], [], ["DUPLICATE_PROVIDER_ID"]);
    }
    if (independenceGroups.has(candidate.independenceGroupId)) {
      return result("INVALID_INPUT", [], [], [], ["DUPLICATE_INDEPENDENCE_GROUP"]);
    }
    if (priorities.has(candidate.priority as number)) {
      return result("INVALID_INPUT", [], [], [], ["DUPLICATE_PROVIDER_PRIORITY"]);
    }
    if (candidate.health.providerId !== candidate.providerId) {
      return result("INVALID_INPUT", [], [], [], ["HEALTH_PROVIDER_ID_MISMATCH"]);
    }
    providerIds.add(candidate.providerId);
    independenceGroups.add(candidate.independenceGroupId);
    priorities.add(candidate.priority as number);
  }

  const eligible: EvaluatedProviderEvidence[] = [];
  const rejected: RejectedProviderEvidence[] = [];
  const orderedCandidates = [...candidates].sort((a, b) =>
    a.priority - b.priority || a.providerId.localeCompare(b.providerId)
  );

  for (const candidate of orderedCandidates) {
    const reasons: string[] = [];
    if (candidate.health.state === "HEALTHY") {
      const lastHealthRequestAt = candidate.health.lastRequestAt!;
      const healthFreshness = assessFreshness({
        retrievedAt: lastHealthRequestAt,
        observedAt: lastHealthRequestAt,
        sourceEventAt: lastHealthRequestAt,
        nowAt: policy.nowAt,
        maxAgeMs: policy.maxHealthAgeMs,
        ...(policy.maxFutureSkewMs === undefined ? {} : { maxFutureSkewMs: policy.maxFutureSkewMs })
      });
      if (healthFreshness.state !== "FRESH") reasons.push("PROVIDER_HEALTH_" + healthFreshness.state);
    }
    if (candidate.snapshot === null) {
      reasons.push("NO_OBSERVATION");
    } else {
      const validation = validateCanonicalMarketSnapshot(candidate.snapshot);
      if (!validation.valid || !isRecord(candidate.snapshot)) {
        reasons.push("INVALID_CANONICAL_SNAPSHOT");
      } else {
        const snapshot = candidate.snapshot as unknown as CanonicalMarketSnapshot;
        if (snapshot.provenance.providerId !== candidate.providerId) {
          return result("INVALID_INPUT", [], [], [], ["PROVENANCE_PROVIDER_ID_MISMATCH"]);
        }
        if (snapshot.poolAddress === null) reasons.push("POOL_IDENTITY_MISSING");
        if (snapshot.provenance.synthetic && policy.allowSyntheticFixtures !== true) {
          reasons.push("SYNTHETIC_EVIDENCE_NOT_ALLOWED");
        }
        if (candidate.health.state !== "HEALTHY") {
          reasons.push("PROVIDER_NOT_HEALTHY");
        }
        const freshness = assessFreshness({
          retrievedAt: snapshot.retrievedAt,
          observedAt: snapshot.observedAt,
          sourceEventAt: snapshot.sourceEventAt,
          nowAt: policy.nowAt,
          maxAgeMs: policy.maxAgeMs,
          ...(policy.maxFutureSkewMs === undefined ? {} : { maxFutureSkewMs: policy.maxFutureSkewMs })
        });
        if (freshness.state !== "FRESH") reasons.push("FRESHNESS_" + freshness.state);
        const sourceTimestamp = snapshot.sourceEventAt ?? snapshot.observedAt;
        if (sourceTimestamp === null) reasons.push("SOURCE_TIMESTAMP_MISSING");

        if (reasons.length === 0) {
          eligible.push({
            providerId: candidate.providerId,
            priority: candidate.priority,
            snapshot,
            sourceTimestampMs: timestampMs(sourceTimestamp!)
          });
        }
      }
    }
    if (candidate.health.state !== "HEALTHY" && !reasons.includes("PROVIDER_NOT_HEALTHY")) {
      reasons.push("PROVIDER_NOT_HEALTHY");
    }
    if (reasons.length > 0) {
      rejected.push({ providerId: candidate.providerId, reasonCodes: reasons });
    }
  }

  const fallbackUsed = !eligible.some((candidate) => candidate.priority === 0) &&
    eligible.some((candidate) => candidate.priority > 0);
  const eligibleIds = eligible.map((candidate) => candidate.providerId);

  if (eligible.length === 0) {
    return result("NO_ACCEPTABLE_PROVIDER", [], rejected, [], ["NO_PROVIDER_PASSED_EVIDENCE_GATES"]);
  }
  if (eligible.length < 2) {
    return result(
      "INSUFFICIENT_EVIDENCE",
      eligibleIds,
      rejected,
      [],
      ["INDEPENDENT_PROVIDER_CONFIRMATION_REQUIRED"],
      fallbackUsed
    );
  }

  const reference = eligible[0]!;
  const identityFields = ["chain", "cluster", "baseMint", "quoteMint", "poolAddress"] as const;
  const identityDisagreements = identityFields.filter((field) =>
    eligible.some((candidate) => candidate.snapshot[field] !== reference.snapshot[field])
  );
  if (identityDisagreements.length > 0) {
    return result(
      "DISAGREEMENT",
      eligibleIds,
      rejected,
      identityDisagreements,
      ["PROVIDER_IDENTITY_DISAGREEMENT"],
      fallbackUsed
    );
  }

  if (eligible.some((candidate) => candidate.sourceTimestampMs !== reference.sourceTimestampMs)) {
    return result(
      "INSUFFICIENT_EVIDENCE",
      eligibleIds,
      rejected,
      ["sourceTimestamp"],
      ["SOURCE_TIME_ALIGNMENT_UNCONFIGURED"],
      fallbackUsed
    );
  }

  const measureFields = ["price", "liquidity", "volume24h"] as const;
  const missingFields: string[] = [];
  const valueDisagreements: string[] = [];
  for (const field of measureFields) {
    const baseline = reference.snapshot[field];
    if (baseline === null || eligible.some((candidate) => candidate.snapshot[field] === null)) {
      missingFields.push(field);
      continue;
    }
    if (eligible.some((candidate) => !measuresEqual(candidate.snapshot[field], baseline))) {
      valueDisagreements.push(field);
    }
  }

  const countFields = ["buys24h", "sells24h"] as const;
  for (const field of countFields) {
    const baseline = reference.snapshot[field];
    if (baseline === null || eligible.some((candidate) => candidate.snapshot[field] === null)) {
      missingFields.push(field);
      continue;
    }
    if (eligible.some((candidate) => candidate.snapshot[field] !== baseline)) {
      valueDisagreements.push(field);
    }
  }

  if (valueDisagreements.length > 0) {
    return result(
      "DISAGREEMENT",
      eligibleIds,
      rejected,
      valueDisagreements,
      ["PROVIDER_MEASURE_DISAGREEMENT"],
      fallbackUsed
    );
  }
  if (missingFields.length > 0) {
    return result(
      "INSUFFICIENT_EVIDENCE",
      eligibleIds,
      rejected,
      missingFields,
      ["REQUIRED_MEASURE_MISSING"],
      fallbackUsed
    );
  }

  const syntheticEvidence = eligible.some((candidate) => candidate.snapshot.provenance.synthetic);
  return result(
    "AGREED",
    eligibleIds,
    rejected,
    [],
    syntheticEvidence ? ["SYNTHETIC_AGREEMENT_ONLY"] : ["PROVIDERS_AGREE_EXACTLY"],
    fallbackUsed,
    !syntheticEvidence
  );
}


export type CriticalMarketDataEvidenceGateStatus =
  | "READY_FOR_ON_CHAIN_VALIDATION"
  | "BLOCKED"
  | "INVALID_INPUT";

export interface CriticalMarketDataEvidenceGateAssessment {
  readonly status: CriticalMarketDataEvidenceGateStatus;
  readonly reasonCodes: readonly string[];
  readonly providerAgreementStatus: ProviderAgreementStatus | null;
  readonly independentComparisonStatus: IndependentPriceComparisonStatus | null;
  /** Allows only the next independent on-chain evidence stage; never authorizes a trade. */
  readonly canProceedToOnChainValidation: boolean;
  readonly tradingAuthorized: false;
}

/**
 * Final fail-closed Phase 6 critical-data gate.
 *
 * Provider agreement and reserve-vs-independent-USD comparison are separate checks;
 * passing either one alone is never enough. This function only decides whether the
 * evidence is complete enough to proceed to the separate on-chain validation stage.
 * It never authorizes trading.
 */
export function assessCriticalMarketDataEvidenceGate(input: {
  readonly providerAgreement: ProviderAgreementAssessment;
  readonly independentComparison: IndependentReservePriceComparisonResult;
}): CriticalMarketDataEvidenceGateAssessment {
  const blocked = (
    status: CriticalMarketDataEvidenceGateStatus,
    reasonCodes: readonly string[],
    providerAgreementStatus: ProviderAgreementStatus | null = null,
    independentComparisonStatus: IndependentPriceComparisonStatus | null = null
  ): CriticalMarketDataEvidenceGateAssessment => ({
    status,
    reasonCodes: [...new Set(reasonCodes)],
    providerAgreementStatus,
    independentComparisonStatus,
    canProceedToOnChainValidation: status === "READY_FOR_ON_CHAIN_VALIDATION",
    tradingAuthorized: false
  });

  if (!isRecord(input) ||
      !isRecord(input.providerAgreement) ||
      !isRecord(input.independentComparison)) {
    return blocked("INVALID_INPUT", ["CRITICAL_EVIDENCE_GATE_INPUT_INVALID"]);
  }

  const provider = input.providerAgreement;
  const independent = input.independentComparison;
  const providerStatuses: readonly string[] = [
    "AGREED", "DISAGREEMENT", "INSUFFICIENT_EVIDENCE", "NO_ACCEPTABLE_PROVIDER", "INVALID_INPUT"
  ];
  const comparisonStatuses: readonly string[] = [
    "AGREED", "DISAGREEMENT", "INSUFFICIENT_EVIDENCE", "INVALID_INPUT", "NOT_ASSESSED"
  ];
  const isStringArray = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item) => typeof item === "string");
  const validProviderIds =
    Array.isArray(provider.eligibleProviderIds) &&
    provider.eligibleProviderIds.every(isSafeSlug) &&
    new Set(provider.eligibleProviderIds as string[]).size === provider.eligibleProviderIds.length;
  const validRejectedProviders =
    Array.isArray(provider.rejectedProviders) &&
    provider.rejectedProviders.every((item) =>
      isRecord(item) && isSafeSlug(item.providerId) && isStringArray(item.reasonCodes)
    );
  const validDisagreementFields = isStringArray(provider.disagreementFields);
  const validProviderShape =
    providerStatuses.includes(String(provider.status)) &&
    validProviderIds &&
    validRejectedProviders &&
    validDisagreementFields &&
    typeof provider.fallbackUsed === "boolean" &&
    typeof provider.canProceedToOnChainValidation === "boolean" &&
    isStringArray(provider.reasonCodes) &&
    provider.tradingAuthorized === false;
  const reserve = independent.reserveComparison;
  const indexed = independent.indexedPriceComparison;
  const nestedComparisonStatuses = [
    "AGREED", "DISAGREEMENT", "INSUFFICIENT_EVIDENCE", "INVALID_INPUT", "NOT_ASSESSED"
  ];
  const validDeviation = (value: unknown): boolean =>
    value === null || (typeof value === "string" && /^(?:0|[1-9][0-9]*)$/.test(value));
  const validTolerance = (value: unknown): boolean =>
    Number.isSafeInteger(value) && (value as number) >= 0 && (value as number) <= 10_000;
  const validNestedComparison = (value: unknown): boolean =>
    isRecord(value) &&
    nestedComparisonStatuses.includes(String(value.status)) &&
    validDeviation(value.deviationBpsRounded) &&
    validTolerance(value.toleranceBps);
  const validComparisonShape =
    comparisonStatuses.includes(String(independent.status)) &&
    validNestedComparison(reserve) &&
    validNestedComparison(indexed) &&
    isSafeSlug(independent.referenceProviderId) &&
    isSafeSlug(independent.referenceIndependenceGroupId) &&
    typeof independent.baseFeedId === "string" &&
    REQUEST_ID_PATTERN.test(independent.baseFeedId) &&
    typeof independent.quoteFeedId === "string" &&
    REQUEST_ID_PATTERN.test(independent.quoteFeedId) &&
    ["FRESH", "STALE", "UNKNOWN", "INVALID"].includes(String(independent.sourceFreshness)) &&
    Number.isSafeInteger(independent.maxReferenceTimestampSkewMs) &&
    (independent.maxReferenceTimestampSkewMs as number) >= 0 &&
    (independent.maxReferenceTimestampSkewMs as number) <= 300_000 &&
    (independent.referenceTimestampSkewMs === null ||
      (Number.isSafeInteger(independent.referenceTimestampSkewMs) &&
       (independent.referenceTimestampSkewMs as number) >= 0 &&
       (independent.referenceTimestampSkewMs as number) <= (independent.maxReferenceTimestampSkewMs as number))) &&
    typeof independent.comparisonEvidenceComplete === "boolean" &&
    isStringArray(independent.reasonCodes) &&
    independent.tradingAuthorized === false;
  if (!validProviderShape || !validComparisonShape) {
    return blocked("INVALID_INPUT", ["CRITICAL_EVIDENCE_GATE_INPUT_INVALID"]);
  }

  const providerStatus = provider.status as ProviderAgreementStatus;
  const comparisonStatus = independent.status as IndependentPriceComparisonStatus;
  const providerReasons = provider.reasonCodes as string[];
  const comparisonReasons = independent.reasonCodes as string[];
  const eligibleProviderIds = provider.eligibleProviderIds as string[];
  const disagreementFields = provider.disagreementFields as string[];

  // Defend against internally inconsistent or forged "AGREED" assessments.
  if (providerStatus === "AGREED") {
    const structurallyAgreed = eligibleProviderIds.length >= 2 && disagreementFields.length === 0;
    const approvedNonSyntheticAgreement =
      provider.canProceedToOnChainValidation === true &&
      providerReasons.includes("PROVIDERS_AGREE_EXACTLY") &&
      !providerReasons.includes("SYNTHETIC_AGREEMENT_ONLY");
    const syntheticAgreement =
      provider.canProceedToOnChainValidation === false &&
      providerReasons.includes("SYNTHETIC_AGREEMENT_ONLY");
    if (!structurallyAgreed || (!approvedNonSyntheticAgreement && !syntheticAgreement)) {
      return blocked("INVALID_INPUT", ["PROVIDER_AGREEMENT_ASSESSMENT_INCONSISTENT"], providerStatus, comparisonStatus);
    }
  } else if (provider.canProceedToOnChainValidation !== false) {
    return blocked("INVALID_INPUT", ["PROVIDER_AGREEMENT_ASSESSMENT_INCONSISTENT"], providerStatus, comparisonStatus);
  }

  const comparisonInternallyConsistent =
    comparisonStatus !== "AGREED" ||
    (isRecord(reserve) &&
      isRecord(indexed) &&
      reserve.status === "AGREED" &&
      indexed.status === "AGREED" &&
      independent.comparisonEvidenceComplete === true &&
      independent.sourceFreshness === "FRESH" &&
      typeof independent.referenceTimestampSkewMs === "number" &&
      reserve.deviationBpsRounded !== null &&
      indexed.deviationBpsRounded !== null &&
      comparisonReasons.length === 0);
  const disagreementInternallyConsistent =
    comparisonStatus !== "DISAGREEMENT" ||
    (isRecord(reserve) &&
      isRecord(indexed) &&
      (reserve.status === "DISAGREEMENT" || indexed.status === "DISAGREEMENT") &&
      independent.comparisonEvidenceComplete === false);
  const incompleteInternallyConsistent =
    comparisonStatus !== "INSUFFICIENT_EVIDENCE" &&
    comparisonStatus !== "NOT_ASSESSED" ||
    independent.comparisonEvidenceComplete === false;
  if (!comparisonInternallyConsistent ||
      !disagreementInternallyConsistent ||
      !incompleteInternallyConsistent) {
    return blocked("INVALID_INPUT", ["INDEPENDENT_COMPARISON_ASSESSMENT_INCONSISTENT"], providerStatus, comparisonStatus);
  }
  const reasons: string[] = [];
  if (providerStatus !== "AGREED") {
    reasons.push("PROVIDER_AGREEMENT_" + providerStatus);
    reasons.push(...provider.reasonCodes as string[]);
  }
  if (provider.canProceedToOnChainValidation !== true) {
    reasons.push("PROVIDER_AGREEMENT_GATE_NOT_READY");
  }
  if (comparisonStatus !== "AGREED") {
    reasons.push("INDEPENDENT_PRICE_COMPARISON_" + comparisonStatus);
    reasons.push(...independent.reasonCodes as string[]);
  }
  if (independent.comparisonEvidenceComplete !== true) {
    reasons.push("INDEPENDENT_PRICE_EVIDENCE_INCOMPLETE");
  }

  if (reasons.length > 0) {
    return blocked("BLOCKED", reasons, providerStatus, comparisonStatus);
  }
  return blocked("READY_FOR_ON_CHAIN_VALIDATION", [], providerStatus, comparisonStatus);
}


/**
 * Untrusted RPC account metadata. The reader must collect these records from one
 * getMultipleAccounts response so contextSlot applies to the whole bundle.
 */
export interface OnChainAccountEvidence {
  readonly address: string;
  readonly exists: boolean;
  /** Solana account's program owner, not the token account's authority. */
  readonly ownerProgramId: string | null;
  readonly executable: boolean | null;
}

export interface OnChainMintEvidence extends OnChainAccountEvidence {
  readonly initialized: boolean | null;
  readonly decimals: number | null;
}

export interface OnChainTokenAccountEvidence extends OnChainAccountEvidence {
  readonly initialized: boolean | null;
  readonly mint: string | null;
  /** Authority stored in the decoded token account data. */
  readonly authority: string | null;
}

export interface OnChainIdentitySourceEvidence {
  readonly providerId: string;
  readonly commitment: "confirmed" | "finalized";
  readonly retrievedAt: string;
  readonly contextSlot: number;
  /** Slot requested through RPC minContextSlot for this evidence bundle. */
  readonly requestedMinContextSlot: number;
  readonly requestId: string | null;
  readonly rawPayloadSha256: string | null;
  readonly synthetic: boolean;
}

/** Decoder outputs must come from a versioned, allowlisted protocol-specific decoder. */
export interface DecodedPoolIdentityEvidence {
  readonly decoderId: string;
  readonly decoderVersion: string;
  readonly poolAddress: string;
  readonly dexProgramId: string;
  readonly baseMint: string;
  readonly quoteMint: string;
  readonly baseVault: string;
  readonly quoteVault: string;
  readonly baseVaultAuthority: string;
  readonly quoteVaultAuthority: string;
}

export interface OnChainIdentityEvidence {
  readonly source: OnChainIdentitySourceEvidence;
  readonly poolAccount: OnChainAccountEvidence;
  readonly dexProgramAccount: OnChainAccountEvidence;
  readonly baseMintAccount: OnChainMintEvidence;
  readonly quoteMintAccount: OnChainMintEvidence;
  readonly baseVaultAccount: OnChainTokenAccountEvidence;
  readonly quoteVaultAccount: OnChainTokenAccountEvidence;
  readonly decodedPool: DecodedPoolIdentityEvidence | null;
}

export interface ApprovedPoolDecoder {
  readonly programId: string;
  readonly decoderId: string;
  readonly decoderVersion: string;
}

export interface OnChainIdentityPolicy {
  readonly nowAt: string;
  readonly maxRetrievalAgeMs: number;
  readonly maxFutureSkewMs?: number;
  readonly minimumContextSlot: number;
  readonly requiredCommitment: "confirmed" | "finalized";
  /** Empty registries are invalid; addresses/decoder versions require explicit review. */
  readonly approvedPoolDecoders: readonly ApprovedPoolDecoder[];
  readonly allowedTokenProgramIds: readonly string[];
  readonly allowedLoaderProgramIds: readonly string[];
}

export type OnChainIdentityStatus =
  | "MATCH"
  | "MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "INVALID_INPUT"
  | "SYNTHETIC_MATCH";

export interface OnChainIdentityAssessment {
  readonly status: OnChainIdentityStatus;
  readonly reasonCodes: readonly string[];
  readonly mismatchFields: readonly string[];
  readonly sourceProviderId: string | null;
  readonly contextSlot: number | null;
  readonly retrievedAt: string | null;
  readonly commitment: "confirmed" | "finalized" | null;
  /** Identity agreement only; never authorization to trade. */
  readonly canProceedToIndependentSafetyReview: boolean;
  readonly tradingAuthorized: false;
}

function isNullableSafeId(value: unknown): boolean {
  return value === null || isOptionalId(value);
}

function isValidAccountEnvelope(value: unknown): value is OnChainAccountEvidence {
  if (!isRecord(value) ||
      typeof value.address !== "string" ||
      !isSolanaPublicKey(value.address) ||
      typeof value.exists !== "boolean") {
    return false;
  }
  if (!value.exists) {
    return (value.ownerProgramId === null || value.ownerProgramId === undefined) &&
      (value.executable === null || value.executable === undefined);
  }
  return typeof value.ownerProgramId === "string" &&
    isSolanaPublicKey(value.ownerProgramId) &&
    typeof value.executable === "boolean";
}

function isValidMintEvidence(value: unknown): value is OnChainMintEvidence {
  if (!isRecord(value) || !isValidAccountEnvelope(value)) return false;
  const mint = value as Record<string, unknown> & OnChainMintEvidence;
  if (!mint.exists) {
    return (mint.initialized === null || mint.initialized === undefined) &&
      (mint.decimals === null || mint.decimals === undefined);
  }
  return typeof mint.initialized === "boolean" &&
    Number.isSafeInteger(mint.decimals) &&
    (mint.decimals as number) >= 0 &&
    (mint.decimals as number) <= 255;
}

function isValidTokenAccountEvidence(value: unknown): value is OnChainTokenAccountEvidence {
  if (!isRecord(value) || !isValidAccountEnvelope(value)) return false;
  const tokenAccount = value as Record<string, unknown> & OnChainTokenAccountEvidence;
  if (!tokenAccount.exists) {
    return (tokenAccount.initialized === null || tokenAccount.initialized === undefined) &&
      (tokenAccount.mint === null || tokenAccount.mint === undefined) &&
      (tokenAccount.authority === null || tokenAccount.authority === undefined);
  }
  return typeof tokenAccount.initialized === "boolean" &&
    typeof tokenAccount.mint === "string" &&
    isSolanaPublicKey(tokenAccount.mint) &&
    typeof tokenAccount.authority === "string" &&
    isSolanaPublicKey(tokenAccount.authority);
}

function isValidOnChainSource(value: unknown): value is OnChainIdentitySourceEvidence {
  return isRecord(value) &&
    typeof value.providerId === "string" &&
    isSafeSlug(value.providerId) &&
    (value.commitment === "confirmed" || value.commitment === "finalized") &&
    typeof value.retrievedAt === "string" &&
    isUtcTimestamp(value.retrievedAt) &&
    Number.isSafeInteger(value.contextSlot) &&
    (value.contextSlot as number) >= 0 &&
    Number.isSafeInteger(value.requestedMinContextSlot) &&
    (value.requestedMinContextSlot as number) >= 0 &&
    isNullableSafeId(value.requestId) &&
    (value.rawPayloadSha256 === null ||
      (typeof value.rawPayloadSha256 === "string" && /^[a-fA-F0-9]{64}$/.test(value.rawPayloadSha256))) &&
    typeof value.synthetic === "boolean";
}

function isValidApprovedPoolDecoder(value: unknown): value is ApprovedPoolDecoder {
  return isRecord(value) &&
    typeof value.programId === "string" &&
    isSolanaPublicKey(value.programId) &&
    typeof value.decoderId === "string" &&
    isSafeSlug(value.decoderId) &&
    typeof value.decoderVersion === "string" &&
    VERSION_PATTERN.test(value.decoderVersion);
}

function isValidOnChainIdentityPolicy(value: unknown): value is OnChainIdentityPolicy {
  if (!isRecord(value) ||
      typeof value.nowAt !== "string" ||
      !isUtcTimestamp(value.nowAt) ||
      typeof value.maxRetrievalAgeMs !== "number" ||
      !Number.isFinite(value.maxRetrievalAgeMs) ||
      value.maxRetrievalAgeMs < 0 ||
      (value.maxFutureSkewMs !== undefined &&
        (typeof value.maxFutureSkewMs !== "number" ||
         !Number.isFinite(value.maxFutureSkewMs) ||
         value.maxFutureSkewMs < 0)) ||
      !Number.isSafeInteger(value.minimumContextSlot) ||
      (value.minimumContextSlot as number) < 0 ||
      (value.requiredCommitment !== "confirmed" && value.requiredCommitment !== "finalized") ||
      !Array.isArray(value.approvedPoolDecoders) ||
      value.approvedPoolDecoders.length === 0 ||
      !Array.isArray(value.allowedTokenProgramIds) ||
      value.allowedTokenProgramIds.length === 0 ||
      !Array.isArray(value.allowedLoaderProgramIds) ||
      value.allowedLoaderProgramIds.length === 0) {
    return false;
  }

  const decoderPrograms = new Set<string>();
  for (const decoder of value.approvedPoolDecoders as readonly unknown[]) {
    if (!isValidApprovedPoolDecoder(decoder) || decoderPrograms.has(decoder.programId)) return false;
    decoderPrograms.add(decoder.programId);
  }
  const tokenPrograms = new Set<string>();
  const loaderPrograms = new Set<string>();
  for (const [field, seen] of [
    ["allowedTokenProgramIds", tokenPrograms],
    ["allowedLoaderProgramIds", loaderPrograms]
  ] as const) {
    for (const address of value[field] as readonly unknown[]) {
      if (typeof address !== "string" || !isSolanaPublicKey(address) || seen.has(address)) return false;
      seen.add(address);
    }
  }
  if ([...decoderPrograms].some((address) => tokenPrograms.has(address) || loaderPrograms.has(address)) ||
      [...tokenPrograms].some((address) => loaderPrograms.has(address))) {
    return false;
  }
  return true;
}

/**
 * Validates a decoded, read-only on-chain identity evidence bundle against an
 * explicitly supplied protocol-decoder/program allowlist. This is NOT an RPC
 * client or binary account decoder. Callers must obtain the accounts from one
 * context-slot response and use the exact allowlisted decoder/version.
 *
 * A MATCH means only that the decoded account identities/owners are internally
 * consistent at the stated slot. It does not establish token safety, market-data
 * freshness, program upgrade authority safety, liquidity, or trade authorization.
 */
export function assessOnChainIdentityEvidence(
  targetInput: unknown,
  evidenceInput: unknown,
  policyInput: unknown
): OnChainIdentityAssessment {
  const assessment = (
    status: OnChainIdentityStatus,
    reasonCodes: readonly string[],
    mismatchFields: readonly string[] = [],
    evidence?: OnChainIdentityEvidence,
    canProceedToIndependentSafetyReview = false
  ): OnChainIdentityAssessment => ({
    status,
    reasonCodes: [...reasonCodes],
    mismatchFields: [...mismatchFields],
    sourceProviderId: evidence?.source.providerId ?? null,
    contextSlot: evidence?.source.contextSlot ?? null,
    retrievedAt: evidence?.source.retrievedAt ?? null,
    commitment: evidence?.source.commitment ?? null,
    canProceedToIndependentSafetyReview,
    tradingAuthorized: false
  });

  if (!isRecord(targetInput) ||
      !validateCanonicalMarketSnapshot(targetInput).valid ||
      targetInput.cluster !== "mainnet-beta" ||
      typeof targetInput.poolAddress !== "string" ||
      !isValidOnChainIdentityPolicy(policyInput) ||
      !isRecord(evidenceInput) ||
      !isValidOnChainSource(evidenceInput.source) ||
      !isValidAccountEnvelope(evidenceInput.poolAccount) ||
      !isValidAccountEnvelope(evidenceInput.dexProgramAccount) ||
      !isValidMintEvidence(evidenceInput.baseMintAccount) ||
      !isValidMintEvidence(evidenceInput.quoteMintAccount) ||
      !isValidTokenAccountEvidence(evidenceInput.baseVaultAccount) ||
      !isValidTokenAccountEvidence(evidenceInput.quoteVaultAccount) ||
      (evidenceInput.decodedPool !== null && !isRecord(evidenceInput.decodedPool))) {
    return assessment("INVALID_INPUT", ["INVALID_TARGET_EVIDENCE_OR_POLICY"]);
  }

  const evidence = evidenceInput as unknown as OnChainIdentityEvidence;
  const policy = policyInput as OnChainIdentityPolicy;
  const target = targetInput as unknown as CanonicalMarketSnapshot;
  const source = evidence.source;

  const retrievalMs = timestampMs(source.retrievedAt);
  const nowMs = timestampMs(policy.nowAt);
  const futureSkewMs = policy.maxFutureSkewMs ?? 0;
  if (retrievalMs > nowMs + futureSkewMs) {
    return assessment("INVALID_INPUT", ["RETRIEVAL_TIMESTAMP_IN_FUTURE"], [], evidence);
  }
  if (nowMs - retrievalMs > policy.maxRetrievalAgeMs) {
    return assessment("INSUFFICIENT_EVIDENCE", ["ON_CHAIN_EVIDENCE_RETRIEVAL_STALE"], [], evidence);
  }
  if (!source.synthetic &&
      (source.requestId === null || source.rawPayloadSha256 === null)) {
    return assessment("INSUFFICIENT_EVIDENCE", ["RPC_EVIDENCE_PROVENANCE_INCOMPLETE"], [], evidence);
  }
  if (source.commitment !== policy.requiredCommitment) {
    return assessment("INSUFFICIENT_EVIDENCE", ["COMMITMENT_BELOW_REQUIRED_POLICY"], [], evidence);
  }
  if (source.requestedMinContextSlot < policy.minimumContextSlot ||
      source.contextSlot < policy.minimumContextSlot ||
      source.contextSlot < source.requestedMinContextSlot) {
    return assessment("INSUFFICIENT_EVIDENCE", ["CONTEXT_SLOT_BELOW_MINIMUM"], [], evidence);
  }

  const requiredAccounts = [
    evidence.poolAccount,
    evidence.dexProgramAccount,
    evidence.baseMintAccount,
    evidence.quoteMintAccount,
    evidence.baseVaultAccount,
    evidence.quoteVaultAccount
  ];
  if (requiredAccounts.some((account) => !account.exists) || evidence.decodedPool === null) {
    return assessment("INSUFFICIENT_EVIDENCE", ["REQUIRED_ACCOUNT_OR_DECODED_POOL_MISSING"], [], evidence);
  }

  const decoded = evidence.decodedPool as DecodedPoolIdentityEvidence;
  const mismatches: string[] = [];
  const addMismatch = (field: string, condition: boolean): void => {
    if (condition) mismatches.push(field);
  };

  addMismatch("poolAddress", evidence.poolAccount.address !== target.poolAddress);
  addMismatch("baseMint", evidence.baseMintAccount.address !== target.baseMint);
  addMismatch("quoteMint", evidence.quoteMintAccount.address !== target.quoteMint);
  addMismatch("poolAccountExecutable", evidence.poolAccount.executable !== false);

  const approvedDecoder = policy.approvedPoolDecoders.find((item) =>
    item.programId === evidence.poolAccount.ownerProgramId
  );
  addMismatch("poolProgramNotAllowlisted", approvedDecoder === undefined);
  addMismatch("poolProgramIdentity", evidence.poolAccount.ownerProgramId !== decoded.dexProgramId);
  addMismatch("dexProgramAddress", evidence.dexProgramAccount.address !== decoded.dexProgramId);
  addMismatch("dexProgramExecutable", evidence.dexProgramAccount.executable !== true);
  addMismatch("dexProgramLoaderNotAllowlisted",
    !policy.allowedLoaderProgramIds.includes(evidence.dexProgramAccount.ownerProgramId!));
  addMismatch("baseMintProgramNotAllowlisted",
    !policy.allowedTokenProgramIds.includes(evidence.baseMintAccount.ownerProgramId!));
  addMismatch("quoteMintProgramNotAllowlisted",
    !policy.allowedTokenProgramIds.includes(evidence.quoteMintAccount.ownerProgramId!));
  addMismatch("baseMintNotInitialized", evidence.baseMintAccount.initialized !== true);
  addMismatch("quoteMintNotInitialized", evidence.quoteMintAccount.initialized !== true);
  addMismatch("baseVaultTokenProgram",
    evidence.baseVaultAccount.ownerProgramId !== evidence.baseMintAccount.ownerProgramId);
  addMismatch("quoteVaultTokenProgram",
    evidence.quoteVaultAccount.ownerProgramId !== evidence.quoteMintAccount.ownerProgramId);
  addMismatch("baseVaultNotInitialized", evidence.baseVaultAccount.initialized !== true);
  addMismatch("quoteVaultNotInitialized", evidence.quoteVaultAccount.initialized !== true);
  addMismatch("baseVaultMint", evidence.baseVaultAccount.mint !== target.baseMint);
  addMismatch("quoteVaultMint", evidence.quoteVaultAccount.mint !== target.quoteMint);
  addMismatch("baseVaultAuthority", evidence.baseVaultAccount.authority !== decoded.baseVaultAuthority);
  addMismatch("quoteVaultAuthority", evidence.quoteVaultAccount.authority !== decoded.quoteVaultAuthority);
  addMismatch("decodedPoolAddress", decoded.poolAddress !== target.poolAddress);
  addMismatch("decodedBaseMint", decoded.baseMint !== target.baseMint);
  addMismatch("decodedQuoteMint", decoded.quoteMint !== target.quoteMint);
  addMismatch("decodedBaseVault", decoded.baseVault !== evidence.baseVaultAccount.address);
  addMismatch("decodedQuoteVault", decoded.quoteVault !== evidence.quoteVaultAccount.address);
  const identityAddresses = [
    evidence.poolAccount.address,
    evidence.dexProgramAccount.address,
    evidence.baseMintAccount.address,
    evidence.quoteMintAccount.address,
    evidence.baseVaultAccount.address,
    evidence.quoteVaultAccount.address
  ];
  addMismatch("identityAddressesNotDistinct",
    new Set(identityAddresses).size !== identityAddresses.length);
  addMismatch("decoderId", approvedDecoder !== undefined && decoded.decoderId !== approvedDecoder.decoderId);
  addMismatch("decoderVersion", approvedDecoder !== undefined && decoded.decoderVersion !== approvedDecoder.decoderVersion);

  if (mismatches.length > 0) {
    return assessment("MISMATCH", ["ON_CHAIN_IDENTITY_MISMATCH"], mismatches, evidence);
  }
  if (source.synthetic || target.provenance.synthetic) {
    return assessment("SYNTHETIC_MATCH", ["SYNTHETIC_EVIDENCE_ONLY"], [], evidence);
  }
  return assessment(
    "MATCH",
    ["ON_CHAIN_IDENTITIES_MATCH_AT_CONTEXT_SLOT"],
    [],
    evidence,
    true
  );
}


export {
  SolanaRpcAccountReader,
  SolanaRpcReaderError
} from "./solana-rpc-reader.js";
export type {
  ReadSolanaAccountsRequest,
  SolanaRpcAccountBundle,
  SolanaRpcAccountReaderOptions,
  SolanaRpcRawAccount,
  SolanaRpcReaderFailureCode
} from "./solana-rpc-reader.js";


export {
  SPL_TOKEN_PROGRAM_ID,
  SPL_TOKEN_2022_PROGRAM_ID,
  decodeSplTokenAccount,
  decodeSplTokenMint
} from "./solana-token-account-decoder.js";
export type {
  DecodedSplTokenAccount,
  DecodedSplTokenMint,
  SplTokenDecodeErrorCode,
  SplTokenDecodeResult,
  SplTokenProgramKind,
  TokenAccountState,
  TokenExtensionState
} from "./solana-token-account-decoder.js";


export { inspectToken2022ExtensionLayout } from "./solana-token-account-decoder.js";
export type {
  Token2022ExtensionEntry,
  Token2022ExtensionLayoutResult,
  Token2022StateKind,
  Token2022TlvErrorCode
} from "./solana-token-account-decoder.js";

export {
  TOKEN2022_EXTENSION_SEMANTICS,
  assessToken2022ExtensionPolicy
} from "./solana-token-account-decoder.js";
export type {
  KnownToken2022ExtensionDefinition,
  Token2022ExtensionImpact,
  Token2022ExtensionPolicyEntry,
  Token2022ExtensionPolicyResult
} from "./solana-token-account-decoder.js";


export {
  RAYDIUM_CPMM_AMM_CONFIG_LENGTH,
  RAYDIUM_CPMM_DECODER_ID,
  RAYDIUM_CPMM_DECODER_VERSION,
  RAYDIUM_CPMM_POOL_STATE_LENGTH,
  RAYDIUM_CPMM_PROGRAM_ID,
  assessRaydiumCpmmIdentityEvidence,
  decodeRaydiumCpmmAmmConfig,
  decodeRaydiumCpmmPool,
  deriveRaydiumCpmmAmmConfigPda,
  deriveRaydiumCpmmAuthorityPda,
  deriveRaydiumCpmmLpMintPda,
  deriveRaydiumCpmmObservationPda,
  deriveRaydiumCpmmPoolPda,
  deriveRaydiumCpmmVaultPda,
  findSolanaProgramAddress,
  readRaydiumCpmmIdentityBundle
} from "./raydium-cpmm-decoder.js";
export type {
  RaydiumCpmmAmmConfigDecodeResult,
  RaydiumCpmmAmmConfigState,
  RaydiumCpmmIdentityAssessment,
  RaydiumCpmmIdentityReadRequest,
  RaydiumCpmmIdentityStatus,
  RaydiumCpmmPoolDecodeErrorCode,
  RaydiumCpmmPoolDecodeResult,
  RaydiumCpmmPoolState
} from "./raydium-cpmm-decoder.js";
