import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPostgresPgPoolOptions,
  PostgresPgAdapterError,
  PostgresPgPoolAdapter
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

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

class FakePool {
  constructor() {
    this.waitingCount = 0;
    this.totalCount = 1;
    this.idleCount = 0;
    this.endCalls = 0;
    this.nextConnect = null;
    this.released = 0;
    this.queries = [];
  }
  on() { return this; }
  async query(sql, parameters) {
    this.queries.push({ sql, parameters });
    return { rows: [{ ok: true }] };
  }
  connect() {
    if (this.nextConnect !== null) return this.nextConnect.promise;
    return Promise.resolve({
      query: async (sql, parameters) => {
        this.queries.push({ sql, parameters });
        return { rows: [{ ok: true }] };
      },
      release: () => { this.released += 1; }
    });
  }
  async end() { this.endCalls += 1; }
}

test("pg options enforce verified TLS and server-side timeout policy", () => {
  const options = buildPostgresPgPoolOptions(CONFIG);
  assert.equal(options.host, CONFIG.host);
  assert.equal(options.connectionString, undefined);
  assert.equal(options.ssl.rejectUnauthorized, true);
  assert.equal(options.ssl.servername, CONFIG.host);
  assert.equal(options.ssl.minVersion, "TLSv1.2");
  assert.equal(options.max, CONFIG.maxConnections);
  assert.match(options.options, /statement_timeout=5000/);
  assert.match(options.options, /lock_timeout=1000/);
  assert.match(options.options, /idle_in_transaction_session_timeout=10000/);
});

test("configuration rejects IP literals, URI-based configuration and insecure TLS options", () => {
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, host: "127.0.0.1" }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, connectionString: "postgres://x" }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
  assert.throws(() => buildPostgresPgPoolOptions({ ...CONFIG, lockTimeoutMs: CONFIG.statementTimeoutMs }),
    (error) => error instanceof PostgresPgAdapterError && error.code === "INVALID_CONFIGURATION");
});

test("adapter preserves structural pool contract and releases a checked-out client once", async () => {
  const pool = new FakePool();
  const adapter = new PostgresPgPoolAdapter(CONFIG, pool);
  const client = await adapter.connect();
  const result = await client.query("SELECT $1::boolean AS ok", [true]);
  assert.deepEqual(result.rows, [{ ok: true }]);
  client.release();
  client.release();
  assert.equal(pool.released, 1);
  assert.deepEqual(await adapter.query("SELECT true AS ok"), { rows: [{ ok: true }] });
  assert.equal(pool.released, 2);
});

test("acquisition queue is bounded and timed-out late clients are released", async () => {
  const pool = new FakePool();
  const pending = deferred();
  pool.nextConnect = pending;
  const adapter = new PostgresPgPoolAdapter({
    ...CONFIG,
    connectionTimeoutMs: 10,
    acquisitionTimeoutMs: 20
  }, pool);

  await assert.rejects(adapter.connect(),
    (error) => error instanceof PostgresPgAdapterError && error.code === "ACQUISITION_TIMEOUT");
  await assert.rejects(adapter.connect(),
    (error) => error instanceof PostgresPgAdapterError && error.code === "POOL_QUEUE_FULL");

  pending.resolve({
    query: async () => ({ rows: [] }),
    release: () => { pool.released += 1; }
  });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(pool.released, 1);
  pool.nextConnect = null;
  const client = await adapter.connect();
  client.release();
  assert.equal(pool.released, 2);
});

test("shutdown stops new acquisitions and is idempotent", async () => {
  const pool = new FakePool();
  const adapter = new PostgresPgPoolAdapter(CONFIG, pool);
  const first = adapter.close();
  const second = adapter.close();
  assert.equal(first, second);
  await first;
  assert.equal(pool.endCalls, 1);
  await assert.rejects(adapter.connect(),
    (error) => error instanceof PostgresPgAdapterError && error.code === "POOL_CLOSING");
});
