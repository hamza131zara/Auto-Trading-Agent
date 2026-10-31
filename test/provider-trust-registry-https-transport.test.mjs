import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { Readable } from "node:stream";
import { Agent } from "node:https";
import test from "node:test";
import {
  NodeHttpsProviderTrustRegistryTransport
} from "../packages/market-data/dist/provider-trust-registry-https-transport.js";

const ORIGIN = "https://trust.example";
const ENDPOINT = ORIGIN + "/v1/signed-snapshot?registry=owner-provider-trust";
const MAX_BYTES = 48 * 1024;
const approvedLookup = (_hostname, _options, callback) => {
  callback(null, "203.0.113.10", 4);
};

function makeRequest(overrides = {}) {
  return {
    expectedOrigin: ORIGIN,
    timeoutMs: 2_500,
    maxResponseBytes: MAX_BYTES,
    redirect: "error",
    acceptContentType: "application/json",
    signal: new AbortController().signal,
    ...overrides
  };
}

function makeRequester(options = {}) {
  const calls = {
    count: 0,
    responseDestroyed: false,
    requestDestroyed: false,
    timeoutMs: null,
    timeoutHandler: null,
    requestOptions: null,
    url: null
  };
  const requester = (url, requestOptions, onResponse) => {
    calls.count += 1;
    calls.url = url;
    calls.requestOptions = requestOptions;
    const request = new EventEmitter();
    request.destroy = () => {
      calls.requestDestroyed = true;
      return request;
    };
    request.setTimeout = (timeoutMs, handler) => {
      calls.timeoutMs = timeoutMs;
      calls.timeoutHandler = handler;
      if (options.timeoutOnEnd) {
        queueMicrotask(() => handler());
      }
      return request;
    };
    request.end = () => {
      if (options.errorOnEnd) {
        queueMicrotask(() => request.emit("error", new Error("private host and credentials")));
        return;
      }
      if (options.timeoutOnEnd) return;
      queueMicrotask(() => {
        const response = Readable.from(options.chunks ?? [Buffer.from("signed snapshot")], {
          objectMode: false
        });
        response.statusCode = options.statusCode ?? 200;
        response.headers = options.headers ?? {
          "content-type": "application/json; charset=utf-8"
        };
        const originalDestroy = response.destroy.bind(response);
        response.destroy = (error) => {
          // Readable auto-destroys after normal end; only count premature aborts.
          if (!response.readableEnded) calls.responseDestroyed = true;
          return originalDestroy(error);
        };
        onResponse(response);
      });
    };
    return request;
  };
  return { requester, calls };
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => {
    assert.equal(error.code, code);
    assert.equal(error.message, code);
    return true;
  });
}

test("uses one fixed HTTPS endpoint and a dedicated verified direct-TLS agent", async () => {
  const fake = makeRequester();
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  const request = makeRequest();
  const response = await transport.readSnapshot(request);
  const options = fake.calls.requestOptions;

  assert.equal(fake.calls.count, 1);
  assert.equal(fake.calls.url.href, ENDPOINT);
  assert.equal(options.method, "GET");
  assert.ok(options.agent instanceof Agent);
  assert.equal(options.rejectUnauthorized, true);
  assert.equal(options.servername, "trust.example");
  assert.equal(options.minVersion, "TLSv1.2");
  assert.equal(options.signal, request.signal);
  assert.equal(options.lookup, approvedLookup);
  assert.equal(fake.calls.timeoutMs, request.timeoutMs);
  assert.deepEqual(options.headers, {
    Accept: "application/json",
    "Accept-Encoding": "identity",
    "Cache-Control": "no-cache",
    Connection: "close"
  });
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(options.headers.Cookie, undefined);
  assert.equal(options.headers["Proxy-Authorization"], undefined);
  assert.equal(response.status, 200);
  assert.equal(response.finalOrigin, ORIGIN);
  assert.equal(response.redirected, false);
  assert.equal(response.contentType, "application/json; charset=utf-8");
  assert.equal(Buffer.from(response.bytes).toString("utf8"), "signed snapshot");
});

test("rejects HTTP, userinfo, fragments, non-canonical endpoints and origin mismatch before I/O", async () => {
  const fake = makeRequester();
  for (const endpointUrl of [
    "http://trust.example/v1/snapshot",
    "https://user:password@trust.example/v1/snapshot",
    "https://trust.example/v1/snapshot#fragment",
    "https://trust.example:443/v1/snapshot"
  ]) {
    await expectCode(
      Promise.resolve().then(() => new NodeHttpsProviderTrustRegistryTransport({
        endpointUrl,
        requester: fake.requester
      })),
      "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
    );
  }

  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  await expectCode(
    transport.readSnapshot(makeRequest({ expectedOrigin: "https://other.example" })),
    "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
  );
  assert.equal(fake.calls.count, 0);
});

test("requires an explicit owner-supplied DNS lookup policy", async () => {
  const fake = makeRequester();
  await expectCode(
    Promise.resolve().then(() => new NodeHttpsProviderTrustRegistryTransport({
      endpointUrl: ENDPOINT,
      requester: fake.requester
    })),
    "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
  );
  assert.equal(fake.calls.count, 0);
});

