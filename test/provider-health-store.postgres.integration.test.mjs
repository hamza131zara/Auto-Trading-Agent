import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const connectionString = process.env.PG_INTEGRATION_URL;
if (process.env.REQUIRE_PG_INTEGRATION === "true" && !connectionString) {
  throw new Error("PG_INTEGRATION_URL is required for the dedicated PostgreSQL integration workflow");
}
const HEALTH_POLICY = { failureThreshold: 1, cooldownMs: 1_000 };
const LEASE_DURATION_MS = 1_000;

function assertDisposableLocalDatabase(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("PG_INTEGRATION_URL must be a valid PostgreSQL URL");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!["localhost", "127.0.0.1", "::1"].includes(host) ||
      database !== "ata_phase6_test" ||
      (parsed.port !== "" && parsed.port !== "5432")) {
    throw new Error("PostgreSQL integration tests only permit the local ata_phase6_test database on port 5432");
  }
}

function makeProviderId() {
  return "phase6-it-" + randomBytes(8).toString("hex");
}

function makeLeaseToken() {
  return randomBytes(32).toString("base64url");
}

function makeFailure(at) {
  return {
    kind: "FAILURE",
    at,
    errorClass: "RATE_LIMIT",
    retryable: true,
    latencyMs: 17
  };
}

