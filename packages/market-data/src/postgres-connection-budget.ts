/**
 * Offline PostgreSQL connection-capacity planning.
 *
 * This module deliberately accepts only operator-supplied numeric declarations.
 * It does not open a connection, read a DSN, select a driver, set pool values or
 * authorize a deployment. All results remain review-required.
 */

export interface PostgresConnectionBudgetPlan {
  /** PostgreSQL max_connections from an owner-verified server configuration source. */
  readonly maxConnections: number;
  /** Combined server-reserved slots that are not available to the application workload. */
  readonly reservedConnections: number;
  /** Additional headroom held back for failover, administration and unexpected demand. */
  readonly safetyBufferConnections: number;
  /** Maximum simultaneously active agent instances, including autoscaling ceiling. */
  readonly runtimeInstanceCount: number;
  /** Configured maximum pool size for each agent instance. */
  readonly maxPoolConnectionsPerInstance: number;
  /** Peak connections reserved for the separate monitoring collector. */
  readonly monitoringConnections: number;
  /** Peak connections reserved for controlled migration operations. */
  readonly migrationConnections: number;
  /** Peak concurrent connections for all other services sharing this PostgreSQL server. */
  readonly otherServiceConnections: number;
  /** Additional free connections required after the above planned workload. */
  readonly minimumHeadroomConnections: number;
}

export type PostgresConnectionBudgetStatus =
  | "CAPACITY_EXCEEDED_REVIEW_REQUIRED"
  | "HEADROOM_BELOW_MINIMUM_REVIEW_REQUIRED"
  | "TECHNICAL_CAPACITY_CHECKS_PASSED_REVIEW_REQUIRED";

export interface PostgresConnectionBudgetAssessment {
  readonly status: PostgresConnectionBudgetStatus;
  readonly capacity: Readonly<{
    maxConnections: number;
    reservedConnections: number;
    safetyBufferConnections: number;
    usableConnectionBudget: number;
  }>;
  readonly workload: Readonly<{
    runtimeInstanceCount: number;
    maxPoolConnectionsPerInstance: number;
    runtimePoolCeiling: number;
    monitoringConnections: number;
    migrationConnections: number;
    otherServiceConnections: number;
    plannedTotalConnections: number;
  }>;
  readonly headroom: Readonly<{
    remainingConnections: number;
    requiredConnections: number;
    utilizationPercent: number;
  }>;
  readonly reasonCodes: readonly string[];
  readonly humanReviewRequired: readonly string[];
  readonly databaseDeploymentApproved: false;
  readonly providerActivationAuthorized: false;
  readonly tradingAuthorized: false;
}

const REQUIRED_KEYS = Object.freeze([
  "maxConnections",
  "reservedConnections",
  "safetyBufferConnections",
  "runtimeInstanceCount",
  "maxPoolConnectionsPerInstance",
  "monitoringConnections",
  "migrationConnections",
  "otherServiceConnections",
  "minimumHeadroomConnections"
] as const);

const HUMAN_REVIEW_REQUIRED = Object.freeze([
  "VERIFY_MAX_CONNECTIONS_AND_RESERVED_SLOTS_AGAINST_TARGET_SERVER",
  "VERIFY_RUNTIME_INSTANCE_COUNT_INCLUDING_AUTOSCALING_AND_ROLLOUT_OVERLAP",
  "VERIFY_PER_INSTANCE_POOL_MAXIMUM_AND_OTHER_SERVICE_DEMAND",
  "REVIEW_DRIVER_SPECIFIC_POOL_TIMEOUTS_AND_CONNECTION_LIFECYCLE",
  "REVIEW_STRICT_CLIENT_TLS_CERTIFICATE_AND_HOSTNAME_VERIFICATION",
  "OWNER_AND_DATABASE_OPERATOR_APPROVAL"
] as const);

const MAX_DECLARED_CONNECTION_COUNT = 1_000_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConnectionCount(value: unknown, minimum: number): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= MAX_DECLARED_CONNECTION_COUNT;
}

function invalidPlan(): never {
  throw new TypeError("INVALID_POSTGRES_CONNECTION_BUDGET_PLAN");
}

