#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync,
  statSync
} from "node:fs";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const PROVIDER_EVIDENCE_MANIFEST_VERSION = "ata.provider-evidence-manifest.v1";

const EVIDENCE_TYPES = new Set([
  "FEED_SYMBOLOGY",
  "PUBLISHER_LINEAGE",
  "PAIRWISE_ATTESTATION",
  "SERVICE_TERMS",
  "ORDER_FORM",
  "WRITTEN_PERMISSION",
  "OWNER_DECISION"
]);
const EVIDENCE_QUALITIES = new Set([
  "EXECUTED_OR_SIGNED",
  "FIRST_PARTY_PUBLIC",
  "FIRST_PARTY_ACCOUNT",
  "SECONDARY"
]);
const REVIEW_STATES = new Set([
  "RECEIVED_UNREVIEWED",
  "REVIEWED_INSUFFICIENT",
  "TECHNICAL_METADATA_VERIFIED",
  "LINEAGE_REVIEWED_NOT_INDEPENDENT",
  "PAIRWISE_INDEPENDENCE_VERIFIED",
  "RIGHTS_CLEARED_FOR_DIAGNOSTIC",
  "RIGHTS_CLEARED_FOR_PRODUCTION_SCOPE",
  "OWNER_DECISION_RECORDED"
]);
const RIGHTS_ACTIONS = new Set([
  "DISPLAY",
  "CACHE",
  "STORE",
  "DERIVE",
  "EXPORT",
  "API_ACCESS",
  "REDISTRIBUTE",
  "SUBLICENSE",
  "RESELL"
]);
const DELIVERY_MODELS = new Set([
  "DISPLAY_ONLY",
  "MULTI_TENANT_HOSTED",
  "SELF_HOSTED_SINGLE_CUSTOMER",
  "CUSTOMER_EXPORT",
  "CUSTOMER_API",
  "REDISTRIBUTION"
]);
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BASE58_PATTERN = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
const FORBIDDEN_KEYS = new Set([
  "apikey",
  "accesstoken",
  "secret",
  "password",
  "privatekey",
  "seedphrase",
  "authorization",
  "bearertoken",
  "walletsecret"
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validUtc(value) {
  return typeof value === "string" &&
    UTC_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value));
}

function nonEmpty(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function uniqueStrings(value, pattern = null) {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => nonEmpty(item) &&
      (pattern === null || (typeof pattern === "function" ? pattern(item) : pattern.test(item)))) &&
    new Set(value).size === value.length;
}

function collectForbiddenKeys(value, path = "$", result = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectForbiddenKeys(item, path + "[" + index + "]", result));
    return result;
  }
  if (!isRecord(value)) return result;
  for (const [key, child] of Object.entries(value)) {
    const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (FORBIDDEN_KEYS.has(normalized)) result.push(path + "." + key);
    collectForbiddenKeys(child, path + "." + key, result);
  }
  return result;
}

