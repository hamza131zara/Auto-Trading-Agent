import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessProviderAgreement } from "../packages/market-data/dist/index.js";
import { ReadOnlyMarketDataOrchestrator } from "../packages/market-data/dist/provider-orchestrator.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;
const TARGET = {
  cluster: "mainnet-beta",
  baseMint: "So11111111111111111111111111111111111111112",
  quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  poolAddress: "47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4"
};
const NOW = "2026-10-29T12:00:55.000Z";

function testSnapshot(providerId, request, context, priceValue = "0.012345") {
  const snapshot = structuredClone(original);
  snapshot.observationId = providerId + "-" + context.retrievedAt;
  snapshot.cluster = request.cluster;
  snapshot.baseMint = request.baseMint;
  snapshot.quoteMint = request.quoteMint;
  snapshot.poolAddress = request.poolAddress;
  snapshot.price = { value: priceValue, unit: "QUOTE_PER_BASE", assetId: request.quoteMint };
  snapshot.observedAt = new Date(Date.parse(context.retrievedAt) - 5_000).toISOString();
  snapshot.sourceEventAt = snapshot.observedAt;
  snapshot.retrievedAt = context.retrievedAt;
  snapshot.provenance = {
    providerId,
    sourceKind: "INDEXED_API",
    adapterVersion: "test-1.0.0",
    schemaVersion: "ata.market-data.v1",
    requestId: context.requestId,
    sourceEventId: null,
    rawPayloadSha256: "a".repeat(64),
    synthetic: false
  };
  return snapshot;
}

class StubAdapter {
  constructor(providerId, behavior = {}) {
    this.providerId = providerId;
    this.adapterVersion = "test-1.0.0";
    this.sourceKind = "INDEXED_API";
    this.behavior = behavior;
    this.calls = 0;
  }

  async fetchRaw(request, signal) {
    this.calls += 1;
    this.lastRequest = request;
    if (signal.aborted) {
      const error = new Error("request aborted");
      error.code = "TIMEOUT";
      error.retryable = true;
      throw error;
    }
    if (this.behavior.fail) {
      const error = new Error("do not disclose secret or remote body");
      error.code = this.behavior.code ?? "NETWORK";
      error.retryable = this.behavior.retryable ?? true;
      throw error;
    }
    return { accepted: true };
  }

  normalize(raw, context) {
    if (this.behavior.normalizationErrors) {
      return { observations: [], errors: this.behavior.normalizationErrors };
    }
    const price = this.behavior.price ?? "0.012345";
    return { observations: [testSnapshot(this.providerId, this.lastRequest, context, price)], errors: [] };
  }
}

function adapter(providerId, behavior = {}) {
  return new StubAdapter(providerId, behavior);
}

function testUseDecision(providerId, purpose, at, overrides = {}) {
  return {
    providerId,
    purpose,
    decisionId: "test-owner-decision-" + providerId,
    owner: "test-only-fixture-owner",
    outcome: "PROCEED_DIAGNOSTIC_ONLY",
    scope: "Test-only read-only market-data collection for provider " + providerId,
    decidedAt: "2026-10-29T11:00:00.000Z",
    expiresAt: "2026-11-01T00:00:00.000Z",
    linkedEvidenceIds: ["test-evidence-" + providerId],
    evidenceManifestSha256: "a".repeat(64),
    ...overrides
  };
}

function createOrchestrator(registered, state = { now: NOW }, policyOverrides = {}) {
  return new ReadOnlyMarketDataOrchestrator(
    registered,
    {
      now: () => state.now,
      healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
      maxHealthAgeMs: 60_000,
      requestTimeoutMs: 2_000,
      requestId: (providerId) => providerId + "-request",
      usagePurpose: "DIAGNOSTIC",
      providerUseDecisionResolver: (providerId, purpose, at) =>
        testUseDecision(providerId, purpose, at),
      ...policyOverrides
    }
  );
}

function agreement(result, nowAt = NOW) {
  return assessProviderAgreement(result.candidates, {
    nowAt,
    maxAgeMs: 60_000,
    maxHealthAgeMs: 60_000
  });
}

