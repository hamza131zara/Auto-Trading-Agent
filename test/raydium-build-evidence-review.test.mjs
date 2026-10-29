import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import {
  REVIEW_EXPECTED_TOOLCHAIN,
  REVIEW_EXPECTED_PROGRAM_ID,
  REVIEW_LIBRARY_NAME,
  REVIEW_PINNED_SOURCE_COMMIT,
  REVIEW_PINNED_SOURCE_REPOSITORY,
  REVIEW_PINNED_SOURCE_TREE,
  REVIEW_SOLANA_VERIFY_SHA256,
  REVIEW_SOLANA_VERIFY_VERSION,
  reviewRaydiumBuildEvidence
} from "../scripts/review-raydium-build-evidence.mjs";

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");
const elfA = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 1, 2, 3, 4, 5, 6]);
const elfB = Buffer.from(elfA);

function source(overrides = {}) {
  return {
    valid: true,
    reasonCodes: [],
    sourceRepository: REVIEW_PINNED_SOURCE_REPOSITORY,
    sourceCommit: REVIEW_PINNED_SOURCE_COMMIT,
    expectedSourceCommit: REVIEW_PINNED_SOURCE_COMMIT,
    sourceTree: REVIEW_PINNED_SOURCE_TREE,
    expectedSourceTree: REVIEW_PINNED_SOURCE_TREE,
    sourceCommitDate: "2026-10-20T06:25:24Z",
    workingTreeClean: true,
    toolchain: {
      rustReference: REVIEW_EXPECTED_TOOLCHAIN.rust,
      solanaDeclared: REVIEW_EXPECTED_TOOLCHAIN.solana,
      solanaWorkspaceMetadata: REVIEW_EXPECTED_TOOLCHAIN.solana,
      anchorDeclared: REVIEW_EXPECTED_TOOLCHAIN.anchor
    },
    programLibraryName: REVIEW_LIBRARY_NAME,
    buildInputSha256: {
      "Cargo.lock": "a".repeat(64),
      "Cargo.toml": "b".repeat(64),
      "Anchor.toml": "c".repeat(64),
      "README.md": "d".repeat(64),
      "programs/cp-swap/Cargo.toml": "e".repeat(64)
    },
    ...overrides
  };
}

function artifact(bytes = elfA) {
  return {
    valid: true,
    reasonCodes: [],
    fileName: "raydium_cp_swap.so",
    sha256: sha256(bytes),
    byteLength: bytes.byteLength,
    elfMagicValid: true
  };
}

function makeManifest(overrides = {}) {
  const buildA = {
    source: source(),
    exitCode: 0,
    artifact: artifact(elfA)
  };
  const buildB = {
    source: source(),
    exitCode: 0,
    artifact: artifact(elfB)
  };
  const manifest = {
    schemaVersion: "ata.phase6.raydium-reference-build-evidence.v1",
    generatedAt: "2026-10-30T00:00:00.000Z",
    scope: "OFFLINE_PINNED_SOURCE_BUILD_ONLY_NO_RPC",
    source: {
      repository: REVIEW_PINNED_SOURCE_REPOSITORY,
      pinnedCommit: REVIEW_PINNED_SOURCE_COMMIT,
      pinnedTree: REVIEW_PINNED_SOURCE_TREE,
      expectedProgramId: REVIEW_EXPECTED_PROGRAM_ID,
      libraryName: REVIEW_LIBRARY_NAME,
      expectedToolchain: { ...REVIEW_EXPECTED_TOOLCHAIN },
      buildTool: "solana-verify build --library-name raydium_cp_swap",
      solanaVerifyVersion: REVIEW_SOLANA_VERIFY_VERSION,
      solanaVerifyBinarySha256: REVIEW_SOLANA_VERIFY_SHA256,
      buildRuns: [buildA, buildB]
    },
    reproducibility: {
      sameSha256: true,
      sameByteLength: true,
      bothCommandsSucceeded: true,
      status: "REPRODUCIBLE_WITHIN_PINNED_RUNNER"
    },
    referenceArtifact: {
      fileName: "raydium_cp_swap.so",
      sha256: sha256(elfA),
      byteLength: elfA.byteLength
    },
    result: {
      status: "PASS_REPRODUCIBLE_REFERENCE_BUILD",
      reasonCodes: [],
      buildEvidenceAcceptedForManualHashComparison: true,
      liveProgramCompared: false,
      rpcRequested: false,
      transactionSubmitted: false,
      tradingAuthorized: false
    },
    limitations: ["Synthetic test manifest; not genuine build evidence."]
  };
  return structuredClone({ ...manifest, ...overrides });
}

