#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const RAYDIUM_SOURCE_REPOSITORY = "https://github.com/raydium-io/raydium-cp-swap";
export const RAYDIUM_PINNED_SOURCE_COMMIT = "f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5";
export const RAYDIUM_PINNED_SOURCE_TREE = "060a556fc8b30bdaf04ada495819530b1dab6174";
export const RAYDIUM_PROGRAM_ID = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const RAYDIUM_LIBRARY_NAME = "raydium_cp_swap";
export const SOLANA_VERIFY_VERSION = "0.5.2";
export const SOLANA_VERIFY_LINUX_SHA256 = "b9d5ccce9634dc14269cab3e7a58649bc141b3306e7735a94478c936341f211f";
export const EXPECTED_TOOLCHAIN = Object.freeze({ rust: "1.91.0", solana: "3.1.10", anchor: "1.0.2" });
const MAX_ELF_BYTES = 50_000_000;
const REQUIRED_SOURCE_FILES = [
  "Cargo.lock",
  "Cargo.toml",
  "Anchor.toml",
  "README.md",
  "programs/cp-swap/Cargo.toml"
];

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}
function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function gitText(directory, args) {
  return execFileSync("git", ["-C", directory, ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
function readUtf8(path) {
  return readFileSync(path, "utf8");
}
function parseAnchorValue(text, key) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = text.match(new RegExp("^\\s*" + escaped + "\\s*=\\s*[\"']([^\"']+)[\"']\\s*$", "m"));
  return match?.[1] ?? null;
}

// Parse only the TOML [lib] section. Do not use the line-multiline $
// anchor as a section terminator: with the m flag, $ matches every line
// ending and would stop at the end of the [lib] header itself.
export function parseProgramLibraryName(programCargo) {
  const libraryName = parseProgramLibraryName(programCargo);

  if (rust !== EXPECTED_TOOLCHAIN.rust) reasons.push("RUST_VERSION_REFERENCE_MISMATCH");
  if (solana !== EXPECTED_TOOLCHAIN.solana || metadataSolana !== EXPECTED_TOOLCHAIN.solana) reasons.push("SOLANA_VERSION_METADATA_MISMATCH");
  if (anchor !== EXPECTED_TOOLCHAIN.anchor) reasons.push("ANCHOR_VERSION_METADATA_MISMATCH");
  if (libraryName !== RAYDIUM_LIBRARY_NAME) reasons.push("PROGRAM_LIBRARY_NAME_MISMATCH");

  return {
    valid: reasons.length === 0,
    reasonCodes: [...new Set(reasons)],
    sourceRepository: RAYDIUM_SOURCE_REPOSITORY,
    sourceCommit: commit,
    expectedSourceCommit: RAYDIUM_PINNED_SOURCE_COMMIT,
    sourceTree: tree,
    expectedSourceTree: RAYDIUM_PINNED_SOURCE_TREE,
    sourceCommitDate: commitDate,
    workingTreeClean,
    toolchain: { rustReference: rust, solanaDeclared: solana, solanaWorkspaceMetadata: metadataSolana, anchorDeclared: anchor },
    programLibraryName: libraryName,
    buildInputSha256: hashes
  };
}

export function inspectElfArtifact(bytes, fileName = "raydium_cp_swap.so") {
  if (!Buffer.isBuffer(bytes) && !(bytes instanceof Uint8Array)) {
    return { valid: false, reasonCodes: ["ARTIFACT_BYTES_INVALID"], fileName, sha256: null, byteLength: null, elfMagicValid: false };
  }
  const artifact = Buffer.from(bytes);
  const elfMagicValid = artifact.length >= 4 &&
    artifact[0] === 0x7f && artifact[1] === 0x45 && artifact[2] === 0x4c && artifact[3] === 0x46;
  const reasons = [];
  if (artifact.length < 4 || artifact.length > MAX_ELF_BYTES) reasons.push("ARTIFACT_BYTE_LENGTH_OUT_OF_RANGE");
  if (!elfMagicValid) reasons.push("ARTIFACT_ELF_MAGIC_INVALID");
  return {
    valid: reasons.length === 0,
    reasonCodes: reasons,
    fileName: basename(fileName),
    sha256: artifact.length > 0 && artifact.length <= MAX_ELF_BYTES ? sha256(artifact) : null,
    byteLength: artifact.length,
    elfMagicValid
  };
}

function inspectArtifactPath(path) {
  if (!path || !existsSync(path)) {
    return { valid: false, reasonCodes: ["BUILD_ARTIFACT_MISSING"], fileName: path ? basename(path) : null, sha256: null, byteLength: null, elfMagicValid: false };
  }
  try {
    const stat = statSync(path);
    if (!stat.isFile() || stat.size < 4 || stat.size > MAX_ELF_BYTES) {
      return { valid: false, reasonCodes: ["ARTIFACT_BYTE_LENGTH_OUT_OF_RANGE"], fileName: basename(path), sha256: null, byteLength: stat.size, elfMagicValid: false };
    }
    return inspectElfArtifact(readFileSync(path), path);
  } catch {
    return { valid: false, reasonCodes: ["BUILD_ARTIFACT_UNREADABLE"], fileName: basename(path), sha256: null, byteLength: null, elfMagicValid: false };
  }
}

export function evaluateRaydiumBuildEvidence({
  sourceA, sourceB, artifactA, artifactB, buildExitCodeA, buildExitCodeB,
  solanaVerifyBinarySha256, generatedAt = new Date().toISOString()
}) {
  const reasons = [];
  if (!isRecord(sourceA) || sourceA.valid !== true) reasons.push("BUILD_A_SOURCE_OR_TOOLCHAIN_INVALID");
  if (!isRecord(sourceB) || sourceB.valid !== true) reasons.push("BUILD_B_SOURCE_OR_TOOLCHAIN_INVALID");
  if (sourceA?.sourceCommit !== RAYDIUM_PINNED_SOURCE_COMMIT || sourceA?.sourceTree !== RAYDIUM_PINNED_SOURCE_TREE) reasons.push("BUILD_A_SOURCE_REVISION_MISMATCH");
  if (sourceB?.sourceCommit !== RAYDIUM_PINNED_SOURCE_COMMIT || sourceB?.sourceTree !== RAYDIUM_PINNED_SOURCE_TREE) reasons.push("BUILD_B_SOURCE_REVISION_MISMATCH");
  if (!Number.isSafeInteger(buildExitCodeA) || buildExitCodeA !== 0) reasons.push("BUILD_A_COMMAND_FAILED");
  if (!Number.isSafeInteger(buildExitCodeB) || buildExitCodeB !== 0) reasons.push("BUILD_B_COMMAND_FAILED");
  if (!isRecord(artifactA) || artifactA.valid !== true) reasons.push("BUILD_A_ARTIFACT_INVALID");
  if (!isRecord(artifactB) || artifactB.valid !== true) reasons.push("BUILD_B_ARTIFACT_INVALID");
  if (solanaVerifyBinarySha256 !== SOLANA_VERIFY_LINUX_SHA256) reasons.push("SOLANA_VERIFY_BINARY_HASH_MISMATCH");
  if (isRecord(sourceA) && isRecord(sourceB)) {
    if (sourceA.sourceCommit !== sourceB.sourceCommit || sourceA.sourceTree !== sourceB.sourceTree) reasons.push("BUILDS_USED_DIFFERENT_SOURCE");
    if (JSON.stringify(sourceA.buildInputSha256) !== JSON.stringify(sourceB.buildInputSha256)) reasons.push("BUILD_INPUT_DIGESTS_DIFFER");
  }
  const hashesEqual = artifactA?.valid === true && artifactB?.valid === true && artifactA.sha256 === artifactB.sha256;
  const lengthsEqual = artifactA?.valid === true && artifactB?.valid === true && artifactA.byteLength === artifactB.byteLength;
  if (artifactA?.valid === true && artifactB?.valid === true && !hashesEqual) reasons.push("INDEPENDENT_BUILD_HASHES_DIFFER");
  if (artifactA?.valid === true && artifactB?.valid === true && !lengthsEqual) reasons.push("INDEPENDENT_BUILD_LENGTHS_DIFFER");

  const pass = reasons.length === 0 && hashesEqual && lengthsEqual;
  return {
    schemaVersion: "ata.phase6.raydium-reference-build-evidence.v1",
    generatedAt,
    scope: "OFFLINE_PINNED_SOURCE_BUILD_ONLY_NO_RPC",
    source: {
      repository: RAYDIUM_SOURCE_REPOSITORY,
      pinnedCommit: RAYDIUM_PINNED_SOURCE_COMMIT,
      pinnedTree: RAYDIUM_PINNED_SOURCE_TREE,
      expectedProgramId: RAYDIUM_PROGRAM_ID,
      libraryName: RAYDIUM_LIBRARY_NAME,
      expectedToolchain: EXPECTED_TOOLCHAIN,
      buildTool: "solana-verify build --library-name raydium_cp_swap",
      solanaVerifyVersion: SOLANA_VERIFY_VERSION,
      solanaVerifyBinarySha256,
      buildRuns: [
        { source: sourceA ?? null, exitCode: buildExitCodeA, artifact: artifactA ?? null },
        { source: sourceB ?? null, exitCode: buildExitCodeB, artifact: artifactB ?? null }
      ]
    },
    reproducibility: {
      sameSha256: hashesEqual,
      sameByteLength: lengthsEqual,
      bothCommandsSucceeded: buildExitCodeA === 0 && buildExitCodeB === 0,
      status: pass ? "REPRODUCIBLE_WITHIN_PINNED_RUNNER" : "NOT_REPRODUCIBLE_OR_INSUFFICIENT_EVIDENCE"
    },
    referenceArtifact: pass ? {
      fileName: RAYDIUM_LIBRARY_NAME + ".so",
      sha256: artifactA.sha256,
      byteLength: artifactA.byteLength
    } : null,
    result: {
      status: pass ? "PASS_REPRODUCIBLE_REFERENCE_BUILD" : "BLOCKED",
      reasonCodes: [...new Set(reasons)],
      buildEvidenceAcceptedForManualHashComparison: pass,
      liveProgramCompared: false,
      rpcRequested: false,
      transactionSubmitted: false,
      tradingAuthorized: false
    },
    limitations: [
      "Two identical builds in this workflow establish repeatability inside this pinned runner/toolchain, not independent cross-organization reproducibility.",
      "The result does not compare the built artifact to any live deployed program and does not establish that this source revision is the currently deployed program.",
      "A passing build manifest is a candidate reference artifact only; independently review source provenance and obtain a separate explicit approval before any ProgramData or other live RPC check."
    ]
  };
}

function parseArgs(argv) {
  const allowed = new Set(["--source-a", "--source-b", "--artifact-a", "--artifact-b", "--build-a-exit", "--build-b-exit", "--solana-verify-binary", "--output"]);
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!allowed.has(key) || out[key] !== undefined || !argv[i + 1] || argv[i + 1].startsWith("--")) {
      throw new Error("BUILD_EVIDENCE_ARGUMENTS_INVALID");
    }
    out[key] = argv[i + 1];
    i += 1;
  }
  for (const key of allowed) if (out[key] === undefined) throw new Error("BUILD_EVIDENCE_ARGUMENT_REQUIRED_" + key.slice(2).replace(/-/g, "_").toUpperCase());
  return out;
}