test("provider use is default-deny when no owner decision resolver is configured", async () => {
  const primary = adapter("provider-primary");
  const orchestrator = new ReadOnlyMarketDataOrchestrator(
    [{ adapter: primary, independenceGroupId: "primary-family", priority: 0 }],
    {
      now: () => NOW,
      healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
      maxHealthAgeMs: 60_000,
      requestTimeoutMs: 2_000,
      usagePurpose: "DIAGNOSTIC"
    }
  );

  const result = await orchestrator.collect(TARGET);
  assert.equal(primary.calls, 0, "provider adapter must not be called without a scoped owner decision");
  assert.equal(result.attempts[0].outcome, "BLOCKED");
  assert.equal(result.attempts[0].permissionStatus, "BLOCK_PROVIDER_USE_NOT_APPROVED");
  assert.deepEqual(result.attempts[0].reasonCodes, ["PROVIDER_USE_DECISION_MISSING"]);
  assert.equal(result.observations.length, 0);
  assert.equal(result.tradingAuthorized, false);
});

test("diagnostic-only owner decision cannot authorize production-purpose collection", async () => {
  const primary = adapter("provider-primary");
  const orchestrator = new ReadOnlyMarketDataOrchestrator(
    [{ adapter: primary, independenceGroupId: "primary-family", priority: 0 }],
    {
      now: () => NOW,
      healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
      maxHealthAgeMs: 60_000,
      requestTimeoutMs: 2_000,
      usagePurpose: "PRODUCTION",
      providerUseDecisionResolver: (providerId, purpose, at) =>
        testUseDecision(providerId, "DIAGNOSTIC", at)
    }
  );

  const result = await orchestrator.collect(TARGET);
  assert.equal(primary.calls, 0);
  assert.equal(result.attempts[0].outcome, "BLOCKED");
  assert.deepEqual(result.attempts[0].reasonCodes, ["PROVIDER_USE_DECISION_INVALID"]);
  assert.equal(result.tradingAuthorized, false);
});

test("production-purpose collection requires a production-scope owner decision", async () => {
  const primary = adapter("provider-primary");
  const orchestrator = new ReadOnlyMarketDataOrchestrator(
    [{ adapter: primary, independenceGroupId: "primary-family", priority: 0 }],
    {
      now: () => NOW,
      healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
      maxHealthAgeMs: 60_000,
      requestTimeoutMs: 2_000,
      usagePurpose: "PRODUCTION",
      providerUseDecisionResolver: (providerId, purpose, at) =>
        testUseDecision(providerId, purpose, at, { outcome: "PROCEED_PRODUCTION_SCOPE" })
    }
  );

  const result = await orchestrator.collect(TARGET);
  assert.equal(primary.calls, 1);
  assert.equal(result.attempts[0].outcome, "OBSERVATION_NORMALIZED");
  assert.equal(result.tradingAuthorized, false);
});

test("expired, future, mismatched, rejected, deferred and malformed owner decisions block before provider calls", async () => {
  const cases = [
    {
      name: "expired",
      overrides: { expiresAt: "2026-10-29T11:59:00.000Z" },
      reason: "PROVIDER_USE_DECISION_EXPIRED"
    },
    {
      name: "not yet effective",
      overrides: { decidedAt: "2026-10-29T12:01:00.000Z" },
      reason: "PROVIDER_USE_DECISION_NOT_YET_EFFECTIVE"
    },
    {
      name: "wrong provider",
      overrides: { providerId: "another-provider" },
      reason: "PROVIDER_USE_DECISION_INVALID"
    },
    {
      name: "rejected",
      overrides: { outcome: "REJECT" },
      reason: "PROVIDER_USE_DECISION_REJECTED"
    },
    {
      name: "deferred",
      overrides: { outcome: "DEFER" },
      reason: "PROVIDER_USE_DECISION_DEFERRED"
    },
    {
      name: "invalid evidence manifest digest",
      overrides: { evidenceManifestSha256: "not-a-digest" },
      reason: "PROVIDER_USE_DECISION_INVALID"
    },
    {
      name: "empty linked evidence",
      overrides: { linkedEvidenceIds: [] },
      reason: "PROVIDER_USE_DECISION_INVALID"
    }
  ];

  for (const item of cases) {
    const primary = adapter("provider-primary");
    const orchestrator = new ReadOnlyMarketDataOrchestrator(
      [{ adapter: primary, independenceGroupId: "primary-family", priority: 0 }],
      {
        now: () => NOW,
        healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
        maxHealthAgeMs: 60_000,
        requestTimeoutMs: 2_000,
        usagePurpose: "DIAGNOSTIC",
        providerUseDecisionResolver: (providerId, purpose, at) =>
          testUseDecision(providerId, purpose, at, item.overrides)
      }
    );
    const result = await orchestrator.collect(TARGET);
    assert.equal(primary.calls, 0, item.name + ": provider must not be called");
    assert.equal(result.attempts[0].permissionStatus, "BLOCK_PROVIDER_USE_NOT_APPROVED", item.name);
    assert.deepEqual(result.attempts[0].reasonCodes, [item.reason], item.name);
  }
});

