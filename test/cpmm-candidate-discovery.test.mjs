import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverRaydiumCpmmCandidates
} from "../scripts/discover-raydium-cpmm-candidates.mjs";

const CPMM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const CLMM = "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK";
const SOL = "So11111111111111111111111111111111111111112";
const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(Array.from(BASE58_ALPHABET, (character, index) => [character, BigInt(index)]));
function decode58(text) {
  let value = 0n;
  for (const character of text) value = value * 58n + BASE58_INDEX.get(character);
  const bytes = [];
  while (value > 0n) {
    bytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  let leading = 0;
  while (leading < text.length && text[leading] === "1") leading += 1;
  return Buffer.concat([Buffer.alloc(leading), Buffer.from(bytes)]);
}
function writeKey(buffer, offset, address) {
  const key = decode58(address);
  assert.equal(key.length, 32);
  key.copy(buffer, offset);
}
const POOL_STATE_BYTES = Buffer.alloc(637);
POOL_STATE_BYTES.set([0xf7, 0xed, 0xe3, 0xf5, 0xd7, 0xc3, 0xde, 0x46], 0);
const sortedMints = [SOL, USDC].sort((left, right) => Buffer.compare(decode58(left), decode58(right)));
writeKey(POOL_STATE_BYTES, 168, sortedMints[0]);
writeKey(POOL_STATE_BYTES, 200, sortedMints[1]);
const POOL_DATA_BASE64 = POOL_STATE_BYTES.toString("base64");
const HIGH_CPMM = "Ff68JGeEiUEF859B2xEaPX82vuFeuwxqoxGNHTZPAuKR";
const LOW_CPMM = "7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny";
const HIGH_CLMM = "3ucNos4NbumPLZNWztqGHNFFgkHeRMBQAVemeeomsUxv";

const approvals = {
  ATA_CPMM_DISCOVERY_RPC_APPROVAL: "APPROVED_READ_ONLY_MAINNET_DISCOVERY",
  ATA_CPMM_DISCOVERY_PROVIDER_APPROVAL: "DEXSCREENER_TERMS_AND_BUDGET_REVIEWED",
  ATA_CPMM_DISCOVERY_MIN_LIQUIDITY_USD: "100000",
  ATA_CPMM_DISCOVERY_MIN_VOLUME_24H_USD: "10000"
};

function makePair(pairAddress, liquidity, volume24h, dexId = "raydium") {
  return {
    chainId: "solana",
    dexId,
    pairAddress,
    baseToken: { address: SOL, symbol: "SOL" },
    quoteToken: { address: USDC, symbol: "USDC" },
    priceUsd: "100.51",
    liquidity: { usd: liquidity },
    volume: { h24: volume24h },
    txns: { h24: { buys: 120, sells: 98 } },
    pairCreatedAt: 1760000000000
  };
}

function mockFetchFactory() {
  const calls = [];
  const pairs = [
    makePair(HIGH_CLMM, 2_000_000, 500_000, "raydium"),
    makePair(HIGH_CPMM, 500_000, 75_000),
    makePair(LOW_CPMM, 86, 2)
  ];
  const owners = {
    [HIGH_CLMM]: CLMM,
    [HIGH_CPMM]: CPMM,
    [LOW_CPMM]: CPMM
  };

  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.startsWith("https://api.dexscreener.com/latest/dex/tokens/")) {
      return new Response(JSON.stringify({ pairs }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    assert.equal(url, "https://api.mainnet.solana.com");
    assert.equal(init.method, "POST");
    const request = JSON.parse(init.body);
    assert.equal(request.method, "getMultipleAccounts");
    assert.equal(request.params[1].commitment, "finalized");
    const addresses = request.params[0];
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        context: { slot: 462900001 },
        value: addresses.map((address) => ({
          owner: owners[address],
          executable: false,
          space: 637,
          data: [POOL_DATA_BASE64, "base64"]
        }))
      }
    }), {
      status: 200,
      headers: { "content-type": "application/json" }
    });
  };

  return { fetchImpl, calls };
}

test("requires explicit read-only RPC acknowledgement before any network call", async () => {
  let calls = 0;
  await assert.rejects(
    discoverRaydiumCpmmCandidates({
      env: {},
      fetchImpl: async () => { calls += 1; throw new Error("must not run"); }
    }),
    { code: "READ_ONLY_MAINNET_RPC_APPROVAL_REQUIRED" }
  );
  assert.equal(calls, 0);
});

