#!/usr/bin/env node
import { createHash } from "node:crypto";
import { pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { isSolanaPublicKey, RAYDIUM_CPMM_PROGRAM_ID } from "../packages/market-data/dist/index.js";

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const DEX_SCREENER_URL =
  "https://api.dexscreener.com/latest/dex/tokens/" + SOL_MINT + "," + USDC_MINT;
const RPC_URL = "https://api.mainnet.solana.com";
const RPC_PROVIDER_ID = "solana-public-shared";
const MAX_RESPONSE_BYTES = 5_000_000;
const MAX_POOL_ACCOUNTS = 100;
const MAX_DISPLAY_CANDIDATES = 20;
const RPC_REQUEST_ID_PATTERN = /^[A-Za-z0-9._:-]{1,128}$/;

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
    throw codedError(errorPrefix + "_HTTP_ERROR");
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
      !isRecord(pair.quoteToken)) {
    return null;
  }

  const baseMint = pair.baseToken.address;
  const quoteMint = pair.quoteToken.address;
  const exactMints =
    (baseMint === SOL_MINT && quoteMint === USDC_MINT) ||
    (baseMint === USDC_MINT && quoteMint === SOL_MINT);
  if (!exactMints) return null;

  const liquidity = asNonNegativeMetric(pair.liquidity?.usd);
  const volume24h = asNonNegativeMetric(pair.volume?.h24);
  const priceUsd = asNonNegativeMetric(pair.priceUsd);
  const buys24h = asNonNegativeMetric(pair.txns?.h24?.buys);
  const sells24h = asNonNegativeMetric(pair.txns?.h24?.sells);

  return {
    poolAddress: pair.pairAddress,
    dexId: pair.dexId,
    baseMint,
    quoteMint,
    baseSymbol: typeof pair.baseToken.symbol === "string" ? pair.baseToken.symbol : null,
    quoteSymbol: typeof pair.quoteToken.symbol === "string" ? pair.quoteToken.symbol : null,
    liquidityUsd: liquidity,
    volume24hUsd: volume24h,
    priceUsd,
    buys24h: buys24h !== null && Number.isSafeInteger(buys24h) ? buys24h : null,
    sells24h: sells24h !== null && Number.isSafeInteger(sells24h) ? sells24h : null,
    pairCreatedAt: Number.isSafeInteger(pair.pairCreatedAt) ? pair.pairCreatedAt : null,
    sourceObservedAt: null
  };
}