test("provider use decision resolver exceptions block without invoking providers", async () => {
  const primary = adapter("provider-primary");
  const orchestrator = new ReadOnlyMarketDataOrchestrator(
    [{ adapter: primary, independenceGroupId: "primary-family", priority: 0 }],
    {
      now: () => NOW,
      healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
      maxHealthAgeMs: 60_000,
      requestTimeoutMs: 2_000,
      usagePurpose: "DIAGNOSTIC",
      providerUseDecisionResolver: () => {
        throw new Error("sensitive manifest lookup details");
      }
    }
  );

  const result = await orchestrator.collect(TARGET);
  assert.equal(primary.calls, 0);
  assert.equal(result.attempts[0].outcome, "BLOCKED");
  assert.deepEqual(result.attempts[0].reasonCodes, ["PROVIDER_USE_DECISION_RESOLVER_FAILED"]);
  assert.equal(JSON.stringify(result).includes("sensitive manifest lookup details"), false);
});

test("orchestrator awaits an online provider-use resolver before making a provider request", async () => {
  const primary = adapter("provider-primary");
  let resolverCompleted = false;
  const orchestrator = new ReadOnlyMarketDataOrchestrator(
    [{ adapter: primary, independenceGroupId: "primary-family", priority: 0 }],
    {
      now: () => NOW,
      healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
      maxHealthAgeMs: 60_000,
      requestTimeoutMs: 2_000,
      usagePurpose: "DIAGNOSTIC",
      providerUseDecisionResolver: async (providerId, purpose, at) => {
        await new Promise((resolve) => setImmediate(resolve));
        resolverCompleted = true;
        return testUseDecision(providerId, purpose, at);
      }
    }
  );

  const result = await orchestrator.collect(TARGET);
  assert.equal(resolverCompleted, true);
  assert.equal(primary.calls, 1);
  assert.equal(result.attempts[0].outcome, "OBSERVATION_NORMALIZED");
});

test("rejected asynchronous provider-use resolver denies before any provider request", async () => {
  const primary = adapter("provider-primary");
  const orchestrator = new ReadOnlyMarketDataOrchestrator(
    [{ adapter: primary, independenceGroupId: "primary-family", priority: 0 }],
    {
      now: () => NOW,
      healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
      maxHealthAgeMs: 60_000,
      requestTimeoutMs: 2_000,
      usagePurpose: "DIAGNOSTIC",
      providerUseDecisionResolver: async () => {
        await Promise.resolve();
        throw new Error("private registry response details");
      }
    }
  );

  const result = await orchestrator.collect(TARGET);
  assert.equal(primary.calls, 0);
  assert.equal(result.attempts[0].permissionStatus, "BLOCK_PROVIDER_USE_NOT_APPROVED");
  assert.deepEqual(result.attempts[0].reasonCodes, ["PROVIDER_USE_DECISION_RESOLVER_FAILED"]);
  assert.equal(JSON.stringify(result).includes("private registry response details"), false);
});

