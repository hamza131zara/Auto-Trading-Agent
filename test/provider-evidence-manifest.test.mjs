import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  CANONICAL_PYTH_FEED_IDENTITIES,
  PROVIDER_EVIDENCE_MANIFEST_VERSION,
  PROVIDER_INDEPENDENCE_GROUPS,
  validateProviderEvidenceManifest
} from "../scripts/validate-provider-evidence-manifest.mjs";
import { getProviderSourceProfile } from "../packages/market-data/dist/index.js";
import {
  PYTH_PRO_SOL_USD_HERMES_FEED_ID,
  PYTH_PRO_USDC_USD_HERMES_FEED_ID,
  PYTH_PRO_WRAPPED_SOL_MINT,
  PYTH_PRO_USDC_MAINNET_MINT
} from "../packages/market-data/dist/providers/pyth-pro.js";

const sha256 = (value) => createHash("sha256").update(value).digest("hex");

function baseRecord(overrides = {}) {
  return {
    evidenceId: "P6E-PYTH-SYMBOLS-001",
    providerIds: ["pyth-pro"],
    evidenceType: "FEED_SYMBOLOGY",
    quality: "FIRST_PARTY_PUBLIC",
    issuer: "Pyth first-party documentation",
    issuedAt: "2026-10-30T10:00:00.000Z",
    artifact: {
      storage: "RESTRICTED_EXTERNAL",
      locator: "vault://market-data/pyth/symbology-2026-10-30",
      fileName: "pyth-symbology.json",
      mediaType: "application/json",
      sha256: "a".repeat(64)
    },
    scope: {
      summary: "Exact SOL/USD and USDC/USD Pyth Pro symbology snapshot.",
      deliveryModels: ["DISPLAY_ONLY"],
      coveredActions: ["DISPLAY"]
    },
    review: {
      state: "RECEIVED_UNREVIEWED",
      reviewer: null,
      reviewedAt: null,
      findings: []
    },
    feedMetadata: [
      {
        feedName: "SOL/USD",
        pythLazerId: 98765,
        canonicalFeedId: CANONICAL_PYTH_FEED_IDENTITIES["SOL/USD"].canonicalFeedId,
        assetMint: CANONICAL_PYTH_FEED_IDENTITIES["SOL/USD"].assetMint,
        feedState: "stable",
        minPublisherCount: 3,
        minChannel: "fixed_rate@1000ms",
        marketSessions: [{ session: "regular", state: "stable", minPublisherCount: 3 }]
      },
      {
        feedName: "USDC/USD",
        pythLazerId: 98766,
        canonicalFeedId: CANONICAL_PYTH_FEED_IDENTITIES["USDC/USD"].canonicalFeedId,
        assetMint: CANONICAL_PYTH_FEED_IDENTITIES["USDC/USD"].assetMint,
        feedState: "stable",
        minPublisherCount: 2,
        minChannel: "fixed_rate@1000ms",
        marketSessions: []
      }
    ],
    ...overrides
  };
}

function makeManifest(records = [baseRecord()], overrides = {}) {
  return {
    schemaVersion: PROVIDER_EVIDENCE_MANIFEST_VERSION,
    generatedAt: "2026-10-30T11:00:00.000Z",
    records,
    ...overrides
  };
}

test("manifest provider-family pins match the canonical in-repository provider registry", () => {
  for (const [providerId, groupId] of Object.entries(PROVIDER_INDEPENDENCE_GROUPS)) {
    const profile = getProviderSourceProfile(providerId);
    assert.ok(profile, "provider must exist in canonical registry: " + providerId);
    assert.equal(profile.independenceGroupId, groupId, "upstream family must match: " + providerId);
  }
});

