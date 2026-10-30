#!/usr/bin/env node
import { createHash } from "node:crypto";
import {
  closeSync,
  existsSync,
  fchmodSync,
  lstatSync,
  openSync,
  readFileSync,
  realpathSync,
  statSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProviderEvidenceManifest } from "./validate-provider-evidence-manifest.mjs";

export const MAX_PROVIDER_EVIDENCE_ARTIFACT_BYTES = 50 * 1024 * 1024;
export const MAX_PROVIDER_EVIDENCE_TOTAL_BYTES = 200 * 1024 * 1024;

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

export class ProviderEvidenceManifestPackagingError extends Error {
  constructor(message, exitCode = 2) {
    super(message);
    this.name = "ProviderEvidenceManifestPackagingError";
    this.exitCode = exitCode;
  }
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isWithin(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" ||
    (pathFromRoot !== ".." &&
      !pathFromRoot.startsWith(".." + sep) &&
      !isAbsolute(pathFromRoot));
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

function resolveArtifactRoot(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ProviderEvidenceManifestPackagingError("--artifact-root is required when a manifest contains LOCAL_FILE artifacts.");
  }
  const requested = resolve(value);
  const entry = lstatSync(requested);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new ProviderEvidenceManifestPackagingError("Artifact root must be a real directory, not a symlink.");
  }
  return realpathSync(requested);
}

function hashLocalArtifact(root, locator, label) {
  if (typeof locator !== "string" ||
      locator.length === 0 ||
      isAbsolute(locator) ||
      locator.includes("\\") ||
      locator.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new ProviderEvidenceManifestPackagingError(label + " has an unsafe LOCAL_FILE locator.");
  }

  let current = root;
  const parts = locator.split("/");
  for (let index = 0; index < parts.length; index += 1) {
    current = join(current, parts[index]);
    const entry = lstatSync(current);
    if (entry.isSymbolicLink()) {
      throw new ProviderEvidenceManifestPackagingError(label + " resolves through a symlink; symlinked evidence is not accepted.");
    }
    if (index < parts.length - 1 && !entry.isDirectory()) {
      throw new ProviderEvidenceManifestPackagingError(label + " contains a non-directory path segment.");
    }
    if (index === parts.length - 1 && !entry.isFile()) {
      throw new ProviderEvidenceManifestPackagingError(label + " must reference a regular file.");
    }
  }

  const realTarget = realpathSync(current);
  if (!isWithin(root, realTarget)) {
    throw new ProviderEvidenceManifestPackagingError(label + " resolves outside the artifact root.");
  }

  const before = statSync(realTarget);
  if (before.size > MAX_PROVIDER_EVIDENCE_ARTIFACT_BYTES) {
    throw new ProviderEvidenceManifestPackagingError(label + " exceeds the 50 MiB per-artifact limit.");
  }
  const bytes = readFileSync(realTarget);
  const after = statSync(realTarget);
  if (bytes.length !== before.size || before.size !== after.size || before.mtimeMs !== after.mtimeMs) {
    throw new ProviderEvidenceManifestPackagingError(label + " changed while being packaged; retry with a stable artifact.");
  }

  return {
    sha256: createHash("sha256").update(bytes).digest("hex"),
    byteLength: bytes.length
  };
}

export function prepareProviderEvidenceManifest(input, options = {}) {
  if (!isRecord(input)) {
    throw new ProviderEvidenceManifestPackagingError("Input manifest must be a JSON object.");
  }

  const forbidden = collectForbiddenKeys(input);
  if (forbidden.length > 0) {
    throw new ProviderEvidenceManifestPackagingError(
      "Manifest contains credential-bearing field names; remove them before packaging."
    );
  }

  const manifest = JSON.parse(JSON.stringify(input));
  const records = Array.isArray(manifest.records) ? manifest.records : [];
  const hasLocalArtifacts = records.some((record) =>
    isRecord(record) && isRecord(record.artifact) && record.artifact.storage === "LOCAL_FILE");
  const artifactRoot = hasLocalArtifacts ? resolveArtifactRoot(options.artifactRoot) : null;
  let localArtifactCount = 0;
  let totalBytes = 0;

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!isRecord(record) || !isRecord(record.artifact) || record.artifact.storage !== "LOCAL_FILE") continue;

    const label = "Record " + index + " (" + (record.evidenceId ?? "unknown evidence ID") + ")";
    const result = hashLocalArtifact(artifactRoot, record.artifact.locator, label);
    if (typeof record.artifact.sha256 === "string" &&
        record.artifact.sha256.toLowerCase() !== result.sha256) {
      throw new ProviderEvidenceManifestPackagingError(label + " supplied SHA-256 does not match the artifact bytes.");
    }
    totalBytes += result.byteLength;
    if (totalBytes > MAX_PROVIDER_EVIDENCE_TOTAL_BYTES) {
      throw new ProviderEvidenceManifestPackagingError("Local evidence artifacts exceed the 200 MiB combined limit.");
    }
    record.artifact.sha256 = result.sha256;
    localArtifactCount += 1;
  }

  const report = validateProviderEvidenceManifest(manifest, {
    artifactRoot
  });
  if (!report.valid) {
    throw new ProviderEvidenceManifestPackagingError(
      "Manifest is not structurally valid: " + report.reasonCodes.join(", "),
      1
    );
  }

  return {
    manifest,
    report,
    localArtifactCount,
    localArtifactBytes: totalBytes
  };
}

