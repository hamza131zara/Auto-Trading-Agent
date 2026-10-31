import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";

const connectionString = process.env.PG_INTEGRATION_URL;
if (process.env.REQUIRE_PG_INTEGRATION === "true" && !connectionString) {
  throw new Error("PG_INTEGRATION_URL is required for the dedicated PostgreSQL integration workflow");
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
      (parsed.port !== "" && parsed.port !== "5432")) {
    throw new Error("PostgreSQL integration tests only permit the local ata_phase6_test database on port 5432");
  }
}

test("Phase 6.46 PostgreSQL trust-registry high-water persistence and CAS", {
  skip: !connectionString
}, async (t) => {
  assertDisposableLocalDatabase(connectionString);
  const { Pool } = await import("pg");
  const options = {
    connectionString,
    max: 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 5_000,
    application_name: "ata-phase6-trust-registry-integration"
  };
  const adminPool = new Pool(options);
  const workerAPool = new Pool(options);
  const workerBPool = new Pool(options);
  const restartPool = new Pool(options);
  const registryId = "phase6-it-" + randomBytes(8).toString("hex");

  t.after(async () => {
    try {
      await adminPool.query(
        "DELETE FROM public.provider_trust_registry_high_water_marks WHERE registry_id = $1",
        [registryId]
      );
    } catch {
      // A disposable service is torn down after the test; cleanup must not hide failures.
    }
    await Promise.allSettled([
      adminPool.end(),
      workerAPool.end(),
      workerBPool.end(),
      restartPool.end()
    ]);
  });

  const migration = await readFile(
    new URL("../infra/migrations/20261031_phase6_provider_trust_registry_high_water_marks.sql", import.meta.url),
    "utf8"
  );
  await adminPool.query(migration);
  await adminPool.query(migration);

  const [{ rows: workerAIdentity }, { rows: workerBIdentity }] = await Promise.all([
    workerAPool.query("SELECT pg_backend_pid() AS pid"),
    workerBPool.query("SELECT pg_backend_pid() AS pid")
  ]);
  assert.notEqual(workerAIdentity[0]?.pid, workerBIdentity[0]?.pid,
    "CAS workers must use distinct PostgreSQL backend connections");

  const {
    PostgresProviderTrustRegistryHighWaterMarkStore,
    advanceProviderTrustRegistryHighWaterMark
  } = await import("../packages/market-data/dist/provider-trust-registry-postgres-store.js");
  const {
    getProviderTrustRegistrySigningPayload,
    PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION
  } = await import("../packages/market-data/dist/provider-trust-registry.js");
  const {
    createEd25519ProviderTrustSnapshotAuthenticator
  } = await import("../packages/market-data/dist/provider-trust-registry-authenticator.js");

  const root = generateKeyPairSync("ed25519");
  const provider = generateKeyPairSync("ed25519");
  const trustAnchor = {
    registryId,
    rootKeyId: "integration-root-01",
    rootPublicKeyPem: root.publicKey.export({ type: "spki", format: "pem" }).toString(),
    expectedSpkiSha256: createHash("sha256")
      .update(root.publicKey.export({ type: "spki", format: "der" }))
      .digest("hex")
  };
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();

  async function makeSnapshot(version, owner = "repository-owner") {
    const now = new Date();
    const payload = {
      schemaVersion: PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
      registryId,
      rootKeyId: "integration-root-01",
      algorithm: "Ed25519",
      version,
      issuedAt: new Date(now.getTime() - 2_000).toISOString(),
      expiresAt: new Date(now.getTime() + 240_000).toISOString(),
      keys: [{
        keyId: "integration-decision-key-01",
        owner,
        publicKeyPem: provider.publicKey.export({ type: "spki", format: "pem" }).toString(),
        notBefore: "2026-01-01T00:00:00.000Z",
        expiresAt: "2027-01-01T00:00:00.000Z",
        revokedAt: null,
        allowedProviderIds: ["dex-screener"],
        allowedPurposes: ["DIAGNOSTIC"]
      }]
    };
    const canonicalPayload = getProviderTrustRegistrySigningPayload(payload);
    const signature = sign(null, Buffer.from(canonicalPayload, "utf8"), root.privateKey)
      .toString("base64url");
    const envelope = { ...payload, signature };
    const retrievedAt = new Date().toISOString();
    return authenticator.authenticate({
      snapshotBytes: Buffer.from(JSON.stringify(envelope), "utf8"),
      trustAnchor,
      now: retrievedAt,
      retrievedAt,
      maxSnapshotAgeMs: 300_000
    });
  }

  const storeA = new PostgresProviderTrustRegistryHighWaterMarkStore(workerAPool);
  const storeB = new PostgresProviderTrustRegistryHighWaterMarkStore(workerBPool);
  const restartedStore = new PostgresProviderTrustRegistryHighWaterMarkStore(restartPool);

  await t.test("the schema is idempotent and an accepted version survives store recreation", async () => {
    assert.equal(await storeA.read(registryId), null);
    const snapshot = await makeSnapshot(1);
    const accepted = await advanceProviderTrustRegistryHighWaterMark({
      snapshot,
      now: new Date().toISOString(),
      maxSnapshotAgeMs: 300_000,
      store: storeA
    });
    assert.equal(accepted.version, 1);

    const afterRestart = await restartedStore.read(registryId);
    assert.deepEqual(afterRestart, {
      registryId,
      version: 1,
      canonicalPayloadSha256: snapshot.canonicalPayloadSha256.toLowerCase()
    });
  });

  await t.test("concurrent workers using the same expected row have exactly one CAS winner", async () => {
    const expected = await restartedStore.read(registryId);
    assert.ok(expected);
    const candidateA = await makeSnapshot(2, "worker-a-candidate");
    const candidateB = await makeSnapshot(2, "worker-b-candidate");
    assert.notEqual(candidateA.canonicalPayloadSha256, candidateB.canonicalPayloadSha256);

    const results = await Promise.all([
      storeA.compareAndSet({
        expected,
        next: {
          registryId,
          version: 2,
          canonicalPayloadSha256: candidateA.canonicalPayloadSha256
        }
      }),
      storeB.compareAndSet({
        expected,
        next: {
          registryId,
          version: 2,
          canonicalPayloadSha256: candidateB.canonicalPayloadSha256
        }
      })
    ]);
    assert.equal(results.filter(Boolean).length, 1,
      "only one simultaneous update can match the exact prior version and digest");

    const persisted = await restartedStore.read(registryId);
    assert.equal(persisted?.version, 2);
    const winningCandidate = results[0] ? candidateA : candidateB;
    const losingCandidate = results[0] ? candidateB : candidateA;
    assert.equal(persisted?.canonicalPayloadSha256, winningCandidate.canonicalPayloadSha256);

    const acceptedReplay = await advanceProviderTrustRegistryHighWaterMark({
      snapshot: winningCandidate,
      now: new Date().toISOString(),
      maxSnapshotAgeMs: 300_000,
      store: restartedStore
    });
    assert.equal(acceptedReplay.version, 2);

    await assert.rejects(
      () => advanceProviderTrustRegistryHighWaterMark({
        snapshot: losingCandidate,
        now: new Date().toISOString(),
        maxSnapshotAgeMs: 300_000,
        store: restartedStore
      }),
      (error) => error?.code === "TRUST_REGISTRY_VERSION_EQUIVOCATION"
    );
  });

  await t.test("rollback is denied and a strictly higher version advances durably", async () => {
    const lower = await makeSnapshot(1, "rollback-candidate");
    await assert.rejects(
      () => advanceProviderTrustRegistryHighWaterMark({
        snapshot: lower,
        now: new Date().toISOString(),
        maxSnapshotAgeMs: 300_000,
        store: storeA
      }),
      (error) => error?.code === "TRUST_REGISTRY_ROLLBACK_DETECTED"
    );

    const higher = await makeSnapshot(3);
    const accepted = await advanceProviderTrustRegistryHighWaterMark({
      snapshot: higher,
      now: new Date().toISOString(),
      maxSnapshotAgeMs: 300_000,
      store: storeA
    });
    assert.equal(accepted.version, 3);
    assert.equal((await restartedStore.read(registryId))?.version, 3);
  });

  await t.test("database outages and corrupt persisted records fail closed", async () => {
    const unavailable = new PostgresProviderTrustRegistryHighWaterMarkStore({
      async query() {
        throw new Error("database endpoint details must not escape");
      }
    });
    await assert.rejects(
      () => unavailable.read(registryId),
      (error) => error?.code === "TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE" &&
        error.message === "TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE"
    );

    const corrupt = new PostgresProviderTrustRegistryHighWaterMarkStore({
      async query() {
        return {
          rows: [{
            registry_id: registryId,
            version: "9007199254740992",
            canonical_payload_sha256: "a".repeat(64)
          }]
        };
      }
    });
    await assert.rejects(
      () => corrupt.read(registryId),
      (error) => error?.code === "TRUST_REGISTRY_HIGH_WATER_MARK_INVALID"
    );
  });
});
