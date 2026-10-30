import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  initialProviderHealth,
  recordProviderResult
} from "../packages/market-data/dist/index.js";
import {
  ReadOnlyMarketDataOrchestrator
} from "../packages/market-data/dist/provider-orchestrator.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;
const PROVIDER = "dex-screener";
const GROUP = "dex-screener-family";
const TARGET = {
  cluster: "mainnet-beta",
  baseMint: "So11111111111111111111111111111111111111112",
  quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  poolAddress: "47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4"
};
const FIRST_FAILURE_AT = "2026-10-30T08:00:00.000Z";
const CIRCUIT_UNTIL = "2026-10-30T08:00:10.000Z";
const HEALTH_POLICY = { failureThreshold: 1, cooldownMs: 10_000 };

function makeCircuitHealth() {
  return recordProviderResult(initialProviderHealth(PROVIDER), {
    kind: "FAILURE",
    at: FIRST_FAILURE_AT,
    errorClass: "RATE_LIMIT",
    retryable: true,
    latencyMs: 20
  }, HEALTH_POLICY);
}

function clone(value) {
  return structuredClone(value);
}

class SharedHealthStoreStub {
  constructor(clock, initialHealth = makeCircuitHealth()) {
    this.clock = clock;
    this.health = initialHealth;
    this.lease = null;
    this.fencing = 0n;
    this.version = 1;
  }

  async get(providerId) {
    if (providerId !== PROVIDER) return null;
    return { health: clone(this.health), version: String(this.version) };
  }

  async claimRecoveryProbe(input) {
    if (input.providerId !== PROVIDER ||
        this.health.state !== "CIRCUIT_OPEN" ||
        Date.parse(this.clock.now) < Date.parse(this.health.circuitOpenUntil)) return null;
    if (this.lease !== null && Date.parse(this.lease.expiresAt) > Date.parse(this.clock.now)) return null;
    this.fencing += 1n;
    this.lease = {
      providerId: input.providerId,
      ownerId: input.ownerId,
      leaseTokenHash: input.leaseTokenHash,
      fencingToken: String(this.fencing),
      acquiredAt: this.clock.now,
      expiresAt: new Date(Date.parse(this.clock.now) + input.leaseDurationMs).toISOString()
    };
    return clone(this.lease);
  }

  async renewRecoveryProbeLease(input) {
    if (!this.matches(input) || Date.parse(this.lease.expiresAt) <= Date.parse(this.clock.now)) return null;
    this.lease.expiresAt = new Date(Date.parse(this.clock.now) + input.leaseDurationMs).toISOString();
    return clone(this.lease);
  }

  async releaseRecoveryProbeLease(input) {
    if (!this.matches(input)) return false;
    this.lease = null;
    return true;
  }

  async recordResult(input) {
    if (this.health.state === "CIRCUIT_OPEN" && input.recoveryLease === undefined) {
      const error = new Error("RECOVERY_LEASE_NOT_OWNED");
      error.code = "RECOVERY_LEASE_NOT_OWNED";
      throw error;
    }
    if (input.recoveryLease !== undefined) {
      if (!this.matches(input.recoveryLease) ||
          Date.parse(this.lease.expiresAt) <= Date.parse(this.clock.now)) {
        const error = new Error("RECOVERY_LEASE_NOT_OWNED");
        error.code = "RECOVERY_LEASE_NOT_OWNED";
        throw error;
      }
    }
    this.health = recordProviderResult(this.health, input.result, input.policy);
    this.version += 1;
    if (input.recoveryLease !== undefined) this.lease = null;
    return {
      health: clone(this.health),
      version: String(this.version),
      recoveryLeaseReleased: input.recoveryLease !== undefined
    };
  }

  matches(identity) {
    return this.lease !== null &&
      identity.providerId === this.lease.providerId &&
      identity.ownerId === this.lease.ownerId &&
      identity.leaseTokenHash === this.lease.leaseTokenHash &&
      String(identity.fencingToken) === this.lease.fencingToken;
  }
}

class Adapter {
  constructor(behavior = {}) {
    this.providerId = PROVIDER;
    this.adapterVersion = "shared-health-test-1.0.0";
    this.sourceKind = "INDEXED_API";
    this.behavior = behavior;
    this.calls = 0;
    this.lastRequest = null;
  }

  async fetchRaw(request, signal) {
    this.calls += 1;
    this.lastRequest = request;
    if (this.behavior.entered) this.behavior.entered();
    if (this.behavior.wait !== undefined) await this.behavior.wait;
    if (this.behavior.failure) {
      const error = new Error("safe test failure");
      error.code = "TIMEOUT";
      error.retryable = true;
      throw error;
    }
    if (signal.aborted) {
      const error = new Error("test abort");
      error.code = "TIMEOUT";
      error.retryable = true;
      throw error;
    }
    return { fixture: true };
  }

