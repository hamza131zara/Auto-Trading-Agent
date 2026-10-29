#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Keep these review pins independent from the manifest generator: changing the
// generator's pins alone must not silently change what the reviewer accepts.
export const REVIEW_PINNED_SOURCE_REPOSITORY = "https://github.com/raydium-io/raydium-cp-swap";
export const REVIEW_PINNED_SOURCE_COMMIT = "f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5";
export const REVIEW_PINNED_SOURCE_TREE = "060a556fc8b30bdaf04ada495819530b1dab6174";
export const REVIEW_EXPECTED_PROGRAM_ID = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const REVIEW_LIBRARY_NAME = "raydium_cp_swap";
export const REVIEW_SOLANA_VERIFY_VERSION = "0.5.2";
export const REVIEW_SOLANA_VERIFY_SHA256 = "b9d5ccce9634dc14269cab3e7a58649bc141b3306e7735a94478c936341f211f";
export const REVIEW_EXPECTED_TOOLCHAIN = Object.freeze({ rust: "1.91.0", solana: "3.1.10", anchor: "1.0.2" });

const MAX_ELF_BYTES = 50_000_000;
const REQUIRED_BUILD_INPUTS = [
  "Cargo.lock",
  "Cargo.toml",
  "Anchor.toml",
  "README.md",
  "programs/cp-swap/Cargo.toml"
];
const PASS_STATUS = "PASS_MANIFEST_AND_ARTIFACT_CONSISTENCY";
const BLOCKED_STATUS = "BLOCKED";

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function isSha256(value) {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function canonicalObjectEntries(value) {
  if (!isRecord(value)) return null;
  return Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
}

function inspectArtifactBytes(bytes, label) {
  if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array)) {
    return {
      valid: false,
      reasonCodes: [label + "_ARTIFACT_BYTES_MISSING"],
      sha256: null,
      byteLength: null,
      elfMagicValid: false
    };
  }
  const artifact = Buffer.from(bytes);
  const elfMagicValid = artifact.length >= 4 &&
    artifact[0] === 0x7f && artifact[1] === 0x45 &&
    artifact[2] === 0x4c && artifact[3] === 0x46;
  const reasons = [];
  if (artifact.length < 4 || artifact.length > MAX_ELF_BYTES) reasons.push(label + "_ARTIFACT_BYTE_LENGTH_OUT_OF_RANGE");
  if (!elfMagicValid) reasons.push(label + "_ARTIFACT_ELF_MAGIC_INVALID");
  return {
    valid: reasons.length === 0,
    reasonCodes: reasons,
    sha256: artifact.length > 0 && artifact.length <= MAX_ELF_BYTES ? sha256(artifact) : null,
    byteLength: artifact.length,
    elfMagicValid
  };
}

function inspectManifestArtifact(manifestArtifact, recomputed, label, reasons) {
  if (!isRecord(manifestArtifact)) {
    reasons.push(label + "_MANIFEST_ARTIFACT_MISSING");
    return;
  }
  if (manifestArtifact.valid !== true) reasons.push(label + "_MANIFEST_ARTIFACT_NOT_VALID");
  if (manifestArtifact.elfMagicValid !== true) reasons.push(label + "_MANIFEST_ARTIFACT_ELF_FLAG_INVALID");
  if (Array.isArray(manifestArtifact.reasonCodes) && manifestArtifact.reasonCodes.length !== 0) {
    reasons.push(label + "_MANIFEST_ARTIFACT_HAS_REASON_CODES");
  } else if (!Array.isArray(manifestArtifact.reasonCodes)) {
    reasons.push(label + "_MANIFEST_ARTIFACT_REASON_CODES_MISSING");
  }
  if (!isSha256(manifestArtifact.sha256)) reasons.push(label + "_MANIFEST_ARTIFACT_SHA256_INVALID");
  if (!Number.isSafeInteger(manifestArtifact.byteLength) || manifestArtifact.byteLength < 4 || manifestArtifact.byteLength > MAX_ELF_BYTES) {
    reasons.push(label + "_MANIFEST_ARTIFACT_LENGTH_INVALID");
  }
  if (manifestArtifact.fileName !== REVIEW_LIBRARY_NAME + ".so") reasons.push(label + "_MANIFEST_ARTIFACT_FILENAME_MISMATCH");
  if (!recomputed.valid) reasons.push(...recomputed.reasonCodes);
  if (recomputed.valid && manifestArtifact.sha256 !== recomputed.sha256) reasons.push(label + "_ARTIFACT_SHA256_DOES_NOT_MATCH_BYTES");
  if (recomputed.valid && manifestArtifact.byteLength !== recomputed.byteLength) reasons.push(label + "_ARTIFACT_LENGTH_DOES_NOT_MATCH_BYTES");
}

