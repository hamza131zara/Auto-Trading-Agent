import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:https";
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import test from "node:test";
import {
  NodeHttpsProviderTrustRegistryTransport
} from "../packages/market-data/dist/provider-trust-registry-https-transport.js";
import {
  parseProviderTrustRegistryConfig
} from "../packages/config/dist/index.js";
import {
  getProviderTrustRegistrySigningPayload,
  PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION
} from "../packages/market-data/dist/provider-trust-registry.js";
import {
  getProviderUseDecisionSigningPayload,
  PROVIDER_USE_DECISION_ENVELOPE_VERSION,
  PROVIDER_USE_DECISION_SIGNATURE_ALGORITHM
} from "../packages/market-data/dist/provider-use-decision-verifier.js";
import {
  createProviderTrustRegistryAuthorizationRuntime
} from "../packages/market-data/dist/provider-trust-registry-runtime.js";

const REQUIRED = process.env.REQUIRE_PROVIDER_TRUST_REGISTRY_HTTPS_TLS_INTEGRATION === "true";
const certificateDirectory = process.env.PG_TLS_CERT_DIR;
const EXPECTED_HOST = "pg-tls.test";

if (REQUIRED && !certificateDirectory) {
  throw new Error("PG_TLS_CERT_DIR is required for the provider trust-registry HTTPS integration test");
}

async function startTlsServer(t, fixture, handler) {
  const [certificate, privateKey] = await Promise.all([
    readFile(join(certificateDirectory, fixture, "server.crt"), "utf8"),
    readFile(join(certificateDirectory, fixture, "server.key"), "utf8")
  ]);
  const server = createServer({ cert: certificate, key: privateKey }, handler);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert.ok(address && typeof address === "object" && Number.isSafeInteger(address.port));

  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(() => resolve()));
  });

  return {
    server,
    port: address.port
  };
}

function createOwnerLookup(expectedHostname) {
  const hostnames = [];
  const lookup = (hostname, options, callback) => {
    hostnames.push(hostname);
    if (hostname !== expectedHostname) {
      const error = new Error("owner DNS policy rejected hostname");
      error.code = "EAI_AGAIN";
      callback(error);
      return;
    }
    if (options?.all === true) {
      callback(null, [{ address: "127.0.0.1", family: 4 }]);
      return;
    }
    callback(null, "127.0.0.1", 4);
  };
  return { lookup, hostnames };
}

function createTransport(hostname, port, lookup) {
  const endpointUrl = "https://" + hostname + ":" + port + "/v1/signed-snapshot?registry=local-fixture";
  const expectedOrigin = "https://" + hostname + ":" + port;
  return {
    endpointUrl,
    expectedOrigin,
    transport: new NodeHttpsProviderTrustRegistryTransport({
      endpointUrl,
      lookup
    })
  };
}

function makeRequest(expectedOrigin, overrides = {}) {
  return {
    expectedOrigin,
    timeoutMs: 2_000,
    maxResponseBytes: 48 * 1024,
    redirect: "error",
    acceptContentType: "application/json",
    signal: new AbortController().signal,
    ...overrides
  };
}

async function expectUnavailable(promise, reason) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, "TRUST_REGISTRY_UNAVAILABLE", reason);
    assert.equal(error.message, "TRUST_REGISTRY_UNAVAILABLE",
      "transport failure messages must not expose TLS, host, or socket details");
    assert.doesNotMatch(error.stack ?? "", /pg-tls|certificate|private key|password/i);
    return true;
  });
}

