import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  getProviderTrustRegistrySigningPayload,
  PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION
} from "../packages/market-data/dist/provider-trust-registry.js";
import {
  advanceProviderTrustRegistryHighWaterMark
} from "../packages/market-data/dist/provider-trust-registry-postgres-store.js";
import {
  createEd25519ProviderTrustSnapshotAuthenticator
} from "../packages/market-data/dist/provider-trust-registry-authenticator.js";

const NOW = "2026-10-31T13:30:00.000Z";
const RETRIEVED_AT = "2026-10-31T13:29:30.000Z";
const ROOT = generateKeyPairSync("ed25519");
const PROVIDER = generateKeyPairSync("ed25519");
const AUTHENTICATOR = createEd25519ProviderTrustSnapshotAuthenticator();
const TRUST_ANCHOR = {
  registryId: "owner-provider-trust",
  rootKeyId: "registry-root-01",
  rootPublicKeyPem: ROOT.publicKey.export({ type: "spki", format: "pem" }).toString(),
  expectedSpkiSha256: createHash("sha256")
    .update(ROOT.publicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
};

async function authenticatedSnapshot(version, overrides = {}) {
  const payload = {
    schemaVersion: PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
    registryId: "owner-provider-trust",
    rootKeyId: "registry-root-01",
    algorithm: "Ed25519",
    version,
    issuedAt: "2026-10-31T13:29:00.000Z",
    expiresAt: "2026-10-31T13:35:00.000Z",
    keys: [{
      keyId: "owner-decision-key-01",
      owner: "repository-owner",
      publicKeyPem: PROVIDER.publicKey.export({ type: "spki", format: "pem" }).toString(),
      notBefore: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      revokedAt: null,
      allowedProviderIds: ["dex-screener"],
      allowedPurposes: ["DIAGNOSTIC"],
      ...overrides.key
    }],
    ...overrides.payload
  };
  const canonicalPayload = getProviderTrustRegistrySigningPayload(payload);
  const signature = sign(
    null,
    Buffer.from(canonicalPayload, "utf8"),
    ROOT.privateKey
  ).toString("base64url");
  const envelope = { ...payload, signature };
  return AUTHENTICATOR.authenticate({
    snapshotBytes: Buffer.from(JSON.stringify(envelope), "utf8"),
    trustAnchor: TRUST_ANCHOR,
    now: NOW,
    retrievedAt: RETRIEVED_AT,
    maxSnapshotAgeMs: 300_000
  });
}

function memoryStore(initial = null, options = {}) {
  let state = initial === null ? null : { ...initial };
  const calls = { read: 0, compareAndSet: 0 };
  return {
    calls,
    async read(registryId) {
      calls.read += 1;
      if (options.readError) throw new Error("sensitive database detail");
      if (state === null) return null;
      return { ...state, registryId };
    },
    async compareAndSet({ expected, next }) {
      calls.compareAndSet += 1;
      if (options.compareAndSetError) throw new Error("database statement details");
      if (options.compareAndSetResult === false) return false;
      const same = state === null
        ? expected === null
        : expected !== null &&
          state.version === expected.version &&
          state.canonicalPayloadSha256 === expected.canonicalPayloadSha256;
      if (!same) return false;
      state = { ...next };
      return true;
    },
    inspect() {
      return state === null ? null : { ...state };
    }
  };
}

function advance(snapshot, store) {
  return advanceProviderTrustRegistryHighWaterMark({
    snapshot,
    now: NOW,
    maxSnapshotAgeMs: 300_000,
    store
  });
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

test("first accepted snapshot is durably inserted before it is returned", async () => {
  const store = memoryStore();
  const candidate = await authenticatedSnapshot(1);
  const accepted = await advance(candidate, store);
  assert.equal(accepted.version, 1);
  assert.deepEqual(store.inspect(), {
    registryId: candidate.registryId,
    version: 1,
    canonicalPayloadSha256: candidate.canonicalPayloadSha256
  });
  assert.equal(store.calls.compareAndSet, 1);
  assert.equal(Object.isFrozen(accepted), true);
});

test("identical version and canonical digest may replay without a second write", async () => {
  const candidate = await authenticatedSnapshot(5);
  const store = memoryStore({
    registryId: candidate.registryId,
    version: candidate.version,
    canonicalPayloadSha256: candidate.canonicalPayloadSha256
  });
  const accepted = await advance(candidate, store);
  assert.equal(accepted.version, 5);
  assert.equal(store.calls.compareAndSet, 0);
});

test("rejects lower versions and same-version digest equivocation", async () => {
  const current = await authenticatedSnapshot(8);
  const store = memoryStore({
    registryId: current.registryId,
    version: current.version,
    canonicalPayloadSha256: current.canonicalPayloadSha256
  });
  await expectCode(advance(await authenticatedSnapshot(7), store), "TRUST_REGISTRY_ROLLBACK_DETECTED");

  const equivocation = await authenticatedSnapshot(8, {
    key: { owner: "different-owner" }
  });
  assert.notEqual(equivocation.canonicalPayloadSha256, current.canonicalPayloadSha256);
  await expectCode(advance(equivocation, store), "TRUST_REGISTRY_VERSION_EQUIVOCATION");
});

test("a higher snapshot version advances from the exact observed row", async () => {
  const current = await authenticatedSnapshot(2);
  const next = await authenticatedSnapshot(3);
  const store = memoryStore({
    registryId: current.registryId,
    version: current.version,
    canonicalPayloadSha256: current.canonicalPayloadSha256
  });
  const accepted = await advance(next, store);
  assert.equal(accepted.version, 3);
  assert.equal(store.inspect()?.canonicalPayloadSha256, next.canonicalPayloadSha256);
});

test("a lost compare-and-swap race denies the candidate snapshot", async () => {
  const candidate = await authenticatedSnapshot(1);
  const store = memoryStore(null, { compareAndSetResult: false });
  await expectCode(advance(candidate, store), "TRUST_REGISTRY_HIGH_WATER_MARK_CONFLICT");
});

test("missing, corrupt or unavailable durable state denies before returning keys", async () => {
  const candidate = await authenticatedSnapshot(1);
  await expectCode(
    advance(candidate, memoryStore(null, { readError: true })),
    "TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE"
  );
  await expectCode(
    advance(candidate, memoryStore({
      registryId: candidate.registryId,
      version: 0,
      canonicalPayloadSha256: "a".repeat(64)
    })),
    "TRUST_REGISTRY_HIGH_WATER_MARK_INVALID"
  );
  await expectCode(
    advance(candidate, memoryStore(null, { compareAndSetError: true })),
    "TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE"
  );
});

test("validates freshness and recomputes the canonical digest before any store operation", async () => {
  const candidate = await authenticatedSnapshot(1);
  const store = memoryStore();
  const tamperedDigest = {
    ...candidate,
    canonicalPayloadSha256: "0".repeat(64)
  };
  await expectCode(advance(tamperedDigest, store), "TRUST_REGISTRY_SNAPSHOT_INVALID");
  assert.equal(store.calls.read, 0);
  assert.equal(store.calls.compareAndSet, 0);

  await expectCode(
    advance(candidate, store),
    "TRUST_REGISTRY_HIGH_WATER_MARK_CONFLICT"
  ).catch((error) => {
    // The first call above must fail on digest mismatch; this second assertion
    // confirms the valid candidate gets as far as the supplied CAS implementation.
    assert.equal(error.code, "TRUST_REGISTRY_HIGH_WATER_MARK_CONFLICT");
  });
});
