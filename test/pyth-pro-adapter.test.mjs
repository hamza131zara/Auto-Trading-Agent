import assert from "node:assert/strict";
import test from "node:test";
import {
  PythProAdapterError,
  PythProUsdPriceAdapter,
  PYTH_PRO_SOL_USD_HERMES_FEED_ID,
  PYTH_PRO_USDC_USD_HERMES_FEED_ID,
  PYTH_PRO_WRAPPED_SOL_MINT,
  PYTH_PRO_USDC_MAINNET_MINT
} from "../packages/market-data/dist/providers/pyth-pro.js";

const CHANNEL = "fixed_rate@200ms";
const UPDATE_TIME_US = String(BigInt(Date.parse("2026-10-30T08:00:00.000Z")) * 1_000n);
const FEEDS = [
  {
    pythLazerId: 101,
    hermesFeedId: PYTH_PRO_SOL_USD_HERMES_FEED_ID,
    feedName: "SOL/USD",
    assetId: PYTH_PRO_WRAPPED_SOL_MINT,
    minPublisherCount: 3,
    minChannel: "fixed_rate@1000ms",
    minPublisherCountBySession: { regular: 4, preMarket: 5 }
  },
  {
    pythLazerId: 202,
    hermesFeedId: PYTH_PRO_USDC_USD_HERMES_FEED_ID,
    feedName: "USDC/USD",
    assetId: PYTH_PRO_USDC_MAINNET_MINT,
    minPublisherCount: 2,
    minChannel: "fixed_rate@1000ms"
  }
];

function payload(overrides = {}) {
  return {
    parsed: {
      timestampUs: UPDATE_TIME_US,
      priceFeeds: [
        {
          priceFeedId: 101,
          price: "9998000000",
          exponent: -8,
          confidence: "1234000",
          publisherCount: 4,
          feedUpdateTimestamp: UPDATE_TIME_US,
          marketSession: "regular"
        },
        {
          priceFeedId: 202,
          price: "100000000",
          exponent: -8,
          confidence: "10000",
          publisherCount: 3,
          feedUpdateTimestamp: UPDATE_TIME_US,
          marketSession: "regular"
        }
      ],
      ...overrides
    }
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

function makeAdapter(fetchImpl, overrides = {}) {
  return new PythProUsdPriceAdapter({
    apiKey: "test-only-key",
    feedBindings: FEEDS,
    channel: CHANNEL,
    fetchImpl,
    now: () => "2026-10-30T08:00:01.000Z",
    ...overrides
  });
}

test("Pyth Pro request asks for pinned feed IDs and the freshness/quorum properties", async () => {
  const { fetchImpl, calls } = mockFetch();
  const result = await makeAdapter(fetchImpl).fetchLatest();

  assert.equal(calls.length, 1);
  const call = calls[0];
  assert.ok(call);
  assert.equal(call.url, "https://pyth-lazer.dourolabs.app/v1/latest_price");
  assert.equal(call.init.method, "POST");
  assert.equal(call.init.headers.authorization, "Bearer test-only-key");
  assert.equal(call.init.headers["content-type"], "application/json");
  const body = JSON.parse(call.init.body);
  assert.deepEqual(body.priceFeedIds, [101, 202]);
  assert.equal(body.channel, CHANNEL);
  assert.deepEqual(body.formats, []);
  assert.deepEqual(body.properties, [
    "price",
    "exponent",
    "confidence",
    "publisherCount",
    "feedUpdateTimestamp",
    "marketSession"
  ]);

  assert.deepEqual(result.errors, []);
  assert.equal(result.observations.length, 2);
  const sol = result.observations.find((item) => item.feedName === "SOL/USD");
  const usdc = result.observations.find((item) => item.feedName === "USDC/USD");
  assert.ok(sol);
  assert.ok(usdc);
  assert.equal(sol.providerId, "pyth-pro");
  assert.equal(sol.independenceGroupId, "pyth-network");
  assert.equal(sol.assetId, PYTH_PRO_WRAPPED_SOL_MINT);
  assert.equal(sol.feedId, PYTH_PRO_SOL_USD_HERMES_FEED_ID);
  assert.equal(sol.priceUsd, "99.98");
  assert.equal(sol.confidenceUsd, "0.01234");
  assert.equal(sol.publisherCount, 4);
  assert.equal(sol.minPublisherCount, 4);
  assert.equal(sol.marketSession, "regular");
  assert.equal(sol.feedUpdateTimestampUnixMicros, UPDATE_TIME_US);
  assert.equal(sol.updateTimestampUnixMicros, UPDATE_TIME_US);
  assert.equal(sol.publishedAt, "2026-10-30T08:00:00.000Z");
  assert.equal(sol.synthetic, true, "injected fetch must remain synthetic");
  assert.match(sol.rawPayloadSha256, /^[a-f0-9]{64}$/);
  assert.match(sol.requestId, /^pyth-pro:/);
  assert.equal(usdc.priceUsd, "1");
});

test("Pyth Pro rejects a carried-forward feed even when the response itself is current", () => {
  const stalePrice = {
    ...payload().parsed.priceFeeds[0],
    feedUpdateTimestamp: String(BigInt(UPDATE_TIME_US) - 60_000_000n)
  };
  const adapter = makeAdapter(async () => new Response("{}"));
  const result = adapter.normalize({
    providerId: "pyth-pro",
    adapterVersion: "1.0.0",
    channel: CHANNEL,
    requestedFeeds: FEEDS,
    requestedAt: "2026-10-30T07:59:59.000Z",
    retrievedAt: "2026-10-30T08:00:01.000Z",
    rawPayloadSha256: "a".repeat(64),
    payload: payload({ priceFeeds: [stalePrice, payload().parsed.priceFeeds[1]] }),
    synthetic: false
  });

  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.errors, ["FEED_CARRIED_FORWARD"]);
});

test("Pyth Pro rejects feeds below their configured minimum publisher count", () => {
  const lowQuorum = {
    ...payload().parsed.priceFeeds[0],
    publisherCount: 2
  };
  const adapter = makeAdapter(async () => new Response("{}"));
  const result = adapter.normalize({
    providerId: "pyth-pro",
    adapterVersion: "1.0.0",
    channel: CHANNEL,
    requestedFeeds: FEEDS,
    requestedAt: "2026-10-30T07:59:59.000Z",
    retrievedAt: "2026-10-30T08:00:01.000Z",
    rawPayloadSha256: "b".repeat(64),
    payload: payload({ priceFeeds: [lowQuorum, payload().parsed.priceFeeds[1]] }),
    synthetic: false
  });

  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.errors, ["PUBLISHER_QUORUM_UNMET"]);
});