test("manifest canonical Pyth feed bindings match the Pyth Pro adapter's pinned feed IDs and mint identities", () => {
  assert.equal(CANONICAL_PYTH_FEED_IDENTITIES["SOL/USD"].canonicalFeedId, PYTH_PRO_SOL_USD_HERMES_FEED_ID);
  assert.equal(CANONICAL_PYTH_FEED_IDENTITIES["USDC/USD"].canonicalFeedId, PYTH_PRO_USDC_USD_HERMES_FEED_ID);
  assert.equal(CANONICAL_PYTH_FEED_IDENTITIES["SOL/USD"].assetMint, PYTH_PRO_WRAPPED_SOL_MINT);
  assert.equal(CANONICAL_PYTH_FEED_IDENTITIES["USDC/USD"].assetMint, PYTH_PRO_USDC_MAINNET_MINT);
});

test("wrong canonical feed IDs, wrong mints and known synthetic numeric IDs are rejected", () => {
  const wrongFeed = baseRecord();
  wrongFeed.feedMetadata[0].canonicalFeedId = "1".repeat(64);
  const wrongMint = baseRecord();
  wrongMint.feedMetadata[1].assetMint = PYTH_PRO_WRAPPED_SOL_MINT;
  const syntheticId = baseRecord();
  syntheticId.feedMetadata[0].pythLazerId = 101;
  const duplicateId = baseRecord();
  duplicateId.feedMetadata[1].pythLazerId = duplicateId.feedMetadata[0].pythLazerId;

  assert.ok(validateProviderEvidenceManifest(makeManifest([wrongFeed])).reasonCodes.includes("RECORD_0_CANONICAL_FEED_ID_DOES_NOT_MATCH_PINNED_IDENTITY"));
  assert.ok(validateProviderEvidenceManifest(makeManifest([wrongMint])).reasonCodes.includes("RECORD_0_ASSET_MINT_DOES_NOT_MATCH_PINNED_IDENTITY"));
  assert.ok(validateProviderEvidenceManifest(makeManifest([syntheticId])).reasonCodes.includes("RECORD_0_PYTH_LAZER_ID_IS_SYNTHETIC_TEST_FIXTURE"));
  assert.ok(validateProviderEvidenceManifest(makeManifest([duplicateId])).reasonCodes.includes("RECORD_0_PYTH_LAZER_ID_DUPLICATED"));
});

test("valid Pyth feed metadata manifest is structurally valid but never an approval", () => {
  const report = validateProviderEvidenceManifest(makeManifest());
  assert.equal(report.valid, true);
  assert.equal(report.status, "STRUCTURALLY_VALID_NOT_AN_APPROVAL");
  assert.equal(report.recordCount, 1);
  assert.equal(report.approvalMutationPerformed, false);
  assert.equal(report.tradingAuthorized, false);
});

test("feed metadata must contain exact SOL/USD and USDC/USD entries with all reviewed fields", () => {
  const missingId = baseRecord();
  missingId.feedMetadata[0].pythLazerId = null;
  const wrongPair = baseRecord();
  wrongPair.feedMetadata[1].feedName = "USDT/USD";

  assert.ok(validateProviderEvidenceManifest(makeManifest([missingId])).reasonCodes.includes("RECORD_0_PYTH_LAZER_ID_INVALID"));
  assert.ok(validateProviderEvidenceManifest(makeManifest([wrongPair])).reasonCodes.includes("RECORD_0_PYTH_SOL_AND_USDC_FEEDS_REQUIRED"));
});

