import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  getProviderTrustRegistrySigningPayload,
  PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION
} from "../packages/market-data/dist/provider-trust-registry.js";
import {
  createEd25519ProviderTrustSnapshotAuthenticator,
  validateProviderTrustRegistryTrustAnchor
} from "../packages/market-data/dist/provider-trust-registry-authenticator.js";

const NOW = "2026-10-31T13:30:00.000Z";
const RETRIEVED_AT = "2026-10-31T13:30:01.000Z";

function fixture(payloadOverrides = {}) {
  const root = generateKeyPairSync("ed25519");
  const provider = generateKeyPairSync("ed25519");
  const payload = {
    schemaVersion: PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
    registryId: "owner-provider-trust",
    rootKeyId: "registry-root-01",
    algorithm: "Ed25519",
    version: 7,
    issuedAt: "2026-10-31T13:29:00.000Z",
    expiresAt: "2026-10-31T13:35:00.000Z",
    keys: [{
      keyId: "owner-decision-key-01",
      owner: "repository-owner",
      publicKeyPem: provider.publicKey.export({ type: "spki", format: "pem" }).toString(),
      notBefore: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      revokedAt: null,
      allowedProviderIds: ["dex-screener", "solana-public-shared"],
      allowedPurposes: ["DIAGNOSTIC"]
    }],
    ...payloadOverrides
  };
  const signingPayload = getProviderTrustRegistrySigningPayload(payload);
  const signature = sign(null, Buffer.from(signingPayload, "utf8"), root.privateKey)
    .toString("base64url");
  const envelope = { ...payload, signature };
  const rootDer = root.publicKey.export({ type: "spki", format: "der" });
  const trustAnchor = {
    registryId: "owner-provider-trust",
    rootKeyId: "registry-root-01",
    rootPublicKeyPem: root.publicKey.export({ type: "spki", format: "pem" }).toString(),
    expectedSpkiSha256: createHash("sha256").update(rootDer).digest("hex")
  };
  return {
    root,
    payload,
    envelope,
    bytes: Buffer.from(JSON.stringify(envelope), "utf8"),
    trustAnchor
  };
}

function request(f, overrides = {}) {
  return {
    snapshotBytes: f.bytes,
    trustAnchor: f.trustAnchor,
    now: NOW,
    retrievedAt: RETRIEVED_AT,
    maxSnapshotAgeMs: 300_000,
    ...overrides
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

test("authenticates a valid root-signed snapshot and freezes the complete trusted-key set", async () => {
  const f = fixture();
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const result = await authenticator.authenticate(request(f));
  const payload = getProviderTrustRegistrySigningPayload(f.payload);
  assert.equal(result.registryId, "owner-provider-trust");
  assert.equal(result.rootKeyId, "registry-root-01");
  assert.equal(result.version, 7);
  assert.equal(result.retrievedAt, RETRIEVED_AT);
  assert.equal(
    result.canonicalPayloadSha256,
    createHash("sha256").update(Buffer.from(payload, "utf8")).digest("hex")
  );
  assert.equal(result.keys.length, 1);
  assert.equal(result.keys[0].keyId, "owner-decision-key-01");
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.keys), true);
  assert.equal(Object.isFrozen(result.keys[0]), true);
  assert.equal(Object.isFrozen(result.keys[0].allowedProviderIds), true);
  assert.equal(Object.isFrozen(result.keys[0].allowedPurposes), true);
});

test("rejects payload tampering and signatures produced by a different root", async () => {
  const f = fixture();
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const tampered = { ...f.envelope, version: f.envelope.version + 1 };
  await expectCode(
    authenticator.authenticate(request(f, {
      snapshotBytes: Buffer.from(JSON.stringify(tampered), "utf8")
    })),
    "TRUST_REGISTRY_AUTHENTICATION_FAILED"
  );

  const otherRoot = generateKeyPairSync("ed25519");
  const otherDer = otherRoot.publicKey.export({ type: "spki", format: "der" });
  const otherAnchor = {
    ...f.trustAnchor,
    rootPublicKeyPem: otherRoot.publicKey.export({ type: "spki", format: "pem" }).toString(),
    expectedSpkiSha256: createHash("sha256").update(otherDer).digest("hex")
  };
  await expectCode(
    authenticator.authenticate(request(f, { trustAnchor: otherAnchor })),
    "TRUST_REGISTRY_AUTHENTICATION_FAILED"
  );
});