function validateArtifact(artifact, options, label, reasons) {
  if (!isRecord(artifact)) {
    reasons.push(label + "_ARTIFACT_INVALID");
    return { integrity: "NOT_CHECKED" };
  }
  if (!SHA256_PATTERN.test(artifact.sha256 ?? "")) reasons.push(label + "_ARTIFACT_SHA256_INVALID");
  if (!nonEmpty(artifact.fileName) ||
      artifact.fileName.includes("/") ||
      artifact.fileName.includes("\\") ||
      artifact.fileName === "." ||
      artifact.fileName === "..") {
    reasons.push(label + "_ARTIFACT_FILENAME_INVALID");
  }
  if (!nonEmpty(artifact.mediaType)) reasons.push(label + "_ARTIFACT_MEDIA_TYPE_MISSING");

  if (artifact.storage === "PUBLIC_URL") {
    try {
      const url = new URL(artifact.locator);
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password || url.search || url.hash) {
        reasons.push(label + "_PUBLIC_ARTIFACT_URL_NOT_CLEAN_HTTPS");
      }
    } catch {
      reasons.push(label + "_PUBLIC_ARTIFACT_URL_INVALID");
    }
    return { integrity: "EXTERNAL_DIGEST_NOT_RECOMPUTED" };
  }

  if (artifact.storage === "RESTRICTED_EXTERNAL") {
    if (!nonEmpty(artifact.locator) ||
        !/^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9._:/-]+$/.test(artifact.locator) ||
        artifact.locator.includes("..")) {
      reasons.push(label + "_RESTRICTED_ARTIFACT_LOCATOR_INVALID");
    }
    return { integrity: "EXTERNAL_DIGEST_NOT_RECOMPUTED" };
  }

  if (artifact.storage !== "LOCAL_FILE") {
    reasons.push(label + "_ARTIFACT_STORAGE_UNSUPPORTED");
    return { integrity: "NOT_CHECKED" };
  }

  if (!nonEmpty(artifact.locator) ||
      isAbsolute(artifact.locator) ||
      artifact.locator.includes("\\") ||
      artifact.locator.split("/").some((part) => part === "" || part === "." || part === "..")) {
    reasons.push(label + "_LOCAL_ARTIFACT_PATH_INVALID");
    return { integrity: "NOT_CHECKED" };
  }
  if (!nonEmpty(options.artifactRoot)) {
    reasons.push(label + "_LOCAL_ARTIFACT_ROOT_REQUIRED");
    return { integrity: "NOT_CHECKED" };
  }

  try {
    const root = realpathSync(resolve(options.artifactRoot));
    const target = resolve(root, artifact.locator);
    if (!target.startsWith(root + sep)) {
      reasons.push(label + "_LOCAL_ARTIFACT_PATH_OUTSIDE_ROOT");
      return { integrity: "NOT_CHECKED" };
    }
    const targetStat = lstatSync(target);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      reasons.push(label + "_LOCAL_ARTIFACT_NOT_REGULAR_FILE");
      return { integrity: "NOT_CHECKED" };
    }
    const realTarget = realpathSync(target);
    if (!realTarget.startsWith(root + sep)) {
      reasons.push(label + "_LOCAL_ARTIFACT_SYMLINK_ESCAPE");
      return { integrity: "NOT_CHECKED" };
    }
    const bytes = readFileSync(realTarget);
    const actual = createHash("sha256").update(bytes).digest("hex");
    if (actual !== artifact.sha256) reasons.push(label + "_LOCAL_ARTIFACT_DIGEST_MISMATCH");
    return { integrity: actual === artifact.sha256 ? "VERIFIED" : "MISMATCH" };
  } catch {
    reasons.push(label + "_LOCAL_ARTIFACT_UNREADABLE");
    return { integrity: "NOT_CHECKED" };
  }
}

function validateReview(review, quality, label, reasons) {
  if (!isRecord(review) || !REVIEW_STATES.has(review.state)) {
    reasons.push(label + "_REVIEW_STATE_INVALID");
    return;
  }
  if (typeof review.findings !== "undefined" &&
      (!Array.isArray(review.findings) || !review.findings.every(nonEmpty))) {
    reasons.push(label + "_REVIEW_FINDINGS_INVALID");
  }
  if (review.state === "RECEIVED_UNREVIEWED") {
    if (review.reviewer !== null || review.reviewedAt !== null) {
      reasons.push(label + "_UNREVIEWED_RECORD_HAS_REVIEW_METADATA");
    }
  } else if (!nonEmpty(review.reviewer) || !validUtc(review.reviewedAt)) {
    reasons.push(label + "_REVIEWER_OR_TIMESTAMP_MISSING");
  }

  if (quality === "SECONDARY" && review.state !== "RECEIVED_UNREVIEWED" &&
      review.state !== "REVIEWED_INSUFFICIENT") {
    reasons.push(label + "_SECONDARY_EVIDENCE_CANNOT_SUPPORT_VERIFIED_STATE");
  }
}

