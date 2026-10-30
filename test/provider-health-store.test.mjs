import assert from "node:assert/strict";
import test from "node:test";
import {
  initialProviderHealth,
  recordProviderResult
} from "../packages/market-data/dist/index.js";
import {
  PostgresProviderHealthStore,
  ProviderHealthStoreError
} from "../packages/market-data/dist/provider-health-store.js";

const PROVIDER = "dex-screener";
const OWNER_A = "worker-a";
const OWNER_B = "worker-b";
const TOKEN_A = "a".repeat(64);
const TOKEN_B = "b".repeat(64);
const FAILURE_AT = "2026-10-30T07:59:30.000Z";
const CIRCUIT_UNTIL = "2026-10-30T07:59:40.000Z";
const HEALTH_POLICY = { failureThreshold: 1, cooldownMs: 10_000 };

function circuitHealth() {
  return recordProviderResult(initialProviderHealth(PROVIDER), {
    kind: "FAILURE",
    at: FAILURE_AT,
    errorClass: "RATE_LIMIT",
    retryable: true,
    latencyMs: 35
  }, HEALTH_POLICY);
}

function healthRow(health, version = "1") {
  return {
    provider_id: health.providerId,
    state: health.state,
    consecutive_failures: health.consecutiveFailures,
    last_success_at: health.lastSuccessAt,
    last_failure_at: health.lastFailureAt,
    last_request_at: health.lastRequestAt,
    last_latency_ms: health.lastLatencyMs,
    circuit_open_until: health.circuitOpenUntil,
    last_error_class: health.lastErrorClass,
    version
  };
}

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function matchesLease(row, providerId, ownerId, tokenHash, fence) {
  return row !== undefined &&
    row.provider_id === providerId &&
    row.owner_id === ownerId &&
    row.lease_token_hash === tokenHash &&
    String(row.fencing_token) === String(fence);
}

class FakePostgresPool {
  constructor(now) {
    this.now = now;
    this.health = new Map([[PROVIDER, healthRow(circuitHealth())]]);
    this.leases = new Map();
  }

  async query(sql, parameters = []) {
    if (sql.includes("recovery_lease:claim")) {
      const [providerId, ownerId, tokenHash, durationMs] = parameters;
      const health = this.health.get(providerId);
      if (health === undefined ||
          health.state !== "CIRCUIT_OPEN" ||
          Date.parse(health.circuit_open_until) > Date.parse(this.now)) return { rows: [] };

      const previous = this.leases.get(providerId);
      if (previous !== undefined && Date.parse(previous.expires_at) > Date.parse(this.now)) {
        return { rows: [] };
      }
      const fencingToken = previous === undefined
        ? "1"
        : String(BigInt(previous.fencing_token) + 1n);
      const row = {
        provider_id: providerId,
        owner_id: ownerId,
        lease_token_hash: tokenHash,
        fencing_token: fencingToken,
        acquired_at: this.now,
        expires_at: new Date(Date.parse(this.now) + durationMs).toISOString(),
        released_at: null
      };
      this.leases.set(providerId, row);
      return { rows: [clone(row)] };
    }

    if (sql.includes("recovery_lease:renew")) {
      const [providerId, ownerId, tokenHash, fence, durationMs] = parameters;
      const row = this.leases.get(providerId);
      if (!matchesLease(row, providerId, ownerId, tokenHash, fence) ||
          Date.parse(row.expires_at) <= Date.parse(this.now)) return { rows: [] };
      row.expires_at = new Date(Date.parse(this.now) + durationMs).toISOString();
      return { rows: [clone(row)] };
    }

    if (sql.includes("recovery_lease:release */")) {
      const [providerId, ownerId, tokenHash, fence] = parameters;
      const row = this.leases.get(providerId);
      if (!matchesLease(row, providerId, ownerId, tokenHash, fence)) return { rows: [] };
      row.owner_id = null;
      row.lease_token_hash = null;
      row.expires_at = this.now;
      row.released_at = this.now;
      return { rows: [{ provider_id: providerId }] };
    }

    if (sql.includes("provider_health:load")) {
      const row = this.health.get(parameters[0]);
      return { rows: row === undefined ? [] : [clone(row)] };
    }
    throw new Error("Unexpected fake-pool SQL");
  }

