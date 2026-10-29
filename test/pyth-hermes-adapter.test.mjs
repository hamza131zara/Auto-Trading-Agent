import assert from "node:assert/strict";
import test from "node:test";
import {
  PythHermesAdapterError,
  PythHermesUsdPriceAdapter,
  PYTH_REFERENCE_FEEDS,
  PYTH_SOL_USD_FEED_ID,
  PYTH_USDC_USD_FEED_ID,
  USDC_MAINNET_MINT,
  WRAPPED_SOL_MINT,
  pythScaledIntegerToDecimal
} from "../packages/market-data/dist/providers/pyth-hermes.js";

function payload(overrides = {}) {
  return {
    parsed: [
      {
        id: PYTH_SOL_USD_FEED_ID,
        price: { price: "9998000000", conf: "1234000", expo: -8, publish_time: 1793277890 },
        metadata: { slot: 462885600 }
      },
      {
        id: "0x" + PYTH_USDC_USD_FEED_ID,
        price: { price: "100000000", conf: "10000", expo: -8, publish_time: 1793277890 },
        metadata: { slot: 462885600 }
      }
    ],
    ...overrides
  };
}

function mockFetch(responsePayload = payload(), status = 200) {
  const calls = [];
  const fetchImpl = async (input, init = {}) => {
    calls.push({ url: String(input), init });
    return new Response(JSON.stringify(responsePayload), {
      status,
      headers: { "content-type": "application/json" }
    });
  };
  return { fetchImpl, calls };
}

test("Pyth integer/exponent values are converted to decimal strings without floating-point", () => {
  assert.equal(pythScaledIntegerToDecimal("9998000000", -8), "99.98");
  assert.equal(pythScaledIntegerToDecimal("1234000", -8, true), "0.01234");
  assert.equal(pythScaledIntegerToDecimal("1", -8), "0.00000001");
  assert.equal(pythScaledIntegerToDecimal("123", 2), "12300");
  assert.equal(pythScaledIntegerToDecimal("0", -8), null);
  assert.equal(pythScaledIntegerToDecimal("-1", -8), null);
  assert.equal(pythScaledIntegerToDecimal("1e3", -8), null);
  assert.equal(pythScaledIntegerToDecimal("1", -31), null);
});

test("authenticated Hermes request asks for only pinned SOL/USD and USDC/USD feeds", async () => {
  const { fetchImpl, calls } = mockFetch();
  const adapter = new PythHermesUsdPriceAdapter({
    apiKey: "test-only-key",
    fetchImpl,
    now: () => "2026-10-29T13:00:00.000Z"
  });
  const result = await adapter.fetchLatest();
  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  const url = new URL(call.url);
  assert.equal(url.origin, "https://pyth.dourolabs.app");
  assert.equal(url.pathname, "/hermes/v2/updates/price/latest");
  assert.deepEqual(url.searchParams.getAll("ids[]").sort(), [PYTH_SOL_USD_FEED_ID, PYTH_USDC_USD_FEED_ID].sort());
  assert.equal(url.searchParams.get("parsed"), "true");
  assert.equal(call.init.headers.authorization, "Bearer test-only-key");
  assert.equal(result.errors.length, 0);
  assert.equal(result.observations.length, 2);
  const sol = result.observations.find((item) => item.feedId === PYTH_SOL_USD_FEED_ID);
  const usdc = result.observations.find((item) => item.feedId === PYTH_USDC_USD_FEED_ID);
  assert.ok(sol);
  assert.ok(usdc);
  assert.equal(sol.assetId, WRAPPED_SOL_MINT);
  assert.equal(sol.priceUsd, "99.98");
  assert.equal(sol.confidenceUsd, "0.01234");
  assert.equal(sol.feedName, "SOL/USD");
  assert.equal(sol.publishedAt, "2026-10-29T13:24:50.000Z");
  assert.equal(sol.retrievedAt, "2026-10-29T13:00:00.000Z");
  assert.equal(sol.synthetic, true, "injected fetch must remain synthetic");
  assert.equal(usdc.assetId, USDC_MAINNET_MINT);
  assert.equal(usdc.priceUsd, "1");
  assert.equal(usdc.feedName, "USDC/USD");
  assert.match(sol.rawPayloadSha256, /^[a-f0-9]{64}$/);
  assert.match(sol.requestId, /^pyth-hermes:/);
  assert.equal(PYTH_REFERENCE_FEEDS.length, 2);
});

