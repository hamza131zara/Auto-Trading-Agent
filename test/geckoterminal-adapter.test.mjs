import assert from "node:assert/strict";
import test from "node:test";
import {
  GeckoTerminalAdapterError,
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