test("Pyth Pro applies session-specific minimum publisher counts", () => {
  const adapter = makeAdapter(async () => new Response("{}"));
  const preMarketFeeds = payload().parsed.priceFeeds.map((item) => ({
    ...item,
    marketSession: "preMarket",
    publisherCount: 4
  }));
  const result = adapter.normalize({
    providerId: "pyth-pro",
    adapterVersion: "1.0.0",
    channel: CHANNEL,
    requestedFeeds: FEEDS,
    requestedAt: "2026-10-30T07:59:59.000Z",
    retrievedAt: "2026-10-30T08:00:01.000Z",
    rawPayloadSha256: "f".repeat(64),
    payload: payload({ priceFeeds: preMarketFeeds }),
    synthetic: false
  });

  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.errors, ["PUBLISHER_QUORUM_UNMET"]);
});

test("Pyth Pro applies session-specific minimum publisher counts", () => {
  const adapter = makeAdapter(async () => new Response("{}"));
  const preMarketFeeds = payload().parsed.priceFeeds.map((item) => ({
    ...item,
    marketSession: "preMarket",
    publisherCount: 4
  }));
  const result = adapter.normalize({
    providerId: "pyth-pro",
    adapterVersion: "1.0.0",
    channel: CHANNEL,
    requestedFeeds: FEEDS,
    requestedAt: "2026-10-30T07:59:59.000Z",
    retrievedAt: "2026-10-30T08:00:01.000Z",
    rawPayloadSha256: "f".repeat(64),
    payload: payload({ priceFeeds: preMarketFeeds }),
    synthetic: false
  });

  assert.deepEqual(result.observations, []);
  assert.deepEqual(result.errors, ["PUBLISHER_QUORUM_UNMET"]);
});

