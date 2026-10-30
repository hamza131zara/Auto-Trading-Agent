import assert from "node:assert/strict";
import test from "node:test";
import {
  assessPostgresProviderHealthOperationalMonitoring,
  ProviderHealthStoreError
} from "../packages/market-data/dist/provider-health-store.js";

const POLICY = Object.freeze({
  maxConnectionUtilizationPercent: 80,
  maxOldestOpenTransactionSeconds: 120,
  maxLongestActiveQuerySeconds: 60,
  maxIdleInTransactionCount: 2,
  maxOldestIdleInTransactionSeconds: 30,
  maxLockWaitCount: 0,
  maxDeadlocksSinceStatsReset: 10,
  maxDatabaseSizeBytes: "10000000"
});

const BASE_ROW = Object.freeze({
  monitoring_role: "ata_monitor",
  role_is_superuser: true,
  has_read_all_stats: false,
  activity_tracking_enabled: true,
  current_database_connections: "12",
  max_connections: "100",
  active_query_count: "1",
  oldest_open_transaction_seconds: "17",
  longest_active_query_seconds: "3",
  idle_in_transaction_count: "1",
  oldest_idle_in_transaction_seconds: "8",
  lock_wait_count: "0",
  deadlocks_since_stats_reset: "2",
  stats_reset_at: "2026-10-30T00:00:00.000Z",
  database_size_bytes: "2048000",
  sampled_at: "2026-10-30T12:00:00.000Z"
});

function clientWith(row = {}, options = {}) {
  const calls = [];
  return {
    calls,
    client: {
      async query(sql, parameters) {
        calls.push({ sql, parameters });
        if (options.error) throw options.error;
        return { rows: [Object.freeze({ ...BASE_ROW, ...row })] };
      }
    }
  };
}

test("one read-only monitoring snapshot reports aggregate metrics and never approves operations", async () => {
  const { client, calls } = clientWith();
  const report = await assessPostgresProviderHealthOperationalMonitoring(client, POLICY);

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql.trim(), /^WITH monitoring_role AS \(/);
  assert.match(calls[0].sql, /pg_stat_activity/);
  assert.match(calls[0].sql, /pg_stat_database/);
  assert.match(calls[0].sql, /pg_database_size/);
  assert.doesNotMatch(calls[0].sql, /pg_stat_activity\.query\b/i);
  assert.doesNotMatch(calls[0].sql, /\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|CREATE)\s+/i);
  assert.equal(calls[0].parameters, undefined);
  assert.equal(report.status, "TECHNICAL_MONITORING_CHECKS_PASSED_REVIEW_REQUIRED");
  assert.equal(report.monitoringRole, "ata_monitor");
  assert.equal(report.activityVisibility, "DATABASE_WIDE");
  assert.equal(report.activityTrackingEnabled, true);
  assert.equal(report.metrics.currentDatabaseConnections, 12);
  assert.equal(report.metrics.maxConnections, 100);
  assert.equal(report.metrics.connectionUtilizationPercent, 12);
  assert.equal(report.metrics.idleInTransactionCount, 1);
  assert.equal(report.metrics.databaseSizeBytes, "2048000");
  assert.deepEqual(report.thresholdBreaches, []);
  assert.deepEqual(report.reasonCodes, []);
  assert.equal(report.providerHealthMonitoringApproved, false);
  assert.equal(report.providerActivationAuthorized, false);
  assert.equal(report.tradingAuthorized, false);
});