function inspectBuildSource(source, label, reasons) {
  if (!isRecord(source)) {
    reasons.push(label + "_SOURCE_EVIDENCE_MISSING");
    return null;
  }
  if (source.valid !== true) reasons.push(label + "_SOURCE_EVIDENCE_NOT_VALID");
  if (!Array.isArray(source.reasonCodes) || source.reasonCodes.length !== 0) reasons.push(label + "_SOURCE_REASON_CODES_NOT_EMPTY");
  if (source.sourceRepository !== REVIEW_PINNED_SOURCE_REPOSITORY) reasons.push(label + "_SOURCE_REPOSITORY_MISMATCH");
  if (source.sourceCommit !== REVIEW_PINNED_SOURCE_COMMIT || source.expectedSourceCommit !== REVIEW_PINNED_SOURCE_COMMIT) {
    reasons.push(label + "_SOURCE_COMMIT_MISMATCH");
  }
  if (source.sourceTree !== REVIEW_PINNED_SOURCE_TREE || source.expectedSourceTree !== REVIEW_PINNED_SOURCE_TREE) {
    reasons.push(label + "_SOURCE_TREE_MISMATCH");
  }
  if (source.workingTreeClean !== true) reasons.push(label + "_SOURCE_WORKTREE_NOT_CLEAN");
  if (source.programLibraryName !== REVIEW_LIBRARY_NAME) reasons.push(label + "_LIBRARY_NAME_MISMATCH");

  const toolchain = source.toolchain;
  if (!isRecord(toolchain) ||
      toolchain.rustReference !== REVIEW_EXPECTED_TOOLCHAIN.rust ||
      toolchain.solanaDeclared !== REVIEW_EXPECTED_TOOLCHAIN.solana ||
      toolchain.solanaWorkspaceMetadata !== REVIEW_EXPECTED_TOOLCHAIN.solana ||
      toolchain.anchorDeclared !== REVIEW_EXPECTED_TOOLCHAIN.anchor) {
    reasons.push(label + "_TOOLCHAIN_METADATA_MISMATCH");
  }

  const inputs = source.buildInputSha256;
  const entries = canonicalObjectEntries(inputs);
  if (!entries || REQUIRED_BUILD_INPUTS.some((name) => !isSha256(inputs[name])) ||
      entries.some(([, digest]) => !isSha256(digest))) {
    reasons.push(label + "_BUILD_INPUT_DIGESTS_INVALID");
  }
  return entries;
}

function compareBuildInputDigests(left, right, reasons) {
  if (!left || !right) return;
  if (JSON.stringify(left) !== JSON.stringify(right)) reasons.push("BUILD_INPUT_DIGESTS_DIFFER");
}

