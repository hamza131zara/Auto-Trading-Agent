import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessProviderAgreement,
  assessCriticalMarketDataEvidenceGate,
  assessIndependentReservePriceAgreement,
  initialProviderHealth,
  recordProviderResult,
  validateCanonicalMarketSnapshot
} from "../packages/market-data/dist/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;
const policy = {
  nowAt: "2026-10-29T00:01:00.000Z",
  maxAgeMs: 60_000,
  maxHealthAgeMs: 60_000,
  allowSyntheticFixtures: true
};

function healthyHealth(providerId) {
  return recordProviderResult(initialProviderHealth(providerId), {
    kind: "SUCCESS",
    at: "2026-10-29T00:00:56.000Z",
    latencyMs: 12
  }, { failureThreshold: 2, cooldownMs: 30_000 });
}

function circuitOpenHealth(providerId) {
  return recordProviderResult(initialProviderHealth(providerId), {
    kind: "FAILURE",
    at: "2026-10-29T00:00:56.000Z",
    errorClass: "NETWORK",
    retryable: true,
    latencyMs: null
  }, { failureThreshold: 1, cooldownMs: 30_000 });
}

function snapshotFor(providerId, mutate = () => {}) {
  const snapshot = structuredClone(original);
  snapshot.observationId = providerId + "-observation";
  snapshot.provenance.providerId = providerId;
  mutate(snapshot);
  assert.equal(validateCanonicalMarketSnapshot(snapshot).valid, true);
  return snapshot;
}

function candidate(
  providerId,
  priority,
  snapshot,
  health = healthyHealth(providerId),
  independenceGroupId = providerId
) {
  return { providerId, independenceGroupId, priority, snapshot, health };
}

function twoAgreeingCandidates() {
  return [
    candidate("provider-primary", 0, snapshotFor("provider-primary")),
    candidate("provider-fallback", 1, snapshotFor("provider-fallback"))
  ];
}

function twoLiveAgreeingCandidates() {
  return twoAgreeingCandidates().map((item) => {
    const snapshot = structuredClone(item.snapshot);
    snapshot.provenance.synthetic = false;
    snapshot.provenance.sourceKind = "INDEXED_API";
    snapshot.provenance.requestId = item.providerId + "-request";
    snapshot.provenance.rawPayloadSha256 = "a".repeat(64);
    assert.equal(validateCanonicalMarketSnapshot(snapshot).valid, true);
    return { ...item, snapshot };
  });
}

function independentPriceInput(overrides = {}) {
  const nowAt = "2026-10-29T12:45:00.000Z";
  const policy = {
    nowAt,
    maxSourceAgeMs: 60_000,
    maxRetrievalAgeMs: 30_000,
    maxReferenceTimestampSkewMs: 10_000,
    maxFutureSkewMs: 0,
    maxDeviationBps: 10,
    approvedProviderId: "oracle-reference",
    approvedIndependenceGroupId: "oracle-network",
    expectedBaseFeedId: "sol-usd-feed",
    expectedQuoteFeedId: "usdc-usd-feed",
    ...(overrides.policy ?? {})
  };
  const baseUsd = {
    assetId: "So11111111111111111111111111111111111111112",
    feedId: "sol-usd-feed",
    providerId: "oracle-reference",
    independenceGroupId: "oracle-network",
    priceUsd: "99.98",
    publishedAt: "2026-10-29T12:44:50.000Z",
    retrievedAt: "2026-10-29T12:44:55.000Z",
    synthetic: false,
    ...(overrides.baseUsd ?? {})
  };
  const quoteUsd = {
    assetId: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    feedId: "usdc-usd-feed",
    providerId: "oracle-reference",
    independenceGroupId: "oracle-network",
    priceUsd: "1.0000",
    publishedAt: "2026-10-29T12:44:50.000Z",
    retrievedAt: "2026-10-29T12:44:55.000Z",
    synthetic: false,
    ...(overrides.quoteUsd ?? {})
  };
  return {
    baseMint: "So11111111111111111111111111111111111111112",
    quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    reserveRatioQuotePerBase: "99.985997437490137051",
    indexedPriceUsdPerBase: "99.98",
    indexedProviderId: "dex-screener",
    indexedIndependenceGroupId: "dex-screener-family",
    indexedSourceEventAt: "2026-10-29T12:44:50.000Z",
    indexedRetrievedAt: "2026-10-29T12:44:55.000Z",
    indexedSynthetic: false,
    ...overrides,
    baseUsd,
    quoteUsd,
    policy
  };
}

