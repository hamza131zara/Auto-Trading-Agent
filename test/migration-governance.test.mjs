import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  evaluateMigrationReleasePacket,
  inspectMigrationSet
} from "../scripts/lib/migration-governance.mjs";

const repositoryInventory = inspectMigrationSet();

async function withFixture(run) {
  const directory = await mkdtemp(join(tmpdir(), "ata-migration-governance-"));
  try {
    await run(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

function digest(content) {
  return createHash("sha256").update(content).digest("hex");
}

async function writeManifest(directory, entries) {
  await writeFile(join(directory, "manifest.json"), JSON.stringify({
    schemaVersion: 1,
    algorithm: "sha256",
    migrations: entries
  }, null, 2) + "\n");
}

async function addMigration(directory, file, content) {
  await writeFile(join(directory, file), content);
  return {
    id: file.slice(0, -4),
    file,
    sha256: digest(content),
    executionMode: "transactional"
  };
}

function validReleasePacket(migrationSetSha256) {
  return {
    schemaVersion: 1,
    changeId: "CHG-2026-033",
    environment: "staging",
    migrationSetSha256,
    target: {
      environmentRef: "env-staging-01",
      clusterRef: "cluster-staging-01",
      databaseRef: "database-staging-01",
      currentSchemaVersion: "20261030_phase6_provider_health_and_recovery_leases",
      targetApplicationReleaseRef: "release-2026.10.30.1"
    },
    preconditions: {
      backup: {
        reference: "evidence://backup/verified-001",
        sha256: "a".repeat(64),
        verifiedAt: "2030-01-01T08:00:00Z"
      },
      restoreDrill: {
        reference: "evidence://restore-drill/verified-001",
        verifiedAt: "2030-01-01T08:30:00Z"
      },
      writersQuiesced: true,
      migrationRoleSeparated: true,
      tlsVerifyFullReviewed: true,
      runtimeRoleReviewRef: "evidence://roles/review-001",
      tlsReviewRef: "evidence://tls/review-001"
    },
    approvals: [
      {
        role: "change-owner",
        approverRef: "person/change-owner",
        evidenceRef: "evidence://approvals/change-owner-001",
        approvedAt: "2030-01-01T09:00:00Z"
      },
      {
        role: "database-operator",
        approverRef: "person/database-operator",
        evidenceRef: "evidence://approvals/database-operator-001",
        approvedAt: "2030-01-01T09:05:00Z"
      }
    ],
    maintenanceWindow: {
      startsAt: "2030-01-02T01:00:00Z",
      endsAt: "2030-01-02T02:00:00Z"
    },
    recovery: {
      strategy: "forward-fix",
      ownerRef: "person/recovery-owner",
      runbookRef: "docs/phase-6/33-migration-governance-and-deployment-preflight.md",
      preserveLeaseFencingCounters: true,
      noAutomaticDownMigration: true
    }
  };
}

test("committed migration inventory matches its SHA-256 manifest", () => {
  assert.equal(repositoryInventory.ok, true, repositoryInventory.errors?.join("; "));
  assert.equal(repositoryInventory.status, "MIGRATION_INTEGRITY_VERIFIED");
  assert.equal(repositoryInventory.migrationCount, 1);
  assert.equal(repositoryInventory.migrations[0].id,
    "20261030_phase6_provider_health_and_recovery_leases");
  assert.equal(repositoryInventory.migrations[0].sha256,
    "e288aad04067efc2abdc9565c3e1095c9823244cedb7d592a155fd50406c21d6");
  assert.equal(repositoryInventory.migrationExecutionAuthorized, false);
  assert.equal(repositoryInventory.tradingAuthorized, false);
});

test("SQL edits without a manifest update are blocked as checksum drift", async () => {
  await withFixture(async (directory) => {
    const file = "20261030_initial.sql";
    const entry = await addMigration(directory, file, "CREATE TABLE sample (id integer);\n");
    await writeManifest(directory, [entry]);
    await writeFile(join(directory, file), "CREATE TABLE sample (id bigint);\n");
    const result = inspectMigrationSet({ migrationDirectory: directory });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("SHA-256 drift")));
  });
});

test("manifest ordering and inventory must exactly match the dated SQL files", async () => {
  await withFixture(async (directory) => {
    const first = await addMigration(directory, "20261030_first.sql", "SELECT 1;\n");
    const second = await addMigration(directory, "20261031_second.sql", "SELECT 2;\n");
    await writeManifest(directory, [second, first]);
    const result = inspectMigrationSet({ migrationDirectory: directory });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("ordered lexicographically")));
  });
});

test("duplicate identifiers and missing manifest entries are blocked", async () => {
  await withFixture(async (directory) => {
    const first = await addMigration(directory, "20261030_first.sql", "SELECT 1;\n");
    await addMigration(directory, "20261031_second.sql", "SELECT 2;\n");
    await writeManifest(directory, [first, { ...first }]);
    const result = inspectMigrationSet({ migrationDirectory: directory });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("Duplicate migration id")));
    assert.ok(result.errors.some((error) => error.includes("inventory must match")));
  });
});

