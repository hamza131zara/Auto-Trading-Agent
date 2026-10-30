import { createHash } from "node:crypto";
import { lstatSync, readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const MIGRATION_FILE_PATTERN = /^([0-9]{8})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const MAX_MIGRATION_BYTES = 5 * 1024 * 1024;

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, expected) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function isValidUtcDatePrefix(value) {
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(4, 6));
  const day = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  return Number.isFinite(date.getTime()) &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day;
}

function blocked(errors, extra = {}) {
  return {
    ok: false,
    status: "BLOCKED",
    errors,
    migrationExecutionAuthorized: false,
    providerActivationAuthorized: false,
    tradingAuthorized: false,
    ...extra
  };
}

export function inspectMigrationSet(options = {}) {
  const migrationDirectory = options.migrationDirectory ?? join(process.cwd(), "infra", "migrations");
  const errors = [];
  let directoryEntries;

  try {
    const directoryStat = lstatSync(migrationDirectory);
    if (directoryStat.isSymbolicLink() || !directoryStat.isDirectory()) {
      return blocked(["Migration directory must be a real, non-symlink directory."]);
    }
    directoryEntries = readdirSync(migrationDirectory, { withFileTypes: true })
      .sort((left, right) => left.name < right.name ? -1 : left.name > right.name ? 1 : 0);
  } catch {
    return blocked(["Migration directory is missing or cannot be inspected."]);
  }

  const sqlFiles = [];
  let manifestIsRegularFile = false;

  for (const entry of directoryEntries) {
    if (entry.name === "manifest.json") {
      if (entry.isFile() && !entry.isSymbolicLink()) manifestIsRegularFile = true;
      else errors.push("manifest.json must be a regular, non-symlink file.");
      continue;
    }

    if (entry.isSymbolicLink() || !entry.isFile()) {
      errors.push("Migration directory may contain only regular SQL files and manifest.json: " + entry.name);
      continue;
    }

    if (!entry.name.endsWith(".sql")) {
      errors.push("Unexpected file in migration directory: " + entry.name);
      continue;
    }

    const match = MIGRATION_FILE_PATTERN.exec(entry.name);
    if (!match || !isValidUtcDatePrefix(match[1])) {
      errors.push("Migration filename must use a valid YYYYMMDD_description.sql name: " + entry.name);
      continue;
    }

    const filePath = join(migrationDirectory, entry.name);
    try {
      const fileStat = lstatSync(filePath);
      if (fileStat.isSymbolicLink() || !fileStat.isFile()) {
        errors.push("Migration must be a regular, non-symlink file: " + entry.name);
        continue;
      }
      if (fileStat.size > MAX_MIGRATION_BYTES) {
        errors.push("Migration exceeds the 5 MiB inventory limit: " + entry.name);
        continue;
      }
      const bytes = readFileSync(filePath);
      sqlFiles.push({
        id: entry.name.slice(0, -4),
        file: entry.name,
        sha256: sha256(bytes)
      });
    } catch {
      errors.push("Migration could not be read: " + entry.name);
    }
  }

  if (!manifestIsRegularFile) {
    errors.push("A regular infra/migrations/manifest.json is required.");
  }
  if (sqlFiles.length === 0) {
    errors.push("At least one dated SQL migration is required.");
  }

  let manifest;
  if (manifestIsRegularFile) {
    try {
      manifest = JSON.parse(readFileSync(join(migrationDirectory, "manifest.json"), "utf8"));
    } catch {
      errors.push("Migration manifest is not valid readable JSON.");
    }
  }

  if (!isRecord(manifest)) {
    if (manifest !== undefined) errors.push("Migration manifest must be a JSON object.");
    return blocked(errors);
  }

  if (!exactKeys(manifest, ["schemaVersion", "algorithm", "migrations"])) {
    errors.push("Migration manifest must contain only schemaVersion, algorithm and migrations.");
  }
  if (manifest.schemaVersion !== 1) errors.push("Unsupported migration manifest schemaVersion; expected 1.");
  if (manifest.algorithm !== "sha256") errors.push("Migration manifest algorithm must be sha256.");
  if (!Array.isArray(manifest.migrations)) {
    errors.push("Migration manifest migrations must be an array.");
    return blocked(errors);
  }

  const seenIds = new Set();
  const seenFiles = new Set();
  const normalized = [];

  for (let index = 0; index < manifest.migrations.length; index += 1) {
    const item = manifest.migrations[index];
    const label = "manifest.migrations[" + index + "]";
    if (!exactKeys(item, ["id", "file", "sha256", "executionMode"])) {
      errors.push(label + " must contain only id, file, sha256 and executionMode.");
      continue;
    }

    if (typeof item.file !== "string" || basename(item.file) !== item.file ||
        item.file.includes("/") || item.file.includes("\\")) {
      errors.push(label + ".file must be a direct-child filename.");
      continue;
    }

    const match = MIGRATION_FILE_PATTERN.exec(item.file);
    if (!match || !isValidUtcDatePrefix(match[1]) || item.id !== item.file.slice(0, -4)) {
      errors.push(label + " has an invalid or mismatched migration id/filename.");
      continue;
    }
    if (seenIds.has(item.id)) errors.push("Duplicate migration id: " + item.id);
    if (seenFiles.has(item.file)) errors.push("Duplicate migration filename: " + item.file);
    seenIds.add(item.id);
    seenFiles.add(item.file);

    if (typeof item.sha256 !== "string" || !SHA256_PATTERN.test(item.sha256)) {
      errors.push(label + ".sha256 must be a lowercase 64-character SHA-256 digest.");
    }
    if (item.executionMode !== "transactional") {
      errors.push(label + ".executionMode must be transactional; other modes require a separately reviewed control.");
    }
    normalized.push({
      id: item.id,
      file: item.file,
      sha256: item.sha256,
      executionMode: item.executionMode
    });
  }

  const actualFiles = sqlFiles.map((item) => item.file);
  const manifestFiles = normalized.map((item) => item.file);
  if (manifestFiles.join("\n") !== [...manifestFiles].sort((a, b) => a < b ? -1 : a > b ? 1 : 0).join("\n")) {
    errors.push("Manifest migrations must be ordered lexicographically by dated filename.");
  }
  if (manifestFiles.join("\n") !== actualFiles.join("\n")) {
    errors.push("Manifest inventory must match the SQL directory exactly; missing and untracked migrations are blocked.");
  }

  const actualByFile = new Map(sqlFiles.map((item) => [item.file, item]));
  for (const item of normalized) {
    const actual = actualByFile.get(item.file);
    if (actual && actual.sha256 !== item.sha256) {
      errors.push("SHA-256 drift detected for migration: " + item.file);
    }
  }

  const uniqueIdCount = new Set(normalized.map((item) => item.id)).size;
  if (uniqueIdCount !== normalized.length) {
    errors.push("Migration identifiers must be unique.");
  }

  if (errors.length > 0) return blocked(errors);

  const canonicalPayload = JSON.stringify({
    schemaVersion: 1,
    algorithm: "sha256",
    migrations: normalized
  });
  const migrationSetSha256 = sha256(canonicalPayload);

  return {
    ok: true,
    status: "MIGRATION_INTEGRITY_VERIFIED",
    migrationCount: normalized.length,
    migrations: normalized,
    migrationSetSha256,
    migrationExecutionAuthorized: false,
    providerActivationAuthorized: false,
    tradingAuthorized: false
  };
}

