import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { assessFreshness } from "../packages/market-data/dist/index.js";
import {
  DexScreenerAdapterError,
  DexScreenerPairsAdapter,
  parseJsonPreservingNumericLexemes
} from "../packages/market-data/dist/providers/dex-screener.js";

const fixtureText = readFileSync(
  new URL("./fixtures/market-data/dexscreener-pair-v1.json", import.meta.url),
  "utf8"
);
const pairAddress = "11111111111111111111111111111111";
const baseMint = "So11111111111111111111111111111111111111112";
const quoteMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const request = {
  cluster: "mainnet-beta",
  baseMint,
  quoteMint,
  poolAddress: pairAddress,
  requestedAt: "2026-10-29T00:00:00.000Z"
};
const context = {
  requestedAt: request.requestedAt,
  retrievedAt: "2026-10-29T00:00:02.000Z",
  requestId: "dex-test-001"
};
const digest = "a".repeat(64);

function envelope(text = fixtureText, synthetic = true) {
  return {
    providerId: "dex-screener",
    requested: request,
    payload: parseJsonPreservingNumericLexemes(text),
    rawPayloadSha256: digest,
    synthetic
  };
}

function successResponse(text = fixtureText) {
  return new Response(text, {
    status: 200,
    headers: { "content-type": "application/json" }
  });
}

test("numeric lexeme parser preserves decimal precision and strings unchanged", () => {
  const parsed = parseJsonPreservingNumericLexemes('{"n":234567.890123456789012345,"text":"123.4500","nested":[17,-0.125,1e-9]}');
  assert.deepEqual(parsed, {
    n: "234567.890123456789012345",
    text: "123.4500",
    nested: ["17", "-0.125", "1e-9"]
  });
});

test("fetches only the known Solana pair using a fixed read-only endpoint", async () => {
  let calls = 0;
  const adapter = new DexScreenerPairsAdapter(async (input, init) => {
    calls += 1;
    assert.equal(String(input), "https://api.dexscreener.com/latest/dex/pairs/solana/" + pairAddress);
    assert.equal(init?.method, "GET");
    assert.equal(new Headers(init?.headers).get("authorization"), null);
    return successResponse();
  });
  const raw = await adapter.fetchRaw(request, new AbortController().signal);
  const output = adapter.normalize(raw, context);
  assert.equal(calls, 1);
  assert.equal(output.errors.length, 0);
  assert.equal(output.observations.length, 1);
  assert.equal(output.observations[0].provenance.providerId, "dex-screener");
  assert.equal(output.observations[0].provenance.synthetic, false);
});

test("rejects test clusters before making a provider request", async () => {
  let calls = 0;
  const adapter = new DexScreenerPairsAdapter(async () => {
    calls += 1;
    return successResponse();
  });
  await assert.rejects(
    adapter.fetchRaw({ ...request, cluster: "devnet" }, new AbortController().signal),
    (error) => error instanceof DexScreenerAdapterError && error.code === "UNKNOWN"
  );
  assert.equal(calls, 0);
});

test("normalizes an exact pair and retains decimal numeric lexemes as strings", () => {
  const adapter = new DexScreenerPairsAdapter(async () => successResponse());
  const result = adapter.normalize(envelope(), context);
  assert.deepEqual(result.errors, []);
  assert.equal(result.observations.length, 1);

  const snapshot = result.observations[0];
  assert.equal(snapshot.baseMint, baseMint);
  assert.equal(snapshot.quoteMint, quoteMint);
  assert.equal(snapshot.poolAddress, pairAddress);
  assert.deepEqual(snapshot.price, {
    value: "0.123456789012345678",
    unit: "USD_PER_BASE",
    assetId: null
  });
  assert.deepEqual(snapshot.liquidity, {
    value: "234567.890123456789012345",
    unit: "USD",
    assetId: null
  });
  assert.deepEqual(snapshot.volume24h, {
    value: "12345.678901234567891234",
    unit: "USD",
    assetId: null
  });
  assert.equal(snapshot.buys24h, 17);
  assert.equal(snapshot.sells24h, 9);
  assert.equal(snapshot.dexProgramAddress, null);
  assert.equal(snapshot.tokenProgramAddress, null);
  assert.equal(snapshot.observedAt, null);
  assert.equal(snapshot.sourceEventAt, null);
  assert.equal(snapshot.provenance.rawPayloadSha256, digest);
  assert.equal(snapshot.provenance.sourceKind, "REPLAY_FIXTURE");
  assert.equal(snapshot.provenance.synthetic, true);
});