function makeSuccess(at) {
  return { kind: "SUCCESS", at, latencyMs: 9 };
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("Phase 6.25 PostgreSQL persistence and distributed recovery behavior", {
  skip: !connectionString
}, async (t) => {
  assertDisposableLocalDatabase(connectionString);

  // The driver is a pinned, test-only install in the dedicated integration workflow.
  // It is deliberately not a production dependency of @ata/market-data or the agent.
  const { Pool } = await import("pg");
  const options = {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    application_name: "ata-phase6-postgres-integration"
  };
  const adminPool = new Pool(options);
  const workerAPool = new Pool(options);
  const workerBPool = new Pool(options);
  const restartPool = new Pool(options);
  const providerIds = [];

  t.after(async () => {
    if (providerIds.length > 0) {
      try {
        await adminPool.query(
          "DELETE FROM public.provider_health WHERE provider_id = ANY($1::text[])",
          [providerIds]
        );
      } catch {
        // The service container is disposable; cleanup must not hide the test failure.
      }
    }
    await Promise.allSettled([
      adminPool.end(),
      workerAPool.end(),
      workerBPool.end(),
      restartPool.end()
    ]);
  });

  const migration = await readFile(
    new URL("../infra/migrations/20261030_phase6_provider_health_and_recovery_leases.sql", import.meta.url),
    "utf8"
  );
  await adminPool.query(migration);
  // Reapplying the schema must be safe for a fresh deployment/retry.
  await adminPool.query(migration);

  const versionResult = await adminPool.query("SHOW server_version_num");
  const serverVersion = Number(versionResult.rows[0]?.server_version_num);
  assert.ok(Number.isInteger(serverVersion) && serverVersion >= 180006,
    "integration target must be PostgreSQL 18.6 or newer within the 18.x major line");
  assert.ok(serverVersion < 190000, "integration target must remain on the PostgreSQL 18 major line");

  const [{ rows: workerAIdentity }, { rows: workerBIdentity }] = await Promise.all([
    workerAPool.query("SELECT pg_backend_pid() AS pid"),
    workerBPool.query("SELECT pg_backend_pid() AS pid")
  ]);
  assert.notEqual(
    workerAIdentity[0]?.pid,
    workerBIdentity[0]?.pid,
    "workers must use two independent PostgreSQL backend connections"
  );

  const {
    PostgresProviderHealthStore
  } = await import("../packages/market-data/dist/provider-health-store.js");
  const storeA = new PostgresProviderHealthStore(workerAPool);
  const storeB = new PostgresProviderHealthStore(workerBPool);
  const restartedStore = new PostgresProviderHealthStore(restartPool);

  await t.test("migration is idempotent and provider health survives store recreation", async () => {
    const providerId = makeProviderId();
    providerIds.push(providerId);
    const failureAt = new Date(Date.now() - 10_000).toISOString();

    const seeded = await storeA.recordResult({
      providerId,
      result: makeFailure(failureAt),
      policy: HEALTH_POLICY
    });
    assert.equal(seeded.health.state, "CIRCUIT_OPEN");
    assert.equal(seeded.version, "1");

    const afterRestart = await restartedStore.get(providerId);
    assert.ok(afterRestart);
    assert.equal(afterRestart.health.state, "CIRCUIT_OPEN");
    assert.equal(afterRestart.version, "1");
    assert.equal(afterRestart.health.lastRequestAt, failureAt);
  });

  await t.test("concurrent workers have one real database lease winner; expiry reclaims with a higher fence", async () => {
    const providerId = providerIds[0];
    const firstClaims = await Promise.all([
      storeA.claimRecoveryProbe({
        providerId,
        ownerId: "worker-a",
        leaseToken: makeLeaseToken(),
        leaseDurationMs: LEASE_DURATION_MS
      }),
      storeB.claimRecoveryProbe({
        providerId,
        ownerId: "worker-b",
        leaseToken: makeLeaseToken(),
        leaseDurationMs: LEASE_DURATION_MS
      })
    ]);

    assert.equal(firstClaims.filter(Boolean).length, 1,
      "only one independent PostgreSQL connection may win the initial lease");
    const originalLease = firstClaims[0] ?? firstClaims[1];
    const originalStore = firstClaims[0] ? storeA : storeB;
    const reclaimStore = firstClaims[0] ? storeB : storeA;
    assert.ok(originalLease);

    const persistedLease = await adminPool.query(
      "SELECT owner_id, lease_token_hash, fencing_token, acquired_at, expires_at " +
      "FROM public.provider_recovery_probe_leases WHERE provider_id = $1",
      [providerId]
    );
    assert.equal(persistedLease.rows.length, 1);
    assert.equal(persistedLease.rows[0].owner_id, originalLease.ownerId);
    assert.match(persistedLease.rows[0].lease_token_hash, /^[a-f0-9]{64}$/);
    assert.notEqual(persistedLease.rows[0].lease_token_hash, originalLease.leaseToken);

    // A new store instance sees the same committed database state.
    const healthFromFreshStore = await restartedStore.get(providerId);
    assert.equal(healthFromFreshStore?.health.state, "CIRCUIT_OPEN");

    await sleep(LEASE_DURATION_MS + 250);
    const reclaimedLease = await reclaimStore.claimRecoveryProbe({
      providerId,
      ownerId: originalLease.ownerId === "worker-a" ? "worker-b" : "worker-a",
      leaseToken: makeLeaseToken(),
      leaseDurationMs: 5_000
    });
    assert.ok(reclaimedLease, "an expired lease must be reclaimable");
    assert.ok(BigInt(reclaimedLease.fencingToken) > BigInt(originalLease.fencingToken),
      "every reclaim must advance the fencing token");

    const staleIdentity = {
      providerId: originalLease.providerId,
      ownerId: originalLease.ownerId,
      leaseToken: originalLease.leaseToken,
      fencingToken: originalLease.fencingToken
    };
    assert.equal(await originalStore.releaseRecoveryProbeLease(staleIdentity), false,
      "the expired worker must not release the replacement worker's lease");

    const beforeStaleWrite = await storeA.get(providerId);
    await assert.rejects(
      () => originalStore.recordResult({
        providerId,
        result: makeSuccess(new Date(Date.now() + 2_000).toISOString()),
        policy: HEALTH_POLICY,
        recoveryLease: staleIdentity
      }),
      (error) => error?.code === "RECOVERY_LEASE_NOT_OWNED"
    );
    const afterStaleWrite = await storeB.get(providerId);
    assert.equal(afterStaleWrite?.health.state, "CIRCUIT_OPEN");
    assert.equal(afterStaleWrite?.version, beforeStaleWrite?.version);

    const committed = await reclaimStore.recordResult({
      providerId,
      result: makeSuccess(new Date(Date.now() + 2_000).toISOString()),
      policy: HEALTH_POLICY,
      recoveryLease: {
        providerId: reclaimedLease.providerId,
        ownerId: reclaimedLease.ownerId,
        leaseToken: reclaimedLease.leaseToken,
        fencingToken: reclaimedLease.fencingToken
      }
    });
    assert.equal(committed.health.state, "HEALTHY");
    assert.equal(committed.version, "2");
    assert.equal(committed.recoveryLeaseReleased, true);

    const recoveredAfterRestart = await restartedStore.get(providerId);
    assert.equal(recoveredAfterRestart?.health.state, "HEALTHY");
    assert.equal(recoveredAfterRestart?.version, "2");

    const releasedRow = await adminPool.query(
      "SELECT owner_id, lease_token_hash, fencing_token, released_at " +
      "FROM public.provider_recovery_probe_leases WHERE provider_id = $1",
      [providerId]
    );
    assert.equal(releasedRow.rows[0]?.owner_id, null);
    assert.equal(releasedRow.rows[0]?.lease_token_hash, null);
    assert.equal(String(releasedRow.rows[0]?.fencing_token), reclaimedLease.fencingToken);
    assert.ok(releasedRow.rows[0]?.released_at);
  });

  await t.test("a failed health transaction rolls back without releasing its lease", async () => {
    const providerId = makeProviderId();
    providerIds.push(providerId);
    const failureAt = new Date(Date.now() - 10_000).toISOString();
    const seeded = await storeA.recordResult({
      providerId,
      result: makeFailure(failureAt),
      policy: HEALTH_POLICY
    });
    assert.equal(seeded.health.state, "CIRCUIT_OPEN");

    const lease = await storeA.claimRecoveryProbe({
      providerId,
      ownerId: "worker-a",
      leaseToken: makeLeaseToken(),
      leaseDurationMs: 5_000
    });
    assert.ok(lease);

    await assert.rejects(
      () => storeA.recordResult({
        providerId,
        result: makeSuccess(new Date(Date.parse(failureAt) - 1).toISOString()),
        policy: HEALTH_POLICY,
        recoveryLease: {
          providerId: lease.providerId,
          ownerId: lease.ownerId,
          leaseToken: lease.leaseToken,
          fencingToken: lease.fencingToken
        }
      }),
      (error) => error?.code === "PROVIDER_RESULT_OUT_OF_ORDER"
    );

    const healthAfterRollback = await storeB.get(providerId);
    assert.equal(healthAfterRollback?.health.state, "CIRCUIT_OPEN");
    assert.equal(healthAfterRollback?.version, "1");

    const leaseAfterRollback = await adminPool.query(
      "SELECT owner_id, lease_token_hash, fencing_token " +
      "FROM public.provider_recovery_probe_leases WHERE provider_id = $1",
      [providerId]
    );
    assert.equal(leaseAfterRollback.rows[0]?.owner_id, "worker-a");
    assert.match(leaseAfterRollback.rows[0]?.lease_token_hash, /^[a-f0-9]{64}$/);

    const recovered = await storeA.recordResult({
      providerId,
      result: makeSuccess(new Date().toISOString()),
      policy: HEALTH_POLICY,
      recoveryLease: {
        providerId: lease.providerId,
        ownerId: lease.ownerId,
        leaseToken: lease.leaseToken,
        fencingToken: lease.fencingToken
      }
    });
    assert.equal(recovered.health.state, "HEALTHY");
    assert.equal(recovered.recoveryLeaseReleased, true);
  });
});
