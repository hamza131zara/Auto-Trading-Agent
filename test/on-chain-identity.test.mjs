import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessOnChainIdentityEvidence } from "../packages/market-data/dist/index.js";

const fixture = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const original = fixture.cases.find((item) => item.caseId === "fresh-source").snapshot;
const poolAddress = "11111111111111111111111111111111";
const baseVault = "11111111111111111111111111111112";
const quoteVault = "11111111111111111111111111111113";
const baseAuthority = "11111111111111111111111111111114";
const quoteAuthority = "11111111111111111111111111111115";
const dexProgramId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const tokenProgramId = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
const loaderProgramId = "BPFLoaderUpgradeab1e11111111111111111111111";

function targetSnapshot(synthetic = false) {
  const target = structuredClone(original);
  target.cluster = "mainnet-beta";
  target.poolAddress = poolAddress;
  target.provenance.synthetic = synthetic;
  return target;
}

function validPolicy() {
  return {
    nowAt: "2026-10-29T00:01:00.000Z",
    maxRetrievalAgeMs: 5_000,
    maxFutureSkewMs: 0,
    minimumContextSlot: 400,
    requiredCommitment: "finalized",
    approvedPoolDecoders: [{
      programId: dexProgramId,
      decoderId: "test-pool-decoder",
      decoderVersion: "0.1.0"
    }],
    allowedTokenProgramIds: [tokenProgramId],
    allowedLoaderProgramIds: [loaderProgramId]
  };
}

function validEvidence(synthetic = false) {
  const target = targetSnapshot(false);
  return {
    source: {
      providerId: "test-rpc",
      commitment: "finalized",
      retrievedAt: "2026-10-29T00:00:59.000Z",
      contextSlot: 500,
      requestedMinContextSlot: 400,
      requestId: "onchain-test-001",
      rawPayloadSha256: "a".repeat(64),
      synthetic
    },
    poolAccount: {
      address: poolAddress,
      exists: true,
      ownerProgramId: dexProgramId,
      executable: false
    },
    dexProgramAccount: {
      address: dexProgramId,
      exists: true,
      ownerProgramId: loaderProgramId,
      executable: true
    },
    baseMintAccount: {
      address: target.baseMint,
      exists: true,
      ownerProgramId: tokenProgramId,
      executable: false,
      initialized: true,
      decimals: 9
    },
    quoteMintAccount: {
      address: target.quoteMint,
      exists: true,
      ownerProgramId: tokenProgramId,
      executable: false,
      initialized: true,
      decimals: 6
    },
    baseVaultAccount: {
      address: baseVault,
      exists: true,
      ownerProgramId: tokenProgramId,
      executable: false,
      initialized: true,
      mint: target.baseMint,
      authority: baseAuthority
    },
    quoteVaultAccount: {
      address: quoteVault,
      exists: true,
      ownerProgramId: tokenProgramId,
      executable: false,
      initialized: true,
      mint: target.quoteMint,
      authority: quoteAuthority
    },
    decodedPool: {
      decoderId: "test-pool-decoder",
      decoderVersion: "0.1.0",
      poolAddress,
      dexProgramId,
      baseMint: target.baseMint,
      quoteMint: target.quoteMint,
      baseVault,
      quoteVault,
      baseVaultAuthority: baseAuthority,
      quoteVaultAuthority: quoteAuthority
    }
  };
}

test("matching real-source account evidence advances only to a separate safety review", () => {
  const assessment = assessOnChainIdentityEvidence(
    targetSnapshot(false),
    validEvidence(false),
    validPolicy()
  );
  assert.equal(assessment.status, "MATCH");
  assert.deepEqual(assessment.reasonCodes, ["ON_CHAIN_IDENTITIES_MATCH_AT_CONTEXT_SLOT"]);
  assert.deepEqual(assessment.mismatchFields, []);
  assert.equal(assessment.sourceProviderId, "test-rpc");
  assert.equal(assessment.contextSlot, 500);
  assert.equal(assessment.canProceedToIndependentSafetyReview, true);
  assert.equal(assessment.tradingAuthorized, false);
});

test("synthetic account evidence or a synthetic target can never advance", () => {
  const syntheticEvidence = assessOnChainIdentityEvidence(
    targetSnapshot(false),
    validEvidence(true),
    validPolicy()
  );
  const syntheticTarget = assessOnChainIdentityEvidence(
    targetSnapshot(true),
    validEvidence(false),
    validPolicy()
  );
  assert.equal(syntheticEvidence.status, "SYNTHETIC_MATCH");
  assert.equal(syntheticTarget.status, "SYNTHETIC_MATCH");
  assert.equal(syntheticEvidence.canProceedToIndependentSafetyReview, false);
  assert.equal(syntheticTarget.canProceedToIndependentSafetyReview, false);
  assert.equal(syntheticEvidence.tradingAuthorized, false);
  assert.equal(syntheticTarget.tradingAuthorized, false);
});

