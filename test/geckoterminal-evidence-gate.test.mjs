import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessProviderAgreement,
  initialProviderHealth,
  recordProviderResult,
  validateCanonicalMarketSnapshot
} from "../packages/market-data/dist/index.js";
import { GeckoTerminalPoolAdapter } from "../packages/market-data/dist/providers/geckoterminal.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const baseline = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;

const TARGET = {
  cluster: "mainnet-beta",
  baseMint: "So11111111111111111111111111111111111111112",
  quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  poolAddress: "47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4",
  requestedAt: "2026-10-29T12:00:50.000Z"
};
const NOW = "2026-10-29T12:00:55.000Z";
const RETRIEVED_AT = "2026-10-29T12:00:54.000Z";

function payload() {
  return {
    data: {
      id: "solana_" + TARGET.poolAddress,
      type: "pool",
      attributes: {
        address: TARGET.poolAddress,
        base_token_price_usd: "100.64",
        reserve_in_usd: "580.12",
        volume_usd: { h24: "272.64" },
        transactions: { h24: { buys: 12, sells: 9 } }
      },
      relationships: {
        base_token: { data: { id: "solana_" + TARGET.baseMint, type: "token" } },
        quote_token: { data: { id: "solana_" + TARGET.quoteMint, type: "token" } }
      }
    }
  };
}

function healthyHealth(providerId) {
  return recordProviderResult(initialProviderHealth(providerId), {
    kind: "SUCCESS",
    at: RETRIEVED_AT,
    latencyMs: 12
  }, { failureThreshold: 2, cooldownMs: 30_000 });
}

function liveLikeIndexedSnapshot(providerId) {
  const snapshot = structuredClone(baseline);
  snapshot.observationId = providerId + "-current-observation";
  snapshot.cluster = TARGET.cluster;
  snapshot.baseMint = TARGET.baseMint;
  snapshot.quoteMint = TARGET.quoteMint;
  snapshot.poolAddress = TARGET.poolAddress;
  snapshot.observedAt = "2026-10-29T12:00:50.000Z";
  snapshot.sourceEventAt = "2026-10-29T12:00:50.000Z";
  snapshot.retrievedAt = RETRIEVED_AT;
  snapshot.provenance.providerId = providerId;
  snapshot.provenance.sourceKind = "INDEXED_API";
  snapshot.provenance.adapterVersion = "fixture-validated";
  snapshot.provenance.requestId = providerId + "-request";
  snapshot.provenance.rawPayloadSha256 = "b".repeat(64);
  snapshot.provenance.synthetic = false;
  assert.equal(validateCanonicalMarketSnapshot(snapshot).valid, true);
  return snapshot;
}

test("GeckoTerminal without a current source timestamp cannot increase provider consensus", () => {
  const adapter = new GeckoTerminalPoolAdapter();
  const normalized = adapter.normalize({
    providerId: "geckoterminal",
    requested: TARGET,
    payload: payload(),
    rawPayloadSha256: "a".repeat(64),
    synthetic: true
  }, {
    requestedAt: TARGET.requestedAt,
    retrievedAt: RETRIEVED_AT,
    requestId: "geckoterminal-fixture-request"
  });

  assert.deepEqual(normalized.errors, []);
  assert.equal(normalized.observations.length, 1);
  const geckoSnapshot = normalized.observations[0];
  assert.ok(geckoSnapshot);
  assert.equal(geckoSnapshot.observedAt, null);
  assert.equal(geckoSnapshot.sourceEventAt, null);
  assert.equal(geckoSnapshot.provenance.synthetic, true);
  assert.equal(validateCanonicalMarketSnapshot(geckoSnapshot).valid, true);

  const assessment = assessProviderAgreement([
    {
      providerId: "provider-current",
      independenceGroupId: "current-indexer-family",
      priority: 0,
      snapshot: liveLikeIndexedSnapshot("provider-current"),
      health: healthyHealth("provider-current")
    },
    {
      providerId: "geckoterminal",
      independenceGroupId: "geckoterminal-family",
      priority: 1,
      snapshot: geckoSnapshot,
      health: healthyHealth("geckoterminal")
    }
  ], {
    nowAt: NOW,
    maxAgeMs: 60_000,
    maxHealthAgeMs: 60_000,
    allowSyntheticFixtures: true
  });

  assert.equal(assessment.status, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(assessment.eligibleProviderIds, ["provider-current"]);
  const rejected = assessment.rejectedProviders.find((item) => item.providerId === "geckoterminal");
  assert.ok(rejected);
  assert.ok(rejected.reasonCodes.includes("FRESHNESS_UNKNOWN"));
  assert.ok(rejected.reasonCodes.includes("SOURCE_TIMESTAMP_MISSING"));
  assert.equal(assessment.canProceedToOnChainValidation, false);
  assert.equal(assessment.tradingAuthorized, false);
});

test("fresh retrieval alone does not rescue a missing source timestamp", () => {
  const adapter = new GeckoTerminalPoolAdapter();
  const normalized = adapter.normalize({
    providerId: "geckoterminal",
    requested: TARGET,
    payload: payload(),
    rawPayloadSha256: "c".repeat(64),
    synthetic: true
  }, {
    requestedAt: TARGET.requestedAt,
    retrievedAt: RETRIEVED_AT,
    requestId: "geckoterminal-fixture-request"
  });
  const snapshot = normalized.observations[0];
  assert.ok(snapshot);
  snapshot.observedAt = null;
  snapshot.sourceEventAt = null;
  snapshot.retrievedAt = NOW;

  const assessment = assessProviderAgreement([{
    providerId: "geckoterminal",
    independenceGroupId: "geckoterminal-family",
    priority: 0,
    snapshot,
    health: healthyHealth("geckoterminal")
  }], {
    nowAt: NOW,
    maxAgeMs: 60_000,
    maxHealthAgeMs: 60_000,
    allowSyntheticFixtures: true
  });
  assert.equal(assessment.status, "NO_ACCEPTABLE_PROVIDER");
  assert.ok(assessment.rejectedProviders[0].reasonCodes.includes("SOURCE_TIMESTAMP_MISSING"));
  assert.ok(assessment.rejectedProviders[0].reasonCodes.includes("FRESHNESS_UNKNOWN"));
  assert.equal(assessment.canProceedToOnChainValidation, false);
  assert.equal(assessment.tradingAuthorized, false);
});