test("orchestrator collects agreeing independent providers without synthetic promotion", async () => {
  const primary = adapter("provider-primary");
  const fallback = adapter("provider-fallback");
  const orchestrator = createOrchestrator([
    { adapter: fallback, independenceGroupId: "fallback-family", priority: 1 },
    { adapter: primary, independenceGroupId: "primary-family", priority: 0 }
  ]);

  const result = await orchestrator.collect(TARGET);
  assert.equal(primary.calls, 1);
  assert.equal(fallback.calls, 1);
  assert.deepEqual(result.attempts.map((item) => item.providerId), ["provider-primary", "provider-fallback"]);
  assert.ok(result.attempts.every((item) => item.outcome === "OBSERVATION_NORMALIZED"));
  assert.equal(result.observations.length, 2);
  const assessed = agreement(result);
  assert.equal(assessed.status, "AGREED");
  assert.equal(assessed.canProceedToOnChainValidation, true);
  assert.equal(result.tradingAuthorized, false);
});

test("primary timeout continues to independent fallbacks; a lone response is insufficient", async () => {
  const primary = adapter("provider-primary", { fail: true, code: "TIMEOUT", retryable: true });
  const fallbackA = adapter("provider-fallback-a");
  const fallbackB = adapter("provider-fallback-b");
  const orchestrator = createOrchestrator([
    { adapter: primary, independenceGroupId: "primary-family", priority: 0 },
    { adapter: fallbackA, independenceGroupId: "fallback-a-family", priority: 1 },
    { adapter: fallbackB, independenceGroupId: "fallback-b-family", priority: 2 }
  ]);

  const result = await orchestrator.collect(TARGET);
  assert.equal(primary.calls, 1);
  assert.equal(fallbackA.calls, 1);
  assert.equal(fallbackB.calls, 1);
  assert.equal(result.attempts[0].outcome, "REQUEST_FAILED");
  assert.deepEqual(result.attempts[0].reasonCodes, ["PROVIDER_REQUEST_TIMEOUT"]);
  assert.equal(JSON.stringify(result).includes("do not disclose secret"), false);
  const assessed = agreement(result);
  assert.equal(assessed.status, "AGREED");
  assert.equal(assessed.fallbackUsed, true);
  assert.deepEqual(assessed.eligibleProviderIds, ["provider-fallback-a", "provider-fallback-b"]);
  assert.equal(assessed.tradingAuthorized, false);

  const lone = createOrchestrator([
    { adapter: adapter("provider-primary", { fail: true }), independenceGroupId: "primary-family", priority: 0 },
    { adapter: adapter("provider-only-fallback"), independenceGroupId: "fallback-family", priority: 1 }
  ]);
  const loneResult = await lone.collect(TARGET);
  assert.equal(agreement(loneResult).status, "INSUFFICIENT_EVIDENCE");
  assert.equal(agreement(loneResult).canProceedToOnChainValidation, false);
});

test("conflicting normalized providers block agreement instead of silently selecting primary", async () => {
  const primary = adapter("provider-primary", { price: "0.012345" });
  const fallback = adapter("provider-fallback", { price: "0.012346" });
  const orchestrator = createOrchestrator([
    { adapter: primary, independenceGroupId: "primary-family", priority: 0 },
    { adapter: fallback, independenceGroupId: "fallback-family", priority: 1 }
  ]);
  const result = await orchestrator.collect(TARGET);
  const assessed = agreement(result);
  assert.equal(assessed.status, "DISAGREEMENT");
  assert.deepEqual(assessed.disagreementFields, ["price"]);
  assert.equal(assessed.canProceedToOnChainValidation, false);
  assert.equal(assessed.tradingAuthorized, false);
});

test("normalization failure marks the provider unavailable and still attempts fallback", async () => {
  const bad = adapter("provider-primary", { normalizationErrors: ["PAIR_MINT_IDENTITY_MISMATCH"] });
  const fallback = adapter("provider-fallback");
  const orchestrator = createOrchestrator([
    { adapter: bad, independenceGroupId: "primary-family", priority: 0 },
    { adapter: fallback, independenceGroupId: "fallback-family", priority: 1 }
  ]);
  const result = await orchestrator.collect(TARGET);
  assert.equal(result.attempts[0].outcome, "NORMALIZATION_FAILED");
  assert.deepEqual(result.attempts[0].reasonCodes, ["PAIR_MINT_IDENTITY_MISMATCH"]);
  assert.equal(result.providerHealth.find((item) => item.providerId === "provider-primary").state, "UNAVAILABLE");
  assert.equal(fallback.calls, 1);
  assert.equal(agreement(result).status, "INSUFFICIENT_EVIDENCE");
});

