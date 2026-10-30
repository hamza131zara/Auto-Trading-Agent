import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessReadOnlyMarketDataCollection,
  ReadOnlyMarketDataOrchestrator
} from "../packages/market-data/dist/provider-orchestrator.js";

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
const START = "2026-10-29T12:00:00.000Z";

const AGREEMENT_POLICY = {
  nowAt: START,
  maxAgeMs: 60_000,
  maxHealthAgeMs: 60_000,
  maxFutureSkewMs: 0
};
const LINEAGE_POLICY = {
  purpose: "DIAGNOSTIC",
  minimumIndependentGroups: 2,
  requireSourceTimestamp: false,
  oneOffDiagnosticAcknowledged: true
};

function snapshotFor(providerId, request, context, behavior = {}) {
  const snapshot = structuredClone(original);
  snapshot.observationId = providerId + "-" + context.retrievedAt;
  snapshot.cluster = request.cluster;
  snapshot.baseMint = request.baseMint;
  snapshot.quoteMint = request.quoteMint;
  snapshot.poolAddress = request.poolAddress;
  snapshot.price = {
    value: behavior.price ?? "0.012345",
    unit: "QUOTE_PER_BASE",
    assetId: request.quoteMint
  };
  snapshot.liquidity = {
    value: behavior.liquidity ?? "100000",
    unit: "USD",
    assetId: null
  };
  snapshot.volume24h = {
    value: behavior.volume24h ?? "10000",
    unit: "USD",
    assetId: null
  };
  snapshot.buys24h = behavior.buys24h ?? 100;
  snapshot.sells24h = behavior.sells24h ?? 80;
  snapshot.observedAt = behavior.observedAt === undefined
    ? "2026-10-29T11:59:55.000Z"
    : behavior.observedAt;
  snapshot.sourceEventAt = behavior.sourceEventAt === undefined
    ? "2026-10-29T11:59:55.000Z"
    : behavior.sourceEventAt;
  snapshot.retrievedAt = context.retrievedAt;
  snapshot.slot = null;
  snapshot.provenance = {
    providerId,
    sourceKind: "INDEXED_API",
    adapterVersion: "phase6-resilience-test-1.0.0",
    schemaVersion: "ata.market-data.v1",
    requestId: context.requestId,
    sourceEventId: null,
    rawPayloadSha256: "b".repeat(64),
    synthetic: false
  };
  return snapshot;
}

class ScenarioAdapter {
  constructor(providerId, behavior = {}) {
    this.providerId = providerId;
    this.adapterVersion = "phase6-resilience-test-1.0.0";
    this.sourceKind = "INDEXED_API";
    this.behavior = behavior;
    this.calls = 0;
    this.lastRequest = null;
  }

  async fetchRaw(request, signal) {
    this.calls += 1;
    this.lastRequest = request;
    if (signal.aborted) {
      const error = new Error("sanitized timeout fixture");
      error.code = "TIMEOUT";
      error.retryable = true;
      throw error;
    }
    if (this.behavior.fail) {
      const error = new Error("secret response body must never be retained");
      error.code = this.behavior.code ?? "NETWORK";
      error.retryable = this.behavior.retryable ?? true;
      throw error;
    }
    return { fixture: "offline-only" };
  }

  normalize(_raw, context) {
    if (this.behavior.normalizationErrors) {
      return { observations: [], errors: this.behavior.normalizationErrors };
    }
    return {
      observations: [snapshotFor(this.providerId, this.lastRequest, context, this.behavior)],
      errors: []
    };
  }
}

function createHarness(adapters, state, healthPolicy = { failureThreshold: 2, cooldownMs: 30_000 }) {
  const registrations = adapters.map((adapter, priority) => {
    const groups = {
      "dex-screener": "dex-screener-family",
      "raydium-api-v3": "raydium-api-v3",
      geckoterminal: "geckoterminal-coingecko-ecosystem"
    };
    return {
      adapter,
      independenceGroupId: groups[adapter.providerId],
      priority
    };
  });
  return new ReadOnlyMarketDataOrchestrator(registrations, {
    now: () => state.now,
    healthPolicy,
    maxHealthAgeMs: 60_000,
    requestTimeoutMs: 2_000,
    requestId: (providerId, requestedAt) => providerId + "-" + requestedAt
  });
}

