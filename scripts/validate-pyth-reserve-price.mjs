#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import {
  assessIndependentReservePriceAgreement
} from "../packages/market-data/dist/index.js";
import {
  PythHermesAdapterError,
  PythHermesUsdPriceAdapter,
  PYTH_SOL_USD_FEED_ID,
  PYTH_USDC_USD_FEED_ID,
  USDC_MAINNET_MINT,
  WRAPPED_SOL_MINT
} from "../packages/market-data/dist/providers/pyth-hermes.js";

const DEFAULT_POOL = "47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4";
const APPROVALS = [
  "CONFIRM_READ_ONLY_RPC",
  "CONFIRM_INDEXED_SOURCE_REVIEW",
  "CONFIRM_PROVIDER_TERMS_BUDGET",
  "CONFIRM_PYTH_PROVIDER_REVIEW",
  "CONFIRM_COMPARISON_POLICY_REVIEW"
];

function emitFailure(code, exitCode = 2) {
  console.error(JSON.stringify({
    schemaVersion: "ata.phase6.pyth-reserve-validation.v1",
    status: "BLOCKED",
    reasonCodes: [code],
    tradingAuthorized: false
  }));
  process.exitCode = exitCode;
}

function envInteger(name, { min, max }) {
  const value = process.env[name] ?? "";
  if (!/^(?:0|[1-9][0-9]*)$/.test(value)) throw new Error("INVALID_POLICY_INPUT");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error("INVALID_POLICY_INPUT");
  }
  return parsed;
}

function requiredEnv(name) {
  const value = process.env[name]?.trim() ?? "";
  if (value.length === 0) throw new Error("REQUIRED_CONFIGURATION_MISSING");
  return value;
}

function validatePreflight() {
  if (APPROVALS.some((name) => process.env[name] !== "yes")) {
    throw new Error("REQUIRED_OPERATOR_APPROVAL_MISSING");
  }
  if ((process.env.PYTH_API_KEY ?? "").trim().length === 0) {
    throw new Error("PYTH_API_KEY_SECRET_MISSING");
  }
  const pool = process.env.POOL_ADDRESS || DEFAULT_POOL;
  const baseMint = process.env.BASE_MINT || WRAPPED_SOL_MINT;
  const quoteMint = process.env.QUOTE_MINT || USDC_MAINNET_MINT;
  if (pool !== DEFAULT_POOL || baseMint !== WRAPPED_SOL_MINT || quoteMint !== USDC_MAINNET_MINT) {
    throw new Error("TARGET_PAIR_NOT_IN_APPROVED_SCOPE");
  }
  if (!/^\d+$/.test(process.env.MINIMUM_CONTEXT_SLOT ?? "") ||
      !/^\d+$/.test(process.env.MAX_RPC_RETRIEVAL_AGE_MS ?? "")) {
    throw new Error("RPC_POLICY_INPUT_INVALID");
  }
  return {
    pool,
    baseMint,
    quoteMint,
    minimumContextSlot: envInteger("MINIMUM_CONTEXT_SLOT", { min: 0, max: Number.MAX_SAFE_INTEGER }),
    maxRpcRetrievalAgeMs: envInteger("MAX_RPC_RETRIEVAL_AGE_MS", { min: 1, max: 300_000 }),
    maxReferenceSourceAgeMs: envInteger("MAX_REFERENCE_SOURCE_AGE_MS", { min: 1, max: 86_400_000 }),
    maxReferenceRetrievalAgeMs: envInteger("MAX_REFERENCE_RETRIEVAL_AGE_MS", { min: 1, max: 300_000 }),
    maxFutureSkewMs: envInteger("MAX_FUTURE_SKEW_MS", { min: 0, max: 60_000 }),
    maxDeviationBps: envInteger("MAX_DEVIATION_BPS", { min: 0, max: 10_000 })
  };
}

