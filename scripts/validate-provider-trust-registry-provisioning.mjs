#!/usr/bin/env node
import {
  existsSync,
  lstatSync,
  readFileSync,
  realpathSync
} from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { inspectMigrationSet } from "./lib/migration-governance.mjs";
import {
  validateProviderTrustRegistryProvisioningPacket
} from "./lib/provider-trust-registry-provisioning.mjs";

const MAX_PACKET_BYTES = 64 * 1024;
const currentFile = fileURLToPath(import.meta.url);
const repositoryRoot = realpathSync(resolve(dirname(currentFile), ".."));

function within(root, candidate) {
  const fromRoot = relative(root, candidate);
  return fromRoot === "" ||
    (fromRoot !== ".." &&
      !fromRoot.startsWith(".." + sep) &&
      !isAbsolute(fromRoot));
}

function readPrivatePacket(pathValue) {
  if (typeof pathValue !== "string" || pathValue.trim().length === 0) {
    throw new Error("A provisioning packet path is required.");
  }
  const requested = resolve(pathValue);
  const entry = lstatSync(requested);
  if (entry.isSymbolicLink() || !entry.isFile()) {
    throw new Error("Provisioning packet must be a regular, non-symlink JSON file.");
  }
  const actual = realpathSync(requested);
  if (within(repositoryRoot, actual)) {
    throw new Error("Provisioning packet must remain outside the Git working tree.");
  }
  if (entry.size < 1 || entry.size > MAX_PACKET_BYTES) {
    throw new Error("Provisioning packet must be between 1 byte and 64 KiB.");
  }
  const bytes = readFileSync(actual);
  if (bytes.byteLength !== entry.size || bytes.byteLength > MAX_PACKET_BYTES) {
    throw new Error("Provisioning packet size changed or exceeds the 64 KiB limit.");
  }
  let packet;
  try {
    packet = JSON.parse(bytes.toString("utf8"));
  } catch {
    throw new Error("Provisioning packet is not valid JSON.");
  }
  return packet;
}

function parseArguments(argv) {
  const result = { input: null, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "--help" || value === "-h") {
      result.help = true;
    } else if (value === "--input" && argv[index + 1]) {
      result.input = argv[++index];
    } else {
      throw new Error("Unknown or incomplete command-line argument.");
    }
  }
  return result;
}

if (process.argv[1] && resolve(process.argv[1]) === currentFile) {
  try {
    const args = parseArguments(process.argv.slice(2));
    if (args.help) {
      console.log("Usage: node scripts/validate-provider-trust-registry-provisioning.mjs --input <private-packet.json>");
      console.log("Runs an offline, review-required trust-registry provisioning preflight. It never writes configuration, calls a service, enables providers or authorizes trading.");
    } else {
      if (!args.input) throw new Error("--input is required.");
      const packet = readPrivatePacket(args.input);
      const migrationInventory = inspectMigrationSet();
      const report = validateProviderTrustRegistryProvisioningPacket(packet, {
        migrationInventory
      });
      // Never print the endpoint, DNS allowlist, trust-anchor fingerprint or evidence references.
      console.log(JSON.stringify({
        valid: report.valid,
        status: report.status,
        reasonCodes: report.reasonCodes,
        environment: report.environment ?? null,
        changeId: report.changeId ?? null,
        migrationId: report.migrationId ?? null,
        migrationSha256: report.migrationSha256 ?? null,
        deploymentDescriptorSha256: report.deploymentDescriptorSha256 ?? null,
        registryProvisioningAuthorized: false,
        providerActivationAuthorized: false,
        tradingAuthorized: false
      }, null, 2));
      if (!report.valid) process.exitCode = 1;
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Provisioning packet validation failed.");
    process.exitCode = 2;
  }
}