  async connect() {
    return new FakePostgresClient(this);
  }

  snapshot() {
    return {
      health: clone(this.health),
      leases: clone(this.leases)
    };
  }

  restore(snapshot) {
    this.health = snapshot.health;
    this.leases = snapshot.leases;
  }
}

class FakePostgresClient {
  constructor(pool) {
    this.pool = pool;
    this.transactionSnapshot = null;
  }

  async query(sql, parameters = []) {
    if (sql === "BEGIN") {
      this.transactionSnapshot = this.pool.snapshot();
      return { rows: [] };
    }
    if (sql === "COMMIT") {
      this.transactionSnapshot = null;
      return { rows: [] };
    }
    if (sql === "ROLLBACK") {
      if (this.transactionSnapshot !== null) this.pool.restore(this.transactionSnapshot);
      this.transactionSnapshot = null;
      return { rows: [] };
    }

    if (sql.includes("provider_health:lock")) {
      const row = this.pool.health.get(parameters[0]);
      return { rows: row === undefined ? [] : [clone(row)] };
    }

    if (sql.includes("recovery_lease:lock_for_result")) {
      const [providerId, ownerId, tokenHash, fence] = parameters;
      const row = this.pool.leases.get(providerId);
      return matchesLease(row, providerId, ownerId, tokenHash, fence) &&
        Date.parse(row.expires_at) > Date.parse(this.pool.now)
        ? { rows: [clone(row)] }
        : { rows: [] };
    }

    if (sql.includes("provider_health:upsert")) {
      const [providerId, state, failures, lastSuccess, lastFailure, lastRequest, latency, cooldown, lastError] = parameters;
      const previous = this.pool.health.get(providerId);
      if (previous?.last_request_at !== null &&
          previous?.last_request_at !== undefined &&
          Date.parse(lastRequest) < Date.parse(previous.last_request_at)) return { rows: [] };
      const version = previous === undefined ? "1" : String(BigInt(previous.version) + 1n);
      const row = {
        provider_id: providerId,
        state,
        consecutive_failures: failures,
        last_success_at: lastSuccess,
        last_failure_at: lastFailure,
        last_request_at: lastRequest,
        last_latency_ms: latency,
        circuit_open_until: cooldown,
        last_error_class: lastError,
        version
      };
      this.pool.health.set(providerId, row);
      return { rows: [clone(row)] };
    }

    if (sql.includes("recovery_lease:release_after_result")) {
      const [providerId, ownerId, tokenHash, fence] = parameters;
      const row = this.pool.leases.get(providerId);
      if (!matchesLease(row, providerId, ownerId, tokenHash, fence) ||
          Date.parse(row.expires_at) <= Date.parse(this.pool.now)) return { rows: [] };
      row.owner_id = null;
      row.lease_token_hash = null;
      row.expires_at = this.pool.now;
      row.released_at = this.pool.now;
      return { rows: [{ provider_id: providerId }] };
    }

    throw new Error("Unexpected fake-client SQL");
  }

  release() {}
}

function storeAt(now) {
  const pool = new FakePostgresPool(now);
  return { pool, store: new PostgresProviderHealthStore(pool) };
}

test("recovery probe cannot be claimed before circuit cooldown expires", async () => {
  const { store } = storeAt("2026-10-30T07:59:39.999Z");
  const claim = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_A,
    leaseToken: TOKEN_A,
    leaseDurationMs: 5_000
  });
  assert.equal(claim, null);
});

