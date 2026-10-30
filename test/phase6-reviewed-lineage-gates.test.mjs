import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  assessCriticalMarketDataEvidenceGateWithReviewedLineage,
  assessIndependentReservePriceAgreementWithReviewedLineage
} from "../packages/market-data/dist/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const snapshotFixture = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;

const LINEAGE_POLICY = {
  purpose: "DIAGNOSTIC",
  minimumIndependentGroups: 2,
  requireSourceTimestamp: true,
  oneOffDiagnosticAcknowledged: true
};

const BASE_MINT = "So11111111111111111111111111111111111111112";
const QUOTE_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const PYTH_PROVIDER = "pyth-hermes";
const PYTH_GROUP = "pyth-network";
const DEX_PROVIDER = "dex-screener";
const DEX_GROUP = "dex-screener-family";

function comparisonInput(overrides = {}) {
  const policy = {
    nowAt: "2026-10-29T12:45:00.000Z",
    maxSourceAgeMs: 30_000,
    maxRetrievalAgeMs: 30_000,
    maxReferenceTimestampSkewMs: 10_000,
    maxFutureSkewMs: 0,
    maxDeviationBps: 10,
    approvedProviderId: PYTH_PROVIDER,
    approvedIndependenceGroupId: PYTH_GROUP,
    expectedBaseFeedId: "sol-usd-feed",
    expectedQuoteFeedId: "usdc-usd-feed"
  };
  const input = {
    baseMint: BASE_MINT,
    quoteMint: QUOTE_MINT,
    reserveRatioQuotePerBase: "99.985997437490137051",
    indexedPriceUsdPerBase: "99.98",
    indexedProviderId: DEX_PROVIDER,
    indexedIndependenceGroupId: DEX_GROUP,
    indexedSourceEventAt: "2026-10-29T12:44:50.000Z",
    indexedSourceObservedAt: null,
    indexedRetrievedAt: "2026-10-29T12:44:55.000Z",
    indexedSynthetic: false,
    baseUsd: {
      assetId: BASE_MINT,
      feedId: "sol-usd-feed",
      providerId: PYTH_PROVIDER,
      independenceGroupId: PYTH_GROUP,
      priceUsd: "99.98",
      publishedAt: "2026-10-29T12:44:50.000Z",
      retrievedAt: "2026-10-29T12:44:55.000Z",
      synthetic: false
    },
    quoteUsd: {
      assetId: QUOTE_MINT,
      feedId: "usdc-usd-feed",
      providerId: PYTH_PROVIDER,
      independenceGroupId: PYTH_GROUP,
      priceUsd: "1.0000",
      publishedAt: "2026-10-29T12:44:50.000Z",
      retrievedAt: "2026-10-29T12:44:55.000Z",
      synthetic: false
    },
    policy
  };
  return {
    ...input,
    ...overrides,
    policy: { ...policy, ...(overrides.policy ?? {}) },
    baseUsd: { ...input.baseUsd, ...(overrides.baseUsd ?? {}) },
    quoteUsd: { ...input.quoteUsd, ...(overrides.quoteUsd ?? {}) }
  };
}

function providerEvidence(providerId, independenceGroupId, priority, sourceEventAt = null) {
  const snapshot = structuredClone(snapshotFixture);
  snapshot.provenance.providerId = providerId;
  snapshot.provenance.synthetic = false;
  snapshot.observedAt = "2026-10-29T12:44:55.000Z";
  snapshot.sourceEventAt = sourceEventAt;
  snapshot.retrievedAt = "2026-10-29T12:44:56.000Z";
  return {
    providerId,
    independenceGroupId,
    priority,
    health: {
      providerId,
      state: "HEALTHY",
      consecutiveFailures: 0,
      lastSuccessAt: "2026-10-29T12:44:56.000Z",
      lastFailureAt: null,
      lastRequestAt: "2026-10-29T12:44:56.000Z",
      lastLatencyMs: 15,
      circuitOpenUntil: null,
      lastErrorClass: null
    },
    snapshot
  };
}

function providerAgreementInput() {
  const dex = providerEvidence(DEX_PROVIDER, DEX_GROUP, 0, null);
  const raydium = providerEvidence("raydium-api-v3", "raydium-api-v3", 1, null);
  return {
    candidates: [dex, raydium],
    lineageCandidates: [
      {
        providerId: DEX_PROVIDER,
        independenceGroupId: DEX_GROUP,
        role: "POOL_METRICS",
        timestampKind: "NONE"
      },
      {
        providerId: "raydium-api-v3",
        independenceGroupId: "raydium-api-v3",
        role: "POOL_METRICS",
        timestampKind: "NONE"
      }
    ],
    lineagePolicy: {
      purpose: "DIAGNOSTIC",
      minimumIndependentGroups: 2,
      requireSourceTimestamp: false,
      oneOffDiagnosticAcknowledged: true
    },
    agreementPolicy: {}
  };
}