export function collectRaydiumBuildEvidence(args, now = () => new Date().toISOString()) {
  const sourceA = inspectRaydiumSourceDirectory(args["--source-a"]);
  const sourceB = inspectRaydiumSourceDirectory(args["--source-b"]);
  const artifactA = inspectArtifactPath(args["--artifact-a"]);
  const artifactB = inspectArtifactPath(args["--artifact-b"]);
  const exitA = Number(args["--build-a-exit"]);
  const exitB = Number(args["--build-b-exit"]);
  const binary = inspectArtifactPath(args["--solana-verify-binary"]);
  const binarySha = binary.valid ? binary.sha256 : null;
  const report = evaluateRaydiumBuildEvidence({
    sourceA, sourceB, artifactA, artifactB,
    buildExitCodeA: Number.isSafeInteger(exitA) ? exitA : -1,
    buildExitCodeB: Number.isSafeInteger(exitB) ? exitB : -1,
    solanaVerifyBinarySha256: binarySha,
    generatedAt: now()
  });
  return report;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  const report = collectRaydiumBuildEvidence(args);
  const output = JSON.stringify(report, null, 2) + "\n";
  const destination = resolve(args["--output"]);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, output, { encoding: "utf8", flag: "w", mode: 0o600 });
  console.log(JSON.stringify({
    status: report.result.status,
    reasonCodes: report.result.reasonCodes,
    referenceArtifact: report.referenceArtifact,
    liveProgramCompared: false,
    tradingAuthorized: false
  }, null, 2));
  return report.result.status === "PASS_REPRODUCIBLE_REFERENCE_BUILD" ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    process.exitCode = main();
  } catch (error) {
    const code = typeof error?.message === "string" && /^[A-Z0-9_-]{1,100}$/.test(error.message)
      ? error.message : "BUILD_EVIDENCE_GENERATION_FAILED";
    console.error("Reference build evidence generation stopped safely: " + code + ".");
    process.exitCode = 2;
  }
}