function checkSafetyFlags(manifest, reasons) {
  const result = manifest?.result;
  if (!isRecord(result)) {
    reasons.push("MANIFEST_RESULT_MISSING");
    return;
  }
  if (result.status !== "PASS_REPRODUCIBLE_REFERENCE_BUILD") reasons.push("GENERATOR_RESULT_NOT_PASS");
  if (!Array.isArray(result.reasonCodes) || result.reasonCodes.length !== 0) reasons.push("GENERATOR_RESULT_REASON_CODES_NOT_EMPTY");
  if (result.buildEvidenceAcceptedForManualHashComparison !== true) reasons.push("GENERATOR_DID_NOT_ACCEPT_BUILD_EVIDENCE");
  if (result.liveProgramCompared !== false) reasons.push("UNEXPECTED_LIVE_PROGRAM_COMPARISON_FLAG");
  if (result.rpcRequested !== false) reasons.push("UNEXPECTED_RPC_REQUEST_FLAG");
  if (result.transactionSubmitted !== false) reasons.push("UNEXPECTED_TRANSACTION_FLAG");
  if (result.tradingAuthorized !== false) reasons.push("UNEXPECTED_TRADING_AUTHORIZATION_FLAG");
}

export function reviewRaydiumBuildEvidence({
  manifest,
  manifestBytes,
  artifactABytes,
  artifactBBytes,
  generatedAt = new Date().toISOString()
}) {
  const reasons = [];
  const source = manifest?.source;
  if (!isRecord(manifest)) {
    reasons.push("MANIFEST_NOT_AN_OBJECT");
  } else {
    if (manifest.schemaVersion !== "ata.phase6.raydium-reference-build-evidence.v1") reasons.push("MANIFEST_SCHEMA_VERSION_UNSUPPORTED");
    if (typeof manifest.generatedAt !== "string" || !Number.isFinite(Date.parse(manifest.generatedAt))) reasons.push("MANIFEST_GENERATED_AT_INVALID");
    if (manifest.scope !== "OFFLINE_PINNED_SOURCE_BUILD_ONLY_NO_RPC") reasons.push("MANIFEST_SCOPE_UNEXPECTED");
  }

  if (!isRecord(source)) {
    reasons.push("MANIFEST_SOURCE_MISSING");
  } else {
    if (source.repository !== REVIEW_PINNED_SOURCE_REPOSITORY) reasons.push("PINNED_SOURCE_REPOSITORY_MISMATCH");
    if (source.pinnedCommit !== REVIEW_PINNED_SOURCE_COMMIT) reasons.push("PINNED_SOURCE_COMMIT_MISMATCH");
    if (source.pinnedTree !== REVIEW_PINNED_SOURCE_TREE) reasons.push("PINNED_SOURCE_TREE_MISMATCH");
    if (source.expectedProgramId !== REVIEW_EXPECTED_PROGRAM_ID) reasons.push("EXPECTED_PROGRAM_ID_MISMATCH");
    if (source.libraryName !== REVIEW_LIBRARY_NAME) reasons.push("PROGRAM_LIBRARY_NAME_MISMATCH");
    if (source.buildTool !== "solana-verify build --library-name raydium_cp_swap") reasons.push("BUILD_COMMAND_MISMATCH");
    if (source.solanaVerifyVersion !== REVIEW_SOLANA_VERIFY_VERSION) reasons.push("SOLANA_VERIFY_VERSION_MISMATCH");
    if (source.solanaVerifyBinarySha256 !== REVIEW_SOLANA_VERIFY_SHA256) reasons.push("SOLANA_VERIFY_BINARY_SHA256_MISMATCH");
    const toolchain = source.expectedToolchain;
    if (!isRecord(toolchain) ||
        toolchain.rust !== REVIEW_EXPECTED_TOOLCHAIN.rust ||
        toolchain.solana !== REVIEW_EXPECTED_TOOLCHAIN.solana ||
        toolchain.anchor !== REVIEW_EXPECTED_TOOLCHAIN.anchor) {
      reasons.push("EXPECTED_TOOLCHAIN_MISMATCH");
    }
  }

  const builds = source?.buildRuns;
  const buildInputSets = [];
  const recomputedArtifacts = [
    inspectArtifactBytes(artifactABytes, "BUILD_A"),
    inspectArtifactBytes(artifactBBytes, "BUILD_B")
  ];
  if (!Array.isArray(builds) || builds.length !== 2) {
    reasons.push("EXACTLY_TWO_BUILD_RUNS_REQUIRED");
  } else {
    for (let index = 0; index < 2; index += 1) {
      const build = builds[index];
      const label = index === 0 ? "BUILD_A" : "BUILD_B";
      if (!isRecord(build)) {
        reasons.push(label + "_RECORD_MISSING");
        continue;
      }
      if (build.exitCode !== 0) reasons.push(label + "_COMMAND_NOT_SUCCESSFUL");
      buildInputSets[index] = inspectBuildSource(build.source, label, reasons);
      inspectManifestArtifact(build.artifact, recomputedArtifacts[index], label, reasons);
    }
  }
  compareBuildInputDigests(buildInputSets[0], buildInputSets[1], reasons);

  const a = builds?.[0]?.artifact;
  const b = builds?.[1]?.artifact;
  if (isRecord(a) && isRecord(b)) {
    if (a.sha256 !== b.sha256) reasons.push("BUILD_ARTIFACT_HASHES_DIFFER");
    if (a.byteLength !== b.byteLength) reasons.push("BUILD_ARTIFACT_LENGTHS_DIFFER");
  }

  const reproducibility = manifest?.reproducibility;
  if (!isRecord(reproducibility) ||
      reproducibility.sameSha256 !== true ||
      reproducibility.sameByteLength !== true ||
      reproducibility.bothCommandsSucceeded !== true ||
      reproducibility.status !== "REPRODUCIBLE_WITHIN_PINNED_RUNNER") {
    reasons.push("REPRODUCIBILITY_SUMMARY_INVALID");
  }

  const reference = manifest?.referenceArtifact;
  if (!isRecord(reference)) {
    reasons.push("REFERENCE_ARTIFACT_MISSING");
  } else {
    if (reference.fileName !== REVIEW_LIBRARY_NAME + ".so") reasons.push("REFERENCE_ARTIFACT_FILENAME_MISMATCH");
    if (!isSha256(reference.sha256)) reasons.push("REFERENCE_ARTIFACT_SHA256_INVALID");
    if (!Number.isSafeInteger(reference.byteLength) || reference.byteLength < 4 || reference.byteLength > MAX_ELF_BYTES) {
      reasons.push("REFERENCE_ARTIFACT_LENGTH_INVALID");
    }
    if (isRecord(a) && reference.sha256 !== a.sha256) reasons.push("REFERENCE_SHA256_DOES_NOT_MATCH_BUILD_A");
    if (isRecord(b) && reference.sha256 !== b.sha256) reasons.push("REFERENCE_SHA256_DOES_NOT_MATCH_BUILD_B");
    if (isRecord(a) && reference.byteLength !== a.byteLength) reasons.push("REFERENCE_LENGTH_DOES_NOT_MATCH_BUILD_A");
    if (isRecord(b) && reference.byteLength !== b.byteLength) reasons.push("REFERENCE_LENGTH_DOES_NOT_MATCH_BUILD_B");
    if (recomputedArtifacts[0].valid && reference.sha256 !== recomputedArtifacts[0].sha256) reasons.push("REFERENCE_SHA256_DOES_NOT_MATCH_RECOMPUTED_BYTES");
    if (recomputedArtifacts[1].valid && reference.sha256 !== recomputedArtifacts[1].sha256) reasons.push("REFERENCE_SHA256_DOES_NOT_MATCH_SECOND_RECOMPUTED_BYTES");
  }

  checkSafetyFlags(manifest, reasons);
  if (!(Buffer.isBuffer(manifestBytes) || manifestBytes instanceof Uint8Array)) reasons.push("RAW_MANIFEST_BYTES_REQUIRED_FOR_DIGEST");

  const uniqueReasons = [...new Set(reasons)];
  const accepted = uniqueReasons.length === 0;
  return {
    schemaVersion: "ata.phase6.raydium-reference-build-review.v1",
    generatedAt,
    reviewScope: "LOCAL_MANIFEST_AND_ELF_CONSISTENCY_ONLY",
    manifestSha256: Buffer.isBuffer(manifestBytes) || manifestBytes instanceof Uint8Array ? sha256(Buffer.from(manifestBytes)) : null,
    sourcePin: {
      repository: source?.repository ?? null,
      commit: source?.pinnedCommit ?? null,
      tree: source?.pinnedTree ?? null,
      programId: source?.expectedProgramId ?? null
    },
    artifactReview: {
      buildA: recomputedArtifacts[0],
      buildB: recomputedArtifacts[1],
      hashesMatch: recomputedArtifacts[0].valid && recomputedArtifacts[1].valid &&
        recomputedArtifacts[0].sha256 === recomputedArtifacts[1].sha256,
      byteLengthsMatch: recomputedArtifacts[0].valid && recomputedArtifacts[1].valid &&
        recomputedArtifacts[0].byteLength === recomputedArtifacts[1].byteLength,
      referenceArtifact: accepted && isRecord(reference) ? {
        sha256: reference.sha256,
        byteLength: reference.byteLength,
        fileName: reference.fileName
      } : null
    },
    result: {
      status: accepted ? PASS_STATUS : BLOCKED_STATUS,
      reasonCodes: uniqueReasons,
      candidateReadyForHumanProvenanceReview: accepted,
      liveProgramCompared: false,
      rpcRequested: false,
      transactionSubmitted: false,
      tradingAuthorized: false
    },
    limitations: [
      "This tool checks manifest consistency and recomputes hashes and exact byte lengths from the two supplied ELF files.",
      "It does not independently retrieve the pinned source, prove GitHub artifact provenance, verify the build runner, or independently attest the source-build process.",
      "A passing result is only a candidate for human provenance review. It does not compare the artifact to live ProgramData, establish current deployment identity, or authorize trading."
    ]
  };
}

