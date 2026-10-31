import assert from "node:assert/strict";
import test from "node:test";
import { assessPostgresPoolLifecyclePolicy } from "../packages/market-data/dist/postgres-pool-lifecycle-policy.js";

const BASE_PLAN = Object.freeze({
  connectionTimeoutMs: 2_500,
  acquisitionTimeoutMs: 5_000,
  idleConnectionTimeoutMs: 30_000,
  maximumConnectionLifetimeMs: 3_600_000,
  statementTimeoutMs: 15_000,
  lockTimeoutMs: 3_000,
  idleInTransactionTimeoutMs: 60_000,
  shutdownDrainTimeoutMs: 20_000,
  maximumPendingAcquisitions: 32,
  queueOverflowBehavior: "REJECT",
  shutdownBehavior: "STOP_ADMISSION_THEN_DRAIN",
  driverAdapterState: "REVIEWED",
  driverAdapterEvidenceReference: "evidence:postgres-pool-driver-001",
  effectiveRuntimeMappingState: "VERIFIED",
  effectiveRuntimeMappingEvidenceReference: "evidence:postgres-pool-runtime-002",
  lifecycleTests: Object.freeze({
    connectionTimeoutEnforced: true,
    acquisitionTimeoutEnforced: true,
    statementTimeoutCancelsQuery: true,
    lockTimeoutCancelsBlockedStatement: true,
    idleInTransactionTimeoutEnforced: true,
    queueOverflowRejected: true,
    shutdownStopsNewAcquisitions: true,
    shutdownDrainsInFlightWork: true
  })
});

test("accepts a coherent pool lifecycle declaration but keeps deployment review-required", () => {
  const report = assessPostgresPoolLifecyclePolicy(BASE_PLAN);

  assert.equal(report.status, "TECHNICAL_POSTGRES_POOL_POLICY_CHECKS_PASSED_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, []);
  assert.equal(report.policy.connectionTimeoutMs, 2_500);
  assert.equal(report.policy.maximumPendingAcquisitions, 32);
  assert.equal(report.evidence.lifecycleTests.shutdownDrainsInFlightWork, true);
  assert.equal(report.databaseDeploymentApproved, false);
  assert.equal(report.providerActivationAuthorized, false);
  assert.equal(report.tradingAuthorized, false);
});

test("blocks connection-establishment timeout greater than total acquisition timeout", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    connectionTimeoutMs: 5_001
  });

  assert.equal(report.status, "POOL_TIMEOUT_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "CONNECTION_TIMEOUT_EXCEEDS_ACQUISITION_TIMEOUT"
  ]);
});

test("requires lock timeout to be strictly shorter than statement timeout", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    lockTimeoutMs: BASE_PLAN.statementTimeoutMs
  });

  assert.equal(report.status, "POOL_TIMEOUT_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.ok(report.reasonCodes.includes("LOCK_TIMEOUT_NOT_SHORTER_THAN_STATEMENT_TIMEOUT"));
});

test("requires the graceful shutdown drain window to cover the statement timeout", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    shutdownDrainTimeoutMs: BASE_PLAN.statementTimeoutMs - 1
  });

  assert.equal(report.status, "POOL_TIMEOUT_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.ok(report.reasonCodes.includes("SHUTDOWN_DRAIN_TIMEOUT_SHORTER_THAN_STATEMENT_TIMEOUT"));
});

test("rejects an unbounded pool acquisition queue", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    queueOverflowBehavior: "UNBOUNDED"
  });

  assert.equal(report.status, "POOL_ADMISSION_OR_SHUTDOWN_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.ok(report.reasonCodes.includes("POOL_QUEUE_OVERFLOW_IS_UNBOUNDED"));
});

test("requires shutdown to stop new admissions before draining accepted work", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    shutdownBehavior: "IMMEDIATE_TERMINATION"
  });

  assert.equal(report.status, "POOL_ADMISSION_OR_SHUTDOWN_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.ok(report.reasonCodes.includes("SHUTDOWN_DOES_NOT_STOP_ADMISSION_AND_DRAIN"));
});

test("requires every timeout, queue and shutdown behavior test", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    lifecycleTests: {
      ...BASE_PLAN.lifecycleTests,
      connectionTimeoutEnforced: false,
      statementTimeoutCancelsQuery: false,
      lockTimeoutCancelsBlockedStatement: false,
      queueOverflowRejected: false,
      shutdownDrainsInFlightWork: false
    }
  });

  assert.equal(report.status, "POOL_LIFECYCLE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "CONNECTION_TIMEOUT_ENFORCEMENT_TEST_MISSING",
    "STATEMENT_TIMEOUT_CANCELLATION_TEST_MISSING",
    "LOCK_TIMEOUT_CANCELLATION_TEST_MISSING",
    "POOL_QUEUE_OVERFLOW_REJECTION_TEST_MISSING",
    "SHUTDOWN_DRAIN_TEST_MISSING"
  ]);
});

test("does not claim readiness when the PostgreSQL driver is not selected", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    driverAdapterState: "NOT_SELECTED",
    driverAdapterEvidenceReference: null,
    effectiveRuntimeMappingState: "UNVERIFIED",
    effectiveRuntimeMappingEvidenceReference: null
  });

  assert.equal(report.status, "POOL_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED");
  assert.ok(report.reasonCodes.includes("POSTGRESQL_POOL_DRIVER_ADAPTER_NOT_REVIEWED"));
  assert.ok(report.reasonCodes.includes("POSTGRESQL_POOL_EFFECTIVE_RUNTIME_MAPPING_NOT_VERIFIED"));
  assert.equal(report.databaseDeploymentApproved, false);
});