function findRepositoryRoot(startDirectory) {
  let current = resolve(startDirectory);
  while (true) {
    if (existsSync(join(current, ".git"))) return realpathSync(current);
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function assertOutsideRepository(pathValue, label, repositoryRoot) {
  const realPath = realpathSync(pathValue);
  if (repositoryRoot !== null && isWithin(repositoryRoot, realPath)) {
    throw new ProviderEvidenceManifestPackagingError(label + " must be outside the Git working tree.");
  }
  return realPath;
}

function readPrivateInput(pathValue, repositoryRoot) {
  const requested = resolve(pathValue);
  const entry = lstatSync(requested);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new ProviderEvidenceManifestPackagingError("Input must be a regular, non-symlink JSON file.");
  }
  const realPath = assertOutsideRepository(requested, "Input manifest", repositoryRoot);
  return JSON.parse(readFileSync(realPath, "utf8"));
}

function resolvePrivateArtifactRoot(pathValue, repositoryRoot) {
  const requested = resolve(pathValue);
  const entry = lstatSync(requested);
  if (entry.isSymbolicLink() || !entry.isDirectory()) {
    throw new ProviderEvidenceManifestPackagingError("Artifact root must be a real directory, not a symlink.");
  }
  return assertOutsideRepository(requested, "Artifact root", repositoryRoot);
}

function createPrivateOutputPath(pathValue, repositoryRoot) {
  const requested = resolve(pathValue);
  const parent = dirname(requested);
  const parentEntry = lstatSync(parent);
  if (parentEntry.isSymbolicLink() || !parentEntry.isDirectory()) {
    throw new ProviderEvidenceManifestPackagingError("Output parent must be an existing, non-symlink directory.");
  }
  const realParent = realpathSync(parent);
  const target = join(realParent, basename(requested));
  if (repositoryRoot !== null && isWithin(repositoryRoot, target)) {
    throw new ProviderEvidenceManifestPackagingError("Output manifest must be outside the Git working tree.");
  }
  try {
    lstatSync(target);
    throw new ProviderEvidenceManifestPackagingError("Output already exists; refusing to overwrite evidence.");
  } catch (error) {
    if (error instanceof ProviderEvidenceManifestPackagingError) throw error;
    if (error?.code !== "ENOENT") throw error;
  }
  return target;
}

function parseArguments(argv) {
  const args = { input: null, artifactRoot: null, output: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") args.help = true;
    else if (value === "--input" && argv[index + 1]) args.input = argv[++index];
    else if (value === "--artifact-root" && argv[index + 1]) args.artifactRoot = argv[++index];
    else if (value === "--output" && argv[index + 1]) args.output = argv[++index];
    else throw new ProviderEvidenceManifestPackagingError("Unknown or incomplete argument: " + value);
  }
  return args;
}

const currentFile = fileURLToPath(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  try {
    const args = parseArguments(process.argv.slice(2));
    if (args.help) {
      console.log("Usage: node scripts/package-provider-evidence-manifest.mjs --input <draft.json> --artifact-root <private-artifact-directory> --output <private-manifest.json>");
      console.log("Packages LOCAL_FILE SHA-256 values and runs the offline v2 validator. It never approves providers or authorizes trading.");
    } else {
      if (!args.input || !args.artifactRoot || !args.output) {
        throw new ProviderEvidenceManifestPackagingError("--input, --artifact-root and --output are required.");
      }
      const repositoryRoot = findRepositoryRoot(dirname(currentFile));
      const input = readPrivateInput(args.input, repositoryRoot);
      const artifactRoot = resolvePrivateArtifactRoot(args.artifactRoot, repositoryRoot);
      const prepared = prepareProviderEvidenceManifest(input, { artifactRoot });
      const outputPath = createPrivateOutputPath(args.output, repositoryRoot);
      const contents = JSON.stringify(prepared.manifest, null, 2) + "\n";
      const descriptor = openSync(outputPath, "wx", 0o600);
      try {
        writeFileSync(descriptor, contents, { encoding: "utf8" });
        fchmodSync(descriptor, 0o600);
      } finally {
        closeSync(descriptor);
      }
      console.log(JSON.stringify({
        valid: prepared.report.valid,
        status: prepared.report.status,
        recordCount: prepared.report.recordCount,
        localArtifactCount: prepared.localArtifactCount,
        localArtifactBytes: prepared.localArtifactBytes,
        approvalMutationPerformed: prepared.report.approvalMutationPerformed,
        tradingAuthorized: prepared.report.tradingAuthorized,
        outputPath
      }, null, 2));
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Evidence manifest packaging failed.");
    process.exitCode = error instanceof ProviderEvidenceManifestPackagingError ? error.exitCode : 2;
  }
}

