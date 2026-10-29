import assert from "node:assert/strict";
import test from "node:test";
import {
  discoverRaydiumCpmmCandidates
} from "../scripts/discover-raydium-cpmm-candidates.mjs";

const CPMM = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
const AMM_V4 = "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8";
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
  ATA_CPMM_DISCOVERY_RAYDIUM_API_APPROVAL: "RAYDIUM_API_USAGE_REVIEWED",
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

function makeRaydiumPool(poolAddress, programId, tvl, volume24h, type = "Standard") {
  return {
    id: poolAddress,
    programId,
    type,
    mintA: { address: SOL, symbol: "SOL", decimals: 9 },
    mintB: { address: USDC, symbol: "USDC", decimals: 6 },
    price: 100.51,
    mintAmountA: 1000,
    mintAmountB: 100510,
    tvl,
    day: { volume: volume24h, volumeQuote: volume24h, volumeFee: 0, apr: 0, feeApr: 0, priceMin: 99, priceMax: 101, rewardApr: [] },
    openTime: "2026-10-01T00:00:00Z"
  };
}

function raydiumResponse(pools, {
  hasNextPage = false,
  includeHasNextPage = true,
  count = pools.length,
  nextPageId,
  wrapped = "none"
} = {}) {
  const page = { count, data: pools };
  if (includeHasNextPage) page.hasNextPage = hasNextPage;
  if (nextPageId !== undefined) page.nextPageId = nextPageId;
  if (wrapped === "success") return { id: "raydium-response-id", success: true, data: page };
  if (wrapped === "data") return { id: "raydium-response-id", data: page };
  if (wrapped === "success_array") return { id: "raydium-response-id", success: true, data: pools };
  return page;
}

function pairResponse(pairs) {
  return { schemaVersion: "test", pairs };
}

function poolApiUrl(url) {
  return url.startsWith("https://api-v3.raydium.io/pools/info/mint?");
}

function mockFetchFactory({ rpcOwnerOverrides = {}, hasNextPage = false } = {}) {
  const calls = [];
  const dexPairs = [
    makePair(HIGH_CPMM, 500_000, 75_000),
    makePair(LOW_CPMM, 86, 2)
  ];
  const raydiumPools = [
    makeRaydiumPool(HIGH_CLMM, CLMM, 2_000_000, 500_000),
    makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000),
    makeRaydiumPool(LOW_CPMM, CPMM, 86, 2)
  ];

  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    calls.push({ url, init });
    if (poolApiUrl(url)) {
      assert.equal(init.method, "GET");
      assert.match(url, /mint1=So11111111111111111111111111111111111111112/);
      assert.match(url, /mint2=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v/);
      assert.match(url, /poolType=standard/);
      assert.match(url, /poolSortField=liquidity/);
      assert.match(url, /sortType=desc/);
      assert.match(url, /pageSize=100/);
      assert.match(url, /page=1/);
      return new Response(JSON.stringify(raydiumResponse(raydiumPools, { hasNextPage })), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    if (url.startsWith("https://api.mainnet.solana.com")) {
      assert.equal(init.method, "POST");
      const request = JSON.parse(init.body);
      assert.equal(request.method, "getMultipleAccounts");
      assert.equal(request.params[1].commitment, "finalized");
      const addresses = request.params[0];
      const owners = {
        [HIGH_CLMM]: CLMM,
        [HIGH_CPMM]: CPMM,
        [LOW_CPMM]: CPMM,
        ...rpcOwnerOverrides
      };
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
    }
    if (url.startsWith("https://api.dexscreener.com/latest/dex/pairs/solana/")) {
      const requestedAddress = url.split("/").at(-1);
      const indexedPairs = dexPairs.filter((pair) => pair.pairAddress === requestedAddress);
      return new Response(JSON.stringify(pairResponse(indexedPairs.length > 0 ? indexedPairs : null)), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    throw new Error("Unexpected mocked URL");
  };
  return { fetchImpl, calls };
}

test("requires all provider and read-only RPC approvals before any network call", async () => {
  let calls = 0;
  await assert.rejects(
    discoverRaydiumCpmmCandidates({
      env: {},
      fetchImpl: async () => { calls += 1; throw new Error("must not run"); }
    }),
    { code: "READ_ONLY_MAINNET_RPC_APPROVAL_REQUIRED" }
  );
  await assert.rejects(
    discoverRaydiumCpmmCandidates({
      env: { ...approvals, ATA_CPMM_DISCOVERY_RAYDIUM_API_APPROVAL: "" },
      fetchImpl: async () => { calls += 1; throw new Error("must not run"); }
    }),
    { code: "RAYDIUM_API_USAGE_REVIEW_REQUIRED" }
  );
  assert.equal(calls, 0);
});

test("combines official Raydium pool discovery, on-chain CPMM decode and exact DEX Screener cross-check", async () => {
  const { fetchImpl, calls } = mockFetchFactory();
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl,
    now: () => "2026-10-29T09:00:00.000Z"
  });

  assert.equal(calls.length, 4); // Raydium pool list, one RPC bundle, two exact CPMM pair lookups
  assert.equal(report.status, "QUALIFYING_CPMM_CANDIDATES_FOUND");
  assert.equal(report.sources.raydiumApi.providerId, "raydium-api-v3");
  assert.equal(report.sources.raydiumApi.freshness, "UNKNOWN");
  assert.match(report.sources.raydiumApi.rawPayloadSha256, /^[a-f0-9]{64}$/);
  assert.equal(report.rpcEvidence.synthetic, true);
  assert.equal(report.rpcEvidence.contextSlot, 462900001);
  assert.equal(report.selectionPolicy.candidateCount, 2);
  assert.equal(report.selectionPolicy.thresholdQualifiedCount, 1);
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, HIGH_CPMM);
  assert.deepEqual(report.candidates.map((item) => item.poolAddress), [HIGH_CPMM, LOW_CPMM]);
  assert.equal(report.candidates[0].onChainProgram, "RAYDIUM_CPMM");
  assert.equal(report.candidates[0].dexScreenerPairFound, true);
  assert.equal(report.candidates[0].meetsRaydiumThresholds, true);
  assert.equal(report.candidates[0].meetsDexScreenerThresholds, true);
  assert.equal(report.candidates[0].meetsLiquidityAndVolumeThresholds, true);
  assert.equal(report.candidates[0].dexScreenerMetrics.priceUsd, 100.51);
  assert.equal(report.candidates[1].meetsLiquidityAndVolumeThresholds, false);
  assert.equal(report.candidates.some((item) => item.poolAddress === HIGH_CLMM), false);
  assert.equal(report.candidates[0].sourceFreshness, "UNKNOWN");
});