test("concurrent workers have one atomic recovery lease winner", async () => {
  const { store } = storeAt(CIRCUIT_UNTIL);
  const claims = await Promise.all([
    store.claimRecoveryProbe({
      providerId: PROVIDER,
      ownerId: OWNER_A,
      leaseToken: TOKEN_A,
      leaseDurationMs: 5_000
    }),
    store.claimRecoveryProbe({
      providerId: PROVIDER,
      ownerId: OWNER_B,
      leaseToken: TOKEN_B,
      leaseDurationMs: 5_000
    })
  ]);
  assert.equal(claims.filter((item) => item !== null).length, 1);
  const winner = claims.find((item) => item !== null);
  assert.equal(winner.fencingToken, "1");
  const persisted = (await store.get(PROVIDER));
  assert.ok(persisted);
  const leaseRow = (await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_A,
    leaseToken: "c".repeat(64),
    leaseDurationMs: 5_000
  }));
  assert.equal(leaseRow, null);
  assert.notEqual(winner.leaseToken, winner.leaseTokenHash);
});

test("expired leases can be reclaimed with a strictly higher fencing token", async () => {
  const { pool, store } = storeAt(CIRCUIT_UNTIL);
  const first = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_A,
    leaseToken: TOKEN_A,
    leaseDurationMs: 1_000
  });
  assert.ok(first);
  assert.equal(first.fencingToken, "1");

  pool.now = "2026-10-30T07:59:41.001Z";
  const second = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_B,
    leaseToken: TOKEN_B,
    leaseDurationMs: 5_000
  });
  assert.ok(second);
  assert.equal(second.fencingToken, "2");

  assert.equal(await store.renewRecoveryProbeLease({
    providerId: first.providerId,
    ownerId: first.ownerId,
    leaseToken: first.leaseToken,
    fencingToken: first.fencingToken,
    leaseDurationMs: 5_000
  }), null);
  assert.equal(await store.releaseRecoveryProbeLease({
    providerId: first.providerId,
    ownerId: first.ownerId,
    leaseToken: first.leaseToken,
    fencingToken: first.fencingToken
  }), false);
});

test("active lease can renew and only its exact owner/token/fence can release", async () => {
  const { pool, store } = storeAt(CIRCUIT_UNTIL);
  const lease = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_A,
    leaseToken: TOKEN_A,
    leaseDurationMs: 1_000
  });
  assert.ok(lease);
  pool.now = "2026-10-30T07:59:40.500Z";

  const renewed = await store.renewRecoveryProbeLease({
    providerId: lease.providerId,
    ownerId: lease.ownerId,
    leaseToken: lease.leaseToken,
    fencingToken: lease.fencingToken,
    leaseDurationMs: 5_000
  });
  assert.ok(renewed);
  assert.equal(renewed.fencingToken, lease.fencingToken);
  assert.equal(Date.parse(renewed.expiresAt) - Date.parse(pool.now), 5_000);

  assert.equal(await store.releaseRecoveryProbeLease({
    providerId: lease.providerId,
    ownerId: OWNER_B,
    leaseToken: TOKEN_B,
    fencingToken: lease.fencingToken
  }), false);
  assert.equal(await store.releaseRecoveryProbeLease({
    providerId: lease.providerId,
    ownerId: lease.ownerId,
    leaseToken: lease.leaseToken,
    fencingToken: lease.fencingToken
  }), true);
});

