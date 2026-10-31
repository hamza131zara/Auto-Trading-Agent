import assert from "node:assert/strict";
import { createHash, generateKeyPairSync } from "node:crypto";
import test from "node:test";
import {
  createOwnerPinnedProviderTrustRegistryLookup,
  createProviderTrustRegistryAuthorizationRuntime
} from "../packages/market-data/dist/provider-trust-registry-runtime.js";

function createConfiguration(overrides = {}) {
  const root = generateKeyPairSync("ed25519");
  const pem = root.publicKey.export({ type: "spki", format: "pem" }).toString();
  const digest = createHash("sha256")
    .update(root.publicKey.export({ type: "spki", format: "der" }))
    .digest("hex");
  return {
    enabled: true,
    endpointUrl: "https://registry.example.invalid/v1/snapshot",
    expectedOrigin: "https://registry.example.invalid",
    endpointHostname: "registry.example.invalid",
    registryId: "owner-provider-trust",
    rootKeyId: "owner-root-01",
    rootPublicKeyPem: pem,
    expectedSpkiSha256: digest,
    dnsAllowedAddresses: ["203.0.113.10"],
    ...overrides
  };
}

test("disabled startup returns a default-deny resolver without a database client", async () => {
  const runtime = await createProviderTrustRegistryAuthorizationRuntime({
    config: { enabled: false },
    envelopes: []
  });

  assert.equal(runtime.enabled, false);
  assert.equal(runtime.resolveProviderUseDecision("dex-screener", "DIAGNOSTIC", "2026-11-01T00:00:00.000Z"), undefined);
});

test("enabled startup requires the durable PostgreSQL query client", async () => {
  await assert.rejects(
    createProviderTrustRegistryAuthorizationRuntime({
      config: createConfiguration(),
      envelopes: []
    }),
    (error) => {
      assert.equal(error.code, "TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
      return true;
    }
  );
});

test("enabled startup validates the independent root fingerprint before constructing database access", async () => {
  let databaseCalls = 0;
  const queryClient = {
    async query() {
      databaseCalls += 1;
      throw new Error("database must not be accessed during bootstrap");
    }
  };

  await assert.rejects(
    createProviderTrustRegistryAuthorizationRuntime({
      config: createConfiguration({ expectedSpkiSha256: "b".repeat(64) }),
      envelopes: [],
      queryClient
    }),
    (error) => {
      assert.equal(error.code, "TRUST_REGISTRY_ROOT_FINGERPRINT_MISMATCH");
      return true;
    }
  );
  assert.equal(databaseCalls, 0);
});

test("enabled startup is lazy and does not contact DNS, HTTPS or PostgreSQL until a matching decision exists", async () => {
  let databaseCalls = 0;
  const queryClient = {
    async query() {
      databaseCalls += 1;
      throw new Error("query must be deferred until registry authorization is needed");
    }
  };
  const runtime = await createProviderTrustRegistryAuthorizationRuntime({
    config: createConfiguration(),
    envelopes: [],
    queryClient
  });

  assert.equal(runtime.enabled, true);
  assert.equal(databaseCalls, 0);
  assert.equal(
    await runtime.resolveProviderUseDecision(
      "dex-screener",
      "DIAGNOSTIC",
      "2026-11-01T00:00:00.000Z"
    ),
    undefined
  );
  assert.equal(databaseCalls, 0);
});

test("ambiguous matching signed decisions are denied before any registry read", async () => {
  let databaseCalls = 0;
  const queryClient = {
    async query() {
      databaseCalls += 1;
      throw new Error("registry read must not occur for ambiguous envelopes");
    }
  };
  const envelope = {
    decision: {
      providerId: "dex-screener",
      purpose: "DIAGNOSTIC"
    }
  };
  const runtime = await createProviderTrustRegistryAuthorizationRuntime({
    config: createConfiguration(),
    envelopes: [envelope, envelope],
    queryClient
  });

  assert.equal(
    await runtime.resolveProviderUseDecision(
      "dex-screener",
      "DIAGNOSTIC",
      "2026-11-01T00:00:00.000Z"
    ),
    undefined
  );
  assert.equal(databaseCalls, 0);
});

test("the owner-pinned DNS callback rejects any host other than the configured endpoint", async () => {
  const lookup = createOwnerPinnedProviderTrustRegistryLookup({
    endpointHostname: "registry.example.invalid",
    allowedAddresses: ["203.0.113.10"]
  });
  const result = await new Promise((resolve) => {
    lookup("attacker.example.invalid", { all: true }, (error, address) => {
      resolve({ error, address });
    });
  });

  assert.equal(result.error.code, "EAI_AGAIN");
  assert.equal(result.error.message, "PROVIDER_TRUST_REGISTRY_DNS_POLICY_REJECTED");
  assert.equal(result.address, "");
});
