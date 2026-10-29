import assert from "node:assert/strict";
import test from "node:test";
import {
  RAYDIUM_PINNED_SOURCE_COMMIT,
  RAYDIUM_PINNED_SOURCE_TREE,
  RAYDIUM_PROGRAM_ID,
  RAYDIUM_LIBRARY_NAME,
  SOLANA_VERIFY_LINUX_SHA256,
  EXPECTED_TOOLCHAIN,
  inspectElfArtifact,
  evaluateRaydiumBuildEvidence
} from "../scripts/create-raydium-build-evidence.mjs";

function source(overrides = {}) {
  return {
    valid: true,
    reasonCodes: [],
    sourceRepository: "https://github.com/raydium-io/raydium-cp-swap",
    sourceCommit: RAYDIUM_PINNED_SOURCE_COMMIT,
    expectedSourceCommit: RAYDIUM_PINNED_SOURCE_COMMIT,
    sourceTree: RAYDIUM_PINNED_SOURCE_TREE,
    expectedSourceTree: RAYDIUM_PINNED_SOURCE_TREE,
    sourceCommitDate: "2026-10-20T06:25:24Z",
    workingTreeClean: true,
    toolchain: { rustReference: EXPECTED_TOOLCHAIN.rust, solanaDeclared: EXPECTED_TOOLCHAIN.solana, solanaWorkspaceMetadata: EXPECTED_TOOLCHAIN.solana, anchorDeclared: EXPECTED_TOOLCHAIN.anchor },
    programLibraryName: RAYDIUM_LIBRARY_NAME,
    buildInputSha256: { "Cargo.lock": "a".repeat(64), "Anchor.toml": "b".repeat(64) },
    ...overrides
  };
}
function elf(body = [1, 2, 3, 4]) {
  return Buffer.from([0x7f, 0x45, 0x4c, 0x46, ...body]);
}
function artifact(body = [1, 2, 3, 4]) {
  return inspectElfArtifact(elf(body), "raydium_cp_swap.so");
}
function evaluate(overrides = {}) {
  return evaluateRaydiumBuildEvidence({
    sourceA: source(),
    sourceB: source(),
    artifactA: artifact(),
    artifactB: artifact(),
    buildExitCodeA: 0,
    buildExitCodeB: 0,
    solanaVerifyBinarySha256: SOLANA_VERIFY_LINUX_SHA256,
    generatedAt: "2026-10-30T00:00:00.000Z",
    ...overrides
  });
}

test("identical artifacts from the pinned clean source build produce a reviewable reference manifest", () => {
  const report = evaluate();
  assert.equal(report.result.status, "PASS_REPRODUCIBLE_REFERENCE_BUILD");
  assert.equal(report.source.expectedProgramId, RAYDIUM_PROGRAM_ID);
  assert.equal(report.source.libraryName, "raydium_cp_swap");
  assert.equal(report.referenceArtifact.sha256, artifact().sha256);
  assert.equal(report.referenceArtifact.byteLength, artifact().byteLength);
  assert.equal(report.reproducibility.status, "REPRODUCIBLE_WITHIN_PINNED_RUNNER");
  assert.equal(report.result.rpcRequested, false);
  assert.equal(report.result.liveProgramCompared, false);
  assert.equal(report.result.transactionSubmitted, false);
  assert.equal(report.result.tradingAuthorized, false);
});

test("divergent ELF hashes block acceptance even when both build commands succeed", () => {
  const report = evaluate({ artifactB: artifact([9, 8, 7, 6]) });
  assert.equal(report.result.status, "BLOCKED");
  assert.equal(report.referenceArtifact, null);
  assert.ok(report.result.reasonCodes.includes("INDEPENDENT_BUILD_HASHES_DIFFER"));
});

test("different artifact lengths block acceptance", () => {
  const report = evaluate({ artifactB: artifact([1, 2, 3, 4, 5]) });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("INDEPENDENT_BUILD_HASHES_DIFFER"));
  assert.ok(report.result.reasonCodes.includes("INDEPENDENT_BUILD_LENGTHS_DIFFER"));
});

test("source revision must match both pinned commit and source tree", () => {
  const report = evaluate({
    sourceB: source({ sourceCommit: "1".repeat(40), sourceTree: "2".repeat(40) })
  });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_B_SOURCE_REVISION_MISMATCH"));
});

test("dirty or incorrect toolchain/source metadata blocks acceptance", () => {
  const report = evaluate({ sourceA: source({ valid: false, reasonCodes: ["SOURCE_WORKTREE_NOT_CLEAN"] }) });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_A_SOURCE_OR_TOOLCHAIN_INVALID"));
});

test("failed build commands cannot be rescued by pre-existing or valid-looking artifacts", () => {
  const report = evaluate({ buildExitCodeB: 1 });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_B_COMMAND_FAILED"));
});

test("unverified build-tool binary digest blocks acceptance", () => {
  const report = evaluate({ solanaVerifyBinarySha256: "0".repeat(64) });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("SOLANA_VERIFY_BINARY_HASH_MISMATCH"));
});

test("invalid or non-ELF artifacts are explicitly rejected", () => {
  const invalid = inspectElfArtifact(Buffer.from("not-elf"), "raydium_cp_swap.so");
  assert.equal(invalid.valid, false);
  assert.ok(invalid.reasonCodes.includes("ARTIFACT_ELF_MAGIC_INVALID"));
  const report = evaluate({ artifactA: invalid });
  assert.equal(report.result.status, "BLOCKED");
  assert.equal(report.referenceArtifact, null);
});

test("an invalid source-build input digest between build copies blocks acceptance", () => {
  const report = evaluate({ sourceB: source({ buildInputSha256: { "Cargo.lock": "f".repeat(64), "Anchor.toml": "b".repeat(64) } }) });
  assert.equal(report.result.status, "BLOCKED");
  assert.ok(report.result.reasonCodes.includes("BUILD_INPUT_DIGESTS_DIFFER"));
});