function validateFeedSymbology(record, label, reasons) {
  if (!Array.isArray(record.feedMetadata) || record.feedMetadata.length !== 2) {
    reasons.push(label + "_PYTH_FEED_METADATA_MUST_CONTAIN_TWO_FEEDS");
    return;
  }
  const names = new Set();
  for (const feed of record.feedMetadata) {
    if (!isRecord(feed) ||
        !["SOL/USD", "USDC/USD"].includes(feed.feedName) ||
        names.has(feed.feedName)) {
      reasons.push(label + "_PYTH_FEED_NAME_INVALID_OR_DUPLICATED");
      continue;
    }
    names.add(feed.feedName);
    if (!Number.isSafeInteger(feed.pythLazerId) || feed.pythLazerId < 1) {
      reasons.push(label + "_PYTH_LAZER_ID_INVALID");
    }
    if (typeof feed.canonicalFeedId !== "string" ||
        !/^[a-fA-F0-9]{64}$/.test(feed.canonicalFeedId)) {
      reasons.push(label + "_CANONICAL_FEED_ID_INVALID");
    }
    if (typeof feed.assetMint !== "string" || !BASE58_PATTERN.test(feed.assetMint)) {
      reasons.push(label + "_ASSET_MINT_INVALID");
    }
    if (!nonEmpty(feed.feedState)) reasons.push(label + "_FEED_STATE_MISSING");
    if (!Number.isSafeInteger(feed.minPublisherCount) || feed.minPublisherCount < 1) {
      reasons.push(label + "_MIN_PUBLISHERS_INVALID");
    }
    if (!nonEmpty(feed.minChannel)) reasons.push(label + "_MIN_CHANNEL_MISSING");
    if (!Array.isArray(feed.marketSessions)) {
      reasons.push(label + "_MARKET_SESSIONS_INVALID");
    } else {
      const sessions = new Set();
      for (const session of feed.marketSessions) {
        if (!isRecord(session) ||
            !nonEmpty(session.session) ||
            sessions.has(session.session) ||
            !nonEmpty(session.state) ||
            !Number.isSafeInteger(session.minPublisherCount) ||
            session.minPublisherCount < 1) {
          reasons.push(label + "_MARKET_SESSION_ENTRY_INVALID");
          continue;
        }
        sessions.add(session.session);
      }
    }
  }
  if (names.size !== 2 || !names.has("SOL/USD") || !names.has("USDC/USD")) {
    reasons.push(label + "_PYTH_SOL_AND_USDC_FEEDS_REQUIRED");
  }
}

function validatePublisherLineage(record, label, reasons) {
  const publisher = record.publisher;
  if (!isRecord(publisher) ||
      !nonEmpty(publisher.publisherId) ||
      !nonEmpty(publisher.publisherName) ||
      !nonEmpty(publisher.operator) ||
      !uniqueStrings(publisher.feedNames, /^(SOL\/USD|USDC\/USD)$/) ||
      !["DISCLOSED", "PARTIAL", "NOT_DISCLOSED"].includes(publisher.upstreamDisclosure)) {
    reasons.push(label + "_PUBLISHER_IDENTITY_INVALID");
    return;
  }
  if (!Array.isArray(publisher.upstreamSources)) {
    reasons.push(label + "_PUBLISHER_UPSTREAM_SOURCES_INVALID");
    return;
  }
  if (publisher.upstreamDisclosure === "NOT_DISCLOSED" && publisher.upstreamSources.length !== 0) {
    reasons.push(label + "_UNDISCLOSED_PUBLISHER_HAS_SOURCE_CLAIMS");
  }
  if (publisher.upstreamDisclosure === "DISCLOSED" && publisher.upstreamSources.length === 0) {
    reasons.push(label + "_DISCLOSED_PUBLISHER_HAS_NO_UPSTREAM_SOURCES");
  }
  for (const source of publisher.upstreamSources) {
    if (!isRecord(source) ||
        !nonEmpty(source.venueOrDataset) ||
        !nonEmpty(source.instrument) ||
        !nonEmpty(source.collectionPath) ||
        !Array.isArray(source.transformations) ||
        !source.transformations.every(nonEmpty) ||
        !uniqueStrings(source.evidenceIds, ID_PATTERN)) {
      reasons.push(label + "_PUBLISHER_UPSTREAM_SOURCE_INVALID");
    }
  }
  if (publisher.upstreamDisclosure === "NOT_DISCLOSED" &&
      record.review?.state === "LINEAGE_REVIEWED_NOT_INDEPENDENT") {
    reasons.push(label + "_UNDISCLOSED_PUBLISHER_CANNOT_BE_MARKED_LINEAGE_REVIEWED");
  }
}

