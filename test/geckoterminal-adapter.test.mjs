import assert from "node:assert/strict";
import test from "node:test";
import {
  assessGeckoTerminalRequestPacing,
  GECKOTERMINAL_MIN_REQUEST_INTERVAL_MS,
  GeckoTerminalAdapterError,
  GeckoTerminalOhlcvPriceAdapter,
  GeckoTerminalPoolAdapter
} from "../packages/market-data/dist/providers/geckoterminal.js";
import { validateCanonicalMarketSnapshot } from "../packages/market-data/dist/index.js";

const TARGET = {
  cluster: "mainnet-beta",
  baseMint: "So11111111111111111111111111111111111111112",
  quoteMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  poolAddress: "47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4",
  requestedAt: "2026-10-29T12:00:00.000Z"
};
const CONTEXT = {
  requestedAt: TARGET.requestedAt,
  retrievedAt: "2026-10-29T12:00:02.000Z",
  requestId: "geckoterminal-test-request"
};

function payload(overrides = {}) {
  return {
    data: {
      id: "solana_" + TARGET.poolAddress,
      type: "pool",
      attributes: {
        address: TARGET.poolAddress,
        name: "SOL / USDC",
        base_token_price_usd: "100.123456",
        quote_token_price_usd: "1.00012",
        pool_created_at: "2024-01-01T00:00:00Z",
        volume_usd: { h24: "123456.789" },
        reserve_in_usd: "543210.987",
        transactions: { h24: { buys: 123, sells: 98 } },
        ...overrides.attributes
      },
      relationships: {
        base_token: { data: { id: "solana_" + TARGET.baseMint, type: "token" } },
        quote_token: { data: { id: "solana_" + TARGET.quoteMint, type: "token" } },
        dex: { data: { id: "raydium", type: "dex" } },
        ...overrides.relationships
      }
    }
  };
}

function envelope(body = payload(), synthetic = false) {
  return {
    providerId: "geckoterminal",
    requested: TARGET,
    payload: body,
    rawPayloadSha256: "a".repeat(64),
    synthetic
  };
}

function response(body, init = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init
  });
}

test("public API request pacing fails closed inside the conservative interval", () => {
  assert.equal(GECKOTERMINAL_MIN_REQUEST_INTERVAL_MS, 7_000);
  const first = assessGeckoTerminalRequestPacing(1_000, 0);
  assert.deepEqual(first, {
    canStartRequest: true,
    nextAllowedAtMs: 8_000,
    reasonCode: "REQUEST_INTERVAL_ELAPSED"
  });
  assert.deepEqual(assessGeckoTerminalRequestPacing(7_999, first.nextAllowedAtMs), {
    canStartRequest: false,
    nextAllowedAtMs: 8_000,
    reasonCode: "REQUEST_INTERVAL_ACTIVE"
  });
  assert.equal(assessGeckoTerminalRequestPacing(8_000, first.nextAllowedAtMs).canStartRequest, true);
  assert.equal(assessGeckoTerminalRequestPacing(-1, 0).reasonCode, "INVALID_PACING_INPUT");
});


function ohlcvPayload(rows, metaOverrides = {}) {
  return {
    data: {
      attributes: { ohlcv_list: rows }
    },
    meta: {
      base: { address: TARGET.baseMint },
      quote: { address: TARGET.quoteMint },
      ...metaOverrides
    }
  };
}

test("OHLCV adapter extracts newest candle close and explicitly reports candle-start observation time", () => {
  const adapter = new GeckoTerminalOhlcvPriceAdapter();
  const result = adapter.normalize({
    providerId: "geckoterminal",
    requested: TARGET,
    payload: ohlcvPayload([
      [1793275200, 99.8, 100.2, 99.7, 100.1, 1234.5],
      [1793275260, 100.1, 100.5, 100.0, 100.25, 987.6],
      [1793275140, 99.5, 99.9, 99.4, 99.8, 1500.0]
    ]),
    rawPayloadSha256: "d".repeat(64),
    synthetic: true
  }, {
    requestedAt: TARGET.requestedAt,
    retrievedAt: "2026-10-29T12:01:02.000Z",
    requestId: "geckoterminal-ohlcv-test"
  });

  assert.deepEqual(result.errors, []);
  assert.ok(result.observation);
  assert.equal(result.observation.priceUsdPerBase, "100.25");
  assert.equal(result.observation.candleStartAt, new Date(1793275260 * 1000).toISOString());
  assert.equal(result.observation.timeframe, "minute");
  assert.equal(result.observation.aggregate, 1);
  assert.equal(result.observation.synthetic, true);
  assert.equal(result.observation.poolAddress, TARGET.poolAddress);
});

