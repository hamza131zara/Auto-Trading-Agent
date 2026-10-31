import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { createServer } from "node:https";
import test from "node:test";
import {
  NodeHttpsProviderTrustRegistryTransport
} from "../packages/market-data/dist/provider-trust-registry-https-transport.js";

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
  const lookup = (hostname, _options, callback) => {
    hostnames.push(hostname);
    if (hostname !== expectedHostname) {
      const error = new Error("owner DNS policy rejected hostname");
      error.code = "EAI_AGAIN";
      callback(error);
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
    const fixture = await startTlsServer(subtest, "valid", (request, response) => {
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
    const fixture = await startTlsServer(subtest, "valid", (_request, response) => {
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
    const fixture = await startTlsServer(subtest, "valid", (_request, response) => {
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
    const fixture = await startTlsServer(subtest, "valid", (_request, _response) => {
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
    const fixture = await startTlsServer(subtest, "valid", (_request, _response) => {
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
});
