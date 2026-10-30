import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const connectionString = process.env.PG_INTEGRATION_URL;
const REQUIRED = process.env.REQUIRE_PG_RECOVERY_INTEGRATION === "true";
const TOOLS_IMAGE = process.env.PG_BACKUP_RESTORE_IMAGE ?? "postgres:18.6";
const SOURCE_DATABASE = "ata_phase6_test";
const RESTORE_DATABASE = "ata_phase6_restore_test";
const MIGRATION_DATABASE = "ata_phase6_migration_test";

if (REQUIRED && !connectionString) {
  throw new Error("PG_INTEGRATION_URL is required for the PostgreSQL recovery drill");
}
if (REQUIRED && TOOLS_IMAGE !== "postgres:18.6") {
  throw new Error("The PostgreSQL backup/restore client image must remain pinned to postgres:18.6");
}

function parseSafeSourceUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("PG_INTEGRATION_URL must be a valid PostgreSQL URL");
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, "");
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!["postgres:", "postgresql:"].includes(parsed.protocol) ||
      !["localhost", "127.0.0.1", "::1"].includes(host) ||
      database !== SOURCE_DATABASE ||
      (parsed.port !== "" && parsed.port !== "5432") ||
      decodeURIComponent(parsed.username) !== "ata_test" ||
      parsed.search !== "" ||
      parsed.hash !== "") {
    throw new Error("Recovery drill permits only the local ata_test role and ata_phase6_test database on port 5432");
  }
  if (decodeURIComponent(parsed.password).length === 0) {
    throw new Error("Recovery drill requires the disposable test database password from the environment");
  }
  return {
    url: parsed,
    host,
    port: "5432",
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password)
  };
}

function databaseUrl(source, database) {
  const target = new URL(source);
  target.pathname = "/" + database;
  return target.toString();
}

function quoteDisposableDatabase(name) {
  const allowed = new Set([RESTORE_DATABASE, MIGRATION_DATABASE]);
  if (!allowed.has(name)) throw new Error("Refusing an unrecognized recovery-drill database name");
  return '"' + name + '"';
}