test("unsafe manifest paths are blocked", async () => {
  await withFixture(async (directory) => {
    const entry = await addMigration(directory, "20261030_initial.sql", "SELECT 1;\n");
    await writeManifest(directory, [{ ...entry, file: "../20261030_initial.sql" }]);
    const result = inspectMigrationSet({ migrationDirectory: directory });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("direct-child filename")));
  });
});

test("unsupported non-transactional execution declarations are blocked", async () => {
  await withFixture(async (directory) => {
    const entry = await addMigration(directory, "20261030_initial.sql", "SELECT 1;\n");
    await writeManifest(directory, [{ ...entry, executionMode: "manual-nontransactional" }]);
    const result = inspectMigrationSet({ migrationDirectory: directory });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("executionMode must be transactional")));
  });
});

test("unknown files, directories and symlinks in the migration folder are blocked", async () => {
  await withFixture(async (directory) => {
    const entry = await addMigration(directory, "20261030_initial.sql", "SELECT 1;\n");
    await writeManifest(directory, [entry]);
    await writeFile(join(directory, "notes.txt"), "not a migration\n");
    await mkdir(join(directory, "nested"));
    const result = inspectMigrationSet({ migrationDirectory: directory });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("Unexpected file")));
    assert.ok(result.errors.some((error) => error.includes("only regular SQL files")));
  });
});

test("a migration symlink is rejected without following it", async () => {
  await withFixture(async (directory) => {
    const entry = await addMigration(directory, "20261030_initial.sql", "SELECT 1;\n");
    await writeManifest(directory, [entry]);
    await symlink(join(directory, "20261030_initial.sql"), join(directory, "20261031_link.sql"));
    const result = inspectMigrationSet({ migrationDirectory: directory });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((error) => error.includes("only regular SQL files")));
  });
});

test("release packet preflight checks required controls but never authorizes execution", () => {
  assert.equal(repositoryInventory.ok, true);
  const packet = validReleasePacket(repositoryInventory.migrationSetSha256);
  const result = evaluateMigrationReleasePacket(packet, {
    migrationSetSha256: repositoryInventory.migrationSetSha256
  });
  assert.equal(result.ok, true, result.errors?.join("; "));
  assert.equal(result.status, "TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED");
  assert.equal(result.migrationExecutionAuthorized, false);
  assert.equal(result.providerActivationAuthorized, false);
  assert.equal(result.tradingAuthorized, false);
});

test("release packet rejects migration-set mismatch and missing backup evidence", () => {
  const packet = validReleasePacket(repositoryInventory.migrationSetSha256);
  packet.migrationSetSha256 = "b".repeat(64);
  packet.preconditions.backup.reference = "";
  const result = evaluateMigrationReleasePacket(packet, {
    migrationSetSha256: repositoryInventory.migrationSetSha256
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("does not match")));
  assert.ok(result.errors.some((error) => error.includes("backup.reference")));
});

test("release packet accepts valid numeric UTC offsets", () => {
  const packet = validReleasePacket(repositoryInventory.migrationSetSha256);
  packet.preconditions.backup.verifiedAt = "2030-01-01T13:00:00+05:00";
  const result = evaluateMigrationReleasePacket(packet, {
    migrationSetSha256: repositoryInventory.migrationSetSha256
  });
  assert.equal(result.ok, true, result.errors?.join("; "));
});

test("release packet rejects impossible calendar timestamps", () => {
  const packet = validReleasePacket(repositoryInventory.migrationSetSha256);
  packet.maintenanceWindow.startsAt = "2030-02-31T01:00:00Z";
  const result = evaluateMigrationReleasePacket(packet, {
    migrationSetSha256: repositoryInventory.migrationSetSha256
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("real calendar timestamp")));
});

test("release packet requires independent owner and database-operator approvers", () => {
  const packet = validReleasePacket(repositoryInventory.migrationSetSha256);
  packet.approvals[1].approverRef = packet.approvals[0].approverRef;
  const result = evaluateMigrationReleasePacket(packet, {
    migrationSetSha256: repositoryInventory.migrationSetSha256
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("different approvers")));
});

test("release packet prohibits automatic down migrations and fencing-counter loss", () => {
  const packet = validReleasePacket(repositoryInventory.migrationSetSha256);
  packet.recovery.noAutomaticDownMigration = false;
  packet.recovery.preserveLeaseFencingCounters = false;
  const result = evaluateMigrationReleasePacket(packet, {
    migrationSetSha256: repositoryInventory.migrationSetSha256
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("fencing counters")));
  assert.ok(result.errors.some((error) => error.includes("down migrations")));
});

test("release packet rejects credential-bearing fields and connection strings", () => {
  const packet = validReleasePacket(repositoryInventory.migrationSetSha256);
  packet.target.connectionString = "postgres://user:password@example.invalid/db";
  const result = evaluateMigrationReleasePacket(packet, {
    migrationSetSha256: repositoryInventory.migrationSetSha256
  });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("credential-bearing")));
  assert.ok(result.errors.some((error) => error.includes("connection or credential")));
});
