import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;
import {
  assessProviderLineageReadiness,
  assessProviderAgreementWithReviewedLineage,
  getProviderSourceProfile,
  listProviderSourceProfiles
} from "../packages/market-data/dist/index.js";

const diagnosticPolicy = {
  purpose: "DIAGNOSTIC",
  minimumIndependentGroups: 2,
  requireSourceTimestamp: true,
  oneOffDiagnosticAcknowledged: true
};

function candidate(providerId, role, timestampKind, independenceGroupId = null) {
  const profile = getProviderSourceProfile(providerId);
  return {
    providerId,
    independenceGroupId: independenceGroupId ?? profile?.independenceGroupId ?? "unknown-family",
    role,
    timestampKind
  };
}

test("built-in provider registry records source family, timestamp semantics and unresolved approvals", () => {
  const profiles = listProviderSourceProfiles();
  assert.ok(profiles.length >= 7);
  assert.equal(new Set(profiles.map((item) => item.providerId)).size, profiles.length);

  const dex = getProviderSourceProfile("dex-screener");
  assert.ok(dex);
  assert.equal(dex.timestampKindsByRole.POOL_METRICS, "NONE");
  assert.equal(dex.independenceReview, "UNVERIFIED");

  const gecko = getProviderSourceProfile("geckoterminal");
  assert.ok(gecko);
  assert.equal(gecko.timestampKindsByRole.POOL_METRICS, "NONE");
  assert.equal(gecko.timestampKindsByRole.INDEXED_PRICE, "OBSERVATION");

  const pyth = getProviderSourceProfile("pyth-hermes");
  assert.ok(pyth);
  assert.equal(pyth.timestampKindsByRole.USD_REFERENCE, "EVENT");
  assert.equal(pyth.independenceReview, "UNVERIFIED");

  const pythPro = getProviderSourceProfile("pyth-pro");
  assert.ok(pythPro);
  assert.equal(pythPro.independenceGroupId, pyth.independenceGroupId);
  assert.equal(pythPro.independenceReview, "UNVERIFIED");
  assert.equal(pythPro.timestampKindsByRole.USD_REFERENCE, "EVENT");
  assert.equal(pythPro.productionUseApproved, false);

  assert.ok(profiles.every((item) => item.productionUseApproved === false));
  assert.ok(profiles.every((item) => item.independentlyVerifiedWithGroups.length === 0));
});

test("two different vendor names do not establish independent lineage without mutual owner attestation", () => {
  const result = assessProviderLineageReadiness([
    candidate("geckoterminal", "INDEXED_PRICE", "OBSERVATION"),
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], diagnosticPolicy);

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.canProceedToProviderAgreement, false);
  assert.equal(result.productionUseApproved, false);
  assert.equal(result.tradingAuthorized, false);
  assert.ok(result.reasonCodes.includes("UPSTREAM_LINEAGE_PAIR_NOT_MUTUALLY_ATTESTED"));
  assert.ok(result.reasonCodes.includes("UPSTREAM_LINEAGE_INDEPENDENCE_NOT_ATTESTED"));
});

test("retrieval or indexed metrics cannot be promoted to a source timestamp when the profile has none", () => {
  const result = assessProviderLineageReadiness([
    candidate("dex-screener", "POOL_METRICS", "NONE"),
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], diagnosticPolicy);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.reasonCodes.includes("SOURCE_TIMESTAMP_NOT_AVAILABLE_FOR_ROLE"));
  assert.ok(result.reasonCodes.includes("UPSTREAM_LINEAGE_PAIR_NOT_MUTUALLY_ATTESTED"));
});

test("GeckoTerminal OHLCV candle boundaries are accepted only as price observations, not pool-metric event times", () => {
  const priceObservation = assessProviderLineageReadiness([
    candidate("geckoterminal", "INDEXED_PRICE", "OBSERVATION"),
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], diagnosticPolicy);
  assert.equal(priceObservation.status, "BLOCKED");
  assert.ok(!priceObservation.reasonCodes.includes("SOURCE_TIMESTAMP_KIND_PROFILE_MISMATCH"));
  assert.ok(priceObservation.reasonCodes.includes("PROVIDER_DIAGNOSTIC_USE_DISABLED"));

  const forgedPoolTimestamp = assessProviderLineageReadiness([
    candidate("geckoterminal", "POOL_METRICS", "EVENT"),
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], diagnosticPolicy);
  assert.equal(forgedPoolTimestamp.status, "BLOCKED");
  assert.ok(forgedPoolTimestamp.reasonCodes.includes("SOURCE_TIMESTAMP_KIND_PROFILE_MISMATCH"));
  assert.ok(forgedPoolTimestamp.reasonCodes.includes("SOURCE_TIMESTAMP_NOT_AVAILABLE_FOR_ROLE"));
});

