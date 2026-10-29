#!/usr/bin/env node
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import {
  decodeRaydiumCpmmPool,
  isSolanaPublicKey,
  RAYDIUM_CPMM_PROGRAM_ID
} from "../packages/market-data/dist/index.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
// Discovery-only allowlist of canonical Solana stablecoin quote mints.
// This does not approve either asset or any pool for production trading.
const APPROVED_QUOTE_ASSETS = Object.freeze([
  { symbol: "USDC", mint: USDC_MINT },
  { symbol: "USDT", mint: USDT_MINT }
]);
const RAYDIUM_POOL_PAGE_SIZE = 100;
const MAX_RAYDIUM_PAGES_PER_QUOTE = 10;
const RAYDIUM_POOL_QUERY_BASE_URL = "https://api-v3.raydium.io/pools/info/mint";
const DEX_SCREENER_PAIR_URL_BASE = "https://api.dexscreener.com/latest/dex/pairs/solana/";
const RAYDIUM_API_PROVIDER_ID = "raydium-api-v3";
const RPC_URL = "https://api.mainnet.solana.com";
const RPC_PROVIDER_ID = "solana-public-shared";
const MAX_RESPONSE_BYTES = 5_000_000;
const MAX_POOL_ACCOUNTS = 100;
const MAX_DISPLAY_CANDIDATES = 20;
const RPC_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

function buildRaydiumPoolQueryUrl(quoteMint, pageNumber) {
  const params = new URLSearchParams({
    mint1: SOL_MINT,
    mint2: quoteMint,
    poolType: "standard",
    poolSortField: "liquidity",
    sortType: "desc",
    pageSize: String(RAYDIUM_POOL_PAGE_SIZE),
    page: String(pageNumber)
  });
  return RAYDIUM_POOL_QUERY_BASE_URL + "?" + params.toString();
}

function isApprovedSolQuotePair(mintA, mintB) {
  return mintA === SOL_MINT && APPROVED_QUOTE_ASSETS.some((asset) => asset.mint === mintB)
    ? { baseMint: SOL_MINT, quoteMint: mintB }
    : mintB === SOL_MINT && APPROVED_QUOTE_ASSETS.some((asset) => asset.mint === mintA)
      ? { baseMint: SOL_MINT, quoteMint: mintA }
      : null;
}