function runPostgresTool({ database, tool, args, backupDirectory, connection }) {
  const dockerArgs = [
    "run",
    "--rm",
    "--network=host",
    "--volume", backupDirectory + ":/backup",
    "--env", "PGHOST=" + connection.host,
    "--env", "PGPORT=" + connection.port,
    "--env", "PGUSER=" + connection.user,
    "--env", "PGDATABASE=" + database,
    "--env", "PGPASSWORD",
    TOOLS_IMAGE,
    tool,
    ...args
  ];
  try {
    return execFileSync("docker", dockerArgs, {
      encoding: "utf8",
      timeout: 180_000,
      maxBuffer: 8 * 1024 * 1024,
      env: { ...process.env, PGPASSWORD: connection.password }
    });
  } catch (error) {
    const exitCode = typeof error?.status === "number" ? error.status : "unknown";
    // Docker/driver output may include sensitive connection details; do not echo it.
    throw new Error("Pinned PostgreSQL recovery utility failed (" + tool + ", exit " + exitCode + ").");
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("Phase 6.32 custom-format backup, isolated restore and interrupted-migration recovery", {
  skip: !connectionString
}, async (t) => {
  assert.equal(process.platform, "linux",
    "The pinned Docker host-network recovery drill is supported by the Linux CI runner");
  const connection = parseSafeSourceUrl(connectionString);
  assert.equal(TOOLS_IMAGE, "postgres:18.6");

  const { Pool } = await import("pg");
  const sourcePool = new Pool({
    connectionString,
    max: 2,
    connectionTimeoutMillis: 5_000,
    application_name: "ata-phase6-recovery-source"
  });
  let restorePool = null;
  let migrationPool = null;
  let restoreDatabaseCreated = false;
  let migrationDatabaseCreated = false;
  let providerId = null;
  let backupDirectory = null;

  try {
    const serverVersionResult = await sourcePool.query("SHOW server_version_num");
    const serverVersion = Number(serverVersionResult.rows[0]?.server_version_num);
    assert.ok(Number.isInteger(serverVersion) && serverVersion >= 180006,
      "Recovery source must be PostgreSQL 18.6 or newer in the 18.x major line");
    assert.ok(serverVersion < 190000, "Recovery source must remain on PostgreSQL 18");

    const existing = await sourcePool.query(
      "SELECT datname FROM pg_database WHERE datname = ANY($1::text[])",
      [[RESTORE_DATABASE, MIGRATION_DATABASE]]
    );
    assert.deepEqual(existing.rows, [],
      "Refusing to use pre-existing databases; recovery targets must be newly created and disposable");

    await sourcePool.query("CREATE DATABASE " + quoteDisposableDatabase(RESTORE_DATABASE));
    restoreDatabaseCreated = true;
    await sourcePool.query("CREATE DATABASE " + quoteDisposableDatabase(MIGRATION_DATABASE));
    migrationDatabaseCreated = true;

    const migrationSql = await readFile(
      new URL("../infra/migrations/20261030_phase6_provider_health_and_recovery_leases.sql", import.meta.url),
      "utf8"
    );

    // Establish a known-good source schema and prove the current migration is repeatable.
    await sourcePool.query(migrationSql);
    await sourcePool.query(migrationSql);

    providerId = "phase6-backup-" + randomBytes(8).toString("hex");
    const leaseHash = createHash("sha256").update(randomBytes(32)).digest("hex");
    const acquiredAt = new Date();
    const expiresAt = new Date(acquiredAt.getTime() + 60_000);

    await sourcePool.query(
      "INSERT INTO public.provider_health (provider_id, state, consecutive_failures) " +
      "VALUES ($1, 'UNKNOWN', 0)",
      [providerId]
    );
    await sourcePool.query(
      "INSERT INTO public.provider_recovery_probe_leases " +
      "(provider_id, owner_id, lease_token_hash, acquired_at, expires_at, fencing_token) " +
      "VALUES ($1, 'backup-drill', $2, $3, $4, 1)",
      [providerId, leaseHash, acquiredAt, expiresAt]
    );

    backupDirectory = await mkdtemp(join(tmpdir(), "ata-phase6-recovery-"));
    const dumpPath = join(backupDirectory, "phase6-provider-health.dump");
    const dumpStartedAt = Date.now();

    const dumpVersion = runPostgresTool({
      database: SOURCE_DATABASE,
      tool: "pg_dump",
      args: ["--version", "--no-owner", "--no-privileges"],
      backupDirectory,
      connection
    });
    assert.match(dumpVersion, /PostgreSQL\) 18\./);

    runPostgresTool({
      database: SOURCE_DATABASE,
      tool: "pg_dump",
      args: [
        "--format=custom",
        "--no-owner",
        "--no-privileges",
        "--file=/backup/phase6-provider-health.dump"
      ],
      backupDirectory,
      connection
    });

    const dumpStat = await stat(dumpPath);
    assert.ok(dumpStat.isFile() && dumpStat.size > 0,
      "Custom-format backup must exist and contain bytes");
    const dumpBytes = await readFile(dumpPath);
    const dumpDigest = createHash("sha256").update(dumpBytes).digest("hex");
    assert.match(dumpDigest, /^[a-f0-9]{64}$/);

    const toc = runPostgresTool({
      database: SOURCE_DATABASE,
      tool: "pg_restore",
      args: ["--list", "/backup/phase6-provider-health.dump"],
      backupDirectory,
      connection
    });
    assert.match(toc, /provider_health/);
    assert.match(toc, /provider_recovery_probe_leases/);

    runPostgresTool({
      database: RESTORE_DATABASE,
      tool: "pg_restore",
      args: [
        "--exit-on-error",
        "--single-transaction",
        "--no-owner",
        "--no-privileges",
        "--dbname=" + RESTORE_DATABASE,
        "/backup/phase6-provider-health.dump"
      ],
      backupDirectory,
      connection
    });

    restorePool = new Pool({
      connectionString: databaseUrl(connection.url, RESTORE_DATABASE),
      max: 2,
      connectionTimeoutMillis: 5_000,
      application_name: "ata-phase6-recovery-restore-verify"
    });

    const restoredHealth = await restorePool.query(
      "SELECT provider_id, state, consecutive_failures FROM public.provider_health WHERE provider_id = $1",
      [providerId]
    );
    assert.equal(restoredHealth.rows.length, 1);
    assert.deepEqual(restoredHealth.rows[0], {
      provider_id: providerId,
      state: "UNKNOWN",
      consecutive_failures: 0
    });

    const restoredLease = await restorePool.query(
      "SELECT provider_id, owner_id, lease_token_hash, fencing_token " +
      "FROM public.provider_recovery_probe_leases WHERE provider_id = $1",
      [providerId]
    );
    assert.equal(restoredLease.rows.length, 1);
    assert.equal(restoredLease.rows[0].owner_id, "backup-drill");
    assert.equal(restoredLease.rows[0].lease_token_hash, leaseHash);
    assert.equal(String(restoredLease.rows[0].fencing_token), "1");

    const restoredOwners = await restorePool.query(
      "SELECT tableowner FROM pg_tables WHERE schemaname = 'public' " +
      "AND tablename = ANY($1::text[]) ORDER BY tablename",
      [["provider_health", "provider_recovery_probe_leases"]]
    );
    assert.equal(restoredOwners.rows.length, 2);
    const restoredCurrentUser = await restorePool.query("SELECT current_user AS role");
    assert.ok(restoredOwners.rows.every((row) => row.tableowner === restoredCurrentUser.rows[0].role),
      "No-owner restore must assign restored tables to the current restore role");

    const dumpDigestAfterRestore = createHash("sha256").update(await readFile(dumpPath)).digest("hex");
    assert.equal(dumpDigestAfterRestore, dumpDigest,
      "Restore must not alter the verified backup artifact");

    // Simulate a migration worker disappearing after DDL but before COMMIT.
    // PostgreSQL must roll back the open transaction when the backend is terminated.
    migrationPool = new Pool({
      connectionString: databaseUrl(connection.url, MIGRATION_DATABASE),
      max: 2,
      connectionTimeoutMillis: 5_000,
      application_name: "ata-phase6-migration-interruption-drill"
    });
    const interruptedClient = await migrationPool.connect();
    let interruptedPid = null;
    try {
      await interruptedClient.query("BEGIN");
      await interruptedClient.query(migrationSql);
      const pidResult = await interruptedClient.query("SELECT pg_backend_pid() AS pid");
      interruptedPid = pidResult.rows[0]?.pid;
      assert.ok(Number.isInteger(interruptedPid));
    } finally {
      // Destroying the client closes the backend; its uncommitted DDL must roll back.
      interruptedClient.release(true);
    }

    let backendClosed = false;
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const activity = await sourcePool.query(
        "SELECT 1 FROM pg_stat_activity WHERE pid = $1",
        [interruptedPid]
      );
      if (activity.rows.length === 0) {
        backendClosed = true;
        break;
      }
      await sleep(50);
    }
    assert.equal(backendClosed, true, "Interrupted migration backend must terminate");

    const afterInterruption = await migrationPool.query(
      "SELECT to_regclass('public.provider_health') AS health_table, " +
      "to_regclass('public.provider_recovery_probe_leases') AS lease_table"
    );
    assert.equal(afterInterruption.rows[0].health_table, null);
    assert.equal(afterInterruption.rows[0].lease_table, null);

    // Reapply transactionally, then repeat to prove idempotency after recovery.
    const recoveryClient = await migrationPool.connect();
    try {
      await recoveryClient.query("BEGIN");
      await recoveryClient.query(migrationSql);
      await recoveryClient.query("COMMIT");
    } catch (error) {
      try { await recoveryClient.query("ROLLBACK"); } catch { /* preserve migration failure */ }
      throw error;
    } finally {
      recoveryClient.release();
    }
    await migrationPool.query(migrationSql);

    const recoveredSchema = await migrationPool.query(
      "SELECT to_regclass('public.provider_health') AS health_table, " +
      "to_regclass('public.provider_recovery_probe_leases') AS lease_table"
    );
    assert.ok(recoveredSchema.rows[0].health_table);
    assert.ok(recoveredSchema.rows[0].lease_table);

    t.diagnostic("custom_format_sha256=" + dumpDigest);
    t.diagnostic("custom_format_bytes=" + String(dumpStat.size));
    t.diagnostic("backup_elapsed_ms=" + String(Date.now() - dumpStartedAt));
  } finally {
    if (providerId !== null) {
      try {
        await sourcePool.query(
          "DELETE FROM public.provider_recovery_probe_leases WHERE provider_id = $1",
          [providerId]
        );
        await sourcePool.query(
          "DELETE FROM public.provider_health WHERE provider_id = $1",
          [providerId]
        );
      } catch {
        // The service container is disposable; cleanup must not hide the drill result.
      }
    }
    await Promise.allSettled([
      restorePool?.end(),
      migrationPool?.end()
    ]);
    if (migrationDatabaseCreated) {
      try { await sourcePool.query("DROP DATABASE IF EXISTS " + quoteDisposableDatabase(MIGRATION_DATABASE) + " WITH (FORCE)"); } catch {}
    }
    if (restoreDatabaseCreated) {
      try { await sourcePool.query("DROP DATABASE IF EXISTS " + quoteDisposableDatabase(RESTORE_DATABASE) + " WITH (FORCE)"); } catch {}
    }
    await sourcePool.end();
    if (backupDirectory !== null) {
      await rm(backupDirectory, { recursive: true, force: true });
    }
  }
});