function validatePairwiseAttestation(record, label, reasons) {
  if (!Array.isArray(record.providerIds) || record.providerIds.length !== 2) {
    reasons.push(label + "_PAIRWISE_REQUIRES_EXACTLY_TWO_PROVIDERS");
    return;
  }
  const pair = record.pairwise;
  if (!isRecord(pair) ||
      !Array.isArray(pair.attestations) ||
      !["NO_KNOWN_OVERLAP", "OVERLAP_IDENTIFIED", "INCOMPLETE", "UNKNOWN"].includes(pair.overlapAssessment) ||
      !["INDEPENDENT", "DEPENDENT", "UNKNOWN"].includes(pair.independenceConclusion) ||
      !nonEmpty(pair.overlapAnalysis)) {
    reasons.push(label + "_PAIRWISE_EVIDENCE_INVALID");
    return;
  }
  if (pair.attestations.length !== 2) reasons.push(label + "_PAIRWISE_ATTESTATION_COUNT_INVALID");
  const attested = new Set();
  for (const attestation of pair.attestations) {
    if (!isRecord(attestation) ||
        !record.providerIds.includes(attestation.providerId) ||
        attested.has(attestation.providerId) ||
        !nonEmpty(attestation.issuer) ||
        !validUtc(attestation.issuedAt) ||
        !nonEmpty(attestation.attestationReference)) {
      reasons.push(label + "_PAIRWISE_ATTESTATION_ENTRY_INVALID");
      continue;
    }
    attested.add(attestation.providerId);
  }
  if (attested.size !== 2) reasons.push(label + "_PAIRWISE_BOTH_SIDES_MUST_ATTEST");
  if (record.review?.state === "PAIRWISE_INDEPENDENCE_VERIFIED" &&
      (pair.independenceConclusion !== "INDEPENDENT" ||
       pair.overlapAssessment !== "NO_KNOWN_OVERLAP" ||
       record.quality !== "EXECUTED_OR_SIGNED" ||
       attested.size !== 2)) {
    reasons.push(label + "_PAIRWISE_VERIFIED_STATE_NOT_SUPPORTED_BY_RECORD");
  }
}

function validateRights(record, label, reasons, generatedAt) {
  const rights = record.rights;
  if (!isRecord(rights) ||
      !nonEmpty(rights.legalEntity) ||
      !nonEmpty(rights.accountReferenceRedacted) ||
      !nonEmpty(rights.planOrTermsName) ||
      !nonEmpty(rights.termsVersion) ||
      !validUtc(rights.effectiveFrom) ||
      !(rights.expiresAt === null || validUtc(rights.expiresAt)) ||
      !uniqueStrings(rights.deliveryModels, (value) => DELIVERY_MODELS.has(value)) ||
      !Array.isArray(rights.permittedActions) ||
      !rights.permittedActions.every((value) => RIGHTS_ACTIONS.has(value)) ||
      new Set(rights.permittedActions).size !== rights.permittedActions.length ||
      !Array.isArray(rights.prohibitedActions) ||
      !rights.prohibitedActions.every((value) => RIGHTS_ACTIONS.has(value)) ||
      new Set(rights.prohibitedActions).size !== rights.prohibitedActions.length ||
      !nonEmpty(rights.attributionRequirements) ||
      !nonEmpty(rights.retentionTerms)) {
    reasons.push(label + "_RIGHTS_SCOPE_INVALID");
    return;
  }
  if (rights.permittedActions.some((action) => rights.prohibitedActions.includes(action))) {
    reasons.push(label + "_RIGHTS_ACTION_CONFLICT");
  }
  if (Date.parse(rights.effectiveFrom) > Date.parse(generatedAt)) {
    reasons.push(label + "_RIGHTS_NOT_YET_EFFECTIVE");
  }
  if (rights.expiresAt !== null && Date.parse(rights.expiresAt) <= Date.parse(generatedAt)) {
    reasons.push(label + "_RIGHTS_EXPIRED");
  }
  if ((record.review?.state === "RIGHTS_CLEARED_FOR_DIAGNOSTIC" ||
       record.review?.state === "RIGHTS_CLEARED_FOR_PRODUCTION_SCOPE") &&
      (!["EXECUTED_OR_SIGNED", "FIRST_PARTY_ACCOUNT"].includes(record.quality) ||
       rights.permittedActions.length === 0)) {
    reasons.push(label + "_RIGHTS_CLEARED_STATE_REQUIRES_EXECUTED_OR_ACCOUNT_EVIDENCE");
  }
  if (record.review?.state === "RIGHTS_CLEARED_FOR_PRODUCTION_SCOPE" &&
      rights.deliveryModels.length === 0) {
    reasons.push(label + "_PRODUCTION_RIGHTS_DELIVERY_SCOPE_MISSING");
  }
}