function quoteAssetForMint(mint) {
  return APPROVED_QUOTE_ASSETS.find((asset) => asset.mint === mint) ?? null;
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function sha256(text) {
  return createHash("sha256").update(text, "utf8").digest("hex");
}

function approvalGate(env) {
  if (env.ATA_CPMM_DISCOVERY_RPC_APPROVAL !== "APPROVED_READ_ONLY_MAINNET_DISCOVERY") {
    throw codedError("READ_ONLY_MAINNET_RPC_APPROVAL_REQUIRED");
  }
  if (env.ATA_CPMM_DISCOVERY_RAYDIUM_API_APPROVAL !== "RAYDIUM_API_USAGE_REVIEWED") {
    throw codedError("RAYDIUM_API_USAGE_REVIEW_REQUIRED");
  }
  if (env.ATA_CPMM_DISCOVERY_PROVIDER_APPROVAL !== "DEXSCREENER_TERMS_AND_BUDGET_REVIEWED") {
    throw codedError("DEXSCREENER_TERMS_QUOTA_BUDGET_REVIEW_REQUIRED");
  }
}

function readThreshold(env, name, fallback) {
  const input = env[name] === undefined ? fallback : env[name];
  if (typeof input !== "string" || input.length > 32 ||
      !/^(?:0|[1-9][0-9]*)(?:\.[0-9]{1,4})?$/.test(input)) {
    throw codedError("DISCOVERY_THRESHOLD_INVALID");
  }
  const value = Number(input);
  if (!Number.isFinite(value) || value < 0 || value > 1_000_000_000_000) {
    throw codedError("DISCOVERY_THRESHOLD_OUT_OF_RANGE");
  }
  return value;
}

async function readBoundedText(response, errorPrefix) {
  if (!response.ok) {
    await response.body?.cancel().catch(() => undefined);
    throw codedError(errorPrefix + "_HTTP_" + String(response.status));
  }
  const contentLength = response.headers.get("content-length");
  if (contentLength !== null && /^\d+$/.test(contentLength) &&
      Number(contentLength) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel().catch(() => undefined);
    throw codedError(errorPrefix + "_RESPONSE_TOO_LARGE");
  }
  if (response.body === null) {
    const text = await response.text();
    if (new TextEncoder().encode(text).byteLength > MAX_RESPONSE_BYTES) {
      throw codedError(errorPrefix + "_RESPONSE_TOO_LARGE");
    }
    return text;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  const chunks = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      receivedBytes += chunk.value.byteLength;
      if (receivedBytes > MAX_RESPONSE_BYTES) {
        await reader.cancel().catch(() => undefined);
        throw codedError(errorPrefix + "_RESPONSE_TOO_LARGE");
      }
      chunks.push(decoder.decode(chunk.value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } catch (error) {
    if (typeof error?.code === "string") throw error;
    throw codedError(errorPrefix + "_INVALID_UTF8");
  }
  return chunks.join("");
}

async function fetchJson(fetchImpl, url, init, errorPrefix) {
  let response;
  try {
    response = await fetchImpl(url, {
      ...init,
      redirect: "error",
      signal: init.signal ?? AbortSignal.timeout(10_000)
    });
  } catch {
    throw codedError(errorPrefix + "_NETWORK_ERROR");
  }
  const rawText = await readBoundedText(response, errorPrefix);
  let payload;
  try {
    payload = JSON.parse(rawText);
  } catch {
    throw codedError(errorPrefix + "_JSON_INVALID");
  }
  return { payload, rawText };
}

function asNonNegativeMetric(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) && value >= 0 ? value : null;
  }
  if (typeof value === "string" && value.length <= 64 &&
      /^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(value)) {
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 ? number : null;
  }
  return null;
}

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeExactPair(pair) {
  if (!isRecord(pair) ||
      pair.chainId !== "solana" ||
      typeof pair.dexId !== "string" ||
      !pair.dexId.toLowerCase().startsWith("raydium") ||
      typeof pair.pairAddress !== "string" ||
      !isSolanaPublicKey(pair.pairAddress) ||
      !isRecord(pair.baseToken) ||
      !isRecord(pair.quoteToken) ||
      typeof pair.baseToken.address !== "string" ||
      typeof pair.quoteToken.address !== "string") {
    return null;
  }

  const pairMints = isApprovedSolQuotePair(pair.baseToken.address, pair.quoteToken.address);
  if (pairMints === null) return null;
  const quoteAsset = quoteAssetForMint(pairMints.quoteMint);
  const solIsBaseToken = pair.baseToken.address === SOL_MINT;
  const liquidity = asNonNegativeMetric(pair.liquidity?.usd);
  const volume24h = asNonNegativeMetric(pair.volume?.h24);
  const priceUsd = asNonNegativeMetric(pair.priceUsd);
  const buys24h = asNonNegativeMetric(pair.txns?.h24?.buys);
  const sells24h = asNonNegativeMetric(pair.txns?.h24?.sells);

  return {
    poolAddress: pair.pairAddress,
    dexId: pair.dexId,
    baseMint: SOL_MINT,
    quoteMint: pairMints.quoteMint,
    quoteAssetSymbol: quoteAsset?.symbol ?? null,
    dexBaseMint: pair.baseToken.address,
    dexQuoteMint: pair.quoteToken.address,
    baseSymbol: solIsBaseToken
      ? (typeof pair.baseToken.symbol === "string" ? pair.baseToken.symbol : null)
      : (typeof pair.quoteToken.symbol === "string" ? pair.quoteToken.symbol : null),
    quoteSymbol: solIsBaseToken
      ? (typeof pair.quoteToken.symbol === "string" ? pair.quoteToken.symbol : null)
      : (typeof pair.baseToken.symbol === "string" ? pair.baseToken.symbol : null),
    liquidityUsd: liquidity,
    volume24hUsd: volume24h,
    // priceUsd is the USD price of the source's base token, so keep its mint explicit.
    priceUsd,
    priceUsdMint: pair.baseToken.address,
    buys24h: buys24h !== null && Number.isSafeInteger(buys24h) ? buys24h : null,
    sells24h: sells24h !== null && Number.isSafeInteger(sells24h) ? sells24h : null,
    pairCreatedAt: Number.isSafeInteger(pair.pairCreatedAt) ? pair.pairCreatedAt : null,
    sourceObservedAt: null
  };
}

function normalizeRaydiumPool(pool) {
  if (!isRecord(pool) ||
      pool.type !== "Standard" ||
      typeof pool.id !== "string" ||
      !isSolanaPublicKey(pool.id) ||
      typeof pool.programId !== "string" ||
      !isSolanaPublicKey(pool.programId) ||
      !isRecord(pool.mintA) ||
      !isRecord(pool.mintB) ||
      typeof pool.mintA.address !== "string" ||
      typeof pool.mintB.address !== "string") {
    return null;
  }
  const mintA = pool.mintA.address;
  const mintB = pool.mintB.address;
  const pairMints = isApprovedSolQuotePair(mintA, mintB);
  if (pairMints === null) return null;
  const quoteAsset = quoteAssetForMint(pairMints.quoteMint);
  const liquidityUsd = asNonNegativeMetric(pool.tvl);
  const volume24hUsd = asNonNegativeMetric(pool.day?.volume);
  return {
    poolAddress: pool.id,
    raydiumProgramId: pool.programId,
    raydiumPoolType: pool.type,
    baseMint: SOL_MINT,
    quoteMint: pairMints.quoteMint,
    quoteAssetSymbol: quoteAsset?.symbol ?? null,
    baseSymbol: mintA === SOL_MINT ? pool.mintA.symbol ?? null : pool.mintB.symbol ?? null,
    quoteSymbol: mintA === SOL_MINT ? pool.mintB.symbol ?? null : pool.mintA.symbol ?? null,
    raydiumLiquidityUsd: liquidityUsd,
    raydiumVolume24hUsd: volume24hUsd,
    raydiumPrice: asNonNegativeMetric(pool.price),
    raydiumMintAmountA: asNonNegativeMetric(pool.mintAmountA),
    raydiumMintAmountB: asNonNegativeMetric(pool.mintAmountB),
    raydiumPoolCreatedAt: typeof pool.openTime === "string" ? pool.openTime : null,
    raydiumData: {
      liquidityUsd,
      volume24hUsd,
      price: asNonNegativeMetric(pool.price)
    }
  };
}

function normalizeRaydiumPage(payload, { pageNumber = 1, pageSize = RAYDIUM_POOL_PAGE_SIZE } = {}) {
  if (!isRecord(payload)) {
    throw codedError("RAYDIUM_API_RESPONSE_ROOT_NOT_OBJECT");
  }
  if (payload.success === false) {
    throw codedError("RAYDIUM_API_REPORTED_FAILURE");
  }

  // The documented /pools/info/mint route uses numbered page/pageSize.
  // Support the standard { id, success, data: { count, data: Pool[] } }
  // envelope and a direct PoolsApiReturn page for compatibility.
  let page = payload;
  let wrapper = "none";
  if (isRecord(payload.data) && Array.isArray(payload.data.data)) {
    page = payload.data;
    wrapper = payload.success === true ? "success_data" : "data";
  } else if (Array.isArray(payload.data) && payload.success === true) {
    page = {
      data: payload.data,
      count: payload.count,
      hasNextPage: payload.hasNextPage,
      nextPageId: payload.nextPageId
    };
    wrapper = "success_array";
  }

  if (!Array.isArray(page.data)) {
    throw codedError(wrapper === "none"
      ? "RAYDIUM_API_PAGE_DATA_NOT_ARRAY"
      : "RAYDIUM_API_NESTED_PAGE_DATA_NOT_ARRAY");
  }

  const hasNextPageFieldIsBoolean = typeof page.hasNextPage === "boolean";
  const hasNextCursorField = Object.prototype.hasOwnProperty.call(page, "nextPageId");
  const hasNextCursor = typeof page.nextPageId === "string" && page.nextPageId.trim().length > 0;
  const cursorFieldIsTerminal = hasNextCursorField &&
    (page.nextPageId === null || page.nextPageId === "" ||
      (typeof page.nextPageId === "string" && page.nextPageId.trim().length === 0));

  const parsedCount = typeof page.count === "number"
    ? page.count
    : typeof page.count === "string" && /^(?:0|[1-9][0-9]*)$/.test(page.count)
      ? Number(page.count)
      : null;
  const count = Number.isSafeInteger(parsedCount) && parsedCount >= 0 ? parsedCount : null;

  let hasNextPage = null;
  let paginationSignal = "UNKNOWN";
  if (hasNextPageFieldIsBoolean) {
    hasNextPage = page.hasNextPage || hasNextCursor;
    paginationSignal = hasNextPage ? "NEXT_PAGE_PRESENT" : "HAS_NEXT_PAGE_FALSE";
  } else if (hasNextCursor) {
    hasNextPage = true;
    paginationSignal = "NEXT_PAGE_CURSOR_PRESENT";
  } else if (cursorFieldIsTerminal) {
    hasNextPage = false;
    paginationSignal = "TERMINAL_CURSOR";
  } else if (count !== null && count > pageNumber * pageSize) {
    hasNextPage = true;
    paginationSignal = "COUNT_EXCEEDS_NUMBERED_PAGE";
  } else if (page.data.length < pageSize) {
    hasNextPage = false;
    paginationSignal = "SHORT_NUMBERED_PAGE_TERMINAL";
  } else if (count !== null && count < pageNumber * pageSize) {
    hasNextPage = false;
    paginationSignal = "COUNT_BELOW_NUMBERED_PAGE_END";
  }

  const diagnosticKeys = (value) => isRecord(value)
    ? Object.keys(value).filter((key) => /^[A-Za-z][A-Za-z0-9_]{0,40}$/.test(key)).sort().slice(0, 24)
    : [];

  return {
    count,
    hasNextPage,
    pools: page.data,
    responseShape: wrapper,
    paginationKnown: hasNextPage !== null,
    paginationSignal,
    responseDiagnostics: {
      rootKeys: diagnosticKeys(payload),
      rootSuccessType: typeof payload.success,
      rootDataType: Array.isArray(payload.data) ? "array" : payload.data === null ? "null" : typeof payload.data,
      nestedDataKeys: diagnosticKeys(payload.data),
      pageKeys: diagnosticKeys(page),
      pageCountType: typeof page.count,
      pageHasNextPageType: typeof page.hasNextPage,
      pageNextPageIdType: page.nextPageId === null ? "null" : typeof page.nextPageId,
      poolArrayLength: page.data.length,
      pageNumber,
      pageSize
    }
  };
}

async function lookupDexScreenerPair(fetchImpl, poolAddress, requestId, expectedQuoteMint) {
  const url = DEX_SCREENER_PAIR_URL_BASE + encodeURIComponent(poolAddress);
  const response = await fetchJson(fetchImpl, url, {
    method: "GET",
    headers: { accept: "application/json" }
  }, "DEX_SCREENER_PAIR");
  if (!isRecord(response.payload) ||
      !(Array.isArray(response.payload.pairs) || response.payload.pairs === null)) {
    throw codedError("DEX_SCREENER_PAIR_RESPONSE_SHAPE_INVALID");
  }

  // A nullable pair list means this address is not indexed; it can never qualify.
  // An omitted or malformed field still fails closed as a response-shape error.
  const indexedPairs = Array.isArray(response.payload.pairs) ? response.payload.pairs : [];
  const found = indexedPairs
    .map(normalizeExactPair)
    .find((pair) => pair !== null &&
      pair.poolAddress === poolAddress &&
      pair.quoteMint === expectedQuoteMint) ?? null;
  return {
    poolAddress,
    quoteMint: expectedQuoteMint,
    requestId,
    rawPayloadSha256: sha256(response.rawText),
    found: found !== null,
    pair: found
  };
}

function checkRpcAccounts(payload, requestId, expectedAddresses, expectedPoolMetadata = new Map()) {
  if (!isRecord(payload) || payload.jsonrpc !== "2.0" || payload.id !== requestId ||
      !isRecord(payload.result) || !isRecord(payload.result.context) ||
      !Number.isSafeInteger(payload.result.context.slot) || payload.result.context.slot < 0 ||
      !Array.isArray(payload.result.value) || payload.result.value.length !== expectedAddresses.length) {
    throw codedError("RPC_RESPONSE_SHAPE_INVALID");
  }

  const contextSlot = payload.result.context.slot;
  const value = payload.result.value;
  const classified = [];
  for (let index = 0; index < expectedAddresses.length; index += 1) {
    const account = value[index];
    if (account === null) {
      classified.push({
        poolAddress: expectedAddresses[index],
        ownerProgramId: null,
        classification: "ACCOUNT_MISSING"
      });
      continue;
    }
    if (!isRecord(account) ||
        typeof account.owner !== "string" ||
        !isSolanaPublicKey(account.owner) ||
        typeof account.executable !== "boolean" ||
        !Number.isSafeInteger(account.space) || account.space < 0 ||
        !Array.isArray(account.data) || account.data.length !== 2 ||
        typeof account.data[0] !== "string" || account.data[1] !== "base64") {
      throw codedError("RPC_ACCOUNT_SHAPE_INVALID");
    }
    const decodedPool = decodeRaydiumCpmmPool({
      address: expectedAddresses[index],
      exists: true,
      ownerProgramId: account.owner,
      executable: account.executable,
      dataBase64: account.data[0],
      space: account.space
    });
    const decodedTokenMints = decodedPool.status === "DECODED"
      ? [decodedPool.value.token0Mint, decodedPool.value.token1Mint]
      : null;
    const expectedPool = expectedPoolMetadata.get(expectedAddresses[index]) ?? null;
    const expectedProgramId = expectedPool?.programId ?? null;
    const hasExactOnChainMints = decodedTokenMints !== null &&
      new Set(decodedTokenMints).size === 2 &&
      expectedPool !== null &&
      decodedTokenMints.includes(expectedPool.baseMint) &&
      decodedTokenMints.includes(expectedPool.quoteMint);
    const classification = expectedProgramId !== null && account.owner !== expectedProgramId
      ? "RAYDIUM_API_PROGRAM_ID_MISMATCH"
      : account.owner === RAYDIUM_CPMM_PROGRAM_ID
        ? decodedPool.status !== "DECODED"
          ? "RAYDIUM_CPMM_DECODE_FAILED"
          : hasExactOnChainMints ? "RAYDIUM_CPMM" : "RAYDIUM_CPMM_MINT_IDENTITY_MISMATCH"
        : account.owner === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
          ? "RAYDIUM_AMM_V4"
          : account.owner === "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
            ? "RAYDIUM_CLMM"
            : "OTHER_PROGRAM";
    classified.push({
      poolAddress: expectedAddresses[index],
      ownerProgramId: account.owner,
      raydiumApiProgramId: expectedProgramId,
      classification,
      executable: account.executable,
      space: account.space,
      poolDecodeErrorCode: decodedPool.status === "ERROR" ? decodedPool.errorCode : null,
      token0Mint: decodedTokenMints?.[0] ?? null,
      token1Mint: decodedTokenMints?.[1] ?? null
    });
  }
  return { contextSlot, classified };
}

export async function discoverRaydiumCpmmCandidates({
  env = process.env,
  fetchImpl = globalThis.fetch,
  now = () => new Date().toISOString()
} = {}) {
  approvalGate(env);
  const minimumLiquidityUsd = readThreshold(env, "ATA_CPMM_DISCOVERY_MIN_LIQUIDITY_USD", "100000");
  const minimumVolume24hUsd = readThreshold(env, "ATA_CPMM_DISCOVERY_MIN_VOLUME_24H_USD", "10000");
  const clientRequestId = "cpmm-discovery-" + Date.now().toString(36);
  if (!RPC_REQUEST_ID_PATTERN.test(clientRequestId + "-rpc")) {
    throw codedError("DISCOVERY_REQUEST_ID_INVALID");
  }

  const byAddress = new Map();
  const raydiumPairResults = [];
  let raydiumScanIncomplete = false;
  for (const quoteAsset of APPROVED_QUOTE_ASSETS) {
    const pairResult = {
      quoteAssetSymbol: quoteAsset.symbol,
      quoteMint: quoteAsset.mint,
      pages: [],
      poolRecordsObserved: 0,
      reportedResultCount: null,
      paginationKnown: true,
      paginationTerminal: false
    };

    for (let pageNumber = 1; pageNumber <= MAX_RAYDIUM_PAGES_PER_QUOTE; pageNumber += 1) {
      const raydium = await fetchJson(
        fetchImpl,
        buildRaydiumPoolQueryUrl(quoteAsset.mint, pageNumber),
        { method: "GET", headers: { accept: "application/json" } },
        "RAYDIUM_API"
      );
      const retrievedAt = now();
      const page = normalizeRaydiumPage(raydium.payload, {
        pageNumber,
        pageSize: RAYDIUM_POOL_PAGE_SIZE
      });
      pairResult.poolRecordsObserved += page.pools.length;
      if (page.count !== null) {
        pairResult.reportedResultCount = Math.max(pairResult.reportedResultCount ?? 0, page.count);
      }
      pairResult.pages.push({
        pageNumber,
        responseShape: page.responseShape,
        rawPayloadSha256: sha256(raydium.rawText),
        retrievedAt,
        resultCount: page.count,
        hasNextPage: page.hasNextPage,
        paginationKnown: page.paginationKnown,
        paginationSignal: page.paginationSignal,
        responseDiagnostics: page.responseDiagnostics
      });

      for (const pool of page.pools) {
        const normalized = normalizeRaydiumPool(pool);
        if (normalized === null || normalized.quoteMint !== quoteAsset.mint) continue;
        const previous = byAddress.get(normalized.poolAddress);
        if (!previous || (normalized.raydiumLiquidityUsd ?? -1) > (previous.raydiumLiquidityUsd ?? -1)) {
          byAddress.set(normalized.poolAddress, normalized);
        }
      }

      if (page.hasNextPage === false) {
        pairResult.paginationTerminal = true;
        break;
      }
      if (page.hasNextPage !== true) {
        pairResult.paginationKnown = false;
        raydiumScanIncomplete = true;
        break;
      }
      if (pageNumber === MAX_RAYDIUM_PAGES_PER_QUOTE) {
        raydiumScanIncomplete = true;
        break;
      }
    }

    if (!pairResult.paginationTerminal) raydiumScanIncomplete = true;
    if (pairResult.reportedResultCount !== null &&
        pairResult.poolRecordsObserved < pairResult.reportedResultCount) {
      raydiumScanIncomplete = true;
    }
    raydiumPairResults.push(pairResult);
  }

  const exactPairs = [...byAddress.values()].sort((a, b) =>
    (b.raydiumLiquidityUsd ?? -1) - (a.raydiumLiquidityUsd ?? -1));
  const selected = exactPairs.slice(0, MAX_POOL_ACCOUNTS);
  let rpcEvidence = {
    providerId: RPC_PROVIDER_ID,
    commitment: "finalized",
    contextSlot: null,
    requestId: null,
    rawPayloadSha256: null,
    synthetic: fetchImpl !== globalThis.fetch
  };
  let classifications = [];
  if (selected.length > 0) {
    const rpcRequestId = clientRequestId + "-rpc";
    const rpcBody = JSON.stringify({
      jsonrpc: "2.0",
      id: rpcRequestId,
      method: "getMultipleAccounts",
      params: [
        selected.map((candidate) => candidate.poolAddress),
        { encoding: "base64", commitment: "finalized" }
      ]
    });
    const rpc = await fetchJson(fetchImpl, RPC_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json"
      },
      body: rpcBody
    }, "RPC");
    const expectedPoolMetadata = new Map(selected.map((candidate) => [
      candidate.poolAddress,
      {
        programId: candidate.raydiumProgramId,
        baseMint: candidate.baseMint,
        quoteMint: candidate.quoteMint
      }
    ]));
    const checked = checkRpcAccounts(
      rpc.payload,
      rpcRequestId,
      selected.map((candidate) => candidate.poolAddress),
      expectedPoolMetadata
    );
    classifications = checked.classified;
    rpcEvidence = {
      providerId: RPC_PROVIDER_ID,
      commitment: "finalized",
      contextSlot: checked.contextSlot,
      requestId: rpcRequestId,
      rawPayloadSha256: sha256(rpc.rawText),
      synthetic: fetchImpl !== globalThis.fetch
    };
  }

  const classByAddress = new Map(classifications.map((item) => [item.poolAddress, item]));
  const decodedCpmmCandidates = exactPairs.map((candidate) => {
    const onChain = classByAddress.get(candidate.poolAddress) ?? {
      ownerProgramId: null,
      classification: "NOT_CHECKED_ACCOUNT_CAP"
    };
    const meetsRaydiumThresholds =
      candidate.raydiumLiquidityUsd !== null &&
      candidate.raydiumVolume24hUsd !== null &&
      candidate.raydiumLiquidityUsd >= minimumLiquidityUsd &&
      candidate.raydiumVolume24hUsd >= minimumVolume24hUsd;
    return {
      ...candidate,
      onChainProgram: onChain.classification,
      onChainOwnerProgramId: onChain.ownerProgramId,
      onChainToken0Mint: onChain.token0Mint ?? null,
      onChainToken1Mint: onChain.token1Mint ?? null,
      poolDecodeErrorCode: onChain.poolDecodeErrorCode ?? null,
      meetsRaydiumThresholds,
      sourceFreshness: "UNKNOWN",
      freshnessReason: "Raydium pool API does not provide a reliable market-event timestamp in this response."
    };
  });

  const cpmmCandidates = decodedCpmmCandidates
    .filter((candidate) => candidate.onChainProgram === "RAYDIUM_CPMM")
    .sort((a, b) => (b.raydiumLiquidityUsd ?? -1) - (a.raydiumLiquidityUsd ?? -1));
  const candidatesToCrossCheck = cpmmCandidates.slice(0, MAX_DISPLAY_CANDIDATES);
  const dexScreenerEvidence = [];
  const dexByAddress = new Map();
  for (let index = 0; index < candidatesToCrossCheck.length; index += 1) {
    const candidate = candidatesToCrossCheck[index];
    const dexRequestId = clientRequestId + "-dex-" + String(index + 1);
    const checked = await lookupDexScreenerPair(
      fetchImpl,
      candidate.poolAddress,
      dexRequestId,
      candidate.quoteMint
    );
    dexScreenerEvidence.push({
      poolAddress: checked.poolAddress,
      quoteMint: checked.quoteMint,
      requestId: checked.requestId,
      rawPayloadSha256: checked.rawPayloadSha256,
      found: checked.found
    });
    dexByAddress.set(candidate.poolAddress, checked.pair);
  }

  const enrichedCandidates = cpmmCandidates.map((candidate) => {
    const dexPair = dexByAddress.get(candidate.poolAddress) ?? null;
    const dexMeetsThresholds = dexPair !== null &&
      dexPair.quoteMint === candidate.quoteMint &&
      dexPair.liquidityUsd !== null &&
      dexPair.volume24hUsd !== null &&
      dexPair.liquidityUsd >= minimumLiquidityUsd &&
      dexPair.volume24hUsd >= minimumVolume24hUsd;
    return {
      ...candidate,
      dexScreenerPairFound: dexPair !== null,
      dexScreenerMetrics: dexPair === null ? null : {
        liquidityUsd: dexPair.liquidityUsd,
        volume24hUsd: dexPair.volume24hUsd,
        priceUsd: dexPair.priceUsd,
        priceUsdMint: dexPair.priceUsdMint,
        buys24h: dexPair.buys24h,
        sells24h: dexPair.sells24h,
        dexId: dexPair.dexId
      },
      meetsDexScreenerThresholds: dexMeetsThresholds,
      meetsLiquidityAndVolumeThresholds: candidate.meetsRaydiumThresholds && dexMeetsThresholds,
      sourceFreshness: "UNKNOWN",
      freshnessReason: "No trustworthy source-event timestamp was provided by the pool API or pair lookup."
    };
  });
  const qualifying = enrichedCandidates.filter((candidate) =>
    candidate.meetsLiquidityAndVolumeThresholds && candidate.dexScreenerPairFound);
  const scanIncomplete =
    raydiumScanIncomplete ||
    selected.length < exactPairs.length ||
    candidatesToCrossCheck.length < cpmmCandidates.length;
  const displayCandidates = enrichedCandidates.slice(0, MAX_DISPLAY_CANDIDATES);

  return {
    schemaVersion: "ata.phase6.cpmm-candidate-discovery.v3",
    generatedAt: now(),
    scope: "READ_ONLY_SOL_ALLOWLISTED_STABLECOIN_RAYDIUM_CPMM_CANDIDATE_DISCOVERY",
    status: scanIncomplete
      ? qualifying.length > 0 ? "QUALIFYING_CPMM_CANDIDATES_FOUND_PARTIAL_SCAN" : "INCOMPLETE_DISCOVERY_SCAN"
      : qualifying.length > 0 ? "QUALIFYING_CPMM_CANDIDATES_FOUND"
        : cpmmCandidates.length > 0 ? "CPMM_FOUND_BUT_NONE_CROSS_QUALIFIED"
          : "NO_CPMM_CANDIDATES_FOUND",
    sources: {
      raydiumApi: {
        providerId: RAYDIUM_API_PROVIDER_ID,
        endpointClass: "pools/info/mint",
        clientRequestId,
        freshness: "UNKNOWN",
        approvedQuotePairQueries: raydiumPairResults,
        complete: !raydiumScanIncomplete
      },
      dexScreener: {
        providerId: "dex-screener",
        endpointClass: "latest-dex-pairs-by-pool-address",
        poolLookupsAttempted: dexScreenerEvidence.length,
        poolLookupsFound: dexScreenerEvidence.filter((item) => item.found).length,
        evidence: dexScreenerEvidence
      }
    },
    rpcEvidence,
    selectionPolicy: {
      exactBaseMint: SOL_MINT,
      approvedQuoteAssets: APPROVED_QUOTE_ASSETS,
      requiredOnChainPoolOwner: RAYDIUM_CPMM_PROGRAM_ID,
      minimumLiquidityUsd,
      minimumVolume24hUsd,
      liquidityVolumeThresholdRequiresBothIndexedSources: true,
      maxPoolAccountsChecked: MAX_POOL_ACCOUNTS,
      raydiumPageSize: RAYDIUM_POOL_PAGE_SIZE,
      raydiumMaxPagesPerQuote: MAX_RAYDIUM_PAGES_PER_QUOTE,
      poolAccountsChecked: selected.length,
      exactRaydiumPoolCount: exactPairs.length,
      truncatedByRpcAccountCap: selected.length < exactPairs.length,
      scanIncomplete,
      candidateCount: cpmmCandidates.length,
      dexScreenerCrossCheckCap: MAX_DISPLAY_CANDIDATES,
      dexScreenerCrossCheckedCount: dexScreenerEvidence.length,
      unCrossCheckedCpmmCandidateCount: cpmmCandidates.length - dexScreenerEvidence.length,
      thresholdQualifiedCount: qualifying.length,
      poolClassificationSummary: classifications.reduce((summary, item) => {
        summary[item.classification] = (summary[item.classification] ?? 0) + 1;
        return summary;
      }, {}),
      recommendedFollowUpPoolAddress: !scanIncomplete ? qualifying[0]?.poolAddress ?? null : null
    },
    candidates: displayCandidates,
    operatorAcknowledgements: {
      readOnlyMainnetRpcApproved: true,
      raydiumApiUsageReviewed: true,
      dexScreenerTermsQuotaAndBudgetReviewed: true
    },
    reportLimitations: [
      "This report is a discovery shortlist, not a trading recommendation or token-safety approval.",
      "Raydium API liquidity/volume and DEX Screener liquidity/volume are both indexed observations, not independent on-chain reserve verification.",
      "The report requires a matching exact pool/approved quote mint identity from DEX Screener and on-chain CPMM PoolState decoding before recommending a follow-up.",
      "Source freshness remains UNKNOWN because neither indexed mapping provides an approved market-event freshness signal here.",
      "Liquidity and volume thresholds are triage settings, not an approved trading policy.",
      "USDC and USDT are a research-only allowlist; this report does not approve their use as production quote assets.",
      "A CPMM candidate must pass the full identity workflow, same-slot reserve reconciliation, independent market-data review, token-safety review, and fallback gates before any later decision."
    ]
  };
}
async function main() {
  const report = await discoverRaydiumCpmmCandidates();
  process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code)
      ? error.code
      : "CPMM_DISCOVERY_FAILED";
    process.stderr.write("Candidate discovery stopped safely: " + code + ". No raw provider bodies or RPC endpoint are printed.\n");
    process.exitCode = 2;
  });
}