function checkRpcAccounts(payload, requestId, expectedAddresses) {
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
    classified.push({
      poolAddress: expectedAddresses[index],
      ownerProgramId: account.owner,
      classification: account.owner === RAYDIUM_CPMM_PROGRAM_ID
        ? (!account.executable &&
            account.space === 637 &&
            account.data[0].length === Math.ceil(account.space / 3) * 4 &&
            Buffer.from(account.data[0], "base64").length === 637 &&
            [0xf7, 0xed, 0xe3, 0xf5, 0xd7, 0xc3, 0xde, 0x46]
              .every((byte, byteIndex) => Buffer.from(account.data[0], "base64")[byteIndex] === byte)
              ? "RAYDIUM_CPMM"
              : "RAYDIUM_CPMM_ACCOUNT_SHAPE_MISMATCH")
        : account.owner === "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8"
          ? "RAYDIUM_AMM_V4"
          : account.owner === "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK"
            ? "RAYDIUM_CLMM"
            : "OTHER_PROGRAM",
      executable: account.executable,
      space: account.space
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
  const fetchedAt = now();

  const indexed = await fetchJson(fetchImpl, DEX_SCREENER_URL, {
    method: "GET",
    headers: { accept: "application/json" }
  }, "INDEXED_API");
  if (!isRecord(indexed.payload) || !Array.isArray(indexed.payload.pairs)) {
    throw codedError("INDEXED_RESPONSE_SHAPE_INVALID");
  }

  const byAddress = new Map();
  for (const pair of indexed.payload.pairs) {
    const normalized = normalizeExactPair(pair);
    if (normalized === null) continue;
    const previous = byAddress.get(normalized.poolAddress);
    if (!previous || (normalized.liquidityUsd ?? -1) > (previous.liquidityUsd ?? -1)) {
      byAddress.set(normalized.poolAddress, normalized);
    }
  }

  const exactPairs = [...byAddress.values()].sort((a, b) =>
    (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
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
    const checked = checkRpcAccounts(
      rpc.payload,
      rpcRequestId,
      selected.map((candidate) => candidate.poolAddress)
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
  const candidates = exactPairs.map((candidate) => {
    const onChain = classByAddress.get(candidate.poolAddress) ?? {
      ownerProgramId: null,
      classification: "NOT_CHECKED_ACCOUNT_CAP"
    };
    const meetsThresholds =
      candidate.liquidityUsd !== null &&
      candidate.volume24hUsd !== null &&
      candidate.liquidityUsd >= minimumLiquidityUsd &&
      candidate.volume24hUsd >= minimumVolume24hUsd;
    return {
      ...candidate,
      onChainProgram: onChain.classification,
      onChainOwnerProgramId: onChain.ownerProgramId,
      meetsLiquidityAndVolumeThresholds: meetsThresholds,
      sourceFreshness: "UNKNOWN",
      freshnessReason: "DEX Screener pair mapping provides no trustworthy market-event timestamp."
    };
  });

  const cpmmCandidates = candidates
    .filter((candidate) => candidate.onChainProgram === "RAYDIUM_CPMM")
    .sort((a, b) => (b.liquidityUsd ?? -1) - (a.liquidityUsd ?? -1));
  const qualifying = cpmmCandidates.filter((candidate) => candidate.meetsLiquidityAndVolumeThresholds);
  const displayCandidates = cpmmCandidates.slice(0, MAX_DISPLAY_CANDIDATES);

  return {
    schemaVersion: "ata.phase6.cpmm-candidate-discovery.v1",
    generatedAt: now(),
    scope: "READ_ONLY_SOL_USDC_RAYDIUM_CPMM_CANDIDATE_DISCOVERY",
    status: exactPairs.length > MAX_POOL_ACCOUNTS
      ? cpmmCandidates.length > 0 ? "CPMM_CANDIDATES_FOUND_PARTIAL_SCAN" : "INCOMPLETE_RPC_ACCOUNT_CAP"
      : cpmmCandidates.length > 0 ? "CPMM_CANDIDATES_FOUND" : "NO_CPMM_CANDIDATES_FOUND",
    source: {
      providerId: "dex-screener",
      endpointClass: "latest-dex-tokens",
      clientRequestId,
      rawPayloadSha256: sha256(indexed.rawText),
      retrievedAt: fetchedAt,
      sourceObservedAt: null,
      freshness: "UNKNOWN"
    },
    rpcEvidence,
    selectionPolicy: {
      exactBaseMint: SOL_MINT,
      exactQuoteMint: USDC_MINT,
      requiredOnChainPoolOwner: RAYDIUM_CPMM_PROGRAM_ID,
      minimumLiquidityUsd,
      minimumVolume24hUsd,
      maxPoolAccountsChecked: MAX_POOL_ACCOUNTS,
      poolAccountsChecked: selected.length,
      exactRaydiumPairCount: exactPairs.length,
      truncatedByRpcAccountCap: exactPairs.length > MAX_POOL_ACCOUNTS,
      candidateCount: cpmmCandidates.length,
      thresholdQualifiedCount: qualifying.length,
      recommendedFollowUpPoolAddress: qualifying[0]?.poolAddress ?? null
    },
    candidates: displayCandidates,
    operatorAcknowledgements: {
      readOnlyMainnetRpcApproved: true,
      indexedSourceTermsAndBudgetReviewed: true
    },
    reportLimitations: [
      "This report is a discovery shortlist, not a trading recommendation or token-safety approval.",
      "DEX Screener market-event timestamps are missing; source freshness remains UNKNOWN.",
      "On-chain account-owner classification identifies CPMM pools but does not yet compare reserves or prove deployed binary/source equivalence.",
      "Liquidity and volume thresholds are triage settings, not an approved trading policy.",
      "A CPMM candidate must pass full identity, reserve reconciliation, independent market-data, token-safety, and fallback gates before any later decision."
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