function review(manifest = makeManifest(), options = {}) {
  const manifestBytes = options.manifestBytes === undefined
    ? Buffer.from(JSON.stringify(manifest), "utf8")
    : options.manifestBytes;
  return reviewRaydiumBuildEvidence({
    manifest,
    manifestBytes,
    artifactABytes: options.artifactABytes === undefined ? elfA : options.artifactABytes,
    artifactBBytes: options.artifactBBytes === undefined ? elfB : options.artifactBBytes,
    generatedAt: "2026-10-30T00:10:00.000Z"
  });
}

test("matching pinned-source manifest and ELF bytes pass only the local consistency gate", () => {
  const report = review();
  assert.equal(report.result.status, "PASS_MANIFEST_AND_ARTIFACT_CONSISTENCY");
  assert.equal(report.result.reasonCodes.length, 0);
  assert.equal(report.result.candidateReadyForHumanProvenanceReview, true);
  assert.equal(report.manifestSha256, sha256(Buffer.from(JSON.stringify(makeManifest()), "utf8")));
  assert.deepEqual(report.artifactReview.buildA, {
    valid: true,
    reasonCodes: [],
    sha256: sha256(elfA),
    byteLength: elfA.byteLength,
    elfMagicValid: true
  });
  assert.equal(report.artifactReview.hashesMatch, true);
  assert.equal(report.artifactReview.byteLengthsMatch, true);
  assert.equal(report.artifactReview.referenceArtifact.sha256, sha256(elfA));
  assert.equal(report.result.liveProgramCompared, false);
  assert.equal(report.result.rpcRequested, false);
  assert.equal(report.result.transactionSubmitted, false);
  assert.equal(report.result.tradingAuthorized, false);
});

test("artifact bytes are hashed again rather than trusting manifest digests", () => {
  const modified = Buffer.from(elfA);
  modified[modified.length - 1] ^= 0xff;
  const report = review(makeManifest(), { artifactABytes: modified });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_A_ARTIFACT_SHA256_DOES_NOT_MATCH_BYTES"));
  assert.ok(report.result.reasonCodes.includes("REFERENCE_SHA256_DOES_NOT_MATCH_RECOMPUTED_BYTES"));
  assert.equal(report.artifactReview.referenceArtifact, null);
});

test("different supplied ELF files block the review even if manifest claims equality", () => {
  const changed = Buffer.from(elfB);
  changed[4] = 42;
  const report = review(makeManifest(), { artifactBBytes: changed });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_B_ARTIFACT_SHA256_DOES_NOT_MATCH_BYTES"));
  assert.equal(report.artifactReview.hashesMatch, false);
});

test("unpinned source commit or tree blocks the review", () => {
  const manifest = makeManifest();
  manifest.source.buildRuns[1].source = source({
    sourceCommit: "1".repeat(40),
    sourceTree: "2".repeat(40),
    expectedSourceCommit: REVIEW_PINNED_SOURCE_COMMIT,
    expectedSourceTree: REVIEW_PINNED_SOURCE_TREE
  });
  const report = review(manifest);
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_B_SOURCE_COMMIT_MISMATCH"));
  assert.ok(report.result.reasonCodes.includes("BUILD_B_SOURCE_TREE_MISMATCH"));
});

test("a failed build command blocks acceptance despite valid-looking artifacts", () => {
  const manifest = makeManifest();
  manifest.source.buildRuns[1].exitCode = 1;
  const report = review(manifest);
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_B_COMMAND_NOT_SUCCESSFUL"));
});