test("sibling CoinGecko and GeckoTerminal products share one upstream source family", () => {
  const result = assessProviderLineageReadiness([
    candidate("geckoterminal", "INDEXED_PRICE", "OBSERVATION"),
    candidate("coingecko-api", "INDEXED_PRICE", "OBSERVATION")
  ], diagnosticPolicy);

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.distinctIndependenceGroupCount, 1);
  assert.ok(result.reasonCodes.includes("DUPLICATE_UPSTREAM_SOURCE_FAMILY"));
});

test("provider group supplied by the caller must exactly match the reviewed registry", () => {
  const result = assessProviderLineageReadiness([
    candidate("dex-screener", "INDEXED_PRICE", "NONE", "pyth-network"),
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], diagnosticPolicy);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.rejectedProviders.some((item) =>
    item.providerId === "dex-screener" &&
    item.reasonCodes.includes("PROVIDER_INDEPENDENCE_GROUP_MISMATCH")
  ));
});

test("unknown provider IDs cannot self-assign a new independence family", () => {
  const result = assessProviderLineageReadiness([
    candidate("unknown-indexer", "INDEXED_PRICE", "EVENT"),
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], diagnosticPolicy);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.rejectedProviders.some((item) =>
    item.providerId === "unknown-indexer" &&
    item.reasonCodes.includes("UNKNOWN_PROVIDER_SOURCE_PROFILE")
  ));
});

test("diagnostic provider usage requires explicit per-run acknowledgement", () => {
  const result = assessProviderLineageReadiness([
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT"),
    candidate("raydium-api-v3", "POOL_METRICS", "NONE")
  ], {
    ...diagnosticPolicy,
    oneOffDiagnosticAcknowledged: false
  });

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.reasonCodes.includes("ONE_OFF_DIAGNOSTIC_ACK_REQUIRED"));
});

test("Birdeye remains disabled until written permission is obtained", () => {
  const profile = getProviderSourceProfile("birdeye");
  assert.ok(profile);
  assert.equal(profile.diagnosticAccess, "DISABLED_PENDING_WRITTEN_PERMISSION");
  assert.equal(profile.commercialRights, "WRITTEN_PERMISSION_REQUIRED");

  const result = assessProviderLineageReadiness([
    candidate("birdeye", "INDEXED_PRICE", "OBSERVATION"),
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], diagnosticPolicy);

  assert.equal(result.status, "BLOCKED");
  assert.ok(result.reasonCodes.includes("PROVIDER_DIAGNOSTIC_USE_DISABLED"));
});