test("rejects root fingerprint mismatch and non-Ed25519 roots", async () => {
  const f = fixture();
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const otherRoot = generateKeyPairSync("ed25519");
  await expectCode(
    authenticator.authenticate(request(f, {
      trustAnchor: {
        ...f.trustAnchor,
        rootPublicKeyPem: otherRoot.publicKey.export({ type: "spki", format: "pem" }).toString()
      }
    })),
    "TRUST_REGISTRY_ROOT_FINGERPRINT_MISMATCH"
  );

  const rsaRoot = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rsaDer = rsaRoot.publicKey.export({ type: "spki", format: "der" });
  await expectCode(
    authenticator.authenticate(request(f, {
      trustAnchor: {
        ...f.trustAnchor,
        rootPublicKeyPem: rsaRoot.publicKey.export({ type: "spki", format: "pem" }).toString(),
        expectedSpkiSha256: createHash("sha256").update(rsaDer).digest("hex")
      }
    })),
    "TRUST_REGISTRY_ROOT_KEY_MISMATCH"
  );
});

test("requires the independently pinned registry and root-key identities", async () => {
  const f = fixture();
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  await expectCode(
    authenticator.authenticate(request(f, {
      trustAnchor: { ...f.trustAnchor, registryId: "different-registry" }
    })),
    "TRUST_REGISTRY_IDENTITY_MISMATCH"
  );
  await expectCode(
    authenticator.authenticate(request(f, {
      trustAnchor: { ...f.trustAnchor, rootKeyId: "different-root" }
    })),
    "TRUST_REGISTRY_ROOT_KEY_MISMATCH"
  );
});

