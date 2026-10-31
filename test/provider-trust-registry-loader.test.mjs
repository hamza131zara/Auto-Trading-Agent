import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  getProviderTrustRegistrySigningPayload,
  PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION
} from "../packages/market-data/dist/provider-trust-registry.js";
import {
  AuthenticatedProviderTrustRegistry
} from "../packages/market-data/dist/provider-trust-registry-loader.js";
import {
  createEd25519ProviderTrustSnapshotAuthenticator
} from "../packages/market-data/dist/provider-trust-registry-authenticator.js";

const NOW = "2026-10-31T13:30:00.000Z";
const ORIGIN = "https://trust.example";
const root = generateKeyPairSync("ed25519");
const delegated = generateKeyPairSync("ed25519");
const trustAnchor = {
  registryId: "owner-provider-trust",
  rootKeyId: "registry-root-01",
  rootPublicKeyPem: root.publicKey.export({ type: "spki", format: "pem" }).toString(),
  expectedSpkiSha256: createHash("sha256")
    .update(root.publicKey.export({ type: "spki", format: "der" }))
    .digest("hex")
};

function makeEnvelope(version = 1, overrides = {}) {
  const payload = {
    schemaVersion: PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
    registryId: trustAnchor.registryId,
    rootKeyId: trustAnchor.rootKeyId,
    algorithm: "Ed25519",
    version,
    issuedAt: "2026-10-31T13:29:00.000Z",
    expiresAt: "2026-10-31T13:35:00.000Z",
    keys: [{
      keyId: "owner-decision-key-01",
      owner: "repository-owner",
      publicKeyPem: delegated.publicKey.export({ type: "spki", format: "pem" }).toString(),
      notBefore: "2026-01-01T00:00:00.000Z",
      expiresAt: "2027-01-01T00:00:00.000Z",
      revokedAt: null,
      allowedProviderIds: ["dex-screener"],
      allowedPurposes: ["DIAGNOSTIC"]
    }],
    ...overrides
  };
  const canonical = getProviderTrustRegistrySigningPayload(payload);
  const signature = sign(null, Buffer.from(canonical, "utf8"), root.privateKey)
    .toString("base64url");
  return { ...payload, signature };
}

function response(overrides = {}) {
  return {
    status: 200,
    contentType: "application/json; charset=utf-8",
    finalOrigin: ORIGIN,
    redirected: false,
    bytes: Buffer.from(JSON.stringify(makeEnvelope()), "utf8"),
    ...overrides
  };
}

function makeStore(options = {}) {
  let current = options.initial ? { ...options.initial } : null;
  const events = options.events ?? [];
  return {
    events,
    async read(registryId) {
      events.push("store-read");
      if (options.readError) throw new Error("database details");
      return current === null ? null : { ...current, registryId };
    },
    async compareAndSet({ expected, next }) {
      events.push("store-cas");
      if (options.casError) throw new Error("SQL and connection details");
      if (options.casResult === false) return false;
      const matches = current === null
        ? expected === null
        : expected !== null &&
          current.version === expected.version &&
          current.canonicalPayloadSha256 === expected.canonicalPayloadSha256;
      if (!matches) return false;
      current = { ...next };
      return true;
    },
    inspect() {
      return current === null ? null : { ...current };
    }
  };
}

function makeLoaderInput(options = {}) {
  const events = options.events ?? [];
  const transportResponse = options.response ?? response();
  const store = options.store ?? makeStore({ events });
  const transport = options.transport ?? {
    async readSnapshot(request) {
      events.push("transport");
      options.onRequest?.(request);
      return transportResponse;
    }
  };
  const authenticator = options.authenticator ?? {
    ...createEd25519ProviderTrustSnapshotAuthenticator(),
    async authenticate(input) {
      events.push("authenticate");
      return createEd25519ProviderTrustSnapshotAuthenticator().authenticate(input);
    }
  };
  return {
    events,
    store,
    loader: new AuthenticatedProviderTrustRegistry(),
    input: {
      now: NOW,
      expectedOrigin: ORIGIN,
      requestTimeoutMs: 1_000,
      clock: () => NOW,
      trustAnchor,
      state: {
        expectedRegistryId: trustAnchor.registryId,
        maxSnapshotAgeMs: 300_000,
        highWaterMarkStore: store
      },
      transport,
      authenticator
    }
  };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

test("loads transport bytes, authenticates, persists the high-water mark, then returns keys", async () => {
  const events = [];
  let capturedRequest;
  const context = makeLoaderInput({
    events,
    onRequest(request) {
      capturedRequest = request;
    }
  });
  const snapshot = await context.loader.loadCurrentSnapshot(context.input);

  assert.deepEqual(events, ["transport", "authenticate", "store-read", "store-cas"]);
  assert.equal(capturedRequest.expectedOrigin, ORIGIN);
  assert.equal(capturedRequest.timeoutMs, 1_000);
  assert.equal(capturedRequest.maxResponseBytes, 48 * 1024);
  assert.equal(capturedRequest.redirect, "error");
  assert.equal(capturedRequest.acceptContentType, "application/json");
  assert.ok(capturedRequest.signal instanceof AbortSignal);
  assert.equal(capturedRequest.signal.aborted, false);
  assert.equal(snapshot.registryId, trustAnchor.registryId);
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.keys.length, 1);
  assert.equal(context.store.inspect()?.version, 1);
  assert.equal(Object.isFrozen(snapshot), true);
  assert.equal(Object.isFrozen(snapshot.keys[0]), true);
});