test("open circuit blocks attempts until cooldown, then permits a recovery probe", async () => {
  const state = { now: NOW };
  const primary = adapter("provider-primary", { fail: true, code: "TIMEOUT", retryable: true });
  const orchestrator = createOrchestrator([
    { adapter: primary, independenceGroupId: "primary-family", priority: 0 }
  ], state, { healthPolicy: { failureThreshold: 1, cooldownMs: 30_000 } });

  const failed = await orchestrator.collect(TARGET);
  assert.equal(failed.providerHealth[0].state, "CIRCUIT_OPEN");
  assert.equal(primary.calls, 1);

  state.now = "2026-10-29T12:01:24.999Z";
  const duringCooldown = await orchestrator.collect(TARGET);
  assert.equal(duringCooldown.attempts[0].outcome, "BLOCKED");
  assert.equal(duringCooldown.attempts[0].permissionStatus, "BLOCK_CIRCUIT_OPEN");
  assert.equal(primary.calls, 1);

  state.now = "2026-10-29T12:01:25.000Z";
  primary.behavior.fail = false;
  const probe = await orchestrator.collect(TARGET);
  assert.equal(probe.attempts[0].permissionStatus, "ALLOW_RECOVERY_PROBE");
  assert.equal(probe.attempts[0].outcome, "OBSERVATION_NORMALIZED");
  assert.equal(probe.providerHealth[0].state, "HEALTHY");
  assert.equal(primary.calls, 2);
});

test("invalid observation identity never reaches the candidate set", async () => {
  const wrong = adapter("provider-primary");
  const originalNormalize = wrong.normalize.bind(wrong);
  wrong.normalize = (raw, context) => {
    const result = originalNormalize(raw, context);
    result.observations[0].poolAddress = "11111111111111111111111111111111";
    return result;
  };
  const orchestrator = createOrchestrator([
    { adapter: wrong, independenceGroupId: "primary-family", priority: 0 }
  ]);
  const result = await orchestrator.collect(TARGET);
  assert.equal(result.attempts[0].outcome, "INVALID_OBSERVATION");
  assert.equal(result.observations.length, 0);
  assert.equal(result.candidates[0].snapshot, null);
  assert.equal(result.providerHealth[0].state, "UNAVAILABLE");
});

test("simultaneous collect calls are single-flight per provider", async () => {
  let release;
  let entered;
  const enteredPromise = new Promise((resolve) => { entered = resolve; });
  const releasePromise = new Promise((resolve) => { release = resolve; });
  const slow = adapter("provider-primary");
  const originalFetch = slow.fetchRaw.bind(slow);
  slow.fetchRaw = async (request, signal) => {
    slow.lastRequest = request;
    entered();
    await releasePromise;
    return originalFetch(request, signal);
  };
  const orchestrator = createOrchestrator([
    { adapter: slow, independenceGroupId: "primary-family", priority: 0 }
  ]);
  const firstPromise = orchestrator.collect(TARGET);
  await enteredPromise;
  const second = await orchestrator.collect(TARGET);
  assert.equal(second.attempts[0].outcome, "BLOCKED");
  assert.deepEqual(second.attempts[0].reasonCodes, ["PROVIDER_ATTEMPT_ALREADY_IN_FLIGHT"]);
  release();
  const first = await firstPromise;
  assert.equal(first.observations.length, 1);
});

test("invalid target and duplicate independent-source registration fail before provider calls", async () => {
  const a = adapter("provider-a");
  const b = adapter("provider-b");
  assert.throws(() => createOrchestrator([
    { adapter: a, independenceGroupId: "same-source", priority: 0 },
    { adapter: b, independenceGroupId: "same-source", priority: 1 }
  ]), /aliases must not share/);
  const orchestrator = createOrchestrator([
    { adapter: a, independenceGroupId: "source-a", priority: 0 }
  ]);
  await assert.rejects(() => orchestrator.collect({ ...TARGET, baseMint: TARGET.quoteMint }), /Invalid read-only market-data target/);
  assert.equal(a.calls, 0);
});