test("NodeHttpsProviderTrustRegistryTransport real TLS handshake and rejection matrix", {
  skip: !certificateDirectory
}, async (t) => {
  assert.equal(REQUIRED, true,
    "The dedicated Phase 6 TLS workflow must explicitly require the real HTTPS tests");
  assert.ok(process.env.NODE_EXTRA_CA_CERTS,
    "the local disposable CA must be installed for this Node process before startup");

  await t.test("trusted CA and matching DNS hostname establish HTTPS and return exact bytes", async (subtest) => {
    let requests = 0;
    const fixture = await startTlsServer(subtest, "registry-valid", (request, response) => {
      requests += 1;
      assert.equal(request.method, "GET");
      assert.equal(request.url, "/v1/signed-snapshot?registry=local-fixture");
      assert.equal(request.headers.accept, "application/json");
      assert.equal(request.headers["accept-encoding"], "identity");
      const body = Buffer.from('{"snapshot":"local-tls-fixture"}', "utf8");
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": String(body.byteLength)
      });
      response.end(body);
    });
    const dns = createOwnerLookup(EXPECTED_HOST);
    const configured = createTransport(EXPECTED_HOST, fixture.port, dns.lookup);
    const response = await configured.transport.readSnapshot(
      makeRequest(configured.expectedOrigin)
    );

    assert.equal(requests, 1);
    assert.deepEqual(dns.hostnames, [EXPECTED_HOST]);
    assert.equal(response.status, 200);
    assert.equal(response.finalOrigin, configured.expectedOrigin);
    assert.equal(response.redirected, false);
    assert.equal(response.contentType, "application/json; charset=utf-8");
    assert.equal(Buffer.from(response.bytes).toString("utf8"), '{"snapshot":"local-tls-fixture"}');
  });

  await t.test("trusted CA does not override hostname verification", async (subtest) => {
    let requests = 0;
    const fixture = await startTlsServer(subtest, "registry-valid", (_request, response) => {
      requests += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
    const wrongHostname = "wrong.pg-tls.test";
    const dns = createOwnerLookup(wrongHostname);
    const configured = createTransport(wrongHostname, fixture.port, dns.lookup);

    await expectUnavailable(
      configured.transport.readSnapshot(makeRequest(configured.expectedOrigin)),
      "a CA-trusted certificate with the wrong DNS SAN must be rejected"
    );
    assert.deepEqual(dns.hostnames, [wrongHostname]);
    assert.equal(requests, 0, "HTTP handler must not run after a TLS hostname failure");
  });

  await t.test("a matching hostname signed by an untrusted CA is rejected", async (subtest) => {
    let requests = 0;
    const fixture = await startTlsServer(subtest, "rogue", (_request, response) => {
      requests += 1;
      response.writeHead(200, { "content-type": "application/json" });
      response.end("{}");
    });
    const dns = createOwnerLookup(EXPECTED_HOST);
    const configured = createTransport(EXPECTED_HOST, fixture.port, dns.lookup);

    await expectUnavailable(
      configured.transport.readSnapshot(makeRequest(configured.expectedOrigin)),
      "a matching DNS SAN must not bypass an untrusted certificate chain"
    );
    assert.deepEqual(dns.hostnames, [EXPECTED_HOST]);
    assert.equal(requests, 0, "HTTP handler must not run after an untrusted-CA failure");
  });

  await t.test("HTTP redirect is returned as a non-success response and never followed", async (subtest) => {
    let requests = 0;
    const fixture = await startTlsServer(subtest, "registry-valid", (_request, response) => {
      requests += 1;
      response.writeHead(302, {
        "content-type": "application/json",
        location: "https://redirect-target.invalid:4443/collect"
      });
      response.end("{}");
    });
    const dns = createOwnerLookup(EXPECTED_HOST);
    const configured = createTransport(EXPECTED_HOST, fixture.port, dns.lookup);
    const response = await configured.transport.readSnapshot(
      makeRequest(configured.expectedOrigin)
    );

    assert.equal(requests, 1);
    assert.deepEqual(dns.hostnames, [EXPECTED_HOST],
      "the redirect target must never be resolved");
    assert.equal(response.status, 302);
    assert.equal(response.redirected, false);
    assert.equal(response.bytes.byteLength, 0);
    assert.equal(response.finalOrigin, configured.expectedOrigin);
  });

  await t.test("socket inactivity timeout rejects and sanitizes a stalled response", async (subtest) => {
    let requests = 0;
    const fixture = await startTlsServer(subtest, "registry-valid", (_request, _response) => {
      requests += 1;
      // Intentionally hold the response open without sending headers or bytes.
    });
    const dns = createOwnerLookup(EXPECTED_HOST);
    const configured = createTransport(EXPECTED_HOST, fixture.port, dns.lookup);

    await expectUnavailable(
      configured.transport.readSnapshot(
        makeRequest(configured.expectedOrigin, { timeoutMs: 150 })
      ),
      "a response that makes no progress must time out"
    );
    assert.equal(requests, 1);
  });

  await t.test("AbortSignal cancels an in-flight TLS request", async (subtest) => {
    let requests = 0;
    let notifyRequest;
    const requestSeen = new Promise((resolve) => {
      notifyRequest = resolve;
    });
    const fixture = await startTlsServer(subtest, "registry-valid", (_request, _response) => {
      requests += 1;
      notifyRequest();
      // Deliberately do not answer; the test aborts after the request arrives.
    });
    const dns = createOwnerLookup(EXPECTED_HOST);
    const configured = createTransport(EXPECTED_HOST, fixture.port, dns.lookup);
    const controller = new AbortController();
    const pending = configured.transport.readSnapshot(
      makeRequest(configured.expectedOrigin, {
        timeoutMs: 3_000,
        signal: controller.signal
      })
    );

    await requestSeen;
    controller.abort();
    await expectUnavailable(pending, "in-flight cancellation must reject with a sanitized reason");
    assert.equal(requests, 1);
  });

  await t.test("startup bootstrap refreshes signed registry keys before authorizing an owner decision", async (subtest) => {
    const rootPair = generateKeyPairSync("ed25519");
    const providerPair = generateKeyPairSync("ed25519");
    const rootPublicKeyPem = rootPair.publicKey.export({
      type: "spki",
      format: "pem"
    }).toString();
    const rootFingerprint = createHash("sha256")
      .update(rootPair.publicKey.export({ type: "spki", format: "der" }))
      .digest("hex");
    const providerPublicKeyPem = providerPair.publicKey.export({
      type: "spki",
      format: "pem"
    }).toString();

    const at = new Date(Date.now() - 1_000).toISOString();
    const issuedAt = at;
    const expiresAt = new Date(Date.parse(at) + 180_000).toISOString();
    const trustedKeys = [{
      keyId: "provider-decision-key-01",
      owner: "test-owner",
      publicKeyPem: providerPublicKeyPem,
      notBefore: new Date(Date.parse(at) - 60_000).toISOString(),
      expiresAt: new Date(Date.parse(at) + 600_000).toISOString(),
      revokedAt: null,
      allowedProviderIds: ["dex-screener"],
      allowedPurposes: ["DIAGNOSTIC"]
    }];
    const unsignedSnapshot = {
      schemaVersion: PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
      registryId: "owner-provider-trust",
      rootKeyId: "owner-root-01",
      algorithm: "Ed25519",
      version: 1,
      issuedAt,
      expiresAt,
      keys: trustedKeys
    };
    const snapshotPayload = getProviderTrustRegistrySigningPayload(unsignedSnapshot);
    const snapshotSignature = sign(
      null,
      Buffer.from(snapshotPayload, "utf8"),
      rootPair.privateKey
    ).toString("base64url");
    const snapshotBody = Buffer.from(JSON.stringify({
      ...unsignedSnapshot,
      signature: snapshotSignature
    }), "utf8");

    const decision = {
      providerId: "dex-screener",
      purpose: "DIAGNOSTIC",
      decisionId: "owner-diagnostic-decision-01",
      owner: "test-owner",
      outcome: "PROCEED_DIAGNOSTIC_ONLY",
      scope: "Test-only read-only diagnostic request for dex-screener",
      decidedAt: new Date(Date.parse(at) - 30_000).toISOString(),
      expiresAt: new Date(Date.parse(at) + 120_000).toISOString(),
      linkedEvidenceIds: ["provider-rights-review-test"],
      evidenceManifestSha256: "c".repeat(64)
    };
    const unsignedDecision = {
      schemaVersion: PROVIDER_USE_DECISION_ENVELOPE_VERSION,
      keyId: "provider-decision-key-01",
      algorithm: PROVIDER_USE_DECISION_SIGNATURE_ALGORITHM,
      decision
    };
    const decisionSignature = sign(
      null,
      Buffer.from(getProviderUseDecisionSigningPayload(unsignedDecision), "utf8"),
      providerPair.privateKey
    ).toString("base64url");
    const signedDecision = { ...unsignedDecision, signature: decisionSignature };

    let httpRequests = 0;
    const fixture = await startTlsServer(subtest, "registry-valid", (request, response) => {
      httpRequests += 1;
      assert.equal(request.method, "GET");
      assert.equal(request.url, "/v1/signed-snapshot?registry=owner-provider-trust");
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "content-length": String(snapshotBody.byteLength)
      });
      response.end(snapshotBody);
    });

    const config = parseProviderTrustRegistryConfig({
      ATA_PROVIDER_TRUST_REGISTRY_ENABLED: "true",
      ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL:
        "https://" + EXPECTED_HOST + ":" + fixture.port +
        "/v1/signed-snapshot?registry=owner-provider-trust",
      ATA_PROVIDER_TRUST_REGISTRY_REGISTRY_ID: "owner-provider-trust",
      ATA_PROVIDER_TRUST_REGISTRY_ROOT_KEY_ID: "owner-root-01",
      ATA_PROVIDER_TRUST_REGISTRY_ROOT_PUBLIC_KEY_PEM: rootPublicKeyPem,
      ATA_PROVIDER_TRUST_REGISTRY_ROOT_SPKI_SHA256: rootFingerprint,
      ATA_PROVIDER_TRUST_REGISTRY_DNS_ALLOWED_IPS: "127.0.0.1"
    });

    let persisted = null;
    let databaseCalls = 0;
    const queryClient = {
      async query(sql, parameters = []) {
        databaseCalls += 1;
        if (sql.includes("provider_trust_registry_high_water_mark:read")) {
          return { rows: persisted === null ? [] : [persisted] };
        }
        if (sql.includes("provider_trust_registry_high_water_mark:insert_cas")) {
          if (persisted !== null) return { rows: [] };
          persisted = {
            registry_id: parameters[0],
            version: String(parameters[1]),
            canonical_payload_sha256: parameters[2]
          };
          return { rows: [persisted] };
        }
        throw new Error("unexpected test SQL operation");
      }
    };

    const runtime = await createProviderTrustRegistryAuthorizationRuntime({
      config,
      envelopes: [signedDecision],
      queryClient
    });

    assert.equal(runtime.enabled, true);
    assert.equal(httpRequests, 0, "startup must not fetch the registry eagerly");
    assert.equal(databaseCalls, 0, "startup must not query the database eagerly");

    const authorized = await runtime.resolveProviderUseDecision(
      "dex-screener",
      "DIAGNOSTIC",
      at
    );

    assert.equal(httpRequests, 1);
    assert.equal(databaseCalls, 2, "the snapshot must pass durable read + initial CAS before keys are used");
    assert.equal(persisted.registry_id, "owner-provider-trust");
    assert.equal(persisted.version, "1");
    assert.match(persisted.canonical_payload_sha256, /^[a-f0-9]{64}$/);
    assert.equal(authorized?.decisionId, "owner-diagnostic-decision-01");
    assert.equal(authorized?.providerId, "dex-screener");
    assert.equal(authorized?.purpose, "DIAGNOSTIC");
  });

});