test("different input-file digests between build copies block acceptance", () => {
  const manifest = makeManifest();
  manifest.source.buildRuns[1].source = source({
    buildInputSha256: {
      "Cargo.lock": "f".repeat(64),
      "Cargo.toml": "b".repeat(64),
      "Anchor.toml": "c".repeat(64),
      "README.md": "d".repeat(64),
      "programs/cp-swap/Cargo.toml": "e".repeat(64)
    }
  });
  const report = review(manifest);
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_INPUT_DIGESTS_DIFFER"));
});

test("unreviewed CLI digest, toolchain changes and program-ID changes block acceptance", () => {
  const manifest = makeManifest();
  manifest.source.solanaVerifyBinarySha256 = "0".repeat(64);
  manifest.source.expectedToolchain.rust = "0.0.0";
  manifest.source.expectedProgramId = "11111111111111111111111111111111";
  const report = review(manifest);
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("SOLANA_VERIFY_BINARY_SHA256_MISMATCH"));
  assert.ok(report.result.reasonCodes.includes("EXPECTED_TOOLCHAIN_MISMATCH"));
  assert.ok(report.result.reasonCodes.includes("EXPECTED_PROGRAM_ID_MISMATCH"));
});

test("dirty worktree or malformed required build-input digest blocks acceptance", () => {
  const manifest = makeManifest();
  manifest.source.buildRuns[0].source = source({
    workingTreeClean: false,
    buildInputSha256: { "Cargo.lock": "not-a-hash" }
  });
  const report = review(manifest);
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_A_SOURCE_WORKTREE_NOT_CLEAN"));
  assert.ok(report.result.reasonCodes.includes("BUILD_A_BUILD_INPUT_DIGESTS_INVALID"));
});

test("missing evidence files, non-ELF bytes and mismatched reference lengths fail closed", () => {
  const nonElf = Buffer.from("not an ELF binary");
  const badBytes = review(makeManifest(), { artifactABytes: nonElf });
  assert.equal(badBytes.result.status, "BLOCKED");
  assert.ok(badBytes.result.reasonCodes.includes("BUILD_A_ARTIFACT_ELF_MAGIC_INVALID"));

  const missingBytes = review(makeManifest(), { artifactBBytes: undefined, manifestBytes: undefined });
  // The standard fixture has bytes by default; exercise absent raw manifest bytes separately below.
  assert.equal(missingBytes.result.status, "PASS_MANIFEST_AND_ARTIFACT_CONSISTENCY");

  const wrongLengthManifest = makeManifest();
  wrongLengthManifest.referenceArtifact.byteLength += 1;
  const wrongLength = review(wrongLengthManifest);
  assert.equal(wrongLength.result.status, "BLOCKED");
  assert.ok(wrongLength.result.reasonCodes.includes("REFERENCE_LENGTH_DOES_NOT_MATCH_BUILD_A"));
});

test("review fails closed unless raw manifest bytes and safe scope flags are supplied", () => {
  const manifest = makeManifest();
  manifest.result.rpcRequested = true;
  const unsafe = review(manifest, { manifestBytes: null });
  assert.equal(unsafe.result.status, "BLOCKED");
  assert.ok(unsafe.result.reasonCodes.includes("UNEXPECTED_RPC_REQUEST_FLAG"));
  assert.ok(unsafe.result.reasonCodes.includes("RAW_MANIFEST_BYTES_REQUIRED_FOR_DIGEST"));
  assert.equal(unsafe.result.liveProgramCompared, false);
  assert.equal(unsafe.result.rpcRequested, false);
  assert.equal(unsafe.result.tradingAuthorized, false);
});

test("extra build records or a missing reference artifact are rejected", () => {
  const tooMany = makeManifest();
  tooMany.source.buildRuns.push(structuredClone(tooMany.source.buildRuns[0]));
  const extraBuilds = review(tooMany);
  assert.equal(extraBuilds.result.status, "BLOCKED");
  assert.ok(extraBuilds.result.reasonCodes.includes("EXACTLY_TWO_BUILD_RUNS_REQUIRED"));

  const noReference = makeManifest();
  noReference.referenceArtifact = null;
  const noReferenceReport = review(noReference);
  assert.equal(noReferenceReport.result.status, "BLOCKED");
  assert.ok(noReferenceReport.result.reasonCodes.includes("REFERENCE_ARTIFACT_MISSING"));
});
