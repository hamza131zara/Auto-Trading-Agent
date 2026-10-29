import assert from "node:assert/strict";
import test from "node:test";
import {
  SolanaRpcAccountReader,
  SolanaRpcReaderError
} from "../packages/market-data/dist/index.js";

const baseMint = "So11111111111111111111111111111111111111112";
const quoteMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const owner = "11111111111111111111111111111111";
const endpoint = "https://rpc.example.invalid/path?token=fixture-only";
const request = {
  addresses: [baseMint, quoteMint],
  commitment: "finalized",
  minContextSlot: 400,
  requestId: "reader-test-001"
};
const clock = () => "2026-10-29T00:01:00.000Z";

function account(overrides = {}) {
  return {
    data: ["AQIDBA==", "base64"],
    executable: false,
    lamports: 1_000_000,
    owner,
    space: 4,
    ...overrides
  };
}

function rpcResponse(value = [account(), account()], overrides = {}) {
  return new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: request.requestId,
    result: {
      context: { slot: 500 },
      value
    },
    ...overrides
  }), {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

function reader(fetchImpl, options = {}) {
  return new SolanaRpcAccountReader({
    endpoint,
    providerId: "test-rpc",
    clock,
    fetchImpl,
    ...options
  });
}

test("requests only explicit accounts with read-only getMultipleAccounts parameters", async () => {
  let calls = 0;
  const client = reader(async (input, init) => {
    calls += 1;
    assert.equal(String(input), endpoint);
    assert.equal(init?.method, "POST");
    assert.equal(init?.redirect, "error");
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    const body = JSON.parse(String(init?.body));
    assert.equal(body.jsonrpc, "2.0");
    assert.equal(body.id, request.requestId);
    assert.equal(body.method, "getMultipleAccounts");
    assert.deepEqual(body.params, [
      [baseMint, quoteMint],
      { encoding: "base64", commitment: "finalized", minContextSlot: 400 }
    ]);
    return rpcResponse();
  });

  const bundle = await client.readAccounts(request);
  assert.equal(calls, 1);
  assert.equal(bundle.source.providerId, "test-rpc");
  assert.equal(bundle.source.synthetic, true);
  assert.equal(bundle.source.commitment, "finalized");
  assert.equal(bundle.source.retrievedAt, clock());
  assert.equal(bundle.source.contextSlot, 500);
  assert.equal(bundle.source.requestedMinContextSlot, 400);
  assert.equal(bundle.source.requestId, request.requestId);
  assert.match(bundle.source.rawPayloadSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(bundle.accounts.map((item) => item.address), [baseMint, quoteMint]);
  assert.ok(bundle.accounts.every((item) => item.exists));
  assert.ok(bundle.accounts.every((item) => item.ownerProgramId === owner));
  assert.ok(bundle.accounts.every((item) => item.dataBase64 === "AQIDBA=="));
  assert.ok(bundle.accounts.every((item) => item.executable === false));
  assert.ok(bundle.accounts.every((item) => item.space === 4));
});

test("preserves missing accounts as explicit absence in the requested order", async () => {
  const client = reader(async () => rpcResponse([null, account()]));
  const bundle = await client.readAccounts(request);
  assert.deepEqual(bundle.accounts[0], {
    address: baseMint,
    exists: false,
    ownerProgramId: null,
    executable: null,
    dataBase64: null,
    space: null
  });
  assert.equal(bundle.accounts[1].exists, true);
});

test("rejects duplicate/invalid addresses, bad slots and invalid request IDs before fetching", async () => {
  let calls = 0;
  const client = reader(async () => {
    calls += 1;
    return rpcResponse();
  });
  await assert.rejects(
    client.readAccounts({ ...request, addresses: [baseMint, baseMint] }),
    (error) => error instanceof SolanaRpcReaderError && error.code === "INVALID_REQUEST"
  );
  await assert.rejects(
    client.readAccounts({ ...request, addresses: ["not-a-public-key"] }),
    (error) => error instanceof SolanaRpcReaderError && error.code === "INVALID_REQUEST"
  );
  await assert.rejects(
    client.readAccounts({ ...request, minContextSlot: -1 }),
    (error) => error instanceof SolanaRpcReaderError && error.code === "INVALID_REQUEST"
  );
  await assert.rejects(
    client.readAccounts({ ...request, requestId: "bad id" }),
    (error) => error instanceof SolanaRpcReaderError && error.code === "INVALID_REQUEST"
  );
  assert.equal(calls, 0);
});

test("rejects too many accounts and non-HTTPS remote endpoints", async () => {
  const client = reader(async () => rpcResponse());
  await assert.rejects(
    client.readAccounts({ ...request, addresses: Array(101).fill(baseMint) }),
    (error) => error instanceof SolanaRpcReaderError && error.code === "INVALID_REQUEST"
  );
  assert.throws(() => new SolanaRpcAccountReader({
    endpoint: "http://rpc.example.invalid",
    providerId: "test-rpc",
    fetchImpl: async () => rpcResponse()
  }), /HTTPS/);
});

test("rejects account response context slots below the requested minimum", async () => {
  const client = reader(async () => new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: request.requestId,
    result: { context: { slot: 399 }, value: [account(), account()] }
  }), { status: 200 }));
  await assert.rejects(
    client.readAccounts(request),
    (error) => error instanceof SolanaRpcReaderError &&
      error.code === "CONTEXT_SLOT_BELOW_MINIMUM" &&
      error.retryable
  );
});

