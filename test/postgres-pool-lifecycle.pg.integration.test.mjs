import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const connectionString = process.env.PG_INTEGRATION_URL;
const REQUIRED = process.env.REQUIRE_PG_POOL_LIFECYCLE_INTEGRATION === "true";

if (REQUIRED && !connectionString) {
  throw new Error("PG_INTEGRATION_URL is required for the PostgreSQL pool lifecycle experiment");
}

function assertDisposableLocalDatabase(raw) {
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
      database !== "ata_phase6_test" ||
      (parsed.port !== "" && parsed.port !== "5432") ||
      decodeURIComponent(parsed.username) !== "ata_test" ||
      parsed.search !== "" ||
      parsed.hash !== "") {
    throw new Error("Pool lifecycle experiment permits only the local ata_test role and ata_phase6_test database on port 5432");
  }
  if (decodeURIComponent(parsed.password).length === 0) {
    throw new Error("Pool lifecycle experiment requires the disposable test database password from the environment");
  }
}

function sleep(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

test("node-postgres 8.23.1 pool lifecycle behavior against disposable PostgreSQL 18.6", {
  skip: !connectionString
}, async (t) => {
  assertDisposableLocalDatabase(connectionString);

  const pgPackage = JSON.parse(
    await readFile(new URL("../node_modules/pg/package.json", import.meta.url), "utf8")
  );
  assert.equal(pgPackage.version, "8.23.1",
    "The lifecycle experiment must use the exact test-only pinned node-postgres version");

  const { Pool } = await import("pg");
  const pools = new Set();

  function createPool(options = {}) {
    const pool = new Pool({
      connectionString,
      max: 4,
      connectionTimeoutMillis: 2_000,
      idleTimeoutMillis: 1_000,
      application_name: "ata-phase6-pg-pool-lifecycle-experiment",
      ...options
    });
    pools.add(pool);
    return pool;
  }

  async function closePool(pool) {
    if (pools.delete(pool)) {
      await pool.end();
    }
  }

  t.after(async () => {
    await Promise.allSettled([...pools].map((pool) => pool.end()));
  });

  await t.test("the test workflow is using the exact pinned node-postgres release", () => {
    assert.equal(pgPackage.name, "pg");
    assert.equal(pgPackage.version, "8.23.1");
    assert.equal(typeof Pool, "function");
  });

  await t.test("pool acquisition wait is bounded by connectionTimeoutMillis", async () => {
    const pool = createPool({ max: 1, connectionTimeoutMillis: 300 });
    const held = await pool.connect();
    try {
      const startedAt = Date.now();
      await assert.rejects(
        pool.connect(),
        (error) => error instanceof Error && /timeout/i.test(error.message)
      );
      const elapsedMs = Date.now() - startedAt;
      assert.ok(elapsedMs >= 200, "the queued acquisition should observe the configured timeout");
      assert.ok(elapsedMs < 3_000, "the queued acquisition must not wait indefinitely");
      assert.equal(pool.waitingCount, 0);
    } finally {
      held.release();
      await closePool(pool);
    }
  });

  await t.test("server statement_timeout cancels the statement and leaves the connection usable", async () => {
    const pool = createPool({ max: 1 });
    const client = await pool.connect();
    try {
      await client.query("SET statement_timeout = '150ms'");
      await assert.rejects(
        client.query("SELECT pg_sleep(2)"),
        (error) => error?.code === "57014"
      );
      await client.query("RESET statement_timeout");
      const result = await client.query("SELECT 1::int AS ok");
      assert.equal(result.rows[0]?.ok, 1);
    } finally {
      client.release();
      await closePool(pool);
    }
  });

  await t.test("server lock_timeout aborts only the blocked lock attempt", async () => {
    const pool = createPool({ max: 2 });
    const blocker = await pool.connect();
    const waiter = await pool.connect();
    const lockKey = 938_271_645;
    try {
      await blocker.query("BEGIN");
      await blocker.query("SELECT pg_advisory_xact_lock($1)", [lockKey]);

      await waiter.query("SET lock_timeout = '150ms'");
      await waiter.query("BEGIN");
      await assert.rejects(
        waiter.query("SELECT pg_advisory_xact_lock($1)", [lockKey]),
        (error) => error?.code === "55P03"
      );
      await waiter.query("ROLLBACK");
      await blocker.query("ROLLBACK");
      const result = await waiter.query("SELECT 1::int AS ok");
      assert.equal(result.rows[0]?.ok, 1);
    } finally {
      try { await waiter.query("ROLLBACK"); } catch {}
      try { await blocker.query("ROLLBACK"); } catch {}
      waiter.release();
      blocker.release();
      await closePool(pool);
    }
  });

  await t.test("idle_in_transaction_session_timeout terminates the abandoned backend", async () => {
    const pool = createPool({ max: 2 });
    const abandoned = await pool.connect();
    const observer = await pool.connect();
    let abandonedPid;
    abandoned.on("error", () => {
      // Expected server-side termination is asserted through pg_stat_activity below.
    });
    try {
      await abandoned.query("SET idle_in_transaction_session_timeout = '250ms'");
      const pidResult = await abandoned.query("SELECT pg_backend_pid()::int AS pid");
      abandonedPid = pidResult.rows[0]?.pid;
      assert.ok(Number.isInteger(abandonedPid));

      await abandoned.query("BEGIN");
      await sleep(700);

      const activity = await observer.query(
        "SELECT count(*)::int AS count FROM pg_stat_activity WHERE pid = $1",
        [abandonedPid]
      );
      assert.equal(activity.rows[0]?.count, 0,
        "PostgreSQL must terminate the backend after the declared idle-in-transaction timeout");

      await assert.rejects(abandoned.query("SELECT 1"));
    } finally {
      abandoned.release(true);
      observer.release();
      await closePool(pool);
    }
  });

  await t.test("an adapter-side admission cap rejects excess waiters before the pg pool queue grows", async () => {
    const pool = createPool({ max: 1, connectionTimeoutMillis: 5_000 });
    const held = await pool.connect();
    const acquiredClients = new Set();
    let heldReleased = false;
    let pending = 0;
    let first;
    let second;
    const maximumPending = 2;
    const releaseHeld = () => {
      if (!heldReleased) {
        heldReleased = true;
        held.release();
      }
    };
    const acquireWithAdmissionCap = () => {
      if (pending >= maximumPending) {
        const error = new Error("POOL_ADMISSION_LIMIT_REACHED");
        error.code = "POOL_ADMISSION_LIMIT_REACHED";
        return Promise.reject(error);
      }
      pending += 1;
      return pool.connect().then((client) => {
        acquiredClients.add(client);
        return client;
      }).finally(() => {
        pending -= 1;
      });
    };

    try {
      first = acquireWithAdmissionCap();
      second = acquireWithAdmissionCap();
      await new Promise((resolve) => setImmediate(resolve));

      assert.equal(pool.waitingCount, 2);
      await assert.rejects(
        acquireWithAdmissionCap(),
        (error) => error?.code === "POOL_ADMISSION_LIMIT_REACHED"
      );
      assert.equal(pool.waitingCount, 2,
        "the rejected third waiter must never enter the underlying FIFO queue");

      releaseHeld();
      const firstClient = await first;
      firstClient.release();
      acquiredClients.delete(firstClient);

      const secondClient = await second;
      secondClient.release();
      acquiredClients.delete(secondClient);

      assert.equal(pool.waitingCount, 0);
      assert.equal(pending, 0);
      assert.equal(acquiredClients.size, 0);
    } finally {
      releaseHeld();
      await Promise.allSettled([first, second].filter(Boolean));
      for (const client of acquiredClients) {
        try { client.release(true); } catch {}
      }
      acquiredClients.clear();
      await closePool(pool);
    }
  });

  await t.test("pool.end stops new acquisitions and drains an already checked-out client", async () => {
    const pool = createPool({ max: 1 });
    const client = await pool.connect();
    let endResolved = false;

    const endPromise = pool.end().then(() => {
      endResolved = true;
    });

    try {
      await sleep(50);
      assert.equal(endResolved, false,
        "pool.end must wait for the checked-out client to be released");

      await assert.rejects(
        pool.connect(),
        /Cannot use a pool after calling end on the pool/
      );

      client.release();
      await endPromise;
      pools.delete(pool);
      assert.equal(endResolved, true);
    } catch (error) {
      client.release(true);
      await endPromise;
      pools.delete(pool);
      throw error;
    }
  });
});