test("production data rights and production-provider approval are independently required", () => {
  const result = assessProviderLineageReadiness([
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT"),
    candidate("geckoterminal", "INDEXED_PRICE", "OBSERVATION")
  ], {
    purpose: "PRODUCTION",
    minimumIndependentGroups: 2,
    requireSourceTimestamp: true,
    oneOffDiagnosticAcknowledged: false
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.productionUseApproved, false);
  assert.ok(result.reasonCodes.includes("PRODUCTION_PROVIDER_NOT_APPROVED"));
  assert.ok(result.reasonCodes.includes("CUSTOMER_DATA_RIGHTS_NOT_CLEARED"));
});

test("invalid lineage policy and malformed candidates fail closed", () => {
  const invalidPolicy = assessProviderLineageReadiness([
    candidate("pyth-hermes", "USD_REFERENCE", "EVENT")
  ], {
    ...diagnosticPolicy,
    minimumIndependentGroups: 1
  });
  assert.equal(invalidPolicy.status, "INVALID_INPUT");
  assert.equal(invalidPolicy.canProceedToProviderAgreement, false);

  const malformed = assessProviderLineageReadiness([
    { providerId: "pyth-hermes", independenceGroupId: "pyth-network", role: "UNKNOWN", timestampKind: "EVENT" },
    candidate("geckoterminal", "INDEXED_PRICE", "OBSERVATION")
  ], diagnosticPolicy);
  assert.equal(malformed.status, "INVALID_INPUT");
  assert.equal(malformed.tradingAuthorized, false);
});


test("reviewed agreement wrapper binds caller groups and timestamp claims to canonical evidence", () => {
  const originalEvidence = {
    providerId: "dex-screener",
    independenceGroupId: "dex-screener-family",
    priority: 0,
    health: {
      providerId: "dex-screener",
      state: "HEALTHY",
      consecutiveFailures: 0,
      lastSuccessAt: "2026-10-29T00:00:56.000Z",
      lastFailureAt: null,
      lastRequestAt: "2026-10-29T00:00:56.000Z",
      lastLatencyMs: 12,
      circuitOpenUntil: null,
      lastErrorClass: null
    },
    snapshot: (() => {
      const value = structuredClone(original);
      value.provenance.providerId = "dex-screener";
      value.provenance.synthetic = false;
      value.observedAt = "2026-10-29T00:00:55.000Z";
      value.sourceEventAt = null;
      value.retrievedAt = "2026-10-29T00:00:56.000Z";
      return value;
    })()
  };
  const pythEvidence = {
    providerId: "pyth-hermes",
    independenceGroupId: "pyth-network",
    priority: 1,
    health: {
      providerId: "pyth-hermes",
      state: "HEALTHY",
      consecutiveFailures: 0,
      lastSuccessAt: "2026-10-29T00:00:56.000Z",
      lastFailureAt: null,
      lastRequestAt: "2026-10-29T00:00:56.000Z",
      lastLatencyMs: 12,
      circuitOpenUntil: null,
      lastErrorClass: null
    },
    snapshot: (() => {
      const value = structuredClone(original);
      value.provenance.providerId = "pyth-hermes";
      value.provenance.synthetic = false;
      value.observedAt = "2026-10-29T00:00:55.000Z";
      value.sourceEventAt = "2026-10-29T00:00:55.000Z";
      value.retrievedAt = "2026-10-29T00:00:56.000Z";
      return value;
    })()
  };
  const result = assessProviderAgreementWithReviewedLineage({
    candidates: [originalEvidence, pythEvidence],
    lineageCandidates: [
      { providerId: "dex-screener", independenceGroupId: "dex-screener-family", role: "POOL_METRICS", timestampKind: "NONE" },
      { providerId: "pyth-hermes", independenceGroupId: "pyth-network", role: "POOL_METRICS", timestampKind: "EVENT" }
    ],
    lineagePolicy: diagnosticPolicy,
    agreementPolicy: {
      nowAt: "2026-10-29T00:01:00.000Z",
      maxAgeMs: 60_000,
      maxHealthAgeMs: 60_000
    }
  });

  assert.equal(result.status, "NO_ACCEPTABLE_PROVIDER");
  assert.equal(result.canProceedToOnChainValidation, false);
  assert.equal(result.tradingAuthorized, false);
  assert.ok(result.reasonCodes.includes("REVIEWED_PROVIDER_LINEAGE_GATE_BLOCKED"));
  assert.ok(result.lineage.rejectedProviders.some((item) =>
    item.providerId === "pyth-hermes" &&
    item.reasonCodes.includes("PROVIDER_ROLE_NOT_SUPPORTED")
  ));
});

test("reviewed agreement wrapper refuses caller timestamp claims that differ from observed evidence", () => {
  const evidence = {
    ...structuredClone(original),
    observationId: "lineage-binding",
    retrievedAt: "2026-10-29T00:00:56.000Z",
    observedAt: "2026-10-29T00:00:55.000Z",
    sourceEventAt: null
  };
  evidence.provenance.providerId = "dex-screener";
  evidence.provenance.synthetic = false;
  const health = {
    providerId: "dex-screener",
    state: "HEALTHY",
    consecutiveFailures: 0,
    lastSuccessAt: "2026-10-29T00:00:56.000Z",
    lastFailureAt: null,
    lastRequestAt: "2026-10-29T00:00:56.000Z",
    lastLatencyMs: 12,
    circuitOpenUntil: null,
    lastErrorClass: null
  };
  const result = assessProviderAgreementWithReviewedLineage({
    candidates: [{
      providerId: "dex-screener",
      independenceGroupId: "dex-screener-family",
      priority: 0,
      health,
      snapshot: evidence
    }],
    lineageCandidates: [{
      providerId: "dex-screener",
      independenceGroupId: "dex-screener-family",
      role: "POOL_METRICS",
      timestampKind: "NONE"
    }],
    lineagePolicy: {
      ...diagnosticPolicy,
      minimumIndependentGroups: 2,
      requireSourceTimestamp: false
    },
    agreementPolicy: {
      nowAt: "2026-10-29T00:01:00.000Z",
      maxAgeMs: 60_000,
      maxHealthAgeMs: 60_000
    }
  });
  assert.equal(result.status, "NO_ACCEPTABLE_PROVIDER");
  assert.ok(result.lineage.rejectedProviders.some((item) =>
    item.providerId === "dex-screener" &&
    item.reasonCodes.includes("SOURCE_TIMESTAMP_KIND_PROFILE_MISMATCH")
  ));
});