test("rejects mismatched JSON-RPC IDs and malformed account data", async () => {
  const mismatchedId = reader(async () => new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: "another-request",
    result: { context: { slot: 500 }, value: [account(), account()] }
  }), { status: 200 }));
  const malformedAccount = reader(async () => rpcResponse([
    account({ data: ["not base64!", "base64"] }),
    account()
  ]));
  await assert.rejects(
    mismatchedId.readAccounts(request),
    (error) => error instanceof SolanaRpcReaderError && error.code === "PARSE"
  );
  await assert.rejects(
    malformedAccount.readAccounts(request),
    (error) => error instanceof SolanaRpcReaderError && error.code === "PARSE"
  );
});

test("classifies rate limit and sanitizes remote error content", async () => {
  const rateLimited = reader(async () => new Response("sensitive rate-limit details", { status: 429 }));
  await assert.rejects(
    rateLimited.readAccounts(request),
    (error) => {
      assert.ok(error instanceof SolanaRpcReaderError);
      assert.equal(error.code, "RATE_LIMIT");
      assert.equal(error.retryable, true);
      assert.equal(String(error).includes("sensitive rate-limit details"), false);
      assert.equal(String(error).includes("token=fixture-only"), false);
      return true;
    }
  );

  const rpcError = reader(async () => new Response(JSON.stringify({
    jsonrpc: "2.0",
    id: request.requestId,
    error: { code: -32000, message: "sensitive RPC provider detail" }
  }), { status: 200 }));
  await assert.rejects(
    rpcError.readAccounts(request),
    (error) => {
      assert.ok(error instanceof SolanaRpcReaderError);
      assert.equal(error.code, "RPC");
      assert.equal(String(error).includes("sensitive RPC provider detail"), false);
      return true;
    }
  );
});

test("cancels an oversized streaming response instead of buffering the full body", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull(controller) {
      controller.enqueue(new Uint8Array(1_024).fill(0x20));
    },
    cancel() {
      cancelled = true;
    }
  }, { highWaterMark: 0 });
  const client = reader(async () => new Response(body), { maxResponseBytes: 1_024 });
  await assert.rejects(
    client.readAccounts(request),
    (error) => error instanceof SolanaRpcReaderError && error.code === "RESPONSE_TOO_LARGE"
  );
  assert.equal(cancelled, true);
});

test("strict UTF-8 decoding rejects malformed byte sequences", async () => {
  const client = reader(async () => new Response(new Uint8Array([0xff])));
  await assert.rejects(
    client.readAccounts(request),
    (error) => error instanceof SolanaRpcReaderError && error.code === "PARSE"
  );
});

test("timeout and caller cancellation remain distinguishable", async () => {
  const timedOut = reader((_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }), { timeoutMs: 100 });
  await assert.rejects(
    timedOut.readAccounts(request),
    (error) => error instanceof SolanaRpcReaderError && error.code === "TIMEOUT"
  );

  const controller = new AbortController();
  controller.abort();
  const cancelled = reader(async (_input, init) => {
    if (init?.signal?.aborted) throw new Error("aborted");
    return rpcResponse();
  });
  await assert.rejects(
    cancelled.readAccounts({ ...request, signal: controller.signal }),
    (error) => error instanceof SolanaRpcReaderError &&
      (error.code === "ABORTED" || error.code === "TIMEOUT")
  );
});