test("exactly aligned independent providers agree but synthetic fixtures cannot advance to on-chain validation", () => {
  const assessment = assessProviderAgreement(twoAgreeingCandidates(), policy);
  assert.equal(assessment.status, "AGREED");
  assert.deepEqual(assessment.eligibleProviderIds, ["provider-primary", "provider-fallback"]);
  assert.deepEqual(assessment.disagreementFields, []);
  assert.deepEqual(assessment.reasonCodes, ["SYNTHETIC_AGREEMENT_ONLY"]);
  assert.equal(assessment.canProceedToOnChainValidation, false);
  assert.equal(assessment.tradingAuthorized, false);
});

test("normalizes equivalent decimal spellings without binary floating-point conversion", () => {
  const candidates = twoAgreeingCandidates();
  candidates[0].snapshot.liquidity.value = "250000.0000";
  candidates[1].snapshot.liquidity.value = "250000";
  const assessment = assessProviderAgreement(candidates, policy);
  assert.equal(assessment.status, "AGREED");
});

test("a price disagreement blocks all provider selection instead of silently preferring primary", () => {
  const candidates = twoAgreeingCandidates();
  candidates[1].snapshot.price.value = "0.012346";
  const assessment = assessProviderAgreement(candidates, policy);
  assert.equal(assessment.status, "DISAGREEMENT");
  assert.deepEqual(assessment.disagreementFields, ["price"]);
  assert.deepEqual(assessment.reasonCodes, ["PROVIDER_MEASURE_DISAGREEMENT"]);
  assert.equal(assessment.canProceedToOnChainValidation, false);
});

test("pair identity disagreement blocks evidence even when measures match", () => {
  const candidates = twoAgreeingCandidates();
  candidates[1].snapshot.cluster = "mainnet-beta";
  const assessment = assessProviderAgreement(candidates, policy);
  assert.equal(assessment.status, "DISAGREEMENT");
  assert.deepEqual(assessment.disagreementFields, ["cluster"]);
});