test("expands exponent-form provider measures without binary floating-point conversion", () => {
  const exponentFixture = fixtureText.replace(
    '"priceUsd": "0.123456789012345678"',
    '"priceUsd": "1e-8"'
  );
  const adapter = new DexScreenerPairsAdapter(async () => successResponse());
  const result = adapter.normalize(envelope(exponentFixture), context);
  assert.deepEqual(result.errors, []);
  assert.equal(result.observations[0].price.value, "0.00000001");
});

test("does not invent a market event timestamp from pair creation time", () => {
  const adapter = new DexScreenerPairsAdapter(async () => successResponse());
  const result = adapter.normalize(envelope(), context);
  const snapshot = result.observations[0];
  assert.equal(snapshot.observedAt, null);
  assert.equal(snapshot.sourceEventAt, null);

  const freshness = assessFreshness({
    retrievedAt: snapshot.retrievedAt,
    observedAt: snapshot.observedAt,
    sourceEventAt: snapshot.sourceEventAt,
    nowAt: "2026-10-29T00:00:03.000Z",
    maxAgeMs: 60_000
  });
  assert.equal(freshness.state, "UNKNOWN");
});

test("rejects a payload for a different pair or mismatched mints", () => {
  const adapter = new DexScreenerPairsAdapter(async () => successResponse());
  const otherPool = fixtureText.replace(pairAddress, "11111111111111111111111111111112");
  assert.deepEqual(adapter.normalize(envelope(otherPool), context), {
    observations: [],
    errors: ["PAIR_NOT_FOUND"]
  });

  const otherQuote = fixtureText.replace(quoteMint, baseMint);
  assert.deepEqual(adapter.normalize(envelope(otherQuote), context), {
    observations: [],
    errors: ["PAIR_MINT_IDENTITY_MISMATCH"]
  });
});

test("rejects unsupported chain, invalid measures, and unsafe counts instead of coercing them", () => {
  const adapter = new DexScreenerPairsAdapter(async () => successResponse());

  const otherChain = fixtureText.replace('"chainId": "solana"', '"chainId": "ethereum"');
  assert.deepEqual(adapter.normalize(envelope(otherChain), context), {
    observations: [],
    errors: ["UNSUPPORTED_CHAIN"]
  });

  const invalidPrice = fixtureText.replace('"priceUsd": "0.123456789012345678"', '"priceUsd": "-1"');
  assert.deepEqual(adapter.normalize(envelope(invalidPrice), context), {
    observations: [],
    errors: ["INVALID_MARKET_MEASURE"]
  });

  const unsafeCount = fixtureText.replace('"buys": 17', '"buys": 9007199254740992');
  assert.deepEqual(adapter.normalize(envelope(unsafeCount), context), {
    observations: [],
    errors: ["INVALID_MARKET_MEASURE"]
  });
});

test("classifies HTTP rate limit without leaking response body", async () => {
  const adapter = new DexScreenerPairsAdapter(async () =>
    new Response("sensitive-provider-response-body", { status: 429 })
  );
  await assert.rejects(
    adapter.fetchRaw(request, new AbortController().signal),
    (error) => {
      assert.ok(error instanceof DexScreenerAdapterError);
      assert.equal(error.code, "RATE_LIMIT");
      assert.equal(error.retryable, true);
      assert.equal(error.statusCode, 429);
      assert.equal(String(error).includes("sensitive-provider-response-body"), false);
      return true;
    }
  );
});

test("cancels an oversized response stream once the byte limit is exceeded", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(1_000_000).fill(0x20));
      controller.enqueue(new Uint8Array(1).fill(0x20));
      controller.close();
    },
    cancel() {
      cancelled = true;
    }
  });
  const adapter = new DexScreenerPairsAdapter(async () => new Response(body));
  await assert.rejects(
    adapter.fetchRaw(request, new AbortController().signal),
    (error) => error instanceof DexScreenerAdapterError && error.code === "PARSE"
  );
  assert.equal(cancelled, true);
});

test("rejects invalid base/quote/pool IDs and validates timeout configuration", async () => {
  const adapter = new DexScreenerPairsAdapter(async () => successResponse());
  await assert.rejects(
    adapter.fetchRaw({ ...request, poolAddress: "bad-address" }, new AbortController().signal),
    (error) => error instanceof DexScreenerAdapterError && error.code === "PARSE"
  );
  assert.throws(() => new DexScreenerPairsAdapter(async () => successResponse(), 0), /timeoutMs/);
});