test("treats a nullable DEX Screener pair list as not indexed without qualifying the pool", async () => {
  const { fetchImpl } = mockFetchFactory();
  const noIndexedPairsFetch = async (input, init = {}) => {
    if (String(input).startsWith("https://api.dexscreener.com/latest/dex/pairs/solana/")) {
      return new Response(JSON.stringify({ schemaVersion: "1.0.0", pairs: null }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return fetchImpl(input, init);
  };

  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl: noIndexedPairsFetch,
    now: () => "2026-10-29T09:00:00.000Z"
  });

  assert.equal(report.status, "CPMM_FOUND_BUT_NONE_CROSS_QUALIFIED");
  assert.equal(report.selectionPolicy.scanIncomplete, false);
  assert.equal(report.selectionPolicy.candidateCount, 2);
  assert.equal(report.selectionPolicy.thresholdQualifiedCount, 0);
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, null);
  assert.equal(report.sources.dexScreener.poolLookupsAttempted, 2);
  assert.equal(report.sources.dexScreener.poolLookupsFound, 0);
  assert.ok(report.candidates.every((candidate) => candidate.dexScreenerPairFound === false));
  assert.ok(report.candidates.every((candidate) => candidate.meetsLiquidityAndVolumeThresholds === false));
});

test("continues to reject a malformed non-null DEX Screener pairs value", async () => {
  const { fetchImpl } = mockFetchFactory();
  const malformedPairsFetch = async (input, init = {}) => {
    if (String(input).startsWith("https://api.dexscreener.com/latest/dex/pairs/solana/")) {
      return new Response(JSON.stringify({ schemaVersion: "1.0.0", pairs: "unexpected" }), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return fetchImpl(input, init);
  };

  await assert.rejects(
    discoverRaydiumCpmmCandidates({ env: approvals, fetchImpl: malformedPairsFetch }),
    { code: "DEX_SCREENER_PAIR_RESPONSE_SHAPE_INVALID" }
  );
});

test("accepts Raydium SDK page shape and supported HTTP envelope forms", async () => {
  for (const wrapped of ["none", "success", "data"]) {
    const { fetchImpl } = mockFetchFactory();
    const wrappedFetch = async (input, init = {}) => {
      const url = String(input);
      if (poolApiUrl(url)) {
        return new Response(JSON.stringify(raydiumResponse([
          makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000)
        ], { wrapped })), { status: 200, headers: { "content-type": "application/json" } });
      }
      return fetchImpl(input, init);
    };
    const report = await discoverRaydiumCpmmCandidates({
      env: approvals,
      fetchImpl: wrappedFetch,
      now: () => "2026-10-29T09:00:00.000Z"
    });
    assert.equal(report.selectionPolicy.candidateCount, 1);
    assert.equal(report.status, "QUALIFYING_CPMM_CANDIDATES_FOUND");
  }
});

test("uses the documented mint-pair endpoint and treats a short numbered page as terminal", async () => {
  const { fetchImpl } = mockFetchFactory();
  const documentedFetch = async (input, init = {}) => {
    const url = String(input);
    if (poolApiUrl(url)) {
      return new Response(JSON.stringify({
        id: "raydium-http-envelope",
        success: true,
        data: {
          count: 1,
          data: [makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000)]
        }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
    return fetchImpl(input, init);
  };
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl: documentedFetch,
    now: () => "2026-10-29T09:00:00.000Z"
  });
  assert.equal(report.sources.raydiumApi.endpointClass, "pools/info/mint");
  assert.equal(report.sources.raydiumApi.paginationKnown, true);
  assert.equal(report.sources.raydiumApi.paginationSignal, "SHORT_NUMBERED_PAGE_TERMINAL");
  assert.equal(report.selectionPolicy.scanIncomplete, false);
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, HIGH_CPMM);
});

test("uses nextPageId cursor and refuses to recommend from a partial page", async () => {
  const { fetchImpl } = mockFetchFactory();
  const cursorFetch = async (input, init = {}) => {
    const url = String(input);
    if (poolApiUrl(url)) {
      return new Response(JSON.stringify(raydiumResponse([
        makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000)
      ], { includeHasNextPage: false, nextPageId: "opaque-next-page" })), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return fetchImpl(input, init);
  };
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl: cursorFetch,
    now: () => "2026-10-29T09:00:00.000Z"
  });
  assert.equal(report.selectionPolicy.raydiumPaginationKnown, true);
  assert.equal(report.selectionPolicy.raydiumPaginationSignal, "NEXT_PAGE_CURSOR_PRESENT");
  assert.equal(report.selectionPolicy.scanIncomplete, true);
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, null);
  assert.equal(report.status, "QUALIFYING_CPMM_CANDIDATES_FOUND_PARTIAL_SCAN");
});