test("recovery health result and lease release commit atomically under the fencing token", async () => {
  const { pool, store } = storeAt(CIRCUIT_UNTIL);
  const lease = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_A,
    leaseToken: TOKEN_A,
    leaseDurationMs: 5_000
  });
  assert.ok(lease);

  pool.now = "2026-10-30T07:59:41.000Z";
  const result = await store.recordResult({
    providerId: PROVIDER,
    result: {
      kind: "SUCCESS",
      at: pool.now,
      latencyMs: 20
    },
    policy: HEALTH_POLICY,
    recoveryLease: {
      providerId: lease.providerId,
      ownerId: lease.ownerId,
      leaseToken: lease.leaseToken,
      fencingToken: lease.fencingToken
    }
  });

  assert.equal(result.health.state, "HEALTHY");
  assert.equal(result.health.consecutiveFailures, 0);
  assert.equal(result.version, "2");
  assert.equal(result.recoveryLeaseReleased, true);
  const stored = await store.get(PROVIDER);
  assert.equal(stored.health.state, "HEALTHY");
  assert.equal(stored.version, "2");
  assert.equal(pool.leases.get(PROVIDER).owner_id, null);
});

test("circuit-open health cannot be changed without the currently owned recovery lease", async () => {
  const { store } = storeAt(CIRCUIT_UNTIL);
  await assert.rejects(
    () => store.recordResult({
      providerId: PROVIDER,
      result: { kind: "SUCCESS", at: "2026-10-30T07:59:41.000Z", latencyMs: 20 },
      policy: HEALTH_POLICY
    }),
    (error) => error instanceof ProviderHealthStoreError && error.code === "RECOVERY_LEASE_NOT_OWNED"
  );
});

test("expired or superseded recovery lease cannot write health state", async () => {
  const { pool, store } = storeAt(CIRCUIT_UNTIL);
  const oldLease = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_A,
    leaseToken: TOKEN_A,
    leaseDurationMs: 1_000
  });
  assert.ok(oldLease);
  pool.now = "2026-10-30T07:59:41.001Z";
  const newLease = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_B,
    leaseToken: TOKEN_B,
    leaseDurationMs: 5_000
  });
  assert.ok(newLease);
  assert.notEqual(oldLease.fencingToken, newLease.fencingToken);

  await assert.rejects(
    () => store.recordResult({
      providerId: PROVIDER,
      result: { kind: "SUCCESS", at: pool.now, latencyMs: 20 },
      policy: HEALTH_POLICY,
      recoveryLease: {
        providerId: oldLease.providerId,
        ownerId: oldLease.ownerId,
        leaseToken: oldLease.leaseToken,
        fencingToken: oldLease.fencingToken
      }
    }),
    (error) => error instanceof ProviderHealthStoreError && error.code === "RECOVERY_LEASE_NOT_OWNED"
  );
  assert.equal((await store.get(PROVIDER)).health.state, "CIRCUIT_OPEN");
});

test("database row versions are monotonic and old health timestamps cannot overwrite newer state", async () => {
  const { pool, store } = storeAt(CIRCUIT_UNTIL);
  const lease = await store.claimRecoveryProbe({
    providerId: PROVIDER,
    ownerId: OWNER_A,
    leaseToken: TOKEN_A,
    leaseDurationMs: 5_000
  });
  assert.ok(lease);
  const success = await store.recordResult({
    providerId: PROVIDER,
    result: { kind: "SUCCESS", at: "2026-10-30T07:59:41.000Z", latencyMs: 20 },
    policy: HEALTH_POLICY,
    recoveryLease: {
      providerId: lease.providerId,
      ownerId: lease.ownerId,
      leaseToken: lease.leaseToken,
      fencingToken: lease.fencingToken
    }
  });
  assert.equal(success.version, "2");

  await assert.rejects(
    () => store.recordResult({
      providerId: PROVIDER,
      result: {
        kind: "FAILURE",
        at: "2026-10-30T07:59:39.000Z",
        errorClass: "NETWORK",
        retryable: true,
        latencyMs: null
      },
      policy: HEALTH_POLICY
    }),
    (error) => error instanceof ProviderHealthStoreError &&
      (error.code === "PROVIDER_RESULT_OUT_OF_ORDER" || error.code === "DATABASE_OPERATION_FAILED")
  );
  assert.equal((await store.get(PROVIDER)).version, "2");
});