test("missing publisher count or feed-generation timestamp fails closed", () => {
  const noPublisherCount = { ...payload().parsed.priceFeeds[0] };
  delete noPublisherCount.publisherCount;
  const adapter = makeAdapter(async () => new Response("{}"));
  const missingQuorum = adapter.normalize({
    providerId: "pyth-pro",
    adapterVersion: "1.0.0",
    channel: CHANNEL,
    requestedFeeds: FEEDS,
    requestedAt: "2026-10-30T07:59:59.000Z",
    retrievedAt: "2026-10-30T08:00:01.000Z",
    rawPayloadSha256: "c".repeat(64),
    payload: payload({ priceFeeds: [noPublisherCount, payload().parsed.priceFeeds[1]] }),
    synthetic: false
  });
  assert.deepEqual(missingQuorum.errors, ["PUBLISHER_COUNT_INVALID"]);

  const noFeedTime = { ...payload().parsed.priceFeeds[0] };
  delete noFeedTime.feedUpdateTimestamp;
  const missingTimestamp = adapter.normalize({
    providerId: "pyth-pro",
    adapterVersion: "1.0.0",
    channel: CHANNEL,
    requestedFeeds: FEEDS,
    requestedAt: "2026-10-30T07:59:59.000Z",
    retrievedAt: "2026-10-30T08:00:01.000Z",
    rawPayloadSha256: "d".repeat(64),
    payload: payload({ priceFeeds: [noFeedTime, payload().parsed.priceFeeds[1]] }),
    synthetic: false
  });
  assert.deepEqual(missingTimestamp.errors, ["FEED_TIMESTAMP_MISSING"]);
});

test("feed binding and minimum update channel are required and exact", () => {
  assert.throws(() => new PythProUsdPriceAdapter({
    apiKey: "test-only-key",
    feedBindings: [
      { ...FEEDS[0], hermesFeedId: "0".repeat(64) },
      FEEDS[1]
    ],
    channel: CHANNEL
  }), (error) => error instanceof PythProAdapterError && error.code === "INVALID_CONFIGURATION");

  assert.throws(() => new PythProUsdPriceAdapter({
    apiKey: "test-only-key",
    feedBindings: [
      { ...FEEDS[0], minChannel: "fixed_rate@50ms" },
      FEEDS[1]
    ],
    channel: "fixed_rate@200ms"
  }), (error) => error instanceof PythProAdapterError && error.code === "INVALID_CONFIGURATION");
});

test("missing key and provider HTTP errors are rejected without leaking credentials or bodies", async () => {
  const { fetchImpl, calls } = mockFetch();
  const noKey = new PythProUsdPriceAdapter({
    feedBindings: FEEDS,
    channel: CHANNEL,
    fetchImpl
  });
  await assert.rejects(() => noKey.fetchLatest(), (error) =>
    error instanceof PythProAdapterError && error.code === "AUTH");
  assert.equal(calls.length, 0);

  const failing = makeAdapter(async () => new Response("private response body", { status: 429 }));
  await assert.rejects(() => failing.fetchLatest(), (error) =>
    error instanceof PythProAdapterError &&
    error.code === "RATE_LIMIT" &&
    !error.message.includes("private response body") &&
    !error.message.includes("test-only-key"));
});

test("a live-style, non-injected envelope can normalize but injected fetch stays synthetic", () => {
  const adapter = new PythProUsdPriceAdapter({
    apiKey: "test-only-key",
    feedBindings: FEEDS,
    channel: CHANNEL
  });
  const result = adapter.normalize({
    providerId: "pyth-pro",
    adapterVersion: "1.0.0",
    channel: CHANNEL,
    requestedFeeds: FEEDS,
    requestedAt: "2026-10-30T07:59:59.000Z",
    retrievedAt: "2026-10-30T08:00:01.000Z",
    rawPayloadSha256: "e".repeat(64),
    payload: payload(),
    synthetic: false
  });
  assert.equal(result.errors.length, 0);
  assert.ok(result.observations.every((item) => item.synthetic === false));
});