function validateOwnerDecision(record, label, reasons) {
  const decision = record.ownerDecision;
  if (!isRecord(decision) ||
      !nonEmpty(decision.decisionId) ||
      !nonEmpty(decision.owner) ||
      !validUtc(decision.decidedAt) ||
      !["PROCEED_DIAGNOSTIC_ONLY", "PROCEED_PRODUCTION_SCOPE", "REJECT", "DEFER"].includes(decision.outcome) ||
      !nonEmpty(decision.scope) ||
      !uniqueStrings(decision.linkedEvidenceIds, ID_PATTERN) ||
      !(decision.expiresAt === null || validUtc(decision.expiresAt))) {
    reasons.push(label + "_OWNER_DECISION_INVALID");
    return;
  }
  if (record.quality !== "EXECUTED_OR_SIGNED" ||
      record.review?.state !== "OWNER_DECISION_RECORDED") {
    reasons.push(label + "_OWNER_DECISION_REQUIRES_SIGNED_REVIEWED_RECORD");
  }
}

export function validateProviderEvidenceManifest(input, options = {}) {
  const reasons = [];
  const integrity = [];
  if (!isRecord(input)) {
    return {
      valid: false,
      status: "BLOCKED",
      reasonCodes: ["MANIFEST_ROOT_INVALID"],
      recordCount: 0,
      artifactIntegrity: [],
      approvalMutationPerformed: false,
      tradingAuthorized: false
    };
  }

  const forbidden = collectForbiddenKeys(input);
  if (forbidden.length > 0) reasons.push("MANIFEST_CONTAINS_FORBIDDEN_CREDENTIAL_FIELDS");

  if (input.schemaVersion !== PROVIDER_EVIDENCE_MANIFEST_VERSION) {
    reasons.push("MANIFEST_SCHEMA_VERSION_UNSUPPORTED");
  }
  if (!validUtc(input.generatedAt)) reasons.push("MANIFEST_GENERATED_AT_INVALID");
  if (!Array.isArray(input.records) || input.records.length === 0) {
    reasons.push("MANIFEST_RECORDS_REQUIRED");
  }

  const records = Array.isArray(input.records) ? input.records : [];
  const ids = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const label = "RECORD_" + index;
    if (!isRecord(record)) {
      reasons.push(label + "_INVALID");
      continue;
    }
    if (!ID_PATTERN.test(record.evidenceId ?? "") || ids.has(record.evidenceId)) {
      reasons.push(label + "_EVIDENCE_ID_INVALID_OR_DUPLICATED");
    } else {
      ids.add(record.evidenceId);
    }
    if (!Array.isArray(record.providerIds) ||
        record.providerIds.length < 1 ||
        record.providerIds.length > 2 ||
        !record.providerIds.every((id) => typeof id === "string" && SLUG_PATTERN.test(id)) ||
        new Set(record.providerIds).size !== record.providerIds.length) {
      reasons.push(label + "_PROVIDER_IDS_INVALID");
    }
    if (!EVIDENCE_TYPES.has(record.evidenceType)) reasons.push(label + "_EVIDENCE_TYPE_INVALID");
    if (!EVIDENCE_QUALITIES.has(record.quality)) reasons.push(label + "_EVIDENCE_QUALITY_INVALID");
    if (!nonEmpty(record.issuer)) reasons.push(label + "_ISSUER_MISSING");
    if (!validUtc(record.issuedAt)) reasons.push(label + "_ISSUED_AT_INVALID");
    if (!isRecord(record.scope) ||
        !nonEmpty(record.scope.summary) ||
        !uniqueStrings(record.scope.deliveryModels, (value) => DELIVERY_MODELS.has(value)) ||
        !Array.isArray(record.scope.coveredActions) ||
        !record.scope.coveredActions.every((value) => RIGHTS_ACTIONS.has(value)) ||
        new Set(record.scope.coveredActions).size !== record.scope.coveredActions.length) {
      reasons.push(label + "_SCOPE_INVALID");
    }
    validateReview(record.review, record.quality, label, reasons);
    const reviewState = record.review?.state;
    const reviewStateType = {
      TECHNICAL_METADATA_VERIFIED: "FEED_SYMBOLOGY",
      LINEAGE_REVIEWED_NOT_INDEPENDENT: "PUBLISHER_LINEAGE",
      PAIRWISE_INDEPENDENCE_VERIFIED: "PAIRWISE_ATTESTATION",
      RIGHTS_CLEARED_FOR_DIAGNOSTIC: ["SERVICE_TERMS", "ORDER_FORM", "WRITTEN_PERMISSION"],
      RIGHTS_CLEARED_FOR_PRODUCTION_SCOPE: ["SERVICE_TERMS", "ORDER_FORM", "WRITTEN_PERMISSION"],
      OWNER_DECISION_RECORDED: "OWNER_DECISION"
    }[reviewState];
    if (typeof reviewStateType === "string" && record.evidenceType !== reviewStateType) {
      reasons.push(label + "_REVIEW_STATE_DOES_NOT_MATCH_EVIDENCE_TYPE");
    } else if (Array.isArray(reviewStateType) && !reviewStateType.includes(record.evidenceType)) {
      reasons.push(label + "_REVIEW_STATE_DOES_NOT_MATCH_EVIDENCE_TYPE");
    }
    const artifactResult = validateArtifact(record.artifact, options, label, reasons);
    integrity.push({ evidenceId: record.evidenceId ?? null, status: artifactResult.integrity });

    if (record.evidenceType === "FEED_SYMBOLOGY") {
      if (record.providerIds?.length !== 1 || record.providerIds[0] !== "pyth-pro") {
        reasons.push(label + "_PYTH_SYMBOLOGY_PROVIDER_MUST_BE_PYTH_PRO");
      }
      validateFeedSymbology(record, label, reasons);
    } else if (record.evidenceType === "PUBLISHER_LINEAGE") {
      validatePublisherLineage(record, label, reasons);
    } else if (record.evidenceType === "PAIRWISE_ATTESTATION") {
      validatePairwiseAttestation(record, label, reasons);
    } else if (["SERVICE_TERMS", "ORDER_FORM", "WRITTEN_PERMISSION"].includes(record.evidenceType)) {
      validateRights(record, label, reasons, input.generatedAt);
    } else if (record.evidenceType === "OWNER_DECISION") {
      validateOwnerDecision(record, label, reasons);
    }

    if (record.review?.state === "OWNER_DECISION_RECORDED" && record.evidenceType !== "OWNER_DECISION") {
      reasons.push(label + "_OWNER_DECISION_STATE_REQUIRES_OWNER_DECISION_RECORD");
    }
  }

  for (const record of records) {
    if (!isRecord(record) || record.evidenceType !== "OWNER_DECISION" || !isRecord(record.ownerDecision)) continue;
    for (const evidenceId of record.ownerDecision.linkedEvidenceIds ?? []) {
      if (!ids.has(evidenceId)) reasons.push("OWNER_DECISION_REFERENCES_UNKNOWN_EVIDENCE");
    }
  }

  const reasonCodes = [...new Set(reasons)].sort();
  return {
    valid: reasonCodes.length === 0,
    status: reasonCodes.length === 0 ? "STRUCTURALLY_VALID_NOT_AN_APPROVAL" : "BLOCKED",
    reasonCodes,
    recordCount: records.length,
    artifactIntegrity: integrity,
    approvalMutationPerformed: false,
    tradingAuthorized: false
  };
}