test("missing API key is rejected before any request", async () => {
  const { fetchImpl, calls } = mockFetch();
  const adapter = new PythHermesUsdPriceAdapter({ fetchImpl });
  await assert.rejects(() => adapter.fetchLatest(), (error) =>
    error instanceof PythHermesAdapterError && error.code === "AUTH");
  assert.equal(calls.length, 0);
});

test("a live-style response with exact, non-injected fetch is marked non-synthetic", async () => {
  const { calls: _calls } = mockFetch();
  const adapter = new PythHermesUsdPriceAdapter({
    apiKey: "test-only-key",
    now: () => "2026-10-29T13:00:00.000Z"
  });
  // Do not invoke the real endpoint in tests; normalize a local envelope instead.
  const result = adapter.normalize({
    providerId: "pyth-hermes",
    adapterVersion: "0.1.0",
    requestedFeeds: PYTH_REFERENCE_FEEDS,
    requestedAt: "2026-10-29T12:59:59.000Z",
    retrievedAt: "2026-10-29T13:00:00.000Z",
    payload: payload({ parsed: payload().parsed.map((item) => ({
      ...item, price: { ...item.price, publish_time: 1793277890 }
    })) }),
    rawPayloadSha256: "a".repeat(64),
    synthetic: false
  });
  assert.equal(result.errors.length, 0);
  assert.ok(result.observations.every((item) => item.synthetic === false));
});

test("missing or duplicate requested feed records fail closed", async () => {
  const missing = payload({ parsed: [payload().parsed[0]] });
  const missingAdapter = new PythHermesUsdPriceAdapter({
    apiKey: "test-only-key", fetchImpl: async () => new Response(JSON.stringify(missing)),
    now: () => "2026-10-29T13:00:00.000Z"
  });
  const missingResult = await missingAdapter.fetchLatest();
  assert.deepEqual(missingResult.observations, []);
  assert.deepEqual(missingResult.errors, ["PYTH_FEED_MISSING"]);

  const duplicate = payload({ parsed: [...payload().parsed, payload().parsed[0]] });
  const duplicateAdapter = new PythHermesUsdPriceAdapter({
    apiKey: "test-only-key", fetchImpl: async () => new Response(JSON.stringify(duplicate)),
    now: () => "2026-10-29T13:00:00.000Z"
  });
  const duplicateResult = await duplicateAdapter.fetchLatest();
  assert.deepEqual(duplicateResult.observations, []);
  assert.deepEqual(duplicateResult.errors, ["PYTH_FEED_DUPLICATE"]);
});

test("malformed price records fail closed and errors never include provider payloads", async () => {
  const malformed = payload({ parsed: payload().parsed.map((item, index) =>
    index === 0 ? { ...item, price: { ...item.price, price: "1e8" } } : item
  ) });
  const adapter = new PythHermesUsdPriceAdapter({
    apiKey: "secret-never-log-this",
    fetchImpl: async () => new Response(JSON.stringify(malformed)),
    now: () => "2026-10-29T13:00:00.000Z"
  });
  const result = await adapter.fetchLatest();
  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.errors, ["PYTH_PRICE_DECIMAL_INVALID"]);
  assert.ok(!JSON.stringify(result).includes("secret-never-log-this"));
});

test("auth, rate-limit, and server errors produce sanitized stable codes", async () => {
  for (const [status, code, retryable] of [
    [401, "AUTH", false],
    [403, "AUTH", false],
    [429, "RATE_LIMIT", true],
    [503, "HTTP", true]
  ]) {
    const adapter = new PythHermesUsdPriceAdapter({
      apiKey: "test-only-key",
      fetchImpl: async () => new Response("do not echo this", { status }),
      now: () => "2026-10-29T13:00:00.000Z"
    });
    await assert.rejects(() => adapter.fetchLatest(), (error) =>
      error instanceof PythHermesAdapterError &&
      error.code === code &&
      error.retryable === retryable &&
      !error.message.includes("do not echo this")
    );
  }
});

test("overlarge Hermes response is rejected by the bounded reader", async () => {
  const adapter = new PythHermesUsdPriceAdapter({
    apiKey: "test-only-key",
    fetchImpl: async () => new Response(" ".repeat(262145), {
      headers: { "content-length": "262145" }
    }),
    now: () => "2026-10-29T13:00:00.000Z"
  });
  await assert.rejects(() => adapter.fetchLatest(), (error) =>
    error instanceof PythHermesAdapterError && error.code === "PARSE"
  );
});
