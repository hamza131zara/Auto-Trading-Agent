/**
 * Driver-neutral PostgreSQL pool lifecycle policy preflight.
 *
 * This module evaluates declarations only. It never creates a pool, opens a
 * database connection, configures a driver, cancels a query or shuts down a
 * service. A passing report remains review-required until driver-specific
 * runtime mapping and isolated behavior tests are independently verified.
 */

export type PostgresPoolDriverAdapterState = "NOT_SELECTED" | "UNREVIEWED" | "REVIEWED";
export type PostgresPoolRuntimeMappingState = "UNVERIFIED" | "VERIFIED";
export type PostgresPoolQueueOverflowBehavior = "REJECT" | "UNBOUNDED";
export type PostgresPoolShutdownBehavior =
  | "STOP_ADMISSION_THEN_DRAIN"
  | "IMMEDIATE_TERMINATION"
  | "UNKNOWN";

export interface PostgresPoolLifecycleTestEvidence {
  readonly connectionTimeoutEnforced: boolean;
  readonly acquisitionTimeoutEnforced: boolean;
  readonly statementTimeoutCancelsQuery: boolean;
  readonly lockTimeoutCancelsBlockedStatement: boolean;
  readonly idleInTransactionTimeoutEnforced: boolean;
  readonly queueOverflowRejected: boolean;
  readonly shutdownStopsNewAcquisitions: boolean;
  readonly shutdownDrainsInFlightWork: boolean;
}

export interface PostgresPoolLifecyclePolicyPlan {
  /** Maximum time to establish one physical connection, in milliseconds. */
  readonly connectionTimeoutMs: number;
  /** Maximum caller wait for a pool acquisition, including connection creation. */
  readonly acquisitionTimeoutMs: number;
  /** Driver pool idle-connection eviction timeout, in milliseconds. */
  readonly idleConnectionTimeoutMs: number;
  /** Maximum physical connection lifetime before it must be recycled. */
  readonly maximumConnectionLifetimeMs: number;
  /** Effective server-side statement timeout, in milliseconds. */
  readonly statementTimeoutMs: number;
  /** Effective server-side lock wait timeout, in milliseconds. */
  readonly lockTimeoutMs: number;
  /** Effective server-side idle-in-transaction timeout, in milliseconds. */
  readonly idleInTransactionTimeoutMs: number;
  /** Maximum time allowed to drain in-flight work during graceful shutdown. */
  readonly shutdownDrainTimeoutMs: number;
  /** Maximum number of callers permitted to wait for a pooled connection. */
  readonly maximumPendingAcquisitions: number;
  /** Queue overflow must reject; an unbounded wait queue is not accepted. */
  readonly queueOverflowBehavior: PostgresPoolQueueOverflowBehavior;
  /** Shutdown must stop new acquisitions and drain accepted work. */
  readonly shutdownBehavior: PostgresPoolShutdownBehavior;
  /** Whether the selected driver's pool/timeout option mapping was reviewed. */
  readonly driverAdapterState: PostgresPoolDriverAdapterState;
  /** Safe evidence identifier for the selected driver and version review. */
  readonly driverAdapterEvidenceReference: string | null;
  /** Whether effective runtime options and server settings were independently checked. */
  readonly effectiveRuntimeMappingState: PostgresPoolRuntimeMappingState;
  /** Safe evidence identifier for effective runtime-option verification. */
  readonly effectiveRuntimeMappingEvidenceReference: string | null;
  /** Isolated tests must exercise the exact selected driver and PostgreSQL version. */
  readonly lifecycleTests: PostgresPoolLifecycleTestEvidence;
}

export type PostgresPoolLifecyclePolicyStatus =
  | "POOL_TIMEOUT_POLICY_BLOCKED_REVIEW_REQUIRED"
  | "POOL_ADMISSION_OR_SHUTDOWN_POLICY_BLOCKED_REVIEW_REQUIRED"
  | "POOL_LIFECYCLE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED"
  | "POOL_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED"
  | "TECHNICAL_POSTGRES_POOL_POLICY_CHECKS_PASSED_REVIEW_REQUIRED";