test("rejects duplicate JSON member names, including escaped-equivalent names", async () => {
  const f = fixture();
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const duplicate = f.bytes.toString("utf8").replace(
    '"registryId":"owner-provider-trust"',
    '"registryId":"owner-provider-trust","registry\\u0049d":"owner-provider-trust"'
  );
  await expectCode(
    authenticator.authenticate(request(f, { snapshotBytes: Buffer.from(duplicate, "utf8") })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
});

test("rejects malformed UTF-8, malformed JSON and non-canonical signatures", async () => {
  const f = fixture();
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  await expectCode(
    authenticator.authenticate(request(f, { snapshotBytes: Uint8Array.from([0xc3, 0x28]) })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
  await expectCode(
    authenticator.authenticate(request(f, { snapshotBytes: Buffer.from("{", "utf8") })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
  const malformed = { ...f.envelope, signature: "A".repeat(85) + "B" };
  await expectCode(
    authenticator.authenticate(request(f, {
      snapshotBytes: Buffer.from(JSON.stringify(malformed), "utf8")
    })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
});

test("enforces the 48 KiB body bound before parsing", async () => {
  const f = fixture();
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const oversized = new Uint8Array(48 * 1024 + 1);
  await expectCode(
    authenticator.authenticate(request(f, { snapshotBytes: oversized })),
    "TRUST_REGISTRY_RESPONSE_TOO_LARGE"
  );
});

test("rejects snapshots issued in the future, expired or older than the configured age", async () => {
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const future = fixture({
    issuedAt: "2026-10-31T13:30:01.000Z",
    expiresAt: "2026-10-31T13:35:01.000Z"
  });
  await expectCode(
    authenticator.authenticate(request(future)),
    "TRUST_REGISTRY_SNAPSHOT_FROM_FUTURE"
  );

  const expired = fixture({
    issuedAt: "2026-10-31T13:20:00.000Z",
    expiresAt: "2026-10-31T13:29:59.000Z"
  });
  await expectCode(
    authenticator.authenticate(request(expired)),
    "TRUST_REGISTRY_SNAPSHOT_EXPIRED"
  );

  const stale = fixture({
    issuedAt: "2026-10-31T13:24:59.000Z",
    expiresAt: "2026-10-31T13:35:00.000Z"
  });
  await expectCode(
    authenticator.authenticate(request(stale)),
    "TRUST_REGISTRY_SNAPSHOT_STALE"
  );
});

test("rejects invalid timestamp encodings and excessive freshness windows", async () => {
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const invalidCalendarDate = fixture();
  const invalidDateEnvelope = {
    ...invalidCalendarDate.envelope,
    issuedAt: "2026-02-30T13:29:00.000Z"
  };
  await expectCode(
    authenticator.authenticate(request(invalidCalendarDate, {
      snapshotBytes: Buffer.from(JSON.stringify(invalidDateEnvelope), "utf8")
    })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
  const valid = fixture();
  await expectCode(
    authenticator.authenticate(request(valid, { maxSnapshotAgeMs: 300_001 })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
  await expectCode(
    authenticator.authenticate(request(valid, { now: "2026-10-31T13:30:00" })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
});

test("rejects a non-Ed25519 provider-decision public key inside a signed snapshot", async () => {
  const base = fixture();
  const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const invalidKeySnapshot = fixture({
    keys: [{
      ...base.payload.keys[0],
      publicKeyPem: rsa.publicKey.export({ type: "spki", format: "pem" }).toString()
    }]
  });
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  await expectCode(
    authenticator.authenticate(request(invalidKeySnapshot)),
    "TRUST_REGISTRY_SNAPSHOT_KEY_INVALID"
  );
});

test("rejects unknown fields, malformed key records and duplicate signing-key IDs", async () => {
  const authenticator = createEd25519ProviderTrustSnapshotAuthenticator();
  const f = fixture();
  const withExtra = { ...f.envelope, untrustedField: true };
  await expectCode(
    authenticator.authenticate(request(f, {
      snapshotBytes: Buffer.from(JSON.stringify(withExtra), "utf8")
    })),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );

  const invalidKey = {
    ...f.envelope,
    keys: [{ ...f.envelope.keys[0], allowedProviderIds: ["dex-screener", "dex-screener"] }]
  };
  await expectCode(
    authenticator.authenticate(request(f, {
      snapshotBytes: Buffer.from(JSON.stringify(invalidKey), "utf8")
    })),
    "TRUST_REGISTRY_SNAPSHOT_KEY_INVALID"
  );

  const duplicateIds = {
    ...f.envelope,
    keys: [f.envelope.keys[0], f.envelope.keys[0]]
  };
  await expectCode(
    authenticator.authenticate(request(f, {
      snapshotBytes: Buffer.from(JSON.stringify(duplicateIds), "utf8")
    })),
    "TRUST_REGISTRY_DUPLICATE_KEY_ID"
  );
});


test("startup trust-anchor validation checks the Ed25519 SPKI pin without a registry response", async () => {
  const f = fixture();
  await assert.doesNotReject(validateProviderTrustRegistryTrustAnchor(f.trustAnchor));

  await expectCode(
    validateProviderTrustRegistryTrustAnchor({
      ...f.trustAnchor,
      expectedSpkiSha256: "b".repeat(64)
    }),
    "TRUST_REGISTRY_ROOT_FINGERPRINT_MISMATCH"
  );

  const rsaRoot = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const rsaDer = rsaRoot.publicKey.export({ type: "spki", format: "der" });
  await expectCode(
    validateProviderTrustRegistryTrustAnchor({
      ...f.trustAnchor,
      rootPublicKeyPem: rsaRoot.publicKey.export({ type: "spki", format: "pem" }).toString(),
      expectedSpkiSha256: createHash("sha256").update(rsaDer).digest("hex")
    }),
    "TRUST_REGISTRY_ROOT_KEY_MISMATCH"
  );
});