test("keeps full numbered page incomplete when pagination signals are absent", async () => {
  const { fetchImpl } = mockFetchFactory();
  const noPaginationFetch = async (input, init = {}) => {
    const url = String(input);
    if (poolApiUrl(url)) {
      return new Response(JSON.stringify(raydiumResponse(
        Array.from({ length: 100 }, () => makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000)),
        { includeHasNextPage: false, count: 100 }
      )), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return fetchImpl(input, init);
  };
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl: noPaginationFetch,
    now: () => "2026-10-29T09:00:00.000Z"
  });
  assert.equal(report.selectionPolicy.raydiumPaginationKnown, false);
  assert.equal(report.selectionPolicy.scanIncomplete, true);
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, null);
  assert.equal(report.status, "QUALIFYING_CPMM_CANDIDATES_FOUND_PARTIAL_SCAN");
  assert.equal(report.sources.raydiumApi.responseDiagnostics.pageHasNextPageType, "undefined");
  assert.equal(report.sources.raydiumApi.responseDiagnostics.poolArrayLength, 100);
});

test("accepts success envelope with a direct pool array but marks it incomplete without pagination metadata", async () => {
  const { fetchImpl } = mockFetchFactory();
  const directArrayFetch = async (input, init = {}) => {
    if (poolApiUrl(String(input))) {
      return new Response(JSON.stringify(raydiumResponse(
        Array.from({ length: 100 }, () => makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000)),
        { wrapped: "success_array", includeHasNextPage: false, count: 100 }
      )), {
        status: 200,
        headers: { "content-type": "application/json" }
      });
    }
    return fetchImpl(input, init);
  };
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl: directArrayFetch,
    now: () => "2026-10-29T09:00:00.000Z"
  });
  assert.equal(report.sources.raydiumApi.responseShape, "success_array");
  assert.equal(report.selectionPolicy.scanIncomplete, true);
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, null);
});