test("Pyth arithmetic can agree while the reviewed lineage gate still blocks indexed-source promotion", () => {
  const result = assessIndependentReservePriceAgreementWithReviewedLineage({
    comparisonInput: comparisonInput(),
    lineagePolicy: LINEAGE_POLICY
  });

  assert.equal(result.comparison.status, "AGREED");
  assert.equal(result.comparison.comparisonEvidenceComplete, true);
  assert.equal(result.status, "BLOCKED");
  assert.equal(result.canProceedToCriticalEvidenceGate, false);
  assert.ok(result.lineage.reasonCodes.includes("SOURCE_TIMESTAMP_KIND_PROFILE_MISMATCH"));
  assert.ok(result.lineage.reasonCodes.includes("UPSTREAM_LINEAGE_INDEPENDENCE_NOT_ATTESTED"));
  assert.ok(result.lineage.reasonCodes.includes("UPSTREAM_LINEAGE_PAIR_NOT_MUTUALLY_ATTESTED"));
  assert.equal(result.tradingAuthorized, false);
});

test("missing DEX Screener event/observation time remains NONE and blocks the reviewed comparison", () => {
  const result = assessIndependentReservePriceAgreementWithReviewedLineage({
    comparisonInput: comparisonInput({
      indexedSourceEventAt: null,
      indexedSourceObservedAt: null
    }),
    lineagePolicy: LINEAGE_POLICY
  });

  assert.equal(result.comparison.indexedSourceTimestampKind, "MISSING");
  assert.equal(result.comparison.indexedPriceComparison.status, "NOT_ASSESSED");
  assert.equal(result.status, "BLOCKED");
  assert.ok(result.lineage.reasonCodes.includes("SOURCE_TIMESTAMP_NOT_AVAILABLE_FOR_ROLE"));
  assert.equal(result.canProceedToCriticalEvidenceGate, false);
});

test("GeckoTerminal candle start is typed as OBSERVATION but its current disabled terms state blocks use", () => {
  const result = assessIndependentReservePriceAgreementWithReviewedLineage({
    comparisonInput: comparisonInput({
      indexedProviderId: "geckoterminal",
      indexedIndependenceGroupId: "geckoterminal-coingecko-ecosystem",
      indexedSourceEventAt: null,
      indexedSourceObservedAt: "2026-10-29T12:44:00.000Z",
      policy: {
        approvedIndexedProviderId: "geckoterminal",
        approvedIndexedIndependenceGroupId: "geckoterminal-coingecko-ecosystem"
      }
    }),
    lineagePolicy: LINEAGE_POLICY
  });

  assert.equal(result.comparison.indexedSourceTimestampKind, "OBSERVATION");
  assert.equal(result.status, "BLOCKED");
  assert.ok(!result.lineage.reasonCodes.includes("SOURCE_TIMESTAMP_KIND_PROFILE_MISMATCH"));
  assert.ok(result.lineage.reasonCodes.includes("PROVIDER_DIAGNOSTIC_USE_DISABLED"));
  assert.equal(result.tradingAuthorized, false);
});

test("Pyth base and quote feeds must belong to the exact reviewed provider and source family", () => {
  const wrongProvider = assessIndependentReservePriceAgreementWithReviewedLineage({
    comparisonInput: comparisonInput({
      quoteUsd: {
        providerId: "coingecko-api",
        independenceGroupId: "geckoterminal-coingecko-ecosystem"
      }
    }),
    lineagePolicy: LINEAGE_POLICY
  });

  assert.equal(wrongProvider.status, "INVALID_INPUT");
  assert.ok(wrongProvider.reasonCodes.includes("REFERENCE_FEED_PROVIDER_OR_LINEAGE_MISMATCH"));
  assert.equal(wrongProvider.tradingAuthorized, false);
});

test("the final critical evidence gate recomputes both reviewed lineage wrappers and blocks unverified sources", () => {
  const result = assessCriticalMarketDataEvidenceGateWithReviewedLineage({
    providerAgreementInput: providerAgreementInput(),
    independentComparisonInput: {
      comparisonInput: comparisonInput(),
      lineagePolicy: LINEAGE_POLICY
    }
  });

  assert.equal(result.status, "BLOCKED");
  assert.equal(result.canProceedToOnChainValidation, false);
  assert.equal(result.providerLineageStatus, "BLOCKED");
  assert.equal(result.independentPriceLineageStatus, "BLOCKED");
  assert.ok(result.reasonCodes.includes("CRITICAL_REVIEWED_LINEAGE_GATE_NOT_READY"));
  assert.equal(result.tradingAuthorized, false);
});

test("the final critical evidence gate rejects malformed inputs without granting progression", () => {
  const result = assessCriticalMarketDataEvidenceGateWithReviewedLineage({
    providerAgreementInput: {},
    independentComparisonInput: {}
  });

  assert.equal(result.status, "INVALID_INPUT");
  assert.equal(result.canProceedToOnChainValidation, false);
  assert.equal(result.tradingAuthorized, false);
});