test("does not call transport for an invalid/non-HTTPS owner origin or registry mismatch", async () => {
  const context = makeLoaderInput();
  await expectCode(
    context.loader.loadCurrentSnapshot({
      ...context.input,
      expectedOrigin: "http://trust.example"
    }),
    "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
  );
  await expectCode(
    context.loader.loadCurrentSnapshot({
      ...context.input,
      expectedOrigin: "https://trust.example/path"
    }),
    "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
  );
  await expectCode(
    context.loader.loadCurrentSnapshot({
      ...context.input,
      state: { ...context.input.state, expectedRegistryId: "different-registry" }
    }),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
  assert.deepEqual(context.events, []);
});

test("rejects redirects, final-origin changes, non-200 status and invalid media types", async () => {
  const invalidResponses = [
    response({ redirected: true }),
    response({ finalOrigin: "https://attacker.example" }),
    response({ status: 302 }),
    response({ status: 204 }),
    response({ contentType: "text/json" }),
    response({ contentType: "application/json; charset=utf-16" }),
    response({ contentType: "application/json; boundary=x" }),
    response({ unexpected: "field" })
  ];
  for (const invalidResponse of invalidResponses) {
    const context = makeLoaderInput({ response: invalidResponse });
    await expectCode(
      context.loader.loadCurrentSnapshot(context.input),
      "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
    );
    assert.equal(context.store.calls?.compareAndSet ?? 0, 0);
  }
});

test("rejects oversized transport responses before authentication or persistence", async () => {
  const events = [];
  const context = makeLoaderInput({
    events,
    response: response({ bytes: new Uint8Array(48 * 1024 + 1) })
  });
  await expectCode(
    context.loader.loadCurrentSnapshot(context.input),
    "TRUST_REGISTRY_RESPONSE_TOO_LARGE"
  );
  assert.deepEqual(events, ["transport"]);
  assert.equal(context.store.inspect(), null);
});

test("transport errors are sanitized and never expose endpoint or response details", async () => {
  const context = makeLoaderInput({
    transport: {
      async readSnapshot() {
        throw new Error("secret URL, response body and credential");
      }
    }
  });
  await expectCode(
    context.loader.loadCurrentSnapshot(context.input),
    "TRUST_REGISTRY_UNAVAILABLE"
  );
  assert.equal(context.store.inspect(), null);
});

test("request timeout aborts the transport and returns no keys", async () => {
  let capturedSignal;
  const context = makeLoaderInput({
    transport: {
      async readSnapshot(request) {
        capturedSignal = request.signal;
        return new Promise(() => {});
      }
    }
  });
  await expectCode(
    context.loader.loadCurrentSnapshot({
      ...context.input,
      requestTimeoutMs: 20
    }),
    "TRUST_REGISTRY_UNAVAILABLE"
  );
  assert.equal(capturedSignal.aborted, true);
  assert.equal(context.store.inspect(), null);
});

test("authentication failure prevents the high-water mark store from being read", async () => {
  const events = [];
  const context = makeLoaderInput({
    events,
    authenticator: {
      async authenticate() {
        events.push("authenticate");
        throw new Error("bad signature details");
      }
    }
  });
  await expectCode(
    context.loader.loadCurrentSnapshot(context.input),
    "TRUST_REGISTRY_AUTHENTICATION_FAILED"
  );
  assert.deepEqual(events, ["transport", "authenticate"]);
  assert.equal(context.store.inspect(), null);
});

test("unavailable and conflicting durable state never returns a snapshot", async () => {
  const unavailableStore = makeStore({ readError: true });
  const unavailable = makeLoaderInput({ store: unavailableStore });
  await expectCode(
    unavailable.loader.loadCurrentSnapshot(unavailable.input),
    "TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE"
  );

  const conflictStore = makeStore({ casResult: false });
  const conflict = makeLoaderInput({ store: conflictStore });
  await expectCode(
    conflict.loader.loadCurrentSnapshot(conflict.input),
    "TRUST_REGISTRY_HIGH_WATER_MARK_CONFLICT"
  );
});

test("caller cannot enlarge response, age or timeout policy beyond protocol bounds", async () => {
  const context = makeLoaderInput();
  await expectCode(
    context.loader.loadCurrentSnapshot({
      ...context.input,
      requestTimeoutMs: 5_001
    }),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
  await expectCode(
    context.loader.loadCurrentSnapshot({
      ...context.input,
      state: { ...context.input.state, maxSnapshotAgeMs: 300_001 }
    }),
    "TRUST_REGISTRY_SNAPSHOT_INVALID"
  );
  assert.deepEqual(context.events, []);
});