test("does not count wrong mint pairs or non-standard pools from the Raydium API", async () => {
  let rpcCalls = 0;
  const fetchImpl = async (input) => {
    const url = String(input);
    if (poolApiUrl(url)) {
      return new Response(JSON.stringify(raydiumResponse([
        {
          ...makeRaydiumPool(HIGH_CPMM, CPMM, 5_000_000, 1_000_000),
          mintB: { address: "11111111111111111111111111111111", symbol: "OTHER" }
        },
        makeRaydiumPool(LOW_CPMM, CPMM, 5_000_000, 1_000_000, "Concentrated")
      ])), { status: 200, headers: { "content-type": "application/json" } });
    }
    rpcCalls += 1;
    throw new Error("RPC must not run when there are no exact standard pairs");
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

test("does not admit a CPMM pool if the API program ID disagrees with the on-chain owner", async () => {
  const { fetchImpl } = mockFetchFactory({ rpcOwnerOverrides: { [HIGH_CPMM]: AMM_V4 } });
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl,
    now: () => "2026-10-29T09:00:00.000Z"
  });
  assert.equal(report.selectionPolicy.candidateCount, 1);
  assert.equal(report.candidates.some((item) => item.poolAddress === HIGH_CPMM), false);
  assert.equal(report.selectionPolicy.poolClassificationSummary.RAYDIUM_API_PROGRAM_ID_MISMATCH, 1);
});

test("wrong PoolState size fails closed", async () => {
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (poolApiUrl(url)) {
      return new Response(JSON.stringify(raydiumResponse([
        makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000)
      ])), { status: 200, headers: { "content-type": "application/json" } });
    }
    if (url.startsWith("https://api.mainnet.solana.com")) {
      const request = JSON.parse(init.body);
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          context: { slot: 462900001 },
          value: [{ owner: CPMM, executable: false, space: 636, data: [POOL_DATA_BASE64, "base64"] }]
        }
      }), { status: 200 });
    }
    throw new Error("DEX Screener should not be called after bad PoolState data");
  };
  const report = await discoverRaydiumCpmmCandidates({ env: approvals, fetchImpl });
  assert.equal(report.selectionPolicy.candidateCount, 0);
});

test("incomplete Raydium API paging cannot advertise a recommended pool", async () => {
  const { fetchImpl } = mockFetchFactory({ hasNextPage: true });
  const report = await discoverRaydiumCpmmCandidates({
    env: approvals,
    fetchImpl,
    now: () => "2026-10-29T09:00:00.000Z"
  });
  assert.equal(report.status, "QUALIFYING_CPMM_CANDIDATES_FOUND_PARTIAL_SCAN");
  assert.equal(report.selectionPolicy.recommendedFollowUpPoolAddress, null);
});

test("fails closed if the RPC returns a mismatched request id", async () => {
  const fetchImpl = async (input, init = {}) => {
    const url = String(input);
    if (poolApiUrl(url)) {
      return new Response(JSON.stringify(raydiumResponse([
        makeRaydiumPool(HIGH_CPMM, CPMM, 500_000, 75_000)
      ])), { status: 200 });
    }
    if (url.startsWith("https://api.mainnet.solana.com")) {
      const request = JSON.parse(init.body);
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id + "-wrong",
        result: {
          context: { slot: 462900001 },
          value: [{ owner: CPMM, executable: false, space: 637, data: [POOL_DATA_BASE64, "base64"] }]
        }
      }), { status: 200 });
    }
    throw new Error("Dex pair call should not be reached");
  };
  await assert.rejects(
    discoverRaydiumCpmmCandidates({ env: approvals, fetchImpl }),
    { code: "RPC_RESPONSE_SHAPE_INVALID" }
  );
});

test("rejects a threshold that is not a safe non-negative decimal before making any request", async () => {
  let calls = 0;
  await assert.rejects(
    discoverRaydiumCpmmCandidates({
      env: {
        ...approvals,
        ATA_CPMM_DISCOVERY_MIN_LIQUIDITY_USD: "-1"
      },
      fetchImpl: async () => { calls += 1; throw new Error("must not run"); }
    }),
    { code: "DISCOVERY_THRESHOLD_INVALID" }
  );
  assert.equal(calls, 0);
});