function requireString(value, path, errors) {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 512) {
    errors.push(path + " must be a non-empty string of at most 512 characters.");
    return false;
  }
  return true;
}

function requireTimestamp(value, path, errors) {
  const match = typeof value === "string"
    ? /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value)
    : null;
  if (!match) {
    errors.push(path + " must be an ISO-8601 timestamp with an explicit timezone.");
    return false;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const zoneHour = match[8] ? Number(match[8]) : 0;
  const zoneMinute = match[9] ? Number(match[9]) : 0;
  const calendar = new Date(Date.UTC(year, month - 1, day));
  const validCalendar = calendar.getUTCFullYear() === year &&
    calendar.getUTCMonth() === month - 1 &&
    calendar.getUTCDate() === day;
  const validClock = hour <= 23 && minute <= 59 && second <= 59;
  const validZone = zoneHour <= 14 && zoneMinute <= 59 &&
    !(zoneHour === 14 && zoneMinute !== 0);
  if (!validCalendar || !validClock || !validZone || !Number.isFinite(Date.parse(value))) {
    errors.push(path + " must be a real calendar timestamp with a valid explicit timezone.");
    return false;
  }
  return true;
}

function checkObject(value, keys, path, errors) {
  if (!exactKeys(value, keys)) {
    errors.push(path + " must be an object with exactly these fields: " + keys.join(", ") + ".");
    return false;
  }
  return true;
}