test("OHLCV fetch preserves exact high-precision and exponent-form JSON close decimals", async () => {
  const rawBody = [
    "{",
    '"data":{"attributes":{"ohlcv_list":[',
    '[1793275200,99.8,100.2,99.7,100.00000000000000001,1234.5],',
    '[1793275260,100.1,100.5,100.0,1.0000000000000000001e2,987.6]',
    '] }},',
    '"meta":{"base":{"address":"' + TARGET.baseMint + '"},"quote":{"address":"' + TARGET.quoteMint + '"}}',
    "}"
  ].join("");
  const adapter = new GeckoTerminalOhlcvPriceAdapter(async () =>
    new Response(rawBody, { status: 200, headers: { "content-type": "application/json" } })
  );
  const raw = await adapter.fetchRaw(TARGET, new AbortController().signal);
  const result = adapter.normalize(raw, {
    requestedAt: TARGET.requestedAt,
    retrievedAt: "2026-10-29T12:01:02.000Z",
    requestId: "geckoterminal-exact-decimal"
  });

  assert.deepEqual(result.errors, []);
  assert.ok(result.observation);
  assert.equal(result.observation.priceUsdPerBase, "100.00000000000000001");
  assert.equal(result.observation.candleStartAt, new Date(1793275260 * 1000).toISOString());
  assert.equal(result.observation.synthetic, true);
  assert.match(result.observation.rawPayloadSha256, /^[a-f0-9]{64}$/);
});

test("OHLCV adapter rejects mismatched base/quote metadata", () => {
  const adapter = new GeckoTerminalOhlcvPriceAdapter();
  const result = adapter.normalize({
    providerId: "geckoterminal",
    requested: TARGET,
    payload: ohlcvPayload([[1793275200, 99, 100, 98, 99.5, 10]], {
      base: { address: "11111111111111111111111111111111" }
    }),
    rawPayloadSha256: "e".repeat(64),
    synthetic: true
  }, {
    requestedAt: TARGET.requestedAt,
    retrievedAt: "2026-10-29T12:01:02.000Z",
    requestId: "geckoterminal-ohlcv-test"
  });
  assert.equal(result.observation, null);
  assert.deepEqual(result.errors, ["OHLCV_MINT_IDENTITY_MISMATCH"]);
});

test("OHLCV adapter rejects conflicting duplicate latest candles and malformed closes", () => {
  const adapter = new GeckoTerminalOhlcvPriceAdapter();
  const context = {
    requestedAt: TARGET.requestedAt,
    retrievedAt: "2026-10-29T12:01:02.000Z",
    requestId: "geckoterminal-ohlcv-test"
  };
  const base = {
    providerId: "geckoterminal",
    requested: TARGET,
    rawPayloadSha256: "f".repeat(64),
    synthetic: true
  };
  const duplicate = adapter.normalize({
    ...base,
    payload: ohlcvPayload([
      [1793275260, 100, 101, 99, 100.25, 1],
      [1793275260, 100, 101, 99, 100.26, 1]
    ])
  }, context);
  assert.equal(duplicate.observation, null);
  assert.deepEqual(duplicate.errors, ["OHLCV_DUPLICATE_LATEST_CANDLE"]);

  const malformed = adapter.normalize({
    ...base,
    payload: ohlcvPayload([[1793275260, 100, 101, 99, "not-a-price", 1]])
  }, context);
  assert.equal(malformed.observation, null);
  assert.deepEqual(malformed.errors, ["OHLCV_CLOSE_INVALID"]);
});

