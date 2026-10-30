import assert from "node:assert/strict";
import test from "node:test";
import { assessPostgresConnectionBudget } from "../packages/market-data/dist/postgres-connection-budget.js";

const BASE_PLAN = Object.freeze({
  maxConnections: 100,
  reservedConnections: 5,
  safetyBufferConnections: 10,
  runtimeInstanceCount: 4,
  maxPoolConnectionsPerInstance: 10,
  monitoringConnections: 2,
  migrationConnections: 1,
  otherServiceConnections: 12,
  minimumHeadroomConnections: 20
});

test("calculates worst-case aggregate pool usage across every declared service", () => {
  const report = assessPostgresConnectionBudget(BASE_PLAN);

  assert.equal(report.status, "TECHNICAL_CAPACITY_CHECKS_PASSED_REVIEW_REQUIRED");
  assert.deepEqual(report.capacity, {
    maxConnections: 100,
    reservedConnections: 5,
    safetyBufferConnections: 10,
    usableConnectionBudget: 85
  });
  assert.deepEqual(report.workload, {
    runtimeInstanceCount: 4,
    maxPoolConnectionsPerInstance: 10,
    runtimePoolCeiling: 40,
    monitoringConnections: 2,
    migrationConnections: 1,
    otherServiceConnections: 12,
    plannedTotalConnections: 55
  });
  assert.deepEqual(report.headroom, {
    remainingConnections: 30,
    requiredConnections: 20,
    utilizationPercent: 64.71
  });
  assert.deepEqual(report.reasonCodes, []);
  assert.ok(report.humanReviewRequired.length >= 5);
  assert.equal(report.databaseDeploymentApproved, false);
  assert.equal(report.providerActivationAuthorized, false);
  assert.equal(report.tradingAuthorized, false);
});

test("blocks aggregate pool demand above usable server capacity", () => {
  const report = assessPostgresConnectionBudget({
    ...BASE_PLAN,
    runtimeInstanceCount: 8
  });

  assert.equal(report.status, "CAPACITY_EXCEEDED_REVIEW_REQUIRED");
  assert.equal(report.workload.runtimePoolCeiling, 80);
  assert.equal(report.workload.plannedTotalConnections, 95);
  assert.equal(report.headroom.remainingConnections, -10);
  assert.deepEqual(report.reasonCodes, ["PLANNED_CONNECTIONS_EXCEED_USABLE_BUDGET"]);
  assert.equal(report.databaseDeploymentApproved, false);
});

test("blocks a plan that fits but consumes the required minimum headroom", () => {
  const report = assessPostgresConnectionBudget({
    ...BASE_PLAN,
    otherServiceConnections: 32,
    minimumHeadroomConnections: 20
  });

  assert.equal(report.workload.plannedTotalConnections, 75);
  assert.equal(report.headroom.remainingConnections, 10);
  assert.equal(report.status, "HEADROOM_BELOW_MINIMUM_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, ["CONNECTION_HEADROOM_BELOW_REQUIRED_MINIMUM"]);
});

test("requires all workload categories instead of silently omitting connection consumers", () => {
  const { monitoringConnections, ...incomplete } = BASE_PLAN;
  assert.equal(monitoringConnections, 2);
  assert.throws(
    () => assessPostgresConnectionBudget(incomplete),
    /INVALID_POSTGRES_CONNECTION_BUDGET_PLAN/
  );
});

test("rejects unknown fields, connection strings and credentials", () => {
  assert.throws(
    () => assessPostgresConnectionBudget({
      ...BASE_PLAN,
      connectionString: "postgres://user:password@example.invalid/db"
    }),
    /INVALID_POSTGRES_CONNECTION_BUDGET_PLAN/
  );
});

test("rejects invalid counts and a reserved budget that consumes the whole server", () => {
  const invalidPlans = [
    { ...BASE_PLAN, maxConnections: 0 },
    { ...BASE_PLAN, runtimeInstanceCount: 0 },
    { ...BASE_PLAN, maxPoolConnectionsPerInstance: 0 },
    { ...BASE_PLAN, otherServiceConnections: -1 },
    { ...BASE_PLAN, minimumHeadroomConnections: 1.5 },
    { ...BASE_PLAN, maxConnections: 10, reservedConnections: 5, safetyBufferConnections: 5 }
  ];

  for (const plan of invalidPlans) {
    assert.throws(
      () => assessPostgresConnectionBudget(plan),
      /INVALID_POSTGRES_CONNECTION_BUDGET_PLAN/
    );
  }
});

test("uses exact integer multiplication for large declared aggregate budgets", () => {
  const report = assessPostgresConnectionBudget({
    maxConnections: 1_000_000,
    reservedConnections: 0,
    safetyBufferConnections: 0,
    runtimeInstanceCount: 1_000_000,
    maxPoolConnectionsPerInstance: 1_000_000,
    monitoringConnections: 0,
    migrationConnections: 0,
    otherServiceConnections: 0,
    minimumHeadroomConnections: 0
  });

  assert.equal(report.workload.runtimePoolCeiling, 1_000_000_000_000);
  assert.equal(report.status, "CAPACITY_EXCEEDED_REVIEW_REQUIRED");
  assert.equal(report.tradingAuthorized, false);
});

test("freezes reports so downstream callers cannot rewrite the capacity result", () => {
  const report = assessPostgresConnectionBudget(BASE_PLAN);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.capacity), true);
  assert.equal(Object.isFrozen(report.workload), true);
  assert.equal(Object.isFrozen(report.headroom), true);
  assert.equal(Object.isFrozen(report.reasonCodes), true);
});