test("refuses non-HTTPS or unbounded transport request policies before I/O", async () => {
  const fake = makeRequester();
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  await expectCode(
    transport.readSnapshot(makeRequest({ redirect: "follow" })),
    "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
  );
  await expectCode(
    transport.readSnapshot(makeRequest({ timeoutMs: 5_001 })),
    "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
  );
  await expectCode(
    transport.readSnapshot(makeRequest({ maxResponseBytes: MAX_BYTES + 1 })),
    "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
  );
  assert.equal(fake.calls.count, 0);
});

test("does not follow a redirect or contact the Location host", async () => {
  const fake = makeRequester({
    statusCode: 302,
    headers: {
      "content-type": "application/json",
      location: "https://attacker.example/collect"
    }
  });
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  const response = await transport.readSnapshot(makeRequest());
  assert.equal(fake.calls.count, 1);
  assert.equal(response.status, 302);
  assert.equal(response.redirected, false);
  assert.equal(response.bytes.byteLength, 0);
  assert.equal(fake.calls.url.origin, ORIGIN);
});

test("accepts exactly 48 KiB when streamed in multiple chunks", async () => {
  const first = Buffer.alloc(20 * 1024, 0x61);
  const second = Buffer.alloc(MAX_BYTES - first.byteLength, 0x62);
  const fake = makeRequester({ chunks: [first, second] });
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  const response = await transport.readSnapshot(makeRequest());
  assert.equal(response.bytes.byteLength, MAX_BYTES);
  assert.equal(fake.calls.responseDestroyed, false);
});

test("aborts and rejects a body that exceeds 48 KiB while streaming", async () => {
  const fake = makeRequester({
    chunks: [Buffer.alloc(MAX_BYTES, 0x61), Buffer.from([0x62])]
  });
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  await expectCode(
    transport.readSnapshot(makeRequest()),
    "TRUST_REGISTRY_RESPONSE_TOO_LARGE"
  );
  assert.equal(fake.calls.responseDestroyed, true);
  assert.equal(fake.calls.requestDestroyed, true);
});

test("rejects an oversized Content-Length before consuming the response body", async () => {
  const fake = makeRequester({
    headers: {
      "content-type": "application/json",
      "content-length": String(MAX_BYTES + 1)
    },
    chunks: [Buffer.alloc(MAX_BYTES + 1)]
  });
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  await expectCode(
    transport.readSnapshot(makeRequest()),
    "TRUST_REGISTRY_RESPONSE_TOO_LARGE"
  );
  assert.equal(fake.calls.responseDestroyed, true);
});

test("rejects compressed or ambiguous content-encoding instead of risking expansion", async () => {
  for (const contentEncoding of ["gzip", ["identity", "gzip"]]) {
    const fake = makeRequester({
      headers: {
        "content-type": "application/json",
        "content-encoding": contentEncoding
      }
    });
    const transport = new NodeHttpsProviderTrustRegistryTransport({
      endpointUrl: ENDPOINT,
      lookup: approvedLookup,
      requester: fake.requester
    });
    await expectCode(
      transport.readSnapshot(makeRequest()),
      "TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID"
    );
    assert.equal(fake.calls.responseDestroyed, true);
  }
});

test("returns response metadata for invalid status or content type for loader rejection", async () => {
  const invalidCases = [
    { statusCode: 503, headers: { "content-type": "application/json" } },
    { statusCode: 200, headers: { "content-type": "text/plain" } },
    { statusCode: 200, headers: { "content-type": "application/json; charset=utf-16" } }
  ];
  for (const invalidCase of invalidCases) {
    const fake = makeRequester(invalidCase);
    const transport = new NodeHttpsProviderTrustRegistryTransport({
      endpointUrl: ENDPOINT,
      lookup: approvedLookup,
      requester: fake.requester
    });
    const response = await transport.readSnapshot(makeRequest());
    assert.equal(response.status, invalidCase.statusCode);
    assert.equal(response.bytes.byteLength, 0);
  }
});

test("sanitizes socket failures and timeout failures", async () => {
  for (const options of [{ errorOnEnd: true }, { timeoutOnEnd: true }]) {
    const fake = makeRequester(options);
    const transport = new NodeHttpsProviderTrustRegistryTransport({
      endpointUrl: ENDPOINT,
      lookup: approvedLookup,
      requester: fake.requester
    });
    await expectCode(
      transport.readSnapshot(makeRequest()),
      "TRUST_REGISTRY_UNAVAILABLE"
    );
    assert.equal(fake.calls.requestDestroyed, true);
  }
});

test("honors a pre-aborted caller signal without creating a request", async () => {
  const fake = makeRequester();
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: ENDPOINT,
    lookup: approvedLookup,
    requester: fake.requester
  });
  const controller = new AbortController();
  controller.abort();
  await expectCode(
    transport.readSnapshot(makeRequest({ signal: controller.signal })),
    "TRUST_REGISTRY_UNAVAILABLE"
  );
  assert.equal(fake.calls.count, 0);
});