function runIdentityValidation(target, env) {
  const child = spawnSync(process.execPath, [
    "scripts/validate-raydium-live-source.mjs",
    "--pool-address", target.pool,
    "--base-mint", target.baseMint,
    "--quote-mint", target.quoteMint
  ], {
    encoding: "utf8",
    timeout: 45_000,
    maxBuffer: 1_500_000,
    env
  });
  if (child.error || child.status !== 0) throw new Error("LIVE_IDENTITY_VALIDATION_FAILED");
  let report;
  try {
    report = JSON.parse(child.stdout.trim());
  } catch {
    throw new Error("LIVE_IDENTITY_REPORT_INVALID");
  }
  if (report?.result?.status !== "MATCH" ||
      report?.result?.identityGatePassed !== true ||
      report?.rpcEvidence?.synthetic !== false ||
      report?.targetSource?.providerId !== "dex-screener" ||
      report?.onChainReserves?.state !== "DECODED" ||
      typeof report?.onChainReserves?.reserveRatioQuotePerBase !== "string") {
    throw new Error("LIVE_IDENTITY_EVIDENCE_INSUFFICIENT");
  }
  return report;
}

async function main() {
  let target;
  try {
    target = validatePreflight();
  } catch (error) {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "PREFLIGHT_FAILED";
    emitFailure(code);
    return;
  }

  let identityReport;
  try {
    identityReport = runIdentityValidation(target, {
      ...process.env,
      ATA_LIVE_SOURCE_APPROVAL: "APPROVED_READ_ONLY_MAINNET_RPC",
      ATA_LIVE_TARGET_SOURCE_APPROVAL: "INDEPENDENT_INDEXED_SOURCE_REVIEWED",
      ATA_LIVE_PROVIDER_TERMS_APPROVAL: "TERMS_QUOTA_AND_BUDGET_REVIEWED",
      ATA_SOLANA_RPC_URL: "https://api.mainnet.solana.com",
      ATA_SOLANA_RPC_PROVIDER_ID: "solana-public-shared",
      ATA_LIVE_MIN_CONTEXT_SLOT: String(target.minimumContextSlot),
      ATA_LIVE_MAX_RETRIEVAL_AGE_MS: String(target.maxRpcRetrievalAgeMs)
    });
  } catch (error) {
    const code = error instanceof Error && /^[A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "LIVE_IDENTITY_VALIDATION_FAILED";
    emitFailure(code, 1);
    return;
  }

  const pythAdapter = new PythHermesUsdPriceAdapter({ apiKey: process.env.PYTH_API_KEY });
  let pythResult;
  try {
    pythResult = await pythAdapter.fetchLatest();
  } catch (error) {
    emitFailure(error instanceof PythHermesAdapterError ? "PYTH_" + error.code : "PYTH_REFERENCE_FETCH_FAILED", 1);
    return;
  }
  if (pythResult.errors.length !== 0 || pythResult.observations.length !== 2 ||
      pythResult.observations.some((observation) => observation.synthetic)) {
    emitFailure("PYTH_REFERENCE_EVIDENCE_INSUFFICIENT", 1);
    return;
  }

  const baseUsd = pythResult.observations.find((item) =>
    item.assetId === target.baseMint && item.feedId === PYTH_SOL_USD_FEED_ID
  );
  const quoteUsd = pythResult.observations.find((item) =>
    item.assetId === target.quoteMint && item.feedId === PYTH_USDC_USD_FEED_ID
  );
  if (!baseUsd || !quoteUsd) {
    emitFailure("PYTH_REFERENCE_FEED_IDENTITY_MISMATCH", 1);
    return;
  }

  const nowAt = [baseUsd.retrievedAt, quoteUsd.retrievedAt]
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
  const comparison = assessIndependentReservePriceAgreement({
    baseMint: target.baseMint,
    quoteMint: target.quoteMint,
    reserveRatioQuotePerBase: identityReport.onChainReserves.reserveRatioQuotePerBase,
    indexedPriceUsdPerBase: identityReport.marketData?.price?.unit === "USD_PER_BASE"
      ? identityReport.marketData.price.value
      : null,
    indexedProviderId: "dex-screener",
    indexedIndependenceGroupId: "dex-screener-family",
    indexedSourceEventAt: identityReport.marketData?.sourceEventAt ?? null,
    indexedRetrievedAt: identityReport.marketData.retrievedAt,
    indexedSynthetic: false,
    baseUsd,
    quoteUsd,
    policy: {
      nowAt,
      maxSourceAgeMs: target.maxReferenceSourceAgeMs,
      maxRetrievalAgeMs: target.maxReferenceRetrievalAgeMs,
      maxFutureSkewMs: target.maxFutureSkewMs,
      maxDeviationBps: target.maxDeviationBps,
      approvedProviderId: "pyth-hermes",
      approvedIndependenceGroupId: "pyth-network",
      expectedBaseFeedId: PYTH_SOL_USD_FEED_ID,
      expectedQuoteFeedId: PYTH_USDC_USD_FEED_ID
    }
  });

  const report = {
    schemaVersion: "ata.phase6.pyth-reserve-validation.v1",
    generatedAt: nowAt,
    scope: "manual read-only evidence check; no wallet, signer, order, or transaction capability",
    target: {
      cluster: "mainnet-beta",
      poolAddress: target.pool,
      baseMint: target.baseMint,
      quoteMint: target.quoteMint
    },
    identity: {
      status: identityReport.result.status,
      identityGatePassed: identityReport.result.identityGatePassed,
      rpcProviderId: identityReport.rpcEvidence.providerId,
      commitment: identityReport.rpcEvidence.commitment,
      contextSlot: identityReport.rpcEvidence.contextSlot,
      synthetic: identityReport.rpcEvidence.synthetic,
      decodedPool: identityReport.decodedPool
    },
    onChainReserves: identityReport.onChainReserves,
    indexedSource: {
      providerId: identityReport.targetSource.providerId,
      price: identityReport.marketData.price,
      liquidity: identityReport.marketData.liquidity,
      volume24h: identityReport.marketData.volume24h,
      observedAt: identityReport.marketData.observedAt,
      sourceEventAt: identityReport.marketData.sourceEventAt,
      retrievedAt: identityReport.marketData.retrievedAt,
      sourceFreshness: identityReport.marketData.sourceFreshness
    },
    pythReference: {
      providerId: "pyth-hermes",
      independenceGroupId: "pyth-network",
      adapterVersion: pythAdapter.adapterVersion,
      rawPayloadSha256: baseUsd.rawPayloadSha256,
      observations: pythResult.observations.map((observation) => ({
        feedName: observation.feedName,
        feedId: observation.feedId,
        assetId: observation.assetId,
        priceUsd: observation.priceUsd,
        confidenceUsd: observation.confidenceUsd,
        publishedAt: observation.publishedAt,
        retrievedAt: observation.retrievedAt,
        publishTimeUnixSeconds: observation.publishTimeUnixSeconds,
        slot: observation.slot,
        requestId: observation.requestId,
        synthetic: observation.synthetic
      }))
    },
    comparisonPolicy: {
      maxReferenceSourceAgeMs: target.maxReferenceSourceAgeMs,
      maxReferenceRetrievalAgeMs: target.maxReferenceRetrievalAgeMs,
      maxFutureSkewMs: target.maxFutureSkewMs,
      maxDeviationBps: target.maxDeviationBps,
      providerSelectionApprovedByThisReport: false
    },
    comparison,
    phase6Complete: false,
    productionProviderApprovedByThisReport: false,
    tradingAuthorized: false,
    limitations: [
      "A Pyth reference comparison is evidence only; it does not establish executable swap price or token safety.",
      "The DEX Screener observation/event timestamps are absent in the current adapter; its indexed-price comparison may remain NOT_ASSESSED.",
      "The comparison tolerance and freshness limits are supplied per manual run; their presence does not record a lasting owner/provider decision.",
      "The public Solana RPC and Pyth reference adapter are not automatically approved production providers.",
      "No API key, authorization header, raw provider payload, or transaction material is included in this report."
    ]
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch(() => emitFailure("UNEXPECTED_VALIDATION_FAILURE", 1));