export interface PostgresPoolLifecyclePolicyAssessment {
  readonly status: PostgresPoolLifecyclePolicyStatus;
  readonly policy: Readonly<{
    connectionTimeoutMs: number;
    acquisitionTimeoutMs: number;
    idleConnectionTimeoutMs: number;
    maximumConnectionLifetimeMs: number;
    statementTimeoutMs: number;
    lockTimeoutMs: number;
    idleInTransactionTimeoutMs: number;
    shutdownDrainTimeoutMs: number;
    maximumPendingAcquisitions: number;
    queueOverflowBehavior: PostgresPoolQueueOverflowBehavior;
    shutdownBehavior: PostgresPoolShutdownBehavior;
    driverAdapterState: PostgresPoolDriverAdapterState;
    effectiveRuntimeMappingState: PostgresPoolRuntimeMappingState;
  }>;
  readonly evidence: Readonly<{
    driverAdapterEvidenceReference: string | null;
    effectiveRuntimeMappingEvidenceReference: string | null;
    lifecycleTests: Readonly<PostgresPoolLifecycleTestEvidence>;
  }>;
  readonly reasonCodes: readonly string[];
  readonly humanReviewRequired: readonly string[];
  readonly databaseDeploymentApproved: false;
  readonly providerActivationAuthorized: false;
  readonly tradingAuthorized: false;
}

const REQUIRED_KEYS = Object.freeze([
  "connectionTimeoutMs",
  "acquisitionTimeoutMs",
  "idleConnectionTimeoutMs",
  "maximumConnectionLifetimeMs",
  "statementTimeoutMs",
  "lockTimeoutMs",
  "idleInTransactionTimeoutMs",
  "shutdownDrainTimeoutMs",
  "maximumPendingAcquisitions",
  "queueOverflowBehavior",
  "shutdownBehavior",
  "driverAdapterState",
  "driverAdapterEvidenceReference",
  "effectiveRuntimeMappingState",
  "effectiveRuntimeMappingEvidenceReference",
  "lifecycleTests"
] as const);

const LIFECYCLE_TEST_KEYS = Object.freeze([
  "connectionTimeoutEnforced",
  "acquisitionTimeoutEnforced",
  "statementTimeoutCancelsQuery",
  "lockTimeoutCancelsBlockedStatement",
  "idleInTransactionTimeoutEnforced",
  "queueOverflowRejected",
  "shutdownStopsNewAcquisitions",
  "shutdownDrainsInFlightWork"
] as const);

const HUMAN_REVIEW_REQUIRED = Object.freeze([
  "SELECT_AND_PIN_THE_ACTUAL_POSTGRESQL_DRIVER_AND_VERSION",
  "MAP_EACH_POLICY_TIMEOUT_TO_THE_SELECTED_DRIVERS_EFFECTIVE_OPTION_OR_SERVER_SETTING",
  "VERIFY_POOL_QUEUE_CAPACITY_AND_OVERFLOW_BEHAVIOR_IN_THE_EFFECTIVE_RUNTIME",
  "RUN_TIMEOUT_CANCELLATION_AND_GRACEFUL_SHUTDOWN_TESTS_AGAINST_DISPOSABLE_POSTGRESQL",
  "VERIFY_THE_EFFECTIVE_DATABASE_ROLE_AND_SESSION_LEVEL_TIMEOUT_SETTINGS",
  "REVIEW_AGGREGATE_POOL_CAPACITY_WITH_PHASE_6_35",
  "OWNER_AND_DATABASE_OPERATOR_APPROVAL"
] as const);

const SAFE_EVIDENCE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const DRIVER_STATES = Object.freeze(["NOT_SELECTED", "UNREVIEWED", "REVIEWED"] as const);
const MAPPING_STATES = Object.freeze(["UNVERIFIED", "VERIFIED"] as const);
const QUEUE_BEHAVIORS = Object.freeze(["REJECT", "UNBOUNDED"] as const);
const SHUTDOWN_BEHAVIORS = Object.freeze([
  "STOP_ADMISSION_THEN_DRAIN",
  "IMMEDIATE_TERMINATION",
  "UNKNOWN"
] as const);
const MAX_PENDING_ACQUISITIONS = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function isPositiveSafeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isPendingAcquisitionCount(value: unknown): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_PENDING_ACQUISITIONS;
}

function isReference(value: unknown): value is string {
  return typeof value === "string" && SAFE_EVIDENCE_REFERENCE.test(value);
}

function isNullableReference(value: unknown): value is string | null {
  return value === null || isReference(value);
}

function isDriverState(value: unknown): value is PostgresPoolDriverAdapterState {
  return typeof value === "string" &&
    (DRIVER_STATES as readonly string[]).includes(value);
}

function isMappingState(value: unknown): value is PostgresPoolRuntimeMappingState {
  return typeof value === "string" &&
    (MAPPING_STATES as readonly string[]).includes(value);
}