test("pool owner must match an explicitly allowlisted decoder/program pair", () => {
  const evidence = validEvidence();
  evidence.poolAccount.ownerProgramId = loaderProgramId;
  const assessment = assessOnChainIdentityEvidence(targetSnapshot(), evidence, validPolicy());
  assert.equal(assessment.status, "MISMATCH");
  assert.ok(assessment.mismatchFields.includes("poolProgramNotAllowlisted"));
  assert.equal(assessment.canProceedToIndependentSafetyReview, false);
});

test("program executable and loader ownership are required", () => {
  const evidence = validEvidence();
  evidence.dexProgramAccount.executable = false;
  const assessment = assessOnChainIdentityEvidence(targetSnapshot(), evidence, validPolicy());
  assert.equal(assessment.status, "MISMATCH");
  assert.ok(assessment.mismatchFields.includes("dexProgramExecutable"));
});

test("pool-decoded mints and vaults must match the actual account evidence", () => {
  const evidence = validEvidence();
  evidence.decodedPool.baseVault = quoteVault;
  evidence.baseVaultAccount.authority = quoteAuthority;
  const assessment = assessOnChainIdentityEvidence(targetSnapshot(), evidence, validPolicy());
  assert.equal(assessment.status, "MISMATCH");
  assert.ok(assessment.mismatchFields.includes("decodedBaseVault"));
  assert.ok(assessment.mismatchFields.includes("baseVaultAuthority"));
});

test("missing RPC accounts or a missing protocol decode are insufficient evidence", () => {
  const missingAccount = validEvidence();
  missingAccount.baseVaultAccount = {
    address: baseVault,
    exists: false,
    ownerProgramId: null,
    executable: null,
    initialized: null,
    mint: null,
    authority: null
  };
  const missingDecode = validEvidence();
  missingDecode.decodedPool = null;
  assert.equal(
    assessOnChainIdentityEvidence(targetSnapshot(), missingAccount, validPolicy()).status,
    "INSUFFICIENT_EVIDENCE"
  );
  assert.equal(
    assessOnChainIdentityEvidence(targetSnapshot(), missingDecode, validPolicy()).status,
    "INSUFFICIENT_EVIDENCE"
  );
});

test("commitment and context-slot floors are explicit fail-closed gates", () => {
  const lowerCommitment = validEvidence();
  lowerCommitment.source.commitment = "confirmed";
  const lowSlot = validEvidence();
  lowSlot.source.contextSlot = 399;
  assert.deepEqual(
    assessOnChainIdentityEvidence(targetSnapshot(), lowerCommitment, validPolicy()).reasonCodes,
    ["COMMITMENT_BELOW_REQUIRED_POLICY"]
  );
  assert.deepEqual(
    assessOnChainIdentityEvidence(targetSnapshot(), lowSlot, validPolicy()).reasonCodes,
    ["CONTEXT_SLOT_BELOW_MINIMUM"]
  );
});

test("stale RPC evidence and missing raw evidence provenance cannot advance", () => {
  const stale = validEvidence();
  stale.source.retrievedAt = "2026-10-29T00:00:00.000Z";
  const missingProvenance = validEvidence();
  missingProvenance.source.rawPayloadSha256 = null;
  assert.deepEqual(
    assessOnChainIdentityEvidence(targetSnapshot(), stale, validPolicy()).reasonCodes,
    ["ON_CHAIN_EVIDENCE_RETRIEVAL_STALE"]
  );
  assert.deepEqual(
    assessOnChainIdentityEvidence(targetSnapshot(), missingProvenance, validPolicy()).reasonCodes,
    ["RPC_EVIDENCE_PROVENANCE_INCOMPLETE"]
  );
});

test("unsupported target cluster and an unapproved decoder version are blocked", () => {
  const devnetTarget = targetSnapshot();
  devnetTarget.cluster = "devnet";
  const alteredDecoder = validEvidence();
  alteredDecoder.decodedPool.decoderVersion = "9.9.9";
  assert.equal(
    assessOnChainIdentityEvidence(devnetTarget, validEvidence(), validPolicy()).status,
    "INVALID_INPUT"
  );
  const assessment = assessOnChainIdentityEvidence(targetSnapshot(), alteredDecoder, validPolicy());
  assert.equal(assessment.status, "MISMATCH");
  assert.ok(assessment.mismatchFields.includes("decoderVersion"));
});

test("empty/duplicate allowlists and malformed evidence fail closed", () => {
  const emptyPrograms = validPolicy();
  emptyPrograms.approvedPoolDecoders = [];
  const duplicatePrograms = validPolicy();
  duplicatePrograms.allowedTokenProgramIds.push(tokenProgramId);
  const malformedEvidence = validEvidence();
  malformedEvidence.source.contextSlot = -1;
  assert.equal(
    assessOnChainIdentityEvidence(targetSnapshot(), validEvidence(), emptyPrograms).status,
    "INVALID_INPUT"
  );
  assert.equal(
    assessOnChainIdentityEvidence(targetSnapshot(), validEvidence(), duplicatePrograms).status,
    "INVALID_INPUT"
  );
  assert.equal(
    assessOnChainIdentityEvidence(targetSnapshot(), malformedEvidence, validPolicy()).status,
    "INVALID_INPUT"
  );
  assert.equal(
    assessOnChainIdentityEvidence(targetSnapshot(), validEvidence(), validPolicy()).tradingAuthorized,
    false
  );
});
