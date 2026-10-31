import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPostgresPgPoolOptions,
  PostgresPgAdapterError
} from "../packages/market-data/dist/postgres-pg-adapter.js";

const CONFIG = Object.freeze({
  host: "postgres.internal.example",
  port: 5432,
  database: "ata_runtime",
  user: "ata_runtime",
  password: "test-only-password",
  caCertificate: "-----BEGIN CERTIFICATE-----\ntest-ca\n-----END CERTIFICATE-----",
  maxConnections: 4,
  connectionTimeoutMs: 1_000,
  acquisitionTimeoutMs: 1_500,
  idleTimeoutMs: 10_000,
  maximumConnectionLifetimeSeconds: 3_600,
  statementTimeoutMs: 5_000,
  lockTimeoutMs: 1_000,
  idleInTransactionTimeoutMs: 10_000,
  maximumPendingAcquisitions: 1,
  shutdownDrainTimeoutMs: 2_000,
  applicationName: "ata-phase6-test"
});

test("pg options enforce verified TLS and server-side timeout policy", () => {
  const options = buildPostgresPgPoolOptions(CONFIG);
  assert.equal(options.host, CONFIG.host);
  assert.equal(options.connectionString, undefined);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.servername, CONFIG.host);
  assert.equal(options.ssl.minVersion, "TLSv1.2");
  assert.equal(options.max, CONFIG.maxConnections);
  assert.equal(options.options.includes("statement_timeout=5000"), true);
  assert.equal(options.options.includes("lock_timeout=1000"), true);
  assert.equal(options.options.includes("idle_in_transaction_session_timeout=10000"), true);
  assert.equal(Object.isFrozen(options), true);
  assert.equal(Object.isFrozen(options.ssl), true);
});

test("configuration rejects IP literals, URI-based configuration and insecure timeout relationships", () => {
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, host: "127.0.0.1" }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, host: "::1" }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, connectionString: "postgres://x" }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, lockTimeoutMs: CONFIG.statementTimeoutMs }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, maximumPendingAcquisitions: 0 }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
});

test("configuration rejects unknown fields instead of silently accepting bypass options", () => {
  for (const extra of [
    { connectionString: "postgres://user:pass@host/db" },
    { ssl: false },
    { rejectUnauthorized: false },
    { statement_timeout: 0 }
  ]) {
    assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, ...extra }),
      (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
  }
});