  normalize(_raw, context) {
    const snapshot = clone(original);
    snapshot.observationId = "shared-" + context.retrievedAt;
    snapshot.cluster = this.lastRequest.cluster;
    snapshot.baseMint = this.lastRequest.baseMint;
    snapshot.quoteMint = this.lastRequest.quoteMint;
    snapshot.poolAddress = this.lastRequest.poolAddress;
    snapshot.observedAt = "2026-10-30T08:00:09.000Z";
    snapshot.sourceEventAt = "2026-10-30T08:00:09.000Z";
    snapshot.retrievedAt = context.retrievedAt;
    snapshot.provenance = {
      providerId: PROVIDER,
      sourceKind: "INDEXED_API",
      adapterVersion: this.adapterVersion,
      schemaVersion: "ata.market-data.v1",
      requestId: context.requestId,
      sourceEventId: null,
      rawPayloadSha256: "c".repeat(64),
      synthetic: false
    };
    return { observations: [snapshot], errors: [] };
  }
}

function makeOrchestrator(adapter, store, clock, ownerId, tokenHash) {
  return new ReadOnlyMarketDataOrchestrator([
    { adapter, independenceGroupId: GROUP, priority: 0 }
  ], {
    now: () => clock.now,
    healthPolicy: HEALTH_POLICY,
    maxHealthAgeMs: 60_000,
    requestTimeoutMs: 1_000,
    requestId: () => "shared-health-request",
    providerHealthStore: store,
    recoveryProbeLease: {
      ownerId,
      leaseDurationMs: 5_000,
      createLeaseTokenHash: () => tokenHash
    }
  });
}

test("separate orchestrators share health and only one worker can perform the recovery probe", async () => {
  const clock = { now: CIRCUIT_UNTIL };
  const store = new SharedHealthStoreStub(clock);
  let releaseFetch;
  let enteredFetch;
  const entered = new Promise((resolve) => { enteredFetch = resolve; });
  const wait = new Promise((resolve) => { releaseFetch = resolve; });

  const firstAdapter = new Adapter({ entered: enteredFetch, wait });
  const secondAdapter = new Adapter();
  const first = makeOrchestrator(firstAdapter, store, clock, "worker-a", "a".repeat(64));
  const second = makeOrchestrator(secondAdapter, store, clock, "worker-b", "b".repeat(64));

  const firstPromise = first.collect(TARGET);
  await entered;
  const secondResult = await second.collect(TARGET);

  assert.equal(secondAdapter.calls, 0);
  assert.equal(secondResult.attempts[0].outcome, "BLOCKED");
  assert.equal(secondResult.attempts[0].permissionStatus, "BLOCK_RECOVERY_PROBE_IN_FLIGHT");
  assert.deepEqual(secondResult.attempts[0].reasonCodes, ["SHARED_RECOVERY_PROBE_LEASE_NOT_AVAILABLE"]);

  clock.now = "2026-10-30T08:00:11.000Z";
  releaseFetch();
  const firstResult = await firstPromise;

  assert.equal(firstAdapter.calls, 1);
  assert.equal(firstResult.attempts[0].permissionStatus, "ALLOW_RECOVERY_PROBE");
  assert.equal(firstResult.attempts[0].outcome, "OBSERVATION_NORMALIZED");
  assert.equal(store.health.state, "HEALTHY");
  assert.equal(store.lease, null);
  assert.equal(firstResult.providerHealth[0].state, "HEALTHY");
});

test("expired recovery worker cannot publish its result after lease expiry", async () => {
  const clock = { now: CIRCUIT_UNTIL };
  const store = new SharedHealthStoreStub(clock);
  let releaseFetch;
  let enteredFetch;
  const entered = new Promise((resolve) => { enteredFetch = resolve; });
  const wait = new Promise((resolve) => { releaseFetch = resolve; });
  const adapter = new Adapter({ entered: enteredFetch, wait });
  const orchestrator = makeOrchestrator(adapter, store, clock, "worker-a", "a".repeat(64));

  const pending = orchestrator.collect(TARGET);
  await entered;
  clock.now = "2026-10-30T08:00:16.000Z";
  releaseFetch();
  const result = await pending;

  assert.equal(result.attempts[0].permissionStatus, "ALLOW_RECOVERY_PROBE");
  assert.equal(result.attempts[0].outcome, "BLOCKED");
  assert.ok(result.attempts[0].reasonCodes.includes("SHARED_RECOVERY_PROBE_LEASE_LOST"));
  assert.equal(result.observations.length, 0);
  assert.equal(store.health.state, "CIRCUIT_OPEN");
});

test("shared health read failure blocks adapter calls instead of falling back to process-local UNKNOWN", async () => {
  const clock = { now: CIRCUIT_UNTIL };
  const store = {
    async get() { throw new Error("database detail must not leak"); },
    async claimRecoveryProbe() { return null; },
    async renewRecoveryProbeLease() { return null; },
    async releaseRecoveryProbeLease() { return false; },
    async recordResult() { throw new Error("database detail must not leak"); }
  };
  const adapter = new Adapter();
  const orchestrator = makeOrchestrator(adapter, store, clock, "worker-a", "a".repeat(64));
  const result = await orchestrator.collect(TARGET);

  assert.equal(adapter.calls, 0);
  assert.equal(result.attempts[0].outcome, "BLOCKED");
  assert.deepEqual(result.attempts[0].reasonCodes, ["SHARED_PROVIDER_HEALTH_READ_FAILED"]);
});
