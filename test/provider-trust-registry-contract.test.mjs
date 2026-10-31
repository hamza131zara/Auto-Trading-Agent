import assert from "node:assert/strict";
import test from "node:test";
import {
  PROVIDER_TRUST_REGISTRY_LIMITS,
  PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
  ProviderTrustRegistryError
} from "../packages/market-data/dist/provider-trust-registry.js";

test("trust registry contract publishes strict bounded defaults", () => {
  assert.equal(PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION, "ata.provider-trust-registry-snapshot.v1");
  assert.deepEqual(PROVIDER_TRUST_REGISTRY_LIMITS, {
    maxSnapshotBytes: 48 * 1024,
    maxKeys: 64,
    maxAgeMs: 300_000,
    maxRequestTimeoutMs: 5_000
  });
});

test("registry errors expose sanitized stable codes only", () => {
  const error = new ProviderTrustRegistryError("TRUST_REGISTRY_AUTHENTICATION_FAILED");
  assert.equal(error.name, "ProviderTrustRegistryError");
  assert.equal(error.code, "TRUST_REGISTRY_AUTHENTICATION_FAILED");
  assert.equal(error.message, "TRUST_REGISTRY_AUTHENTICATION_FAILED");
  assert.equal(error.stack?.includes("https://"), false);
});
