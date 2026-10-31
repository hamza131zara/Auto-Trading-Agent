import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

const REQUIRED = process.env.REQUIRE_PG_TLS_INTEGRATION === "true";
const certificateDirectory = process.env.PG_TLS_CERT_DIR;

if (REQUIRED && !certificateDirectory) {
  throw new Error("PG_TLS_CERT_DIR is required for the PostgreSQL TLS integration test");
}

test("node-postgres 8.23.1 TLS verification against disposable PostgreSQL 18.6 fixtures", {
  skip: !certificateDirectory
}, async (t) => {
  assert.equal(REQUIRED, true, "The dedicated TLS workflow must require this test suite");

  const pgPackage = JSON.parse(
    await readFile(new URL("../node_modules/pg/package.json", import.meta.url), "utf8")
  );
  assert.equal(pgPackage.version, "8.23.1",
    "TLS verification must exercise the exact pinned test-only node-postgres release");

  const trustedCa = await readFile(join(certificateDirectory, "ca.crt"), "utf8");
  const untrustedCa = await readFile(join(certificateDirectory, "rogue-ca.crt"), "utf8");
  const { Pool } = await import("pg");

  const baseConfig = Object.freeze({
    host: "pg-tls.test",
    port: 55_432,
    user: "ata_tls_test",
    password: "ata_local_tls_test_only",
    database: "ata_tls_test",
    application_name: "ata-phase6-pg-tls-handshake-experiment",
    connectionTimeoutMillis: 3_000,
    ssl: Object.freeze({
      ca: trustedCa,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      servername: "pg-tls.test"
    })
  });

  async function assertConnectionRejected(config, predicate, label) {
    const pool = new Pool({ ...baseConfig, ...config });
    try {
      await assert.rejects(
        pool.connect(),
        (error) => {
          assert.ok(error instanceof Error, label + " must reject with an Error");
          assert.ok(predicate(error), label + " must fail for the expected TLS reason; got " +
            String(error.code ?? error.message));
          return true;
        }
      );
    } finally {
      await pool.end().catch(() => {});
    }
  }

  await t.test("trusted CA and requested DNS hostname are accepted with TLS 1.2 or newer", async () => {
    const pool = new Pool(baseConfig);
    let client;
    try {
      client = await pool.connect();
      const result = await client.query(
        "SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid = pg_backend_pid()"
      );
      assert.equal(result.rows.length, 1);
      assert.equal(result.rows[0].ssl, true);
      assert.match(result.rows[0].version, /^TLSv1\.(2|3)$/);
      assert.ok(String(result.rows[0].cipher).length > 0);
    } finally {
      client?.release();
      await pool.end();
    }
  });


  await t.test("production PostgresPgPoolAdapter connects with verified CA and hostname", async () => {
    const { PostgresPgPoolAdapter } = await import("../packages/market-data/dist/postgres-pg-adapter.js");
    const adapterConfig = {
      host: "pg-tls.test",
      port: 55_432,
      user: "ata_tls_test",
      password: "ata_local_tls_test_only",
      database: "ata_tls_test",
      caCertificate: trustedCa,
      maxConnections: 2,
      connectionTimeoutMs: 3_000,
      acquisitionTimeoutMs: 2_000,
      idleTimeoutMs: 1_000,
      maximumConnectionLifetimeSeconds: 600,
      statementTimeoutMs: 5_000,
      lockTimeoutMs: 1_000,
      idleInTransactionTimeoutMs: 5_000,
      maximumPendingAcquisitions: 2,
      shutdownDrainTimeoutMs: 2_000,
      applicationName: "ata-phase6-production-adapter-integration"
    };
    const adapter = new PostgresPgPoolAdapter(adapterConfig);
    // Caller-side mutation after construction must not change the validated policy.
    adapterConfig.maximumPendingAcquisitions = 0;
    adapterConfig.acquisitionTimeoutMs = 1;

    try {
      const client = await adapter.connect();
      try {
        const result = await client.query(
          "SELECT ssl, version FROM pg_stat_ssl WHERE pid = pg_backend_pid()"
        );
        assert.equal(result.rows.length, 1);
        assert.equal(result.rows[0].ssl, true);
        assert.match(result.rows[0].version, /^TLSv1\.(2|3)$/);
      } finally {
        client.release();
      }
    } finally {
      await adapter.close();
    }
  });


  await t.test("production adapter bounds queued acquisitions and releases a late client", async () => {
    const { PostgresPgPoolAdapter, PostgresPgAdapterError } =
      await import("../packages/market-data/dist/postgres-pg-adapter.js");
    const adapter = new PostgresPgPoolAdapter({
      host: "pg-tls.test",
      port: 55_432,
      user: "ata_tls_test",
      password: "ata_local_tls_test_only",
      database: "ata_tls_test",
      caCertificate: trustedCa,
      maxConnections: 1,
      connectionTimeoutMs: 3_000,
      acquisitionTimeoutMs: 200,
      idleTimeoutMs: 1_000,
      maximumConnectionLifetimeSeconds: 600,
      statementTimeoutMs: 5_000,
      lockTimeoutMs: 1_000,
      idleInTransactionTimeoutMs: 5_000,
      maximumPendingAcquisitions: 1,
      shutdownDrainTimeoutMs: 2_000,
      applicationName: "ata-phase6-production-adapter-queue-test"
    });
    let held;
    try {
      held = await adapter.connect();
      const pending = adapter.connect();
      await new Promise((resolve) => setImmediate(resolve));
      assert.equal(adapter.getPoolSnapshot().waitingAcquisitions, 1);
      await assert.rejects(
        adapter.connect(),
        (error) => error instanceof PostgresPgAdapterError && error.code === "POOL_QUEUE_FULL"
      );
      await assert.rejects(
        pending,
        (error) => error instanceof PostgresPgAdapterError && error.code === "ACQUISITION_TIMEOUT"
      );
      // The timed-out request still occupies the admission slot until pg settles it.
      await assert.rejects(
        adapter.connect(),
        (error) => error instanceof PostgresPgAdapterError && error.code === "POOL_QUEUE_FULL"
      );
      assert.equal(adapter.getPoolSnapshot().waitingAcquisitions, 1);
      held.release();
      held = undefined;
      for (let attempt = 0; attempt < 100; attempt += 1) {
        const snapshot = adapter.getPoolSnapshot();
        if (snapshot.waitingAcquisitions === 0 && snapshot.idleConnections === 1) break;
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
      const settledSnapshot = adapter.getPoolSnapshot();
      assert.equal(settledSnapshot.waitingAcquisitions, 0);
      assert.equal(settledSnapshot.idleConnections, 1,
        "the late client must be returned to the idle pool after the timed-out caller is released");
      const followUp = await adapter.connect();
      followUp.release();
    } finally {
      held?.release();
      await adapter.close();
    }
  });

  await t.test("production adapter rejects an untrusted CA without exposing driver details", async () => {
    const { PostgresPgPoolAdapter, PostgresPgAdapterError } =
      await import("../packages/market-data/dist/postgres-pg-adapter.js");
    const adapter = new PostgresPgPoolAdapter({
      host: "pg-tls.test",
      port: 55_432,
      user: "ata_tls_test",
      password: "ata_local_tls_test_only",
      database: "ata_tls_test",
      caCertificate: untrustedCa,
      maxConnections: 1,
      connectionTimeoutMs: 3_000,
      acquisitionTimeoutMs: 2_000,
      idleTimeoutMs: 1_000,
      maximumConnectionLifetimeSeconds: 600,
      statementTimeoutMs: 5_000,
      lockTimeoutMs: 1_000,
      idleInTransactionTimeoutMs: 5_000,
      maximumPendingAcquisitions: 1,
      shutdownDrainTimeoutMs: 2_000,
      applicationName: "ata-phase6-production-adapter-negative-test"
    });
    try {
      await assert.rejects(
        adapter.connect(),
        (error) => error instanceof PostgresPgAdapterError &&
          error.code === "DATABASE_OPERATION_FAILED" &&
          !/certificate|hostname|pg-tls|ata_tls|password/i.test(error.message)
      );
    } finally {
      await adapter.close();
    }
  });

  await t.test("production adapter enforces hostname verification and sanitizes mismatch", async () => {
    const { PostgresPgPoolAdapter, PostgresPgAdapterError } =
      await import("../packages/market-data/dist/postgres-pg-adapter.js");
    const adapter = new PostgresPgPoolAdapter({
      host: "wrong.pg-tls.test",
      port: 55_432,
      user: "ata_tls_test",
      password: "ata_local_tls_test_only",
      database: "ata_tls_test",
      caCertificate: trustedCa,
      maxConnections: 1,
      connectionTimeoutMs: 3_000,
      acquisitionTimeoutMs: 2_000,
      idleTimeoutMs: 1_000,
      maximumConnectionLifetimeSeconds: 600,
      statementTimeoutMs: 5_000,
      lockTimeoutMs: 1_000,
      idleInTransactionTimeoutMs: 5_000,
      maximumPendingAcquisitions: 1,
      shutdownDrainTimeoutMs: 2_000,
      applicationName: "ata-phase6-production-adapter-hostname-test"
    });
    try {
      await assert.rejects(
        adapter.connect(),
        (error) => error instanceof PostgresPgAdapterError &&
          error.code === "DATABASE_OPERATION_FAILED" &&
          !/wrong\.pg-tls|certificate|hostname/i.test(error.message)
      );
    } finally {
      await adapter.close();
    }
  });

  await t.test("untrusted CA is rejected", async () => {
    await assertConnectionRejected(
      { ssl: { ...baseConfig.ssl, ca: untrustedCa } },
      (error) => [
        "SELF_SIGNED_CERT_IN_CHAIN",
        "UNABLE_TO_VERIFY_LEAF_SIGNATURE",
        "UNABLE_TO_GET_ISSUER_CERT_LOCALLY"
      ].includes(error.code),
      "untrusted certificate chain"
    );
  });

  await t.test("certificate hostname mismatch is rejected", async () => {
    await assertConnectionRejected(
      {
        host: "wrong.pg-tls.test",
        ssl: { ...baseConfig.ssl, servername: "wrong.pg-tls.test" }
      },
      (error) => error.code === "ERR_TLS_CERT_ALTNAME_INVALID",
      "hostname mismatch"
    );
  });

  await t.test("expired server certificate is rejected", async () => {
    await assertConnectionRejected(
      { port: 55_433 },
      (error) => error.code === "CERT_HAS_EXPIRED",
      "expired certificate"
    );
  });

  await t.test("TLS configuration refuses a PostgreSQL endpoint with TLS disabled", async () => {
    await assertConnectionRejected(
      { port: 55_435 },
      (error) => /does not support SSL connections/i.test(error.message),
      "plaintext-only PostgreSQL endpoint"
    );
  });

  await t.test("configured TLS 1.3 minimum rejects a server restricted to TLS 1.2", async () => {
    await assertConnectionRejected(
      {
        port: 55_434,
        ssl: { ...baseConfig.ssl, minVersion: "TLSv1.3" }
      },
      (error) => /protocol|version|handshake|alert/i.test(
        String(error.code ?? "") + " " + error.message
      ),
      "TLS protocol below the explicitly configured TLS 1.3 minimum"
    );
  });

  await t.test("production adapter shutdown rejects new work and drains checked-out clients", async () => {
    const { PostgresPgPoolAdapter, PostgresPgAdapterError } =
      await import("../packages/market-data/dist/postgres-pg-adapter.js");
    const adapter = new PostgresPgPoolAdapter({
      host: "pg-tls.test",
      port: 55_432,
      user: "ata_tls_test",
      password: "ata_local_tls_test_only",
      database: "ata_tls_test",
      caCertificate: trustedCa,
      maxConnections: 1,
      connectionTimeoutMs: 3_000,
      acquisitionTimeoutMs: 2_000,
      idleTimeoutMs: 1_000,
      maximumConnectionLifetimeSeconds: 600,
      statementTimeoutMs: 5_000,
      lockTimeoutMs: 1_000,
      idleInTransactionTimeoutMs: 5_000,
      maximumPendingAcquisitions: 1,
      shutdownDrainTimeoutMs: 2_000,
      applicationName: "ata-phase6-production-adapter-drain-test"
    });
    const held = await adapter.connect();
    let closeResolved = false;
    const drainPromise = adapter.close();
    const closePromise = drainPromise.then(() => {
      closeResolved = true;
    });

    try {
      assert.equal(adapter.getPoolSnapshot().closing, true);
      await assert.rejects(
        adapter.connect(),
        (error) => error instanceof PostgresPgAdapterError &&
          error.code === "POOL_CLOSING"
      );
      await new Promise((resolve) => setTimeout(resolve, 50));
      assert.equal(closeResolved, false,
        "shutdown must wait for a checked-out client rather than terminate it");
      assert.equal(adapter.close(), drainPromise,
        "repeated close calls must return the same drain promise");
      held.release();
      await closePromise;
      assert.equal(closeResolved, true);
    } finally {
      held.release();
      await closePromise;
    }
  });

});