function parseArguments(argv) {
  const args = { manifest: null, artifactRoot: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--manifest" && argv[index + 1]) args.manifest = argv[++index];
    else if (value === "--artifact-root" && argv[index + 1]) args.artifactRoot = argv[++index];
    else throw new Error("Unknown or incomplete argument: " + value);
  }
  return args;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  try {
    const args = parseArguments(process.argv.slice(2));
    if (args.help) {
      console.log("Usage: node scripts/validate-provider-evidence-manifest.mjs --manifest <manifest.json> [--artifact-root <restricted-artifact-directory>]");
      console.log("Validates structure and local artifact digests only. It never approves a provider or authorizes trading.");
    } else if (!args.manifest) {
      throw new Error("--manifest is required.");
    } else if (!existsSync(resolve(args.manifest)) || !statSync(resolve(args.manifest)).isFile()) {
      throw new Error("Manifest file is missing or is not a regular file.");
    } else {
      const manifest = JSON.parse(readFileSync(resolve(args.manifest), "utf8"));
      const report = validateProviderEvidenceManifest(manifest, {
        artifactRoot: args.artifactRoot ? resolve(args.artifactRoot) : null
      });
      console.log(JSON.stringify(report, null, 2));
      if (!report.valid) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Evidence manifest validation failed.");
    process.exitCode = 2;
  }
}