test("requires effective runtime mapping evidence after driver review", () => {
  const report = assessPostgresPoolLifecyclePolicy({
    ...BASE_PLAN,
    effectiveRuntimeMappingState: "UNVERIFIED",
    effectiveRuntimeMappingEvidenceReference: null
  });

  assert.equal(report.status, "POOL_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED");
  assert.ok(report.reasonCodes.includes("POSTGRESQL_POOL_EFFECTIVE_RUNTIME_MAPPING_NOT_VERIFIED"));
});

test("rejects evidence references that contain a URL, path or credential-like value", () => {
  assert.throws(
    () => assessPostgresPoolLifecyclePolicy({
      ...BASE_PLAN,
      driverAdapterEvidenceReference: "https://example.invalid/pool-review"
    }),
    /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresPoolLifecyclePolicy({
      ...BASE_PLAN,
      effectiveRuntimeMappingEvidenceReference: "/etc/postgresql/pg.conf"
    }),
    /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresPoolLifecyclePolicy({
      ...BASE_PLAN,
      driverAdapterEvidenceReference: "postgres://user:pass@host/db"
    }),
    /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
  );
});

test("rejects missing, extra and credential-shaped fields", () => {
  const { connectionTimeoutMs, ...incomplete } = BASE_PLAN;
  assert.equal(connectionTimeoutMs, BASE_PLAN.connectionTimeoutMs);
  assert.throws(
    () => assessPostgresPoolLifecyclePolicy(incomplete),
    /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresPoolLifecyclePolicy({
      ...BASE_PLAN,
      connectionString: "REDACTED"
    }),
    /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
  );
});

test("rejects malformed timeouts, fractional counts and unsafe queue bounds", () => {
  const invalidPlans = [
    { ...BASE_PLAN, connectionTimeoutMs: 0 },
    { ...BASE_PLAN, acquisitionTimeoutMs: -1 },
    { ...BASE_PLAN, idleConnectionTimeoutMs: 1.5 },
    { ...BASE_PLAN, maximumConnectionLifetimeMs: Number.MAX_SAFE_INTEGER + 1 },
    { ...BASE_PLAN, statementTimeoutMs: "15000" },
    { ...BASE_PLAN, lockTimeoutMs: 0 },
    { ...BASE_PLAN, idleInTransactionTimeoutMs: -1 },
    { ...BASE_PLAN, shutdownDrainTimeoutMs: 1.5 },
    { ...BASE_PLAN, maximumPendingAcquisitions: -1 },
    { ...BASE_PLAN, maximumPendingAcquisitions: 1_000_001 },
    { ...BASE_PLAN, maximumPendingAcquisitions: 4.5 }
  ];

  for (const plan of invalidPlans) {
    assert.throws(
      () => assessPostgresPoolLifecyclePolicy(plan),
      /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
    );
  }
});

test("rejects unknown enums and inconsistent adapter/mapping evidence states", () => {
  const invalidPlans = [
    { ...BASE_PLAN, queueOverflowBehavior: "WAIT_FOREVER" },
    { ...BASE_PLAN, shutdownBehavior: "GRACEFUL" },
    { ...BASE_PLAN, driverAdapterState: "SELECTED" },
    { ...BASE_PLAN, driverAdapterState: "UNREVIEWED", driverAdapterEvidenceReference: null },
    { ...BASE_PLAN, effectiveRuntimeMappingState: "VERIFIED", effectiveRuntimeMappingEvidenceReference: null },
    {
      ...BASE_PLAN,
      driverAdapterState: "NOT_SELECTED",
      driverAdapterEvidenceReference: null,
      effectiveRuntimeMappingState: "VERIFIED",
      effectiveRuntimeMappingEvidenceReference: "evidence:impossible-runtime-state"
    }
  ];

  for (const plan of invalidPlans) {
    assert.throws(
      () => assessPostgresPoolLifecyclePolicy(plan),
      /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
    );
  }
});

test("rejects a lifecycle test matrix with missing, extra or non-boolean fields", () => {
  const invalidPlans = [
    {
      ...BASE_PLAN,
      lifecycleTests: {
        ...BASE_PLAN.lifecycleTests,
        shutdownDrainsInFlightWork: undefined
      }
    },
    {
      ...BASE_PLAN,
      lifecycleTests: {
        ...BASE_PLAN.lifecycleTests,
        unexpectedTest: true
      }
    },
    {
      ...BASE_PLAN,
      lifecycleTests: {
        ...BASE_PLAN.lifecycleTests,
        acquisitionTimeoutEnforced: "true"
      }
    }
  ];

  for (const plan of invalidPlans) {
    assert.throws(
      () => assessPostgresPoolLifecyclePolicy(plan),
      /INVALID_POSTGRES_POOL_LIFECYCLE_POLICY_PLAN/
    );
  }
});

test("freezes the policy, evidence, test matrix, reason codes and assessment", () => {
  const report = assessPostgresPoolLifecyclePolicy(BASE_PLAN);

  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.policy), true);
  assert.equal(Object.isFrozen(report.evidence), true);
  assert.equal(Object.isFrozen(report.evidence.lifecycleTests), true);
  assert.equal(Object.isFrozen(report.reasonCodes), true);
  assert.equal(Object.isFrozen(report.humanReviewRequired), true);
});