function parseArgs(argv) {
  const allowed = new Set(["--manifest", "--artifact-a", "--artifact-b", "--output"]);
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!allowed.has(key) || args[key] !== undefined || !value || value.startsWith("--")) {
      throw new Error("BUILD_EVIDENCE_REVIEW_ARGUMENTS_INVALID");
    }
    args[key] = value;
    index += 1;
  }
  for (const key of allowed) {
    if (args[key] === undefined) {
      throw new Error("BUILD_EVIDENCE_REVIEW_ARGUMENT_REQUIRED_" + key.slice(2).replace(/-/g, "_").toUpperCase());
    }
  }
  return args;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const manifestPath = resolve(args["--manifest"]);
  const artifactAPath = resolve(args["--artifact-a"]);
  const artifactBPath = resolve(args["--artifact-b"]);
  const outputPath = resolve(args["--output"]);
  if (![manifestPath, artifactAPath, artifactBPath].every(existsSync)) {
    throw new Error("BUILD_EVIDENCE_REVIEW_INPUT_MISSING");
  }

  const manifestBytes = readFileSync(manifestPath);
  let manifest;
  try {
    manifest = JSON.parse(manifestBytes.toString("utf8"));
  } catch {
    throw new Error("BUILD_EVIDENCE_REVIEW_MANIFEST_JSON_INVALID");
  }
  const report = reviewRaydiumBuildEvidence({
    manifest,
    manifestBytes,
    artifactABytes: readFileSync(artifactAPath),
    artifactBBytes: readFileSync(artifactBPath)
  });
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, JSON.stringify(report, null, 2) + "\n", { encoding: "utf8", flag: "w", mode: 0o600 });
  console.log(JSON.stringify({
    status: report.result.status,
    reasonCodes: report.result.reasonCodes,
    manifestSha256: report.manifestSha256,
    candidateReadyForHumanProvenanceReview: report.result.candidateReadyForHumanProvenanceReview,
    liveProgramCompared: false,
    rpcRequested: false,
    tradingAuthorized: false
  }, null, 2));
  return report.result.status === PASS_STATUS ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    const code = typeof error?.message === "string" && /^[A-Z0-9_-]{1,120}$/.test(error.message)
      ? error.message : "BUILD_EVIDENCE_REVIEW_FAILED";
    console.error("Reference build evidence review stopped safely: " + code + ".");
    process.exitCode = 2;
  }
}