test("policy threshold breaches return deterministic alert codes", async () => {
  const { client } = clientWith({
    current_database_connections: "91",
    active_query_count: "5",
    oldest_open_transaction_seconds: "121",
    longest_active_query_seconds: "61",
    idle_in_transaction_count: "3",
    oldest_idle_in_transaction_seconds: "31",
    lock_wait_count: "1",
    deadlocks_since_stats_reset: "11",
    database_size_bytes: "10000001"
  });
  const report = await assessPostgresProviderHealthOperationalMonitoring(client, POLICY);
  assert.equal(report.status, "ALERT_REVIEW_REQUIRED");
  assert.deepEqual(report.thresholdBreaches, [
    "CONNECTION_UTILIZATION_ABOVE_THRESHOLD",
    "OLDEST_OPEN_TRANSACTION_ABOVE_THRESHOLD",
    "LONGEST_ACTIVE_QUERY_ABOVE_THRESHOLD",
    "IDLE_IN_TRANSACTION_COUNT_ABOVE_THRESHOLD",
    "OLDEST_IDLE_IN_TRANSACTION_ABOVE_THRESHOLD",
    "LOCK_WAIT_COUNT_ABOVE_THRESHOLD",
    "DEADLOCKS_SINCE_STATS_RESET_ABOVE_THRESHOLD",
    "DATABASE_SIZE_ABOVE_THRESHOLD"
  ]);
  assert.deepEqual(report.reasonCodes, report.thresholdBreaches);
  assert.equal(report.tradingAuthorized, false);
});

test("ordinary database role is marked monitoring-scope-limited without pg_read_all_stats", async () => {
  const { client } = clientWith({
    role_is_superuser: false,
    has_read_all_stats: false
  });
  const report = await assessPostgresProviderHealthOperationalMonitoring(client, POLICY);
  assert.equal(report.status, "MONITORING_SCOPE_LIMITED_REVIEW_REQUIRED");
  assert.equal(report.activityVisibility, "CURRENT_ROLE_ONLY");
  assert.deepEqual(report.reasonCodes, ["POSTGRES_ACTIVITY_VISIBILITY_LIMITED"]);
  assert.equal(report.providerHealthMonitoringApproved, false);
});

test("disabled activity tracking is never represented as complete monitoring", async () => {
  const { client } = clientWith({ activity_tracking_enabled: false });
  const report = await assessPostgresProviderHealthOperationalMonitoring(client, POLICY);
  assert.equal(report.status, "MONITORING_SCOPE_LIMITED_REVIEW_REQUIRED");
  assert.ok(report.reasonCodes.includes("POSTGRES_ACTIVITY_TRACKING_DISABLED"));
});

test("threshold policy is mandatory, exact and range checked before querying", async () => {
  const { client, calls } = clientWith();
  await assert.rejects(
    () => assessPostgresProviderHealthOperationalMonitoring(client, undefined),
    (error) => error instanceof ProviderHealthStoreError && error.code === "INVALID_INPUT"
  );
  await assert.rejects(
    () => assessPostgresProviderHealthOperationalMonitoring(client, {
      ...POLICY,
      maxConnectionUtilizationPercent: 101
    }),
    (error) => error instanceof ProviderHealthStoreError && error.code === "INVALID_INPUT"
  );
  await assert.rejects(
    () => assessPostgresProviderHealthOperationalMonitoring(client, {
      ...POLICY,
      maxDatabaseSizeBytes: "-1"
    }),
    (error) => error instanceof ProviderHealthStoreError && error.code === "INVALID_INPUT"
  );
  assert.equal(calls.length, 0);
});

test("malformed metrics fail closed and do not produce a partial healthy report", async () => {
  const { client } = clientWith({ max_connections: "0" });
  await assert.rejects(
    () => assessPostgresProviderHealthOperationalMonitoring(client, POLICY),
    (error) => error instanceof ProviderHealthStoreError && error.code === "DATABASE_OPERATION_FAILED"
  );
});

test("driver errors are sanitized and do not leak connection details", async () => {
  const { client } = clientWith({}, {
    error: new Error("password=do-not-leak host=private-db.internal")
  });
  await assert.rejects(
    () => assessPostgresProviderHealthOperationalMonitoring(client, POLICY),
    (error) => error instanceof ProviderHealthStoreError &&
      error.code === "DATABASE_OPERATION_FAILED" &&
      !error.message.includes("private-db.internal") &&
      !error.message.includes("do-not-leak")
  );
});

test("invalid query client is rejected before any query", async () => {
  await assert.rejects(
    () => assessPostgresProviderHealthOperationalMonitoring({}, POLICY),
    (error) => error instanceof ProviderHealthStoreError && error.code === "INVALID_INPUT"
  );
});