test("secondary material cannot be marked as verified evidence", () => {
  const record = baseRecord({
    quality: "SECONDARY",
    review: {
      state: "TECHNICAL_METADATA_VERIFIED",
      reviewer: "owner-reviewer",
      reviewedAt: "2026-10-30T10:30:00.000Z",
      findings: []
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_SECONDARY_EVIDENCE_CANNOT_SUPPORT_VERIFIED_STATE"));
});

test("publisher lineage records preserve undisclosed inputs as UNKNOWN rather than inventing venues", () => {
  const record = baseRecord({
    evidenceId: "P6E-PYTH-PUBLISHER-001",
    evidenceType: "PUBLISHER_LINEAGE",
    publisher: {
      publisherId: "publisher-001",
      publisherName: "Publisher One",
      operator: "Publisher One Ltd",
      feedNames: ["SOL/USD"],
      upstreamDisclosure: "NOT_DISCLOSED",
      upstreamSources: []
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.equal(report.valid, true);

  record.publisher.upstreamDisclosure = "DISCLOSED";
  const blocked = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(blocked.reasonCodes.includes("RECORD_0_DISCLOSED_PUBLISHER_HAS_NO_UPSTREAM_SOURCES"));
});

test("publisher lineage must be Pyth Pro and its referenced source evidence must exist", () => {
  const record = baseRecord({
    evidenceId: "P6E-PYTH-PUBLISHER-002",
    evidenceType: "PUBLISHER_LINEAGE",
    publisher: {
      publisherId: "publisher-001",
      publisherName: "Publisher One",
      operator: "Publisher One Ltd",
      feedNames: ["SOL/USD"],
      upstreamDisclosure: "DISCLOSED",
      upstreamSources: [{
        venueOrDataset: "Venue A",
        instrument: "SOL/USD",
        collectionPath: "direct venue feed",
        transformations: [],
        evidenceIds: ["P6E-NONEXISTENT-SOURCE"]
      }]
    }
  });
  record.providerIds = ["pyth-hermes"];
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_PUBLISHER_LINEAGE_PROVIDER_MUST_BE_PYTH_PRO"));
  assert.ok(report.reasonCodes.includes("RECORD_0_PUBLISHER_UPSTREAM_EVIDENCE_REFERENCE_UNKNOWN"));
});

test("pairwise independence requires two distinct provider families, two-sided attestations and linked evidence", () => {
  const pythEvidence = baseRecord();
  const dexEvidence = baseRecord({
    evidenceId: "P6E-DEX-TERMS-001",
    evidenceType: "SERVICE_TERMS",
    rights: {
      legalEntity: "Example DEX Entity",
      accountReferenceRedacted: "account-****",
      planOrTermsName: "Public API Terms",
      termsVersion: "2026-10",
      effectiveFrom: "2026-10-01T00:00:00Z",
      expiresAt: null,
      deliveryModels: ["DISPLAY_ONLY"],
      permittedActions: ["DISPLAY"],
      prohibitedActions: ["REDISTRIBUTE"],
      attributionRequirements: "Attribution per published terms.",
      retentionTerms: "Retention per published terms."
    }
  });
  const record = baseRecord({
    evidenceId: "P6E-PAIR-PYTH-DEX-001",
    providerIds: ["pyth-pro", "dex-screener"],
    evidenceType: "PAIRWISE_ATTESTATION",
    quality: "EXECUTED_OR_SIGNED",
    pairwise: {
      attestations: [
        { providerId: "pyth-pro", issuer: "Pyth", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-A", evidenceIds: [pythEvidence.evidenceId] },
        { providerId: "dex-screener", issuer: "DEX Screener", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-B", evidenceIds: [dexEvidence.evidenceId] }
      ],
      overlapAssessment: "NO_KNOWN_OVERLAP",
      overlapAnalysis: "Reviewed publisher, venue, dataset and aggregator paths.",
      overlapEvidenceIds: [pythEvidence.evidenceId, dexEvidence.evidenceId],
      independenceConclusion: "INDEPENDENT"
    },
    review: {
      state: "PAIRWISE_INDEPENDENCE_VERIFIED",
      reviewer: "independent-reviewer",
      reviewedAt: "2026-10-30T10:30:00Z",
      findings: []
    }
  });
  const good = validateProviderEvidenceManifest(makeManifest([pythEvidence, dexEvidence, record]));
  assert.equal(good.valid, true);
  assert.equal(good.approvalMutationPerformed, false);
  assert.equal(good.tradingAuthorized, false);

  record.pairwise.attestations.pop();
  const missingSide = validateProviderEvidenceManifest(makeManifest([pythEvidence, dexEvidence, record]));
  assert.ok(missingSide.reasonCodes.includes("RECORD_2_PAIRWISE_BOTH_SIDES_MUST_ATTEST"));
});

test("two provider aliases in the same upstream family cannot be marked independent", () => {
  const record = baseRecord({
    evidenceId: "P6E-PAIR-PYTH-ALIASES-001",
    providerIds: ["pyth-pro", "pyth-hermes"],
    evidenceType: "PAIRWISE_ATTESTATION",
    quality: "EXECUTED_OR_SIGNED",
    pairwise: {
      attestations: [
        { providerId: "pyth-pro", issuer: "Pyth", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-A", evidenceIds: ["P6E-PYTH-SYMBOLS-001"] },
        { providerId: "pyth-hermes", issuer: "Pyth", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-B", evidenceIds: ["P6E-PYTH-SYMBOLS-001"] }
      ],
      overlapAssessment: "NO_KNOWN_OVERLAP",
      overlapAnalysis: "The two interfaces belong to the same Pyth upstream source family.",
      overlapEvidenceIds: ["P6E-PYTH-SYMBOLS-001"],
      independenceConclusion: "INDEPENDENT"
    },
    review: {
      state: "PAIRWISE_INDEPENDENCE_VERIFIED",
      reviewer: "independent-reviewer",
      reviewedAt: "2026-10-30T10:30:00Z",
      findings: []
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([baseRecord(), record]));
  assert.ok(report.reasonCodes.includes("RECORD_1_SAME_UPSTREAM_FAMILY_CANNOT_BE_INDEPENDENT"));
  assert.ok(report.reasonCodes.includes("RECORD_1_PAIRWISE_VERIFIED_STATE_NOT_SUPPORTED_BY_RECORD"));
});

test("inherited JavaScript object keys cannot masquerade as provider-family registry entries", () => {
  const record = baseRecord({
    evidenceId: "P6E-PAIR-PROTO-KEY-001",
    providerIds: ["pyth-pro", "constructor"],
    evidenceType: "PAIRWISE_ATTESTATION",
    pairwise: {
      attestations: [
        { providerId: "pyth-pro", issuer: "Pyth", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-A", evidenceIds: ["P6E-PYTH-SYMBOLS-001"] },
        { providerId: "constructor", issuer: "Unknown", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-B", evidenceIds: ["P6E-PYTH-SYMBOLS-001"] }
      ],
      overlapAssessment: "UNKNOWN",
      overlapAnalysis: "Provider does not exist in the canonical registry.",
      overlapEvidenceIds: ["P6E-PYTH-SYMBOLS-001"],
      independenceConclusion: "UNKNOWN"
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([baseRecord(), record]));
  assert.ok(report.reasonCodes.includes("RECORD_1_PAIRWISE_UNKNOWN_PROVIDER"));
});

test("pairwise records reject unknown providers and missing evidence links", () => {
  const record = baseRecord({
    evidenceId: "P6E-PAIR-UNKNOWN-001",
    providerIds: ["pyth-pro", "unknown-source"],
    evidenceType: "PAIRWISE_ATTESTATION",
    quality: "FIRST_PARTY_PUBLIC",
    pairwise: {
      attestations: [
        { providerId: "pyth-pro", issuer: "Pyth", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-A", evidenceIds: ["P6E-MISSING-A"] },
        { providerId: "unknown-source", issuer: "Unknown", issuedAt: "2026-10-29T12:00:00Z", attestationReference: "attestation-B", evidenceIds: ["P6E-MISSING-B"] }
      ],
      overlapAssessment: "UNKNOWN",
      overlapAnalysis: "Upstream source path has not been disclosed.",
      overlapEvidenceIds: ["P6E-MISSING-C"],
      independenceConclusion: "UNKNOWN"
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_PAIRWISE_UNKNOWN_PROVIDER"));
  assert.ok(report.reasonCodes.includes("RECORD_0_PAIRWISE_ATTESTATION_EVIDENCE_REFERENCE_UNKNOWN"));
  assert.ok(report.reasonCodes.includes("RECORD_0_PAIRWISE_OVERLAP_EVIDENCE_REFERENCE_UNKNOWN"));
});

test("public or unsigned evidence cannot claim diagnostic or production rights clearance", () => {
  const record = baseRecord({
    evidenceId: "P6E-PYTH-TERMS-001",
    evidenceType: "WRITTEN_PERMISSION",
    quality: "FIRST_PARTY_PUBLIC",
    rights: {
      legalEntity: "Example LLC",
      accountReferenceRedacted: "account-****",
      planOrTermsName: "Public API Terms",
      termsVersion: "2026-10",
      effectiveFrom: "2026-10-01T00:00:00Z",
      expiresAt: null,
      deliveryModels: ["MULTI_TENANT_HOSTED"],
      permittedActions: ["DISPLAY"],
      prohibitedActions: ["REDISTRIBUTE"],
      attributionRequirements: "Prominent attribution required.",
      retentionTerms: "Retain only as permitted by the plan."
    },
    review: {
      state: "RIGHTS_CLEARED_FOR_PRODUCTION_SCOPE",
      reviewer: "reviewer",
      reviewedAt: "2026-10-30T10:30:00Z",
      findings: []
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_RIGHTS_CLEARED_STATE_REQUIRES_EXECUTED_OR_ACCOUNT_EVIDENCE"));
});

test("rights records must cover every delivery model and action claimed by the evidence scope", () => {
  const record = baseRecord({
    evidenceId: "P6E-PYTH-RIGHTS-SCOPE-001",
    evidenceType: "WRITTEN_PERMISSION",
    rights: {
      legalEntity: "Example LLC",
      accountReferenceRedacted: "account-****",
      planOrTermsName: "Display-only plan",
      termsVersion: "v1",
      effectiveFrom: "2026-10-01T00:00:00Z",
      expiresAt: null,
      deliveryModels: ["DISPLAY_ONLY"],
      permittedActions: ["DISPLAY"],
      prohibitedActions: ["EXPORT", "REDISTRIBUTE"],
      attributionRequirements: "Prominent attribution.",
      retentionTerms: "Short-lived cache only."
    },
    scope: {
      summary: "Claims API redistribution and data export.",
      deliveryModels: ["CUSTOMER_API"],
      coveredActions: ["DISPLAY", "API_ACCESS", "EXPORT"]
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_RIGHTS_DO_NOT_COVER_DECLARED_DELIVERY_MODEL"));
  assert.ok(report.reasonCodes.includes("RECORD_0_RIGHTS_DO_NOT_COVER_DECLARED_ACTION"));
});

test("expired rights and contradictory permitted/prohibited actions fail closed", () => {
  const record = baseRecord({
    evidenceId: "P6E-PYTH-TERMS-002",
    evidenceType: "SERVICE_TERMS",
    quality: "FIRST_PARTY_ACCOUNT",
    rights: {
      legalEntity: "Example LLC",
      accountReferenceRedacted: "account-****",
      planOrTermsName: "Commercial API Plan",
      termsVersion: "v3",
      effectiveFrom: "2026-10-01T00:00:00Z",
      expiresAt: "2026-10-29T00:00:00Z",
      deliveryModels: ["DISPLAY_ONLY"],
      permittedActions: ["DISPLAY"],
      prohibitedActions: ["DISPLAY"],
      attributionRequirements: "Attribution per plan.",
      retentionTerms: "Retention per plan."
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_RIGHTS_EXPIRED"));
  assert.ok(report.reasonCodes.includes("RECORD_0_RIGHTS_ACTION_CONFLICT"));
});

test("owner decision must reference evidence records present in the same manifest", () => {
  const feed = baseRecord();
  const decision = baseRecord({
    evidenceId: "P6E-OWNER-DECISION-001",
    evidenceType: "OWNER_DECISION",
    quality: "EXECUTED_OR_SIGNED",
    review: {
      state: "OWNER_DECISION_RECORDED",
      reviewer: "owner",
      reviewedAt: "2026-10-30T10:45:00Z",
      findings: []
    },
    ownerDecision: {
      decisionId: "OWNER-DECISION-001",
      owner: "Project owner",
      decidedAt: "2026-10-30T10:45:00Z",
      expiresAt: null,
      outcome: "DEFER",
      scope: "No provider diagnostics authorized.",
      linkedEvidenceIds: ["P6E-MISSING-RECORD"]
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([feed, decision]));
  assert.ok(report.reasonCodes.includes("OWNER_DECISION_REFERENCES_UNKNOWN_EVIDENCE"));
});

test("forbidden credential-bearing properties are rejected before manifest review", () => {
  const record = baseRecord();
  record.apiKey = "must-never-be-committed";
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("MANIFEST_CONTAINS_FORBIDDEN_CREDENTIAL_FIELDS"));
});

test("malformed nested evidence objects fail closed without throwing", () => {
  const record = baseRecord({
    evidenceId: "P6E-MALFORMED-SCOPE-001",
    evidenceType: "SERVICE_TERMS",
    scope: { summary: "Malformed scope", deliveryModels: "not-an-array", coveredActions: "DISPLAY" },
    rights: {
      legalEntity: "Example LLC",
      accountReferenceRedacted: "account-****",
      planOrTermsName: "Plan",
      termsVersion: "v1",
      effectiveFrom: "2026-10-01T00:00:00Z",
      expiresAt: null,
      deliveryModels: ["DISPLAY_ONLY"],
      permittedActions: ["DISPLAY"],
      prohibitedActions: [],
      attributionRequirements: "Attribution.",
      retentionTerms: "Retention."
    }
  });
  assert.doesNotThrow(() => validateProviderEvidenceManifest(makeManifest([record])));
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_SCOPE_INVALID"));
});

test("local artifact SHA-256 is recomputed inside the supplied artifact root", () => {
  const root = mkdtempSync(join(tmpdir(), "p6-provider-evidence-"));
  try {
    mkdirSync(join(root, "artifacts"));
    const bytes = Buffer.from("synthetic evidence artifact");
    writeFileSync(join(root, "artifacts", "metadata.json"), bytes);
    const record = baseRecord({
      artifact: {
        storage: "LOCAL_FILE",
        locator: "artifacts/metadata.json",
        fileName: "metadata.json",
        mediaType: "application/json",
        sha256: sha256(bytes)
      }
    });
    const good = validateProviderEvidenceManifest(makeManifest([record]), { artifactRoot: root });
    assert.equal(good.valid, true);
    assert.equal(good.artifactIntegrity[0].status, "VERIFIED");

    record.artifact.sha256 = "0".repeat(64);
    const bad = validateProviderEvidenceManifest(makeManifest([record]), { artifactRoot: root });
    assert.ok(bad.reasonCodes.includes("RECORD_0_LOCAL_ARTIFACT_DIGEST_MISMATCH"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local artifact traversal and symlink escapes are rejected", () => {
  const root = mkdtempSync(join(tmpdir(), "p6-provider-evidence-root-"));
  const outside = mkdtempSync(join(tmpdir(), "p6-provider-evidence-outside-"));
  try {
    const secretPath = join(outside, "outside.json");
    writeFileSync(secretPath, "outside");
    const record = baseRecord({
      artifact: {
        storage: "LOCAL_FILE",
        locator: "../outside.json",
        fileName: "outside.json",
        mediaType: "application/json",
        sha256: sha256("outside")
      }
    });
    const traversal = validateProviderEvidenceManifest(makeManifest([record]), { artifactRoot: root });
    assert.ok(traversal.reasonCodes.includes("RECORD_0_LOCAL_ARTIFACT_PATH_INVALID"));

    symlinkSync(secretPath, join(root, "outside-link.json"));
    record.artifact.locator = "outside-link.json";
    const symlink = validateProviderEvidenceManifest(makeManifest([record]), { artifactRoot: root });
    assert.ok(symlink.reasonCodes.includes("RECORD_0_LOCAL_ARTIFACT_NOT_REGULAR_FILE"));
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  }
});

test("unreviewed records cannot contain reviewer timestamps or claim that an approval was mutated", () => {
  const record = baseRecord({
    review: {
      state: "RECEIVED_UNREVIEWED",
      reviewer: "someone",
      reviewedAt: "2026-10-30T10:30:00Z",
      findings: []
    }
  });
  const report = validateProviderEvidenceManifest(makeManifest([record]));
  assert.ok(report.reasonCodes.includes("RECORD_0_UNREVIEWED_RECORD_HAS_REVIEW_METADATA"));
  assert.equal(report.approvalMutationPerformed, false);
  assert.equal(report.tradingAuthorized, false);
});