function assess(collection, nowAt) {
  return assessReadOnlyMarketDataCollection(collection, {
    agreementPolicy: { ...AGREEMENT_POLICY, nowAt },
    lineagePolicy: LINEAGE_POLICY
  });
}

test("healthy arithmetic agreement remains diagnostic-only until source lineage is attested", async () => {
  const state = { now: START };
  const dex = new ScenarioAdapter("dex-screener");
  const raydium = new ScenarioAdapter("raydium-api-v3");
  const orchestrator = createHarness([dex, raydium], state);

  const collection = await orchestrator.collect(TARGET);
  const result = assess(collection, state.now);

  assert.equal(result.diagnosticAgreement.status, "AGREED");
  assert.deepEqual(result.diagnosticAgreement.eligibleProviderIds, ["dex-screener", "raydium-api-v3"]);
  assert.equal(result.reviewedAgreement.lineage.status, "BLOCKED");
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.canProceedToOnChainValidation, false);
  assert.ok(result.reasonCodes.includes("UPSTREAM_LINEAGE_INDEPENDENCE_NOT_ATTESTED"));
  assert.equal(result.tradingAuthorized, false);
});

test("fallback disagreement is preserved and never silently replaced by primary priority", async () => {
  const state = { now: START };
  const dex = new ScenarioAdapter("dex-screener", { fail: true, code: "RATE_LIMIT", retryable: true });
  const raydium = new ScenarioAdapter("raydium-api-v3", { price: "0.012345" });
  const gecko = new ScenarioAdapter("geckoterminal", { price: "0.012346" });
  const orchestrator = createHarness([dex, raydium, gecko], state);

  const collection = await orchestrator.collect(TARGET);
  const result = assess(collection, state.now);

  assert.equal(collection.attempts[0].outcome, "REQUEST_FAILED");
  assert.deepEqual(collection.attempts[0].reasonCodes, ["PROVIDER_REQUEST_RATE_LIMIT"]);
  assert.equal(collection.providerHealth[0].state, "DEGRADED");
  assert.equal(result.attemptSummary.failedProviderIds[0], "dex-screener");
  assert.deepEqual(result.attemptSummary.successfulProviderIds, ["raydium-api-v3", "geckoterminal"]);
  assert.equal(result.fallbackUsed, true);
  assert.equal(result.diagnosticAgreement.status, "DISAGREEMENT");
  assert.deepEqual(result.diagnosticAgreement.disagreementFields, ["price"]);
  assert.equal(result.status, "DISAGREEMENT");
  assert.equal(result.canProceedToOnChainValidation, false);
  assert.equal(result.tradingAuthorized, false);
});

test("stale source observation is rejected even when retrieval and provider health are recent", async () => {
  const state = { now: START };
  const stale = new ScenarioAdapter("dex-screener", {
    sourceEventAt: "2026-10-29T11:55:00.000Z",
    observedAt: "2026-10-29T11:55:00.000Z"
  });
  const fresh = new ScenarioAdapter("raydium-api-v3");
  const orchestrator = createHarness([stale, fresh], state);

  const collection = await orchestrator.collect(TARGET);
  const result = assess(collection, state.now);

  assert.equal(collection.providerHealth.every((item) => item.state === "HEALTHY"), true);
  assert.equal(result.diagnosticAgreement.status, "INSUFFICIENT_EVIDENCE");
  const staleRejection = result.diagnosticAgreement.rejectedProviders.find((item) =>
    item.providerId === "dex-screener"
  );
  assert.ok(staleRejection.reasonCodes.includes("FRESHNESS_STALE"));
  assert.equal(result.canProceedToOnChainValidation, false);
  assert.equal(result.tradingAuthorized, false);
});