function isQueueBehavior(value: unknown): value is PostgresPoolQueueOverflowBehavior {
  return typeof value === "string" &&
    (QUEUE_BEHAVIORS as readonly string[]).includes(value);
}

function isShutdownBehavior(value: unknown): value is PostgresPoolShutdownBehavior {
  return typeof value === "string" &&
    (SHUTDOWN_BEHAVIORS as readonly string[]).includes(value);
}

function isLifecycleTests(value: unknown): value is PostgresPoolLifecycleTestEvidence {
  if (!isRecord(value) || !hasExactKeys(value, LIFECYCLE_TEST_KEYS)) return false;
  return LIFECYCLE_TEST_KEYS.every((key) => typeof value[key] === "boolean");
}

function invalidPlan(): never {
  throw new TypeError("INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN");
}

/**
 * Assess declared PostgreSQL pool/timeout/shutdown behavior without configuring
 * or connecting a driver. Numeric relationships are consistency checks only;
 * the caller remains responsible for selecting workload-appropriate values.
 */
export function assessPostgresPoolLifecyclePolicy(
  input: unknown
): PostgresPoolLifecyclePolicyAssessment {
  if (!isRecord(input) || !hasExactKeys(input, REQUIRED_KEYS)) return invalidPlan();

  if (!isPositiveSafeInteger(input.connectionTimeoutMs) ||
      !isPositiveSafeInteger(input.acquisitionTimeoutMs) ||
      !isPositiveSafeInteger(input.idleConnectionTimeoutMs) ||
      !isPositiveSafeInteger(input.maximumConnectionLifetimeMs) ||
      !isPositiveSafeInteger(input.statementTimeoutMs) ||
      !isPositiveSafeInteger(input.lockTimeoutMs) ||
      !isPositiveSafeInteger(input.idleInTransactionTimeoutMs) ||
      !isPositiveSafeInteger(input.shutdownDrainTimeoutMs) ||
      !isPendingAcquisitionCount(input.maximumPendingAcquisitions) ||
      !isQueueBehavior(input.queueOverflowBehavior) ||
      !isShutdownBehavior(input.shutdownBehavior) ||
      !isDriverState(input.driverAdapterState) ||
      !isNullableReference(input.driverAdapterEvidenceReference) ||
      !isMappingState(input.effectiveRuntimeMappingState) ||
      !isNullableReference(input.effectiveRuntimeMappingEvidenceReference) ||
      !isLifecycleTests(input.lifecycleTests)) {
    return invalidPlan();
  }

  if ((input.driverAdapterState === "REVIEWED") !==
      (input.driverAdapterEvidenceReference !== null) ||
      (input.effectiveRuntimeMappingState === "VERIFIED") !==
      (input.effectiveRuntimeMappingEvidenceReference !== null) ||
      (input.effectiveRuntimeMappingState === "VERIFIED" &&
       input.driverAdapterState !== "REVIEWED")) {
    return invalidPlan();
  }

  const reasonCodes: string[] = [];
  let timeoutPolicyBlocked = false;
  let admissionOrShutdownBlocked = false;

  if (input.connectionTimeoutMs > input.acquisitionTimeoutMs) {
    timeoutPolicyBlocked = true;
    reasonCodes.push("CONNECTION_TIMEOUT_EXCEEDS_ACQUISITION_TIMEOUT");
  }
  if (input.lockTimeoutMs >= input.statementTimeoutMs) {
    timeoutPolicyBlocked = true;
    reasonCodes.push("LOCK_TIMEOUT_NOT_SHORTER_THAN_STATEMENT_TIMEOUT");
  }
  if (input.shutdownDrainTimeoutMs < input.statementTimeoutMs) {
    timeoutPolicyBlocked = true;
    reasonCodes.push("SHUTDOWN_DRAIN_TIMEOUT_SHORTER_THAN_STATEMENT_TIMEOUT");
  }
  if (input.queueOverflowBehavior !== "REJECT") {
    admissionOrShutdownBlocked = true;
    reasonCodes.push("POOL_QUEUE_OVERFLOW_IS_UNBOUNDED");
  }
  if (input.shutdownBehavior !== "STOP_ADMISSION_THEN_DRAIN") {
    admissionOrShutdownBlocked = true;
    reasonCodes.push("SHUTDOWN_DOES_NOT_STOP_ADMISSION_AND_DRAIN");
  }

  const lifecycleTests = input.lifecycleTests;
  const failedLifecycleTests: readonly [keyof PostgresPoolLifecycleTestEvidence, string][] = [
    ["connectionTimeoutEnforced", "CONNECTION_TIMEOUT_ENFORCEMENT_TEST_MISSING"],
    ["acquisitionTimeoutEnforced", "POOL_ACQUISITION_TIMEOUT_TEST_MISSING"],
    ["statementTimeoutCancelsQuery", "STATEMENT_TIMEOUT_CANCELLATION_TEST_MISSING"],
    ["lockTimeoutCancelsBlockedStatement", "LOCK_TIMEOUT_CANCELLATION_TEST_MISSING"],
    ["idleInTransactionTimeoutEnforced", "IDLE_IN_TRANSACTION_TIMEOUT_TEST_MISSING"],
    ["queueOverflowRejected", "POOL_QUEUE_OVERFLOW_REJECTION_TEST_MISSING"],
    ["shutdownStopsNewAcquisitions", "SHUTDOWN_ADMISSION_STOP_TEST_MISSING"],
    ["shutdownDrainsInFlightWork", "SHUTDOWN_DRAIN_TEST_MISSING"]
  ];
  let lifecycleTestsIncomplete = false;
  for (const [key, reason] of failedLifecycleTests) {
    if (!lifecycleTests[key]) {
      lifecycleTestsIncomplete = true;
      reasonCodes.push(reason);
    }
  }

  const driverAdapterUnreviewed =
    input.driverAdapterState !== "REVIEWED" ||
    input.driverAdapterEvidenceReference === null ||
    input.effectiveRuntimeMappingState !== "VERIFIED" ||
    input.effectiveRuntimeMappingEvidenceReference === null;

  if (input.driverAdapterState !== "REVIEWED" ||
      input.driverAdapterEvidenceReference === null) {
    reasonCodes.push("POSTGRESQL_POOL_DRIVER_ADAPTER_NOT_REVIEWED");
  }
  if (input.effectiveRuntimeMappingState !== "VERIFIED" ||
      input.effectiveRuntimeMappingEvidenceReference === null) {
    reasonCodes.push("POSTGRESQL_POOL_EFFECTIVE_RUNTIME_MAPPING_NOT_VERIFIED");
  }

  let status: PostgresPoolLifecyclePolicyStatus;
  if (timeoutPolicyBlocked) {
    status = "POOL_TIMEOUT_POLICY_BLOCKED_REVIEW_REQUIRED";
  } else if (admissionOrShutdownBlocked) {
    status = "POOL_ADMISSION_OR_SHUTDOWN_POLICY_BLOCKED_REVIEW_REQUIRED";
  } else if (lifecycleTestsIncomplete) {
    status = "POOL_LIFECYCLE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED";
  } else if (driverAdapterUnreviewed) {
    status = "POOL_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED";
  } else {
    status = "TECHNICAL_POSTGRES_POOL_POLICY_CHECKS_PASSED_REVIEW_REQUIRED";
  }

  return Object.freeze({
    status,
    policy: Object.freeze({
      connectionTimeoutMs: input.connectionTimeoutMs,
      acquisitionTimeoutMs: input.acquisitionTimeoutMs,
      idleConnectionTimeoutMs: input.idleConnectionTimeoutMs,
      maximumConnectionLifetimeMs: input.maximumConnectionLifetimeMs,
      statementTimeoutMs: input.statementTimeoutMs,
      lockTimeoutMs: input.lockTimeoutMs,
      idleInTransactionTimeoutMs: input.idleInTransactionTimeoutMs,
      shutdownDrainTimeoutMs: input.shutdownDrainTimeoutMs,
      maximumPendingAcquisitions: input.maximumPendingAcquisitions,
      queueOverflowBehavior: input.queueOverflowBehavior,
      shutdownBehavior: input.shutdownBehavior,
      driverAdapterState: input.driverAdapterState,
      effectiveRuntimeMappingState: input.effectiveRuntimeMappingState
    }),
    evidence: Object.freeze({
      driverAdapterEvidenceReference: input.driverAdapterEvidenceReference,
      effectiveRuntimeMappingEvidenceReference: input.effectiveRuntimeMappingEvidenceReference,
      lifecycleTests: Object.freeze({ ...lifecycleTests })
    }),
    reasonCodes: Object.freeze(reasonCodes),
    humanReviewRequired: HUMAN_REVIEW_REQUIRED,
    databaseDeploymentApproved: false as const,
    providerActivationAuthorized: false as const,
    tradingAuthorized: false as const
  });
}