test("ranks exact SOL/USDC candidates by indexed liquidity but only admits on-chain CPMM-owned pools", async () => {
  const { fetchImpl, calls } = mockFetchFactory();
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl,
    now: () => "2026-10-29T09:00:00.000Z"
  });

  assert.equal(calls.length, 2);
  assert.equal(report.status, "CPMM_CANDIDATES_FOUND");
  assert.equal(report.source.freshness, "UNKNOWN");
  assert.match(report.source.rawPayloadSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.rpcEvidence.synthetic, true);
  assert.equal(report.rpcEvidence.contextSlot, 462900001);
  assert.equal(report.selectionPolicy.candidateCount, 2);
  assert.equal(report.selectionPolicy.thresholdQualifiedCount, 1);
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, HIGH_CPMM);
  assert.deepEqual(report.candidates.map((item) => item.poolAddress), [HIGH_CPMM, LOW_CPMM]);
  assert.equal(report.candidates[0].onChainProgram, "RAYDIUM_CPMM");
  assert.equal(report.candidates[0].meetsLiquidityAndVolumeThresholds, true);
  assert.equal(report.candidates[1].meetsLiquidityAndVolumeThresholds, false);
  assert.equal(report.candidates.some((item) => item.poolAddress === HIGH_CLMM), false);
  assert.equal(report.candidates[0].sourceFreshness, "UNKNOWN");
});

test("does not count quote-mint or non-Solana pairs as candidates", async () => {
  let rpcCalls = 0;
  const fetchImpl = async (input) => {
    const url = String(input);
    if (url.startsWith("https://api.dexscreener.com/")) {
      return new Response(JSON.stringify({
        pairs: [
          {
            ...makePair(HIGH_CPMM, 5_000_000, 1_000_000),
            chainId: "ethereum"
          },
          {
            ...makePair(LOW_CPMM, 5_000_000, 1_000_000),
            quoteToken: { address: "11111111111111111111111111111111", symbol: "OTHER" }
          }
        ]
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    rpcCalls += 1;
    throw new Error("RPC must not run when there are no exact pairs");
  };
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl,
    now: () => "2026-10-29T09:00:00.000Z"
  });
  assert.equal(rpcCalls, 0);
  assert.equal(report.status, "NO_CPMM_CANDIDATES_FOUND");
  assert.equal(report.selectionPolicy.candidateCount, 0);
});

test("does not classify an owner-matching account as a CPMM pool if the PoolState space is wrong", async () => {
  const wrongSpaceFetch = async (input, init = {}) => {
    if (String(input).startsWith("https://api.dexscreener.com/")) {
      return new Response(JSON.stringify({
        pairs: [makePair(HIGH_CPMM, 500_000, 75_000)]
      }), { status: 200 });
    }
    const request = JSON.parse(init.body);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: request.id,
      result: {
        context: { slot: 462900001 },
        value: [{ owner: CPMM, executable: false, space: 636, data: [POOL_DATA_BASE64, "base64"] }]
      }
    }), { status: 200 });
  };
  const report = await discoverRaydiumCpmmCandidates({ env: approvals, fetchImpl: wrongSpaceFetch });
  assert.equal(report.status, "NO_CPMM_CANDIDATES_FOUND");
  assert.equal(report.selectionPolicy.candidateCount, 0);
});

test("fails closed if the RPC returns a mismatched request id", async () => {
  const { fetchImpl } = mockFetchFactory();
  const badFetch = async (input, init = {}) => {
    const url = String(input);
    if (url.startsWith("https://api.dexscreener.com/")) {
      return new Response(JSON.stringify({
        pairs: [makePair(HIGH_CPMM, 500_000, 75_000)]
      }), { status: 200 });
    }
    const request = JSON.parse(init.body);
    return new Response(JSON.stringify({
      jsonrpc: "2.0",
      id: request.id + "-wrong",
      result: {
        context: { slot: 462900001 },
        value: [{ owner: CPMM, executable: false, space: 637, data: [POOL_DATA_BASE64, "base64"] }]
      }
    }), { status: 200 });
  };
  await assert.rejects(
    discoverRaydiumCpmmCandidates({ env: approvals, fetchImpl: badFetch }),
    { code: "RPC_RESPONSE_SHAPE_INVALID" }
  );
});

test("rejects a threshold that is not a safe non-negative decimal", async () => {
  const { fetchImpl } = mockFetchFactory();
  await assert.rejects(
    discoverRaydiumCpmmCandidates({
      env: {
        ...approvals,
        ATA_CPMM_DISCOVERY_MIN_LIQUIDITY_USD: "-1"
      },
      fetchImpl
    }),
    { code: "DISCOVERY_THRESHOLD_INVALID" }
  );
});