test("different source timestamps return insufficient evidence until alignment policy is approved", () => {
  const candidates = twoAgreeingCandidates();
  candidates[1].snapshot.sourceEventAt = "2026-10-29T00:00:51.000Z";
  candidates[1].snapshot.observedAt = "2026-10-29T00:00:51.000Z";
  const assessment = assessProviderAgreement(candidates, policy);
  assert.equal(assessment.status, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(assessment.disagreementFields, ["sourceTimestamp"]);
  assert.deepEqual(assessment.reasonCodes, ["SOURCE_TIME_ALIGNMENT_UNCONFIGURED"]);
});

test("an unhealthy primary does not block two agreeing fallback providers, and fallback use is explicit", () => {
  const candidates = [
    candidate("provider-primary", 0, null, circuitOpenHealth("provider-primary")),
    candidate("provider-fallback-a", 1, snapshotFor("provider-fallback-a")),
    candidate("provider-fallback-b", 2, snapshotFor("provider-fallback-b"))
  ];
  const assessment = assessProviderAgreement(candidates, policy);
  assert.equal(assessment.status, "AGREED");
  assert.equal(assessment.fallbackUsed, true);
  assert.deepEqual(assessment.eligibleProviderIds, ["provider-fallback-a", "provider-fallback-b"]);
  assert.deepEqual(assessment.rejectedProviders, [{
    providerId: "provider-primary",
    reasonCodes: ["NO_OBSERVATION", "PROVIDER_NOT_HEALTHY"]
  }]);
  assert.equal(assessment.canProceedToOnChainValidation, false);
});

test("a single healthy fallback remains blocked without independent confirmation", () => {
  const candidates = [
    candidate("provider-primary", 0, null, circuitOpenHealth("provider-primary")),
    candidate("provider-fallback", 1, snapshotFor("provider-fallback"))
  ];
  const assessment = assessProviderAgreement(candidates, policy);
  assert.equal(assessment.status, "INSUFFICIENT_EVIDENCE");
  assert.equal(assessment.fallbackUsed, true);
  assert.deepEqual(assessment.reasonCodes, ["INDEPENDENT_PROVIDER_CONFIRMATION_REQUIRED"]);
  assert.equal(assessment.canProceedToOnChainValidation, false);
});

test("stale or source-time-unknown observations are rejected even when provider health is healthy", () => {
  const stale = snapshotFor("provider-stale", (snapshot) => {
    snapshot.retrievedAt = "2026-10-28T23:00:00.000Z";
    snapshot.observedAt = "2026-10-28T23:00:00.000Z";
    snapshot.sourceEventAt = "2026-10-28T23:00:00.000Z";
  });
  const unknown = snapshotFor("provider-unknown", (snapshot) => {
    snapshot.observedAt = null;
    snapshot.sourceEventAt = null;
  });
  const staleResult = assessProviderAgreement([
    candidate("provider-stale", 0, stale)
  ], policy);
  const unknownResult = assessProviderAgreement([
    candidate("provider-unknown", 0, unknown)
  ], policy);
  assert.equal(staleResult.status, "NO_ACCEPTABLE_PROVIDER");
  assert.ok(staleResult.rejectedProviders[0].reasonCodes.includes("FRESHNESS_STALE"));
  assert.equal(unknownResult.status, "NO_ACCEPTABLE_PROVIDER");
  assert.ok(unknownResult.rejectedProviders[0].reasonCodes.includes("FRESHNESS_UNKNOWN"));
  assert.ok(unknownResult.rejectedProviders[0].reasonCodes.includes("SOURCE_TIMESTAMP_MISSING"));
});

test("missing required market measures are insufficient evidence, not zero", () => {
  const candidates = twoAgreeingCandidates();
  candidates[0].snapshot.liquidity = null;
  candidates[1].snapshot.liquidity = null;
  const assessment = assessProviderAgreement(candidates, policy);
  assert.equal(assessment.status, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(assessment.disagreementFields, ["liquidity"]);
  assert.deepEqual(assessment.reasonCodes, ["REQUIRED_MEASURE_MISSING"]);
});

test("a stale provider-health snapshot is rejected even when the observation itself is fresh", () => {
  const staleHealth = {
    ...healthyHealth("provider-stale-health"),
    lastSuccessAt: "2026-10-28T23:00:00.000Z",
    lastRequestAt: "2026-10-28T23:00:00.000Z"
  };
  const assessment = assessProviderAgreement([
    candidate("provider-stale-health", 0, snapshotFor("provider-stale-health"), staleHealth)
  ], policy);
  assert.equal(assessment.status, "NO_ACCEPTABLE_PROVIDER");
  assert.ok(assessment.rejectedProviders[0].reasonCodes.includes("PROVIDER_HEALTH_STALE"));
});

test("synthetic observations are rejected by default", () => {
  const assessment = assessProviderAgreement(twoAgreeingCandidates(), {
    nowAt: policy.nowAt,
    maxAgeMs: policy.maxAgeMs,
    maxHealthAgeMs: policy.maxHealthAgeMs
  });
  assert.equal(assessment.status, "NO_ACCEPTABLE_PROVIDER");
  assert.ok(assessment.rejectedProviders.every((item) =>
    item.reasonCodes.includes("SYNTHETIC_EVIDENCE_NOT_ALLOWED")
  ));
});

test("duplicate providers or provider priority values are rejected as invalid input", () => {
  const duplicateProvider = [
    candidate("provider-primary", 0, snapshotFor("provider-primary")),
    candidate("provider-primary", 1, snapshotFor("provider-primary"))
  ];
  const duplicatePriority = [
    candidate("provider-primary", 0, snapshotFor("provider-primary")),
    candidate("provider-fallback", 0, snapshotFor("provider-fallback"))
  ];
  const duplicateIndependenceGroup = [
    candidate("provider-primary", 0, snapshotFor("provider-primary"), healthyHealth("provider-primary"), "same-upstream"),
    candidate("provider-alias", 1, snapshotFor("provider-alias"), healthyHealth("provider-alias"), "same-upstream")
  ];
  assert.deepEqual(
    assessProviderAgreement(duplicateProvider, policy).reasonCodes,
    ["DUPLICATE_PROVIDER_ID"]
  );
  assert.deepEqual(
    assessProviderAgreement(duplicatePriority, policy).reasonCodes,
    ["DUPLICATE_PROVIDER_PRIORITY"]
  );
  assert.deepEqual(
    assessProviderAgreement(duplicateIndependenceGroup, policy).reasonCodes,
    ["DUPLICATE_INDEPENDENCE_GROUP"]
  );
});

test("provider provenance cannot be relabeled to make another source appear authoritative", () => {
  const candidateWithMismatchedProvenance = candidate(
    "provider-primary",
    0,
    snapshotFor("provider-other")
  );
  const assessment = assessProviderAgreement([candidateWithMismatchedProvenance], policy);
  assert.equal(assessment.status, "INVALID_INPUT");
  assert.deepEqual(assessment.reasonCodes, ["PROVENANCE_PROVIDER_ID_MISMATCH"]);
});

test("critical evidence gate advances only when independent provider and Pyth price gates both pass", () => {
  const providerAgreement = assessProviderAgreement(twoLiveAgreeingCandidates(), {
    nowAt: policy.nowAt,
    maxAgeMs: policy.maxAgeMs,
    maxHealthAgeMs: policy.maxHealthAgeMs
  });
  const independentComparison = assessIndependentReservePriceAgreement(independentPriceInput());
  assert.equal(providerAgreement.status, "AGREED");
  assert.equal(providerAgreement.canProceedToOnChainValidation, true);
  assert.equal(independentComparison.status, "AGREED");
  assert.equal(independentComparison.comparisonEvidenceComplete, true);

  const gate = assessCriticalMarketDataEvidenceGate({ providerAgreement, independentComparison });
  assert.equal(gate.status, "READY_FOR_ON_CHAIN_VALIDATION");
  assert.deepEqual(gate.reasonCodes, []);
  assert.equal(gate.canProceedToOnChainValidation, true);
  assert.equal(gate.tradingAuthorized, false);
});

test("critical evidence gate blocks provider agreement when the live Pyth reserve comparison disagrees", () => {
  const providerAgreement = assessProviderAgreement(twoLiveAgreeingCandidates(), {
    nowAt: policy.nowAt,
    maxAgeMs: policy.maxAgeMs,
    maxHealthAgeMs: policy.maxHealthAgeMs
  });
  const independentComparison = assessIndependentReservePriceAgreement(independentPriceInput({
    reserveRatioQuotePerBase: "100.643712539836069377",
    indexedPriceUsdPerBase: "100.64",
    indexedSourceEventAt: null,
    indexedRetrievedAt: "2026-10-29T14:34:17.779Z",
    policy: {
      nowAt: "2026-10-29T14:34:18.750Z",
      maxSourceAgeMs: 60_000,
      maxRetrievalAgeMs: 30_000,
      maxReferenceTimestampSkewMs: 10_000,
      maxFutureSkewMs: 0,
      maxDeviationBps: 10
    },
    baseUsd: {
      priceUsd: "101.25522465",
      publishedAt: "2026-10-29T14:34:18.000Z",
      retrievedAt: "2026-10-29T14:34:18.750Z"
    },
    quoteUsd: {
      priceUsd: "0.99975109",
      publishedAt: "2026-10-29T14:34:18.000Z",
      retrievedAt: "2026-10-29T14:34:18.750Z"
    }
  }));
  assert.equal(providerAgreement.status, "AGREED");
  assert.equal(independentComparison.status, "DISAGREEMENT");
  assert.equal(independentComparison.reserveComparison.deviationBpsRounded, "63");
  assert.equal(independentComparison.indexedPriceComparison.status, "NOT_ASSESSED");

  const gate = assessCriticalMarketDataEvidenceGate({ providerAgreement, independentComparison });
  assert.equal(gate.status, "BLOCKED");
  assert.equal(gate.canProceedToOnChainValidation, false);
  assert.ok(gate.reasonCodes.includes("INDEPENDENT_PRICE_COMPARISON_DISAGREEMENT"));
  assert.ok(gate.reasonCodes.includes("RESERVE_RATIO_OUTSIDE_TOLERANCE"));
  assert.ok(gate.reasonCodes.includes("INDEXED_SOURCE_TIMESTAMP_MISSING"));
  assert.ok(gate.reasonCodes.includes("INDEPENDENT_PRICE_EVIDENCE_INCOMPLETE"));
  assert.equal(gate.tradingAuthorized, false);
});

test("critical evidence gate rejects malformed or forged authorization-shaped inputs", () => {
  const malformed = assessCriticalMarketDataEvidenceGate(null);
  assert.equal(malformed.status, "INVALID_INPUT");
  assert.equal(malformed.canProceedToOnChainValidation, false);
  assert.equal(malformed.tradingAuthorized, false);

  const providerAgreement = {
    status: "AGREED",
    reasonCodes: [],
    canProceedToOnChainValidation: true,
    tradingAuthorized: true
  };
  const independentComparison = {
    status: "AGREED",
    reasonCodes: [],
    comparisonEvidenceComplete: true,
    tradingAuthorized: false
  };
  const forged = assessCriticalMarketDataEvidenceGate({ providerAgreement, independentComparison });
  assert.equal(forged.status, "INVALID_INPUT");
  assert.equal(forged.canProceedToOnChainValidation, false);
  assert.equal(forged.tradingAuthorized, false);
});

test("invalid policy fails closed", () => {
  const assessment = assessProviderAgreement(twoAgreeingCandidates(), {
    nowAt: policy.nowAt,
    maxAgeMs: -1,
    maxHealthAgeMs: policy.maxHealthAgeMs
  });
  assert.equal(assessment.status, "INVALID_INPUT");
  assert.equal(assessment.tradingAuthorized, false);
});
