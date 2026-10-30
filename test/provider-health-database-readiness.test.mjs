import assert from "node:assert/strict";
import test from "node:test";
import {
  assessPostgresProviderHealthDatabaseReadiness,
  ProviderHealthStoreError
} from "../packages/market-data/dist/provider-health-store.js";

const BASE_ROW = Object.freeze({
  runtime_role: "ata_runtime",
  runtime_is_superuser: false,
  runtime_has_owner_membership: false,
  schema_present: true,
  public_schema_usage: true,
  health_can_select: true,
  health_can_insert: true,
  health_can_update: true,
  lease_can_select: true,
  lease_can_insert: true,
  lease_can_update: true,
  runtime_has_excess_privileges: false,
  transport_encrypted: true
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

test("PostgreSQL preflight checks the least-privilege encrypted runtime posture but never approves deployment", async () => {
  const { client, calls } = clientWith();
  const report = await assessPostgresProviderHealthDatabaseReadiness(client);

  assert.equal(calls.length, 1);
  assert.match(calls[0].sql.trim(), /^WITH app_relations AS \(/);
  assert.match(calls[0].sql, /SELECT/);
  assert.equal(calls[0].parameters, undefined);
  assert.equal(report.status, "TECHNICAL_CHECKS_PASSED_REVIEW_REQUIRED");
  assert.equal(report.runtimeRole, "ata_runtime");
  assert.deepEqual(report.reasonCodes, []);
  assert.equal(report.checks.schemaPresent, true);
  assert.equal(report.checks.requiredTablePrivileges, true);
  assert.equal(report.checks.noExcessPrivileges, true);
  assert.equal(report.checks.transportEncrypted, true);
  assert.ok(report.humanReviewRequired.includes("CLIENT_TLS_CERTIFICATE_CHAIN_AND_HOSTNAME_VERIFICATION"));
  assert.equal(report.providerHealthStoreDeploymentApproved, false);
  assert.equal(report.tradingAuthorized, false);
});

test("plaintext database transport blocks the preflight even when role and schema grants are correct", async () => {
  const { client } = clientWith({ transport_encrypted: false });
  const report = await assessPostgresProviderHealthDatabaseReadiness(client);

  assert.equal(report.status, "BLOCKED");
  assert.deepEqual(report.reasonCodes, ["DATABASE_CONNECTION_NOT_ENCRYPTED"]);
  assert.equal(report.checks.runtimeRoleNotSuperuser, true);
  assert.equal(report.checks.requiredTablePrivileges, true);
});

test("superuser, table-owner membership and excess privileges block the runtime role", async () => {
  const { client } = clientWith({
    runtime_is_superuser: true,
    runtime_has_owner_membership: true,
    runtime_has_excess_privileges: true
  });
  const report = await assessPostgresProviderHealthDatabaseReadiness(client);

  assert.equal(report.status, "BLOCKED");
  assert.deepEqual(report.reasonCodes, [
    "RUNTIME_ROLE_IS_SUPERUSER",
    "RUNTIME_ROLE_HAS_TABLE_OWNER_MEMBERSHIP",
    "RUNTIME_ROLE_HAS_EXCESS_PRIVILEGES"
  ]);
});

test("missing schema usage or required table operations block the preflight", async () => {
  const { client } = clientWith({
    schema_present: false,
    public_schema_usage: false,
    health_can_update: false,
    lease_can_insert: false
  });
  const report = await assessPostgresProviderHealthDatabaseReadiness(client);

  assert.equal(report.status, "BLOCKED");
  assert.deepEqual(report.reasonCodes, [
    "REQUIRED_TABLES_MISSING_OR_INVALID",
    "PUBLIC_SCHEMA_USAGE_MISSING",
    "REQUIRED_TABLE_PRIVILEGES_MISSING"
  ]);
});

test("malformed database metadata is rejected with a sanitized store error", async () => {
  const { client } = clientWith({ transport_encrypted: "maybe" });
  await assert.rejects(
    () => assessPostgresProviderHealthDatabaseReadiness(client),
    (error) => error instanceof ProviderHealthStoreError &&
      error.code === "DATABASE_OPERATION_FAILED" &&
      !error.message.includes("maybe")
  );
});

test("database driver errors are sanitized and do not leak connection details", async () => {
  const { client } = clientWith({}, {
    error: new Error("password=do-not-leak host=private-db.internal")
  });
  await assert.rejects(
    () => assessPostgresProviderHealthDatabaseReadiness(client),
    (error) => error instanceof ProviderHealthStoreError &&
      error.code === "DATABASE_OPERATION_FAILED" &&
      !error.message.includes("private-db.internal") &&
      !error.message.includes("do-not-leak")
  );
});

test("invalid query client is rejected before any query", async () => {
  await assert.rejects(
    () => assessPostgresProviderHealthDatabaseReadiness({}),
    (error) => error instanceof ProviderHealthStoreError && error.code === "INVALID_INPUT"
  );
});