test("OHLCV adapter requests the pinned exact-pool minute endpoint", async () => {
  let calledUrl = "";
  let options;
  const adapter = new GeckoTerminalOhlcvPriceAdapter(async (url, init) => {
    calledUrl = String(url);
    options = init;
    return response(ohlcvPayload([[1793275260, 100, 101, 99, 100.25, 1]]));
  });
  const raw = await adapter.fetchRaw(TARGET, new AbortController().signal);
  assert.match(calledUrl, /\/networks\/solana\/pools\/47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4\/ohlcv\/minute/);
  assert.match(calledUrl, /aggregate=1/);
  assert.match(calledUrl, /limit=5/);
  assert.match(calledUrl, /currency=usd/);
  assert.match(calledUrl, /token=base/);
  assert.equal(options.headers.accept, "application/json;version=20230203");
  assert.equal(raw.synthetic, true);
  assert.match(raw.rawPayloadSha256, /^[a-f0-9]{64}$/);
});

test("normalizes exact pool and explicit market measures without inventing snapshot time", () => {
  const adapter = new GeckoTerminalPoolAdapter();
  const result = adapter.normalize(envelope(), CONTEXT);
  assert.deepEqual(result.errors, []);
  assert.equal(result.observations.length, 1);
  const snapshot = result.observations[0];
  assert.ok(snapshot);
  assert.equal(validateCanonicalMarketSnapshot(snapshot).valid, true);
  assert.equal(snapshot.price.value, "100.123456");
  assert.equal(snapshot.price.unit, "USD_PER_BASE");
  assert.equal(snapshot.liquidity.value, "543210.987");
  assert.equal(snapshot.volume24h.value, "123456.789");
  assert.equal(snapshot.buys24h, 123);
  assert.equal(snapshot.sells24h, 98);
  assert.equal(snapshot.observedAt, null);
  assert.equal(snapshot.sourceEventAt, null);
  assert.equal(snapshot.provenance.synthetic, false);
  assert.equal(snapshot.provenance.sourceKind, "INDEXED_API");
});

test("pool adapter preserves exact numeric JSON measures and integer transaction counts", async () => {
  const rawBody = JSON.stringify(payload()).replace(
    '"base_token_price_usd":"100.123456"',
    '"base_token_price_usd":100.00000000000000001'
  ).replace(
    '"reserve_in_usd":"543210.987"',
    '"reserve_in_usd":543210.00000000000000001'
  ).replace(
    '"h24":"123456.789"',
    '"h24":123456.00000000000000001'
  );
  const adapter = new GeckoTerminalPoolAdapter(async () =>
    new Response(rawBody, { status: 200, headers: { "content-type": "application/json" } })
  );
  const raw = await adapter.fetchRaw(TARGET, new AbortController().signal);
  const result = adapter.normalize(raw, CONTEXT);

  assert.deepEqual(result.errors, []);
  assert.equal(result.observations.length, 1);
  assert.equal(result.observations[0].price.value, "100.00000000000000001");
  assert.equal(result.observations[0].liquidity.value, "543210.00000000000000001");
  assert.equal(result.observations[0].volume24h.value, "123456.00000000000000001");
  assert.equal(result.observations[0].buys24h, 123);
  assert.equal(result.observations[0].sells24h, 98);
});

test("pool creation time is never used as a current source-event timestamp", () => {
  const adapter = new GeckoTerminalPoolAdapter();
  const result = adapter.normalize(envelope(payload({
    attributes: { pool_created_at: "2020-01-01T00:00:00Z" }
  })), CONTEXT);
  assert.equal(result.observations[0].sourceEventAt, null);
  assert.equal(result.observations[0].observedAt, null);
});

test("fetches only the pinned Solana exact-pool endpoint with API version header", async () => {
  let calledUrl;
  let calledOptions;
  const adapter = new GeckoTerminalPoolAdapter(async (url, options) => {
    calledUrl = String(url);
    calledOptions = options;
    return response(payload());
  });
  const raw = await adapter.fetchRaw(TARGET, new AbortController().signal);
  assert.match(calledUrl, /api\/v2\/networks\/solana\/pools\/47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4/);
  assert.match(calledUrl, /include=base_token%2Cquote_token%2Cdex/);
  assert.equal(calledOptions.method, "GET");
  assert.equal(calledOptions.redirect, "error");
  assert.equal(calledOptions.headers.accept, "application/json;version=20230203");
  assert.equal(raw.synthetic, true, "injected fetch must always be marked synthetic");
  assert.match(raw.rawPayloadSha256, /^[a-f0-9]{64}$/);
});