/**
 * Evaluate the worst-case aggregate pool budget across all configured runtime
 * instances and separately declared monitoring/migration/other workloads.
 *
 * A passing result confirms arithmetic consistency only. It does not verify
 * server settings, infrastructure scaling, actual driver behavior, TLS or
 * runtime usage and can never approve deployment, provider activation or trade.
 */
export function assessPostgresConnectionBudget(
  input: unknown
): PostgresConnectionBudgetAssessment {
  if (!isRecord(input)) return invalidPlan();

  const actualKeys = Object.keys(input).sort();
  const expectedKeys = [...REQUIRED_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length ||
      !actualKeys.every((key, index) => key === expectedKeys[index])) {
    return invalidPlan();
  }

  if (!isConnectionCount(input.maxConnections, 1) ||
      !isConnectionCount(input.reservedConnections, 0) ||
      !isConnectionCount(input.safetyBufferConnections, 0) ||
      !isConnectionCount(input.runtimeInstanceCount, 1) ||
      !isConnectionCount(input.maxPoolConnectionsPerInstance, 1) ||
      !isConnectionCount(input.monitoringConnections, 0) ||
      !isConnectionCount(input.migrationConnections, 0) ||
      !isConnectionCount(input.otherServiceConnections, 0) ||
      !isConnectionCount(input.minimumHeadroomConnections, 0)) {
    return invalidPlan();
  }

  const maxConnections = BigInt(input.maxConnections);
  const reservedConnections = BigInt(input.reservedConnections);
  const safetyBufferConnections = BigInt(input.safetyBufferConnections);
  const usableConnectionBudget = maxConnections - reservedConnections - safetyBufferConnections;
  if (usableConnectionBudget <= 0n) return invalidPlan();

  const runtimePoolCeiling =
    BigInt(input.runtimeInstanceCount) * BigInt(input.maxPoolConnectionsPerInstance);
  const plannedTotalConnections =
    runtimePoolCeiling +
    BigInt(input.monitoringConnections) +
    BigInt(input.migrationConnections) +
    BigInt(input.otherServiceConnections);
  const remainingConnections = usableConnectionBudget - plannedTotalConnections;
  const requiredHeadroom = BigInt(input.minimumHeadroomConnections);

  const reasonCodes: string[] = [];
  let status: PostgresConnectionBudgetStatus;
  if (remainingConnections < 0n) {
    status = "CAPACITY_EXCEEDED_REVIEW_REQUIRED";
    reasonCodes.push("PLANNED_CONNECTIONS_EXCEED_USABLE_BUDGET");
  } else if (remainingConnections < requiredHeadroom) {
    status = "HEADROOM_BELOW_MINIMUM_REVIEW_REQUIRED";
    reasonCodes.push("CONNECTION_HEADROOM_BELOW_REQUIRED_MINIMUM");
  } else {
    status = "TECHNICAL_CAPACITY_CHECKS_PASSED_REVIEW_REQUIRED";
  }

  const utilizationBasisPoints =
    (plannedTotalConnections * 20_000n + usableConnectionBudget) /
    (usableConnectionBudget * 2n);

  return Object.freeze({
    status,
    capacity: Object.freeze({
      maxConnections: input.maxConnections,
      reservedConnections: input.reservedConnections,
      safetyBufferConnections: input.safetyBufferConnections,
      usableConnectionBudget: Number(usableConnectionBudget)
    }),
    workload: Object.freeze({
      runtimeInstanceCount: input.runtimeInstanceCount,
      maxPoolConnectionsPerInstance: input.maxPoolConnectionsPerInstance,
      runtimePoolCeiling: Number(runtimePoolCeiling),
      monitoringConnections: input.monitoringConnections,
      migrationConnections: input.migrationConnections,
      otherServiceConnections: input.otherServiceConnections,
      plannedTotalConnections: Number(plannedTotalConnections)
    }),
    headroom: Object.freeze({
      remainingConnections: Number(remainingConnections),
      requiredConnections: input.minimumHeadroomConnections,
      utilizationPercent: Number(utilizationBasisPoints) / 100
    }),
    reasonCodes: Object.freeze(reasonCodes),
    humanReviewRequired: HUMAN_REVIEW_REQUIRED,
    databaseDeploymentApproved: false as const,
    providerActivationAuthorized: false as const,
    tradingAuthorized: false as const
  });
}
