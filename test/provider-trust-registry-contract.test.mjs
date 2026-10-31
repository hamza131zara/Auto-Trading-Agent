import assert from "node:assert/strict";
import test from "node:test";
import {
  getProviderTrustRegistrySigningPayload,
  PROVIDER_TRUST_REGISTRY_LIMITS,
  PROVIDER_TRUST_REGISTRY_SIGNATURE_ALGORITHM,
  PROVIDER_TRUST_REGISTRY_SIGNING_DOMAIN,
  PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
  ProviderTrustRegistryError,
  validateProviderTrustRegistryHighWaterMark,
  validateProviderTrustRegistrySnapshotEnvelope
} from "../packages/market-data/dist/provider-trust-registry.js";

const KEY = {
  keyId: "owner-decision-key-01",
  owner: "repository-owner",
  publicKeyPem: "-----BEGIN PUBLIC KEY-----\nTEST PUBLIC KEY BYTES\n-----END PUBLIC KEY-----",
  notBefore: "2026-01-01T00:00:00.000Z",
  expiresAt: "2027-01-01T00:00:00.000Z",
  revokedAt: null,
  allowedProviderIds: ["dex-screener", "solana-public-shared"],
  allowedPurposes: ["DIAGNOSTIC"]
};

function snapshot(overrides = {}) {
  return {
    schemaVersion: PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
    registryId: "owner-provider-trust",
    rootKeyId: "registry-root-01",
    algorithm: PROVIDER_TRUST_REGISTRY_SIGNATURE_ALGORITHM,
    version: 7,
    issuedAt: "2026-10-31T13:00:00.000Z",
    expiresAt: "2026-10-31T13:05:00.000Z",
    keys: [structuredClone(KEY)],
    ...overrides
  };
}

test("trust registry contract publishes the protocol's bounded defaults", () => {
  assert.equal(PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION, "ata.provider-trust-registry-snapshot.v1");
  assert.deepEqual(PROVIDER_TRUST_REGISTRY_LIMITS, {
    maxSnapshotBytes: 48 * 1024,
    maxKeys: 64,
    maxAgeMs: 300_000,
    maxRequestTimeoutMs: 5_000
  });
});

test("canonical signing payload uses the documented domain and exact fixed property order", () => {
  const payload = getProviderTrustRegistrySigningPayload(snapshot());
  const parsed = JSON.parse(payload);

  assert.equal(parsed.domain, PROVIDER_TRUST_REGISTRY_SIGNING_DOMAIN);
  assert.deepEqual(Object.keys(parsed), [
    "domain",
    "schemaVersion",
    "registryId",
    "rootKeyId",
    "algorithm",
    "version",
    "issuedAt",
    "expiresAt",
    "keys"
  ]);
  assert.deepEqual(Object.keys(parsed.keys[0]), [
    "keyId",
    "owner",
    "publicKeyPem",
    "notBefore",
    "expiresAt",
    "revokedAt",
    "allowedProviderIds",
    "allowedPurposes"
  ]);
  assert.equal(Object.hasOwn(parsed, "signature"), false);
  assert.equal(parsed.version, 7);
});

test("envelope validation requires the exact protocol fields and signature encoding", () => {
  const envelope = { ...snapshot(), signature: "A".repeat(86) };
  assert.equal(validateProviderTrustRegistrySnapshotEnvelope(envelope).signature, envelope.signature);
  assert.throws(
    () => validateProviderTrustRegistrySnapshotEnvelope({ ...envelope, unexpected: true }),
    /TRUST_REGISTRY_SNAPSHOT_INVALID/
  );
  assert.throws(
    () => validateProviderTrustRegistrySnapshotEnvelope({ ...snapshot(), signature: "short" }),
    /TRUST_REGISTRY_SNAPSHOT_INVALID/
  );
  assert.throws(
    () => validateProviderTrustRegistrySnapshotEnvelope({
      ...snapshot(),
      signature: "A".repeat(85) + "B"
    }),
    /TRUST_REGISTRY_SNAPSHOT_INVALID/
  );
});

test("canonical payload rejects wrong schema, extra fields and unsafe versions", () => {
  assert.throws(
    () => getProviderTrustRegistrySigningPayload(snapshot({ schemaVersion: "unknown" })),
    /TRUST_REGISTRY_SNAPSHOT_INVALID/
  );
  assert.throws(
    () => getProviderTrustRegistrySigningPayload({ ...snapshot(), signature: "not-part-of-payload" }),
    /TRUST_REGISTRY_SNAPSHOT_INVALID/
  );
  assert.throws(
    () => getProviderTrustRegistrySigningPayload(snapshot({ version: Number.MAX_SAFE_INTEGER + 1 })),
    /TRUST_REGISTRY_SNAPSHOT_INVALID/
  );
});

test("canonical payload rejects duplicate key IDs and malformed provider scopes", () => {
  assert.throws(
    () => getProviderTrustRegistrySigningPayload(snapshot({ keys: [structuredClone(KEY), structuredClone(KEY)] })),
    /TRUST_REGISTRY_SNAPSHOT_DUPLICATE_KEY_ID/
  );
  assert.throws(
    () => getProviderTrustRegistrySigningPayload(snapshot({
      keys: [{ ...KEY, allowedProviderIds: ["dex-screener", "dex-screener"] }]
    })),
    /TRUST_REGISTRY_SNAPSHOT_KEY_INVALID/
  );
});

test("high-water records require the expected registry, safe version and SHA-256 digest", () => {
  const record = {
    registryId: "owner-provider-trust",
    version: 7,
    canonicalPayloadSha256: "a".repeat(64)
  };
  assert.deepEqual(
    validateProviderTrustRegistryHighWaterMark(record, "owner-provider-trust"),
    record
  );
  assert.throws(
    () => validateProviderTrustRegistryHighWaterMark(record, "another-registry"),
    /TRUST_REGISTRY_HIGH_WATER_MARK_INVALID/
  );
  assert.throws(
    () => validateProviderTrustRegistryHighWaterMark({ ...record, version: 0 }, "owner-provider-trust"),
    /TRUST_REGISTRY_HIGH_WATER_MARK_INVALID/
  );
  assert.throws(
    () => validateProviderTrustRegistryHighWaterMark({ ...record, canonicalPayloadSha256: "bad" }, "owner-provider-trust"),
    /TRUST_REGISTRY_HIGH_WATER_MARK_INVALID/
  );
});

test("registry errors expose sanitized stable codes without attached response details", () => {
  const error = new ProviderTrustRegistryError("TRUST_REGISTRY_AUTHENTICATION_FAILED");
  assert.equal(error.name, "ProviderTrustRegistryError");
  assert.equal(error.code, "TRUST_REGISTRY_AUTHENTICATION_FAILED");
  assert.equal(error.message, "TRUST_REGISTRY_AUTHENTICATION_FAILED");
  assert.equal(error.stack?.includes("https://"), false);
});