test("rejects wrong pool and mint identity instead of normalizing related pools", () => {
  const adapter = new GeckoTerminalPoolAdapter();
  const wrongPool = payload();
  wrongPool.data.id = "solana_11111111111111111111111111111111";
  assert.deepEqual(adapter.normalize(envelope(wrongPool), CONTEXT).errors, ["POOL_IDENTITY_MISMATCH"]);

  const wrongMint = payload();
  wrongMint.data.relationships.base_token.data.id = "solana_11111111111111111111111111111111";
  assert.deepEqual(adapter.normalize(envelope(wrongMint), CONTEXT).errors, ["POOL_MINT_IDENTITY_MISMATCH"]);
});

test("missing measures stay null; malformed decimal/count values fail closed", () => {
  const adapter = new GeckoTerminalPoolAdapter();
  const missing = payload();
  delete missing.data.attributes.volume_usd;
  delete missing.data.attributes.reserve_in_usd;
  delete missing.data.attributes.base_token_price_usd;
  delete missing.data.attributes.transactions.h24.buys;
  const normalized = adapter.normalize(envelope(missing), CONTEXT);
  assert.deepEqual(normalized.errors, []);
  assert.equal(normalized.observations[0].price, null);
  assert.equal(normalized.observations[0].liquidity, null);
  assert.equal(normalized.observations[0].volume24h, null);
  assert.equal(normalized.observations[0].buys24h, null);

  const malformed = payload({ attributes: { base_token_price_usd: "1e-8" } });
  assert.deepEqual(adapter.normalize(envelope(malformed), CONTEXT).errors, ["INVALID_MARKET_MEASURE"]);
  const badCount = payload({ attributes: { transactions: { h24: { buys: 1.5, sells: 1 } } } });
  assert.deepEqual(adapter.normalize(envelope(badCount), CONTEXT).errors, ["INVALID_MARKET_MEASURE"]);
});

test("HTTP failure mapping is stable and never includes remote response bodies", async () => {
  for (const [status, code, retryable] of [
    [429, "RATE_LIMIT", true],
    [401, "AUTH", false],
    [403, "AUTH", false],
    [503, "HTTP", true],
    [404, "HTTP", false]
  ]) {
    const adapter = new GeckoTerminalPoolAdapter(async () =>
      new Response("sensitive remote body", { status })
    );
    await assert.rejects(
      adapter.fetchRaw(TARGET, new AbortController().signal),
      (error) => error instanceof GeckoTerminalAdapterError &&
        error.code === code &&
        error.retryable === retryable &&
        !error.message.includes("sensitive remote body")
    );
  }
});

test("invalid target and invalid envelope are rejected before promotion", async () => {
  const adapter = new GeckoTerminalPoolAdapter(async () => response(payload()));
  await assert.rejects(
    adapter.fetchRaw({ ...TARGET, cluster: "devnet" }, new AbortController().signal),
    (error) => error instanceof GeckoTerminalAdapterError && error.code === "PARSE"
  );
  const malformed = adapter.normalize({ ...envelope(), rawPayloadSha256: "bad" }, CONTEXT);
  assert.deepEqual(malformed.errors, ["INVALID_PROVIDER_ENVELOPE"]);
});

test("oversized and non-JSON responses fail closed", async () => {
  const tooLarge = "x".repeat(1_000_001);
  const oversized = new GeckoTerminalPoolAdapter(async () =>
    new Response(tooLarge, { headers: { "content-length": String(tooLarge.length) } })
  );
  await assert.rejects(
    oversized.fetchRaw(TARGET, new AbortController().signal),
    (error) => error instanceof GeckoTerminalAdapterError && error.code === "PARSE"
  );

  const notJson = new GeckoTerminalPoolAdapter(async () => new Response("not json"));
  await assert.rejects(
    notJson.fetchRaw(TARGET, new AbortController().signal),
    (error) => error instanceof GeckoTerminalAdapterError && error.code === "PARSE"
  );
});

test("preserves synthetic provenance when the payload came from an injected adapter", () => {
  const adapter = new GeckoTerminalPoolAdapter();
  const result = adapter.normalize(envelope(payload(), true), CONTEXT);
  assert.equal(result.observations[0].provenance.synthetic, true);
  assert.equal(result.observations[0].provenance.sourceKind, "REPLAY_FIXTURE");
});