test("missing event and observation timestamps do not become fresh through a new retrieval", async () => {
  const state = { now: START };
  const dex = new ScenarioAdapter("dex-screener", {
    sourceEventAt: null,
    observedAt: null
  });
  const raydium = new ScenarioAdapter("raydium-api-v3", {
    sourceEventAt: null,
    observedAt: null
  });
  const orchestrator = createHarness([dex, raydium], state);

  const collection = await orchestrator.collect(TARGET);
  const result = assess(collection, state.now);

  assert.equal(collection.observations.length, 2);
  assert.equal(result.diagnosticAgreement.status, "NO_ACCEPTABLE_PROVIDER");
  assert.ok(result.diagnosticAgreement.rejectedProviders.length === 2);
  assert.ok(result.diagnosticAgreement.rejectedProviders.every((item) =>
    item.reasonCodes.includes("SOURCE_TIMESTAMP_MISSING")
  ));
  assert.equal(result.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(result.canProceedToOnChainValidation, false);
});

test("two rate limits open the primary circuit, cooldown blocks it, and a recovery disagreement remains visible", async () => {
  const state = { now: START };
  const primary = new ScenarioAdapter("dex-screener", {
    fail: true,
    code: "RATE_LIMIT",
    retryable: true
  });
  const raydium = new ScenarioAdapter("raydium-api-v3", { price: "0.012345" });
  const gecko = new ScenarioAdapter("geckoterminal", { price: "0.012345" });
  const orchestrator = createHarness(
    [primary, raydium, gecko],
    state,
    { failureThreshold: 2, cooldownMs: 30_000 }
  );

  const first = await orchestrator.collect(TARGET);
  const firstAssessment = assess(first, state.now);
  assert.equal(firstAssessment.fallbackUsed, true);
  assert.equal(primary.calls, 1);
  assert.equal(first.providerHealth[0].state, "DEGRADED");

  state.now = "2026-10-29T12:00:01.000Z";
  const second = await orchestrator.collect(TARGET);
  assert.equal(second.attempts[0].permissionStatus, "ALLOW_RETRY");
  assert.equal(second.providerHealth[0].state, "CIRCUIT_OPEN");
  assert.equal(primary.calls, 2);

  state.now = "2026-10-29T12:00:30.999Z";
  const duringCooldown = await orchestrator.collect(TARGET);
  assert.equal(duringCooldown.attempts[0].permissionStatus, "BLOCK_CIRCUIT_OPEN");
  assert.equal(duringCooldown.attempts[0].outcome, "BLOCKED");
  assert.equal(primary.calls, 2);

  state.now = "2026-10-29T12:00:31.000Z";
  primary.behavior.fail = false;
  primary.behavior.price = "0.012346";
  const recovery = await orchestrator.collect(TARGET);
  const recoveryAssessment = assess(recovery, state.now);

  assert.equal(recovery.attempts[0].permissionStatus, "ALLOW_RECOVERY_PROBE");
  assert.equal(recovery.attempts[0].outcome, "OBSERVATION_NORMALIZED");
  assert.equal(recovery.providerHealth[0].state, "HEALTHY");
  assert.equal(primary.calls, 3);
  assert.equal(recoveryAssessment.diagnosticAgreement.status, "DISAGREEMENT");
  assert.deepEqual(recoveryAssessment.diagnosticAgreement.disagreementFields, ["price"]);
  assert.equal(recoveryAssessment.canProceedToOnChainValidation, false);
});

test("non-retryable authentication failure stays unavailable while independent fallbacks continue", async () => {
  const state = { now: START };
  const primary = new ScenarioAdapter("dex-screener", {
    fail: true,
    code: "AUTH",
    retryable: false
  });
  const raydium = new ScenarioAdapter("raydium-api-v3");
  const gecko = new ScenarioAdapter("geckoterminal");
  const orchestrator = createHarness([primary, raydium, gecko], state);

  const first = await orchestrator.collect(TARGET);
  assert.equal(first.providerHealth[0].state, "UNAVAILABLE");
  assert.equal(first.attempts[0].reasonCodes[0], "PROVIDER_REQUEST_AUTH");
  assert.equal(raydium.calls, 1);
  assert.equal(gecko.calls, 1);

  state.now = "2026-10-29T12:00:01.000Z";
  const second = await orchestrator.collect(TARGET);
  assert.equal(second.attempts[0].permissionStatus, "BLOCK_UNAVAILABLE");
  assert.equal(second.attempts[0].outcome, "BLOCKED");
  assert.equal(primary.calls, 1);
  assert.equal(raydium.calls, 2);
  assert.equal(gecko.calls, 2);
});
