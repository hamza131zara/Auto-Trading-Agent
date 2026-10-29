import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessProviderAgreement,
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

test("synthetic observations are rejected by default", () => {
  const assessment = assessProviderAgreement(twoAgreeingCandidates(), {
    nowAt: policy.nowAt,
    maxAgeMs: policy.maxAgeMs
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

test("invalid policy fails closed", () => {
  const assessment = assessProviderAgreement(twoAgreeingCandidates(), {
    nowAt: policy.nowAt,
    maxAgeMs: -1
  });
  assert.equal(assessment.status, "INVALID_INPUT");
  assert.equal(assessment.tradingAuthorized, false);
});