function scanForCredentialMaterial(value, path, errors) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => scanForCredentialMaterial(item, path + "[" + index + "]", errors));
    return;
  }
  if (!isRecord(value)) {
    if (typeof value === "string" &&
        /(postgres(?:ql)?:\/\/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\b(?:gh[pousr]_|sk_live_|AKIA[0-9A-Z]{16}))/i.test(value)) {
      errors.push(path + " appears to contain connection or credential material.");
    }
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (/(?:password|secret|private.?key|seed.?phrase|api.?key|connection.?string|wallet.?secret|signing.?key)/i.test(key)) {
      errors.push(path + "." + key + " is a prohibited credential-bearing field.");
    }
    scanForCredentialMaterial(item, path + "." + key, errors);
  }
}

export function evaluateMigrationReleasePacket(packet, options = {}) {
  const errors = [];
  const expectedDigest = options.migrationSetSha256;
  if (typeof expectedDigest !== "string" || !SHA256_PATTERN.test(expectedDigest)) {
    errors.push("A verified migration-set SHA-256 digest is required.");
  }
  if (!isRecord(packet)) {
    return blocked(["Release packet must be a JSON object."]);
  }

  scanForCredentialMaterial(packet, "packet", errors);
  checkObject(packet, [
    "schemaVersion", "changeId", "environment", "migrationSetSha256",
    "target", "preconditions", "approvals", "maintenanceWindow", "recovery"
  ], "packet", errors);

  if (packet.schemaVersion !== 1) errors.push("Release packet schemaVersion must be 1.");
  if (typeof packet.changeId !== "string" || !/^[A-Z][A-Z0-9-]{4,63}$/.test(packet.changeId)) {
    errors.push("changeId must be a stable change-control identifier.");
  }
  if (!["staging", "production"].includes(packet.environment)) {
    errors.push("environment must be staging or production.");
  }
  if (packet.migrationSetSha256 !== expectedDigest) {
    errors.push("Release packet migrationSetSha256 does not match the verified repository migration set.");
  }

  const targetKeys = [
    "environmentRef", "clusterRef", "databaseRef", "currentSchemaVersion", "targetApplicationReleaseRef"
  ];
  if (checkObject(packet.target, targetKeys, "target", errors)) {
    for (const key of targetKeys) requireString(packet.target[key], "target." + key, errors);
  }

  const preconditionKeys = [
    "backup", "restoreDrill", "writersQuiesced", "migrationRoleSeparated",
    "tlsVerifyFullReviewed", "runtimeRoleReviewRef", "tlsReviewRef"
  ];
  if (checkObject(packet.preconditions, preconditionKeys, "preconditions", errors)) {
    const pre = packet.preconditions;
    if (checkObject(pre.backup, ["reference", "sha256", "verifiedAt"], "preconditions.backup", errors)) {
      requireString(pre.backup.reference, "preconditions.backup.reference", errors);
      if (typeof pre.backup.sha256 !== "string" || !SHA256_PATTERN.test(pre.backup.sha256)) {
        errors.push("preconditions.backup.sha256 must be a lowercase SHA-256 digest.");
      }
      requireTimestamp(pre.backup.verifiedAt, "preconditions.backup.verifiedAt", errors);
    }
    if (checkObject(pre.restoreDrill, ["reference", "verifiedAt"], "preconditions.restoreDrill", errors)) {
      requireString(pre.restoreDrill.reference, "preconditions.restoreDrill.reference", errors);
      requireTimestamp(pre.restoreDrill.verifiedAt, "preconditions.restoreDrill.verifiedAt", errors);
    }
    if (pre.writersQuiesced !== true) errors.push("writersQuiesced must be explicitly true.");
    if (pre.migrationRoleSeparated !== true) errors.push("migrationRoleSeparated must be explicitly true.");
    if (pre.tlsVerifyFullReviewed !== true) errors.push("tlsVerifyFullReviewed must be explicitly true.");
    requireString(pre.runtimeRoleReviewRef, "preconditions.runtimeRoleReviewRef", errors);
    requireString(pre.tlsReviewRef, "preconditions.tlsReviewRef", errors);
  }

  if (!Array.isArray(packet.approvals) || packet.approvals.length !== 2) {
    errors.push("Exactly two approval records are required: change-owner and database-operator.");
  } else {
    const requiredRoles = new Set(["change-owner", "database-operator"]);
    const approvers = new Set();
    const roles = new Set();
    for (let index = 0; index < packet.approvals.length; index += 1) {
      const approval = packet.approvals[index];
      const path = "approvals[" + index + "]";
      if (!checkObject(approval, ["role", "approverRef", "evidenceRef", "approvedAt"], path, errors)) continue;
      if (!requiredRoles.has(approval.role)) errors.push(path + ".role is unsupported.");
      if (roles.has(approval.role)) errors.push("Approval roles must not be duplicated.");
      roles.add(approval.role);
      requireString(approval.approverRef, path + ".approverRef", errors);
      requireString(approval.evidenceRef, path + ".evidenceRef", errors);
      requireTimestamp(approval.approvedAt, path + ".approvedAt", errors);
      if (typeof approval.approverRef === "string") {
        if (approvers.has(approval.approverRef)) errors.push("Change owner and database operator must be different approvers.");
        approvers.add(approval.approverRef);
      }
    }
    for (const role of requiredRoles) {
      if (!roles.has(role)) errors.push("Missing required approval role: " + role + ".");
    }
  }

  if (checkObject(packet.maintenanceWindow, ["startsAt", "endsAt"], "maintenanceWindow", errors)) {
    const startValid = requireTimestamp(packet.maintenanceWindow.startsAt, "maintenanceWindow.startsAt", errors);
    const endValid = requireTimestamp(packet.maintenanceWindow.endsAt, "maintenanceWindow.endsAt", errors);
    if (startValid && endValid &&
        Date.parse(packet.maintenanceWindow.endsAt) <= Date.parse(packet.maintenanceWindow.startsAt)) {
      errors.push("Maintenance-window endsAt must be later than startsAt.");
    }
  }

  const recoveryKeys = [
    "strategy", "ownerRef", "runbookRef", "preserveLeaseFencingCounters", "noAutomaticDownMigration"
  ];
  if (checkObject(packet.recovery, recoveryKeys, "recovery", errors)) {
    if (!["forward-fix", "restore-and-cutover"].includes(packet.recovery.strategy)) {
      errors.push("recovery.strategy must be forward-fix or restore-and-cutover.");
    }
    requireString(packet.recovery.ownerRef, "recovery.ownerRef", errors);
    requireString(packet.recovery.runbookRef, "recovery.runbookRef", errors);
    if (packet.recovery.preserveLeaseFencingCounters !== true) {
      errors.push("Recovery must explicitly preserve monotonically increasing lease-fencing counters.");
    }
    if (packet.recovery.noAutomaticDownMigration !== true) {
      errors.push("Automatic/destructive down migrations are prohibited.");
    }
  }

  if (errors.length > 0) return blocked(errors);

  return {
    ok: true,
    status: "TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED",
    changeId: packet.changeId,
    environment: packet.environment,
    migrationSetSha256: expectedDigest,
    approverEvidenceRecords: 2,
    migrationExecutionAuthorized: false,
    providerActivationAuthorized: false,
    tradingAuthorized: false,
    notice: "References and attestations are structurally complete only; identity, signatures, evidence contents and actual approval must be independently verified by people."
  };
}
