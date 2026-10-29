#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DexScreenerPairsAdapter } from "@ata/market-data/providers/dex-screener";
import { ReadOnlyMarketDataOrchestrator } from "@ata/market-data/orchestrator";
import {
  RAYDIUM_CPMM_DECODER_ID,
  RAYDIUM_CPMM_DECODER_VERSION,
  RAYDIUM_CPMM_POOL_STATE_LENGTH,
  RAYDIUM_CPMM_AMM_CONFIG_LENGTH,
  RAYDIUM_CPMM_PROGRAM_ID,
  inspectUpgradeableProgramAccount,
  assessUpgradeableProgramDeployment,
  SPL_TOKEN_PROGRAM_ID,
  SPL_TOKEN_2022_PROGRAM_ID,
  decodeSplTokenAccount,
  decodeSplTokenMint,
  SolanaRpcAccountReader,
  assessRaydiumCpmmIdentityEvidence,
  readRaydiumCpmmIdentityBundle,
  validateCanonicalMarketSnapshot
} from "../packages/market-data/dist/index.js";

const SOURCE_APPROVAL = "APPROVED_READ_ONLY_MAINNET_RPC";
const TARGET_APPROVAL = "INDEPENDENT_INDEXED_SOURCE_REVIEWED";
const PROVIDER_APPROVAL = "TERMS_QUOTA_AND_BUDGET_REVIEWED";
const UPGRADEABLE_LOADER_PROGRAM_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
const REQUEST_ID_PREFIX = "live-raydium";
const INDEXER_REQUEST_PREFIX = "live-dexscreener";
const SAFE_PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_INTEGER_TEXT = /^(?:0|[1-9][0-9]*)$/;

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function codedError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function usage() {
  return [
    "Read-only live-source validation for the pinned Raydium CPMM candidate.",
    "",
    "Usage:",
    "  node scripts/validate-raydium-live-source.mjs --target <canonical-snapshot.json> [--output <new-report.json>]",
    "  node scripts/validate-raydium-live-source.mjs --pool-address <pair> --base-mint <mint> --quote-mint <mint> [--output <new-report.json>]",
    "",
    "The second mode fetches the explicitly named pair from DEX Screener before the read-only RPC check.",
    "",
    "Required environment variables:",
    "  ATA_LIVE_SOURCE_APPROVAL=APPROVED_READ_ONLY_MAINNET_RPC",
    "  ATA_LIVE_TARGET_SOURCE_APPROVAL=INDEPENDENT_INDEXED_SOURCE_REVIEWED",
    "  ATA_LIVE_PROVIDER_TERMS_APPROVAL=TERMS_QUOTA_AND_BUDGET_REVIEWED",
    "  ATA_SOLANA_RPC_URL=<owner-approved HTTPS read-only RPC endpoint>",
    "  ATA_SOLANA_RPC_PROVIDER_ID=<safe provider slug>",
    "  ATA_LIVE_MIN_CONTEXT_SLOT=<explicit positive finalized-slot floor>",
    "  ATA_LIVE_MAX_RETRIEVAL_AGE_MS=<explicit retrieval-age limit, 1-300000>",
    "",
    "The target must be a non-synthetic ata.market-data.v1 snapshot sourced from a",
    "reviewed independent indexed API with a request ID and SHA-256 source digest.",
    "The endpoint is never included in output. Raw account data is not saved.",
    "A MATCH only verifies account identity; it does not complete Phase 6 or authorize trading."
  ].join("\n");
}

export function validateRpcEndpoint(endpointInput) {
  if (typeof endpointInput !== "string" || endpointInput.length === 0 || endpointInput.length > 2048) {
    throw codedError("RPC_ENDPOINT_INVALID");
  }
  let endpoint;
  try {
    endpoint = new URL(endpointInput);
  } catch {
    throw codedError("RPC_ENDPOINT_INVALID");
  }
  if (endpoint.protocol !== "https:" ||
      endpoint.username.length > 0 ||
      endpoint.password.length > 0 ||
      endpoint.hash.length > 0) {
    throw codedError("RPC_ENDPOINT_POLICY_REJECTED");
  }
  return endpoint.toString();
}

function readPositiveInteger(env, name, maximum) {
  const input = env[name];
  if (typeof input !== "string" || !SAFE_INTEGER_TEXT.test(input)) {
    throw codedError(name + "_REQUIRED_AS_INTEGER");
  }
  const value = Number(input);
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) {
    throw codedError(name + "_OUT_OF_RANGE");
  }
  return value;
}

export function validateLiveTargetSnapshot(target, rpcProviderId) {
  const validation = validateCanonicalMarketSnapshot(target);
  if (!validation.valid) throw codedError("TARGET_SNAPSHOT_SCHEMA_INVALID");
  if (target.cluster !== "mainnet-beta") throw codedError("TARGET_MUST_BE_SOLANA_MAINNET");
  if (typeof target.poolAddress !== "string" || target.poolAddress.length === 0) {
    throw codedError("TARGET_POOL_ADDRESS_REQUIRED");
  }
  if (target.provenance.synthetic !== false ||
      target.provenance.sourceKind !== "INDEXED_API" ||
      target.provenance.providerId === "replay-fixture") {
    throw codedError("TARGET_MUST_BE_REAL_INDEXED_SOURCE_EVIDENCE");
  }
  if (target.provenance.providerId === rpcProviderId) {
    throw codedError("TARGET_AND_RPC_PROVIDERS_MUST_DIFFER");
  }
  if (typeof target.provenance.requestId !== "string" ||
      target.provenance.requestId.length === 0 ||
      typeof target.provenance.rawPayloadSha256 !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(target.provenance.rawPayloadSha256)) {
    throw codedError("TARGET_SOURCE_PROVENANCE_REQUIRED");
  }
  if (target.dexProgramAddress !== null &&
      target.dexProgramAddress !== RAYDIUM_CPMM_PROGRAM_ID) {
    throw codedError("TARGET_DEX_PROGRAM_CONFLICTS_WITH_CANDIDATE");
  }
  return target;
}

export function parseArgs(argv) {
  const parsed = {
    target: null,
    output: null,
    poolAddress: null,
    baseMint: null,
    quoteMint: null,
    help: false
  };
  const options = new Map([
    ["--target", "target"],
    ["--output", "output"],
    ["--pool-address", "poolAddress"],
    ["--base-mint", "baseMint"],
    ["--quote-mint", "quoteMint"]
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--help" || arg === "-h") {
      parsed.help = true;
      continue;
    }
    const field = options.get(arg);
    if (field === undefined) throw codedError("UNKNOWN_ARGUMENT");
    const value = argv[index + 1];
    if (typeof value !== "string" || value.startsWith("--") || value.length === 0) {
      const errorCode = field === "target" ? "TARGET_PATH_REQUIRED" :
        field === "output" ? "OUTPUT_PATH_REQUIRED" : "PAIR_IDENTITY_ARGUMENT_REQUIRED";
      throw codedError(errorCode);
    }
    if (parsed[field] !== null) throw codedError("DUPLICATE_ARGUMENT");
    parsed[field] = value;
    index += 1;
  }

  if (!parsed.help) {
    const liveFields = [parsed.poolAddress, parsed.baseMint, parsed.quoteMint];
    const hasAnyLiveField = liveFields.some((value) => value !== null);
    const hasAllLiveFields = liveFields.every((value) => value !== null);
    if (parsed.target !== null && hasAnyLiveField) throw codedError("TARGET_MODE_ARGUMENT_CONFLICT");
    if (parsed.target === null && !hasAllLiveFields) {
      throw codedError(hasAnyLiveField ? "PAIR_IDENTITY_ARGUMENTS_INCOMPLETE" : "TARGET_PATH_REQUIRED");
    }
  }
  return parsed;
}

/**
 * Fetch the exact pair named by the operator through the existing read-only DEX Screener adapter.
 * The adapter marks any injected/mock fetch as synthetic, so test doubles cannot become live evidence.
 */
export async function buildTargetSnapshotFromDexScreener({
  poolAddress,
  baseMint,
  quoteMint,
  rpcProviderId,
  adapter = new DexScreenerPairsAdapter(),
  now = () => new Date().toISOString(),
  requestId = INDEXER_REQUEST_PREFIX + "-" + Date.now().toString(36)
}) {
  // Single-source identity diagnostic only: this does not establish provider consensus or candidate eligibility.
  // The generic orchestrator supports multiple registrations, but no second indexed production provider
  // is approved/configured for this live workflow yet.
  const orchestrator = new ReadOnlyMarketDataOrchestrator([{
    adapter,
    independenceGroupId: "dex-screener-family",
    priority: 0
  }], {
    now,
    requestTimeoutMs: 5_000,
    maxHealthAgeMs: 30_000,
    healthPolicy: { failureThreshold: 2, cooldownMs: 30_000 },
    requestId: () => requestId
  });
  const collection = await orchestrator.collect({
    cluster: "mainnet-beta",
    baseMint,
    quoteMint,
    poolAddress
  });
  const attempt = collection.attempts.find((item) => item.providerId === adapter.providerId);
  if (attempt?.outcome !== "OBSERVATION_NORMALIZED" || collection.observations.length !== 1) {
    const reason = attempt?.reasonCodes[0] ?? "PROVIDER_ATTEMPT_BLOCKED";
    throw codedError("INDEXED_API_" + reason);
  }
  return validateLiveTargetSnapshot(collection.observations[0], rpcProviderId);
}

function readOperatorConfiguration(env) {
  if (env.ATA_LIVE_SOURCE_APPROVAL !== SOURCE_APPROVAL) {
    throw codedError("READ_ONLY_MAINNET_APPROVAL_REQUIRED");
  }
  if (env.ATA_LIVE_TARGET_SOURCE_APPROVAL !== TARGET_APPROVAL) {
    throw codedError("INDEPENDENT_TARGET_SOURCE_REVIEW_REQUIRED");
  }
  if (env.ATA_LIVE_PROVIDER_TERMS_APPROVAL !== PROVIDER_APPROVAL) {
    throw codedError("PROVIDER_TERMS_QUOTA_BUDGET_REVIEW_REQUIRED");
  }

  const endpoint = validateRpcEndpoint(env.ATA_SOLANA_RPC_URL);
  const providerId = env.ATA_SOLANA_RPC_PROVIDER_ID;
  if (typeof providerId !== "string" || !SAFE_PROVIDER_ID.test(providerId)) {
    throw codedError("RPC_PROVIDER_ID_INVALID");
  }
  const minContextSlot = readPositiveInteger(env, "ATA_LIVE_MIN_CONTEXT_SLOT", Number.MAX_SAFE_INTEGER);
  const maxRetrievalAgeMs = readPositiveInteger(env, "ATA_LIVE_MAX_RETRIEVAL_AGE_MS", 300_000);
  const expectedProgramElfSha256 = (env.ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_SHA256 ?? "").trim();
  if (expectedProgramElfSha256.length > 0 && !/^[a-f0-9]{64}$/.test(expectedProgramElfSha256)) {
    throw codedError("EXPECTED_PROGRAM_ELF_SHA256_INVALID");
  }
  if (expectedProgramElfSha256.length > 0 &&
      env.ATA_LIVE_PROGRAM_BUILD_HASH_REVIEW !== "EXPECTED_RAYDIUM_ELF_HASH_REVIEWED") {
    throw codedError("PROGRAM_BUILD_HASH_REVIEW_REQUIRED");
  }

  return {
    endpoint, providerId, minContextSlot, maxRetrievalAgeMs,
    expectedProgramElfSha256: expectedProgramElfSha256 || null
  };
}

export function buildMarketDataReportSection(target) {
  const hasSourceTimestamp = target.observedAt !== null || target.sourceEventAt !== null;
  const sourceFreshness = hasSourceTimestamp
    ? {
        state: "NOT_ASSESSED",
        reasonCodes: ["SOURCE_SPECIFIC_FRESHNESS_POLICY_NOT_CONFIGURED"]
      }
    : {
        state: "UNKNOWN",
        reasonCodes: ["SOURCE_TIMESTAMP_MISSING"]
      };

  return {
    retrievedAt: target.retrievedAt,
    observedAt: target.observedAt,
    sourceEventAt: target.sourceEventAt,
    sourceTimestampStatus: hasSourceTimestamp ? "PRESENT_BUT_NOT_ASSESSED" : "UNKNOWN",
    sourceFreshness,
    price: target.price ?? null,
    liquidity: target.liquidity ?? null,
    volume24h: target.volume24h ?? null,
    buys24h: target.buys24h ?? null,
    sells24h: target.sells24h ?? null,
    interpretation: "Indexed-source measures only; not independently validated market data."
  };
}

function formatExactTokenAmount(rawAmount, decimals) {
  if (typeof rawAmount !== "string" || !/^(?:0|[1-9][0-9]*)$/.test(rawAmount) ||
      !Number.isSafeInteger(decimals) || decimals < 0 || decimals > 255) {
    return null;
  }
  const amount = BigInt(rawAmount);
  const scale = 10n ** BigInt(decimals);
  const whole = (amount / scale).toString();
  if (decimals === 0) return whole;
  const fractional = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return fractional.length === 0 ? whole : whole + "." + fractional;
}

function formatReserveRatioQuotePerBase(baseRaw, quoteRaw, baseDecimals, quoteDecimals) {
  if (!/^(?:0|[1-9][0-9]*)$/.test(baseRaw) ||
      !/^(?:0|[1-9][0-9]*)$/.test(quoteRaw) ||
      !Number.isSafeInteger(baseDecimals) || baseDecimals < 0 || baseDecimals > 255 ||
      !Number.isSafeInteger(quoteDecimals) || quoteDecimals < 0 || quoteDecimals > 255) {
    return null;
  }
  const baseAmount = BigInt(baseRaw);
  const quoteAmount = BigInt(quoteRaw);
  if (baseAmount === 0n) return null;
  const numerator = quoteAmount * (10n ** BigInt(baseDecimals));
  const denominator = baseAmount * (10n ** BigInt(quoteDecimals));
  const precision = 18n;
  const scale = 10n ** precision;
  const scaled = (numerator * scale) / denominator;
  const whole = (scaled / scale).toString();
  const fractional = (scaled % scale).toString().padStart(Number(precision), "0").replace(/0+$/, "");
  return fractional.length === 0 ? whole : whole + "." + fractional;
}

export function buildOnChainReserveEvidence(target, bundle, pool) {
  const unavailable = (state, reasonCodes) => ({
    state,
    reasonCodes,
    contextSlot: isRecord(bundle?.source) ? bundle.source.contextSlot ?? null : null,
    baseMint: target?.baseMint ?? null,
    quoteMint: target?.quoteMint ?? null,
    baseVaultAddress: null,
    quoteVaultAddress: null,
    baseVaultAmountRaw: null,
    quoteVaultAmountRaw: null,
    baseReserveAmount: null,
    quoteReserveAmount: null,
    reserveRatioQuotePerBase: null
  });

  if (!isRecord(target) || !isRecord(bundle) || !Array.isArray(bundle.accounts) || !isRecord(pool)) {
    return unavailable("NOT_AVAILABLE", ["POOL_OR_ACCOUNT_BUNDLE_NOT_AVAILABLE"]);
  }
  const baseVaultAddress = pool.token0Mint === target.baseMint
    ? pool.token0Vault
    : pool.token1Mint === target.baseMint ? pool.token1Vault : null;
  const quoteVaultAddress = pool.token0Mint === target.quoteMint
    ? pool.token0Vault
    : pool.token1Mint === target.quoteMint ? pool.token1Vault : null;
  if (baseVaultAddress === null || quoteVaultAddress === null ||
      typeof baseVaultAddress !== "string" || typeof quoteVaultAddress !== "string") {
    return unavailable("MISMATCH", ["POOL_MINTS_DO_NOT_MATCH_TARGET"]);
  }

  const byAddress = new Map(bundle.accounts.map((account) => [account.address, account]));
  const baseMintRaw = byAddress.get(target.baseMint);
  const quoteMintRaw = byAddress.get(target.quoteMint);
  const baseVaultRaw = byAddress.get(baseVaultAddress);
  const quoteVaultRaw = byAddress.get(quoteVaultAddress);
  if (!baseMintRaw || !quoteMintRaw || !baseVaultRaw || !quoteVaultRaw) {
    return {
      ...unavailable("NOT_AVAILABLE", ["RESERVE_EVIDENCE_ACCOUNT_MISSING"]),
      baseVaultAddress,
      quoteVaultAddress
    };
  }

  const baseMint = decodeSplTokenMint(baseMintRaw);
  const quoteMint = decodeSplTokenMint(quoteMintRaw);
  const baseVault = decodeSplTokenAccount(baseVaultRaw);
  const quoteVault = decodeSplTokenAccount(quoteVaultRaw);
  const decodeFailures = [];
  if (baseMint.status !== "DECODED") decodeFailures.push("BASE_MINT_" + (baseMint.errorCode ?? baseMint.status));
  if (quoteMint.status !== "DECODED") decodeFailures.push("QUOTE_MINT_" + (quoteMint.errorCode ?? quoteMint.status));
  if (baseVault.status !== "DECODED") decodeFailures.push("BASE_VAULT_" + (baseVault.errorCode ?? baseVault.status));
  if (quoteVault.status !== "DECODED") decodeFailures.push("QUOTE_VAULT_" + (quoteVault.errorCode ?? quoteVault.status));
  if (decodeFailures.length > 0) {
    return {
      ...unavailable("BLOCKED", decodeFailures),
      baseVaultAddress,
      quoteVaultAddress
    };
  }

  if (baseVault.value.mint !== target.baseMint) {
    return {
      ...unavailable("MISMATCH", ["BASE_VAULT_MINT_MISMATCH"]),
      baseVaultAddress,
      quoteVaultAddress
    };
  }
  if (quoteVault.value.mint !== target.quoteMint) {
    return {
      ...unavailable("MISMATCH", ["QUOTE_VAULT_MINT_MISMATCH"]),
      baseVaultAddress,
      quoteVaultAddress
    };
  }
  if (baseVault.value.state !== "INITIALIZED" || quoteVault.value.state !== "INITIALIZED") {
    return {
      ...unavailable("MISMATCH", ["VAULT_NOT_INITIALIZED"]),
      baseVaultAddress,
      quoteVaultAddress
    };
  }

  const baseVaultAmountRaw = baseVault.value.amount;
  const quoteVaultAmountRaw = quoteVault.value.amount;
  const baseReserveAmount = formatExactTokenAmount(baseVaultAmountRaw, baseMint.value.decimals);
  const quoteReserveAmount = formatExactTokenAmount(quoteVaultAmountRaw, quoteMint.value.decimals);
  if (baseReserveAmount === null || quoteReserveAmount === null) {
    return {
      ...unavailable("INVALID", ["RESERVE_AMOUNT_FORMAT_INVALID"]),
      baseVaultAddress,
      quoteVaultAddress
    };
  }

  const baseAmountIsZero = BigInt(baseVaultAmountRaw) === 0n;
  const quoteAmountIsZero = BigInt(quoteVaultAmountRaw) === 0n;
  const reserveRatioQuotePerBase = baseAmountIsZero
    ? null
    : formatReserveRatioQuotePerBase(
        baseVaultAmountRaw,
        quoteVaultAmountRaw,
        baseMint.value.decimals,
        quoteMint.value.decimals
      );

  return {
    state: baseAmountIsZero || quoteAmountIsZero ? "EMPTY_RESERVE_SIDE" : "DECODED",
    reasonCodes: baseAmountIsZero || quoteAmountIsZero ? ["ONE_OR_MORE_VAULT_RESERVES_ZERO"] : [],
    providerId: bundle.source.providerId,
    commitment: bundle.source.commitment,
    contextSlot: bundle.source.contextSlot,
    rpcRequestId: bundle.source.requestId,
    rpcRawPayloadSha256: bundle.source.rawPayloadSha256,
    baseMint: target.baseMint,
    quoteMint: target.quoteMint,
    baseMintDecimals: baseMint.value.decimals,
    quoteMintDecimals: quoteMint.value.decimals,
    baseVaultAddress,
    quoteVaultAddress,
    baseVaultMint: baseVault.value.mint,
    quoteVaultMint: quoteVault.value.mint,
    baseVaultAmountRaw,
    quoteVaultAmountRaw,
    baseReserveAmount,
    quoteReserveAmount,
    reserveRatioQuotePerBase,
    reserveRatioUnit: "QUOTE_PER_BASE",
    reserveRatioPrecisionDecimalPlaces: 18,
    interpretation: "Decoded on-chain vault balances from the same finalized account bundle. Reserve ratio is a pool-state ratio, not an executable swap quote or a USD valuation.",
    independentComparisonStatus: "NOT_ASSESSED",
    independentComparisonReason: "Requires an independent quote-asset USD value, source-specific freshness policy, and owner-approved comparison tolerance."
  };
}

async function buildProgramDeploymentVerification(reader, bundle, config, requestId) {
  const programAccount = bundle.accounts.find((item) => item.address === RAYDIUM_CPMM_PROGRAM_ID) ?? null;
  const inspection = programAccount === null
    ? { valid: false, programDataAddress: null, reasonCodes: ["PROGRAM_ACCOUNT_MISSING"] }
    : inspectUpgradeableProgramAccount(programAccount, RAYDIUM_CPMM_PROGRAM_ID, UPGRADEABLE_LOADER_PROGRAM_ID);
  const common = {
    programId: RAYDIUM_CPMM_PROGRAM_ID,
    loaderProgramId: UPGRADEABLE_LOADER_PROGRAM_ID,
    programDataAddress: inspection.programDataAddress,
    programAccountContextSlot: bundle.source.contextSlot,
    identityBundleContextSlot: bundle.source.contextSlot,
    programDataContextSlot: null,
    expectedElfSha256: config.expectedProgramElfSha256,
    observedElfSha256: null,
    elfByteLength: null,
    deploymentSlot: null,
    upgradeAuthorityPresent: null,
    synthetic: bundle.source.synthetic,
    programDataReadAttempted: false,
    programDataRpcEvidence: null,
    tradingAuthorized: false
  };
  if (config.expectedProgramElfSha256 === null) {
    return {
      ...common,
      status: "NOT_ASSESSED",
      reasonCodes: inspection.valid ? ["EXPECTED_REFERENCE_ELF_SHA256_REQUIRED"] : inspection.reasonCodes
    };
  }
  if (programAccount === null || !inspection.valid || inspection.programDataAddress === null) {
    const failure = await assessUpgradeableProgramDeployment({
      programAccount: programAccount ?? {
        address: RAYDIUM_CPMM_PROGRAM_ID, exists: false, ownerProgramId: null,
        executable: null, dataBase64: null, space: null
      },
      programDataAccount: null,
      expectedProgramId: RAYDIUM_CPMM_PROGRAM_ID,
      expectedElfSha256: config.expectedProgramElfSha256,
      programAccountContextSlot: bundle.source.contextSlot,
      programDataContextSlot: null,
      synthetic: bundle.source.synthetic,
      loaderProgramId: UPGRADEABLE_LOADER_PROGRAM_ID
    });
    return { ...common, ...failure, programDataReadAttempted: false };
  }
  let dataBundle;
  try {
    // Re-read both accounts in one response/context slot to bind the pointer and bytecode atomically.
    dataBundle = await reader.readAccounts({
      addresses: [RAYDIUM_CPMM_PROGRAM_ID, inspection.programDataAddress],
      commitment: "finalized",
      minContextSlot: bundle.source.contextSlot,
      requestId: requestId + "-deployment"
    });
  } catch {
    return {
      ...common,
      status: "INSUFFICIENT_EVIDENCE",
      reasonCodes: ["PROGRAMDATA_RPC_READ_FAILED"],
      programDataReadAttempted: true
    };
  }
  const programAtSlot = dataBundle.accounts[0] ?? null;
  const programDataAccount = dataBundle.accounts[1] ?? null;
  if (programAtSlot === null) {
    return {
      ...common,
      status: "INSUFFICIENT_EVIDENCE",
      reasonCodes: ["PROGRAM_ACCOUNT_MISSING_AT_VERIFICATION_SLOT"],
      programAccountContextSlot: dataBundle.source.contextSlot,
      programDataContextSlot: dataBundle.source.contextSlot,
      programDataReadAttempted: true,
      programDataRpcEvidence: {
        providerId: dataBundle.source.providerId,
        commitment: dataBundle.source.commitment,
        retrievedAt: dataBundle.source.retrievedAt,
        contextSlot: dataBundle.source.contextSlot,
        requestId: dataBundle.source.requestId,
        rawPayloadSha256: dataBundle.source.rawPayloadSha256,
        synthetic: dataBundle.source.synthetic
      }
    };
  }
  const result = await assessUpgradeableProgramDeployment({
    programAccount: programAtSlot,
    programDataAccount,
    expectedProgramId: RAYDIUM_CPMM_PROGRAM_ID,
    expectedElfSha256: config.expectedProgramElfSha256,
    programAccountContextSlot: dataBundle.source.contextSlot,
    programDataContextSlot: dataBundle.source.contextSlot,
    synthetic: bundle.source.synthetic || dataBundle.source.synthetic,
    loaderProgramId: UPGRADEABLE_LOADER_PROGRAM_ID
  });
  return {
    ...result,
    identityBundleContextSlot: bundle.source.contextSlot,
    programDataReadAttempted: true,
    programDataRpcEvidence: {
      providerId: dataBundle.source.providerId,
      commitment: dataBundle.source.commitment,
      retrievedAt: dataBundle.source.retrievedAt,
      contextSlot: dataBundle.source.contextSlot,
      requestId: dataBundle.source.requestId,
      rawPayloadSha256: dataBundle.source.rawPayloadSha256,
      synthetic: dataBundle.source.synthetic
    }
  };
}

function buildReport({ target, bundle, assessment, config, generatedAt, programDeploymentVerification = null }) {
  const pool = assessment.pool;
  const deploymentVerification = programDeploymentVerification ?? {
    status: "NOT_ASSESSED",
    reasonCodes: ["EXPECTED_REFERENCE_ELF_SHA256_REQUIRED"],
    programId: RAYDIUM_CPMM_PROGRAM_ID,
    programDataAddress: null,
    loaderProgramId: UPGRADEABLE_LOADER_PROGRAM_ID,
    deploymentSlot: null,
    upgradeAuthorityPresent: null,
    programAccountContextSlot: bundle.source.contextSlot,
    identityBundleContextSlot: bundle.source.contextSlot,
    programDataContextSlot: null,
    expectedElfSha256: null,
    observedElfSha256: null,
    elfByteLength: null,
    synthetic: bundle.source.synthetic,
    programDataReadAttempted: false,
    programDataRpcEvidence: null,
    tradingAuthorized: false
  };
  return {
    schemaVersion: "ata.phase6.live-source-validation.v1",
    generatedAt,
    scope: "READ_ONLY_SOLANA_MAINNET_ACCOUNT_IDENTITY",
    result: {
      status: assessment.status,
      reasonCodes: [...assessment.reasonCodes],
      mismatchFields: [...assessment.mismatchFields],
      identityGatePassed: assessment.status === "MATCH" &&
        assessment.canProceedToIndependentSafetyReview === true &&
        bundle.source.synthetic === false,
      canProceedToIndependentSafetyReview: assessment.canProceedToIndependentSafetyReview,
      programDeploymentVerificationPassed: deploymentVerification.status === "MATCH",
      phase6Complete: false,
      productionProviderApprovedByThisReport: false,
      tradingAuthorized: false
    },
    targetSource: {
      providerId: target.provenance.providerId,
      sourceKind: target.provenance.sourceKind,
      observationId: target.observationId,
      requestId: target.provenance.requestId,
      rawPayloadSha256: target.provenance.rawPayloadSha256,
      observedAt: target.observedAt,
      sourceEventAt: target.sourceEventAt
    },
    targetIdentity: {
      cluster: target.cluster,
      poolAddress: target.poolAddress,
      baseMint: target.baseMint,
      quoteMint: target.quoteMint,
      indexedDexProgramAddress: target.dexProgramAddress
    },
    marketData: buildMarketDataReportSection(target),
    onChainReserves: buildOnChainReserveEvidence(target, bundle, pool),
    programDeploymentVerification: deploymentVerification,
    rpcEvidence: {
      providerId: bundle.source.providerId,
      commitment: bundle.source.commitment,
      retrievedAt: bundle.source.retrievedAt,
      contextSlot: bundle.source.contextSlot,
      requestedMinContextSlot: bundle.source.requestedMinContextSlot,
      requestId: bundle.source.requestId,
      rawPayloadSha256: bundle.source.rawPayloadSha256,
      synthetic: bundle.source.synthetic
    },
    decoder: {
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      decoderId: RAYDIUM_CPMM_DECODER_ID,
      decoderVersion: RAYDIUM_CPMM_DECODER_VERSION,
      pinnedPoolStateBytes: RAYDIUM_CPMM_POOL_STATE_LENGTH,
      pinnedAmmConfigBytes: RAYDIUM_CPMM_AMM_CONFIG_LENGTH
    },
    decodedPool: pool === null ? null : {
      poolAddress: pool.address,
      ammConfigAddress: pool.ammConfig,
      lpMintAddress: pool.lpMint,
      token0Mint: pool.token0Mint,
      token1Mint: pool.token1Mint,
      token0Vault: pool.token0Vault,
      token1Vault: pool.token1Vault,
      observationAddress: pool.observationKey,
      statusFlags: pool.status,
      swapsEnabled: pool.swapsEnabled,
      depositsEnabled: pool.depositsEnabled,
      withdrawalsEnabled: pool.withdrawalsEnabled,
      canonicalPoolPdaMatches: pool.canonicalPoolPdaMatches
    },
    policy: {
      requiredCommitment: "finalized",
      minimumContextSlot: config.minContextSlot,
      maximumRpcRetrievalAgeMs: config.maxRetrievalAgeMs,
      tokenProgramIdsAllowedForBaseDecode: [SPL_TOKEN_PROGRAM_ID, SPL_TOKEN_2022_PROGRAM_ID],
      loaderProgramIdsAllowed: [UPGRADEABLE_LOADER_PROGRAM_ID]
    },
    operatorAcknowledgements: {
      readOnlyMainnetRpcApproved: true,
      indexedTargetSourceIndependenceReviewed: true,
      providerTermsQuotaAndBudgetReviewed: true
    },
    reportLimitations: [
      "This report proves neither provider honesty nor complete market-data freshness.",
      "Identity MATCH is not token-safety approval, production provider approval, or trading authorization.",
      "Token-2022 extension-bearing accounts remain blocked pending Phase 7 review.",
      "Program deployment hash comparison requires a reference ELF hash from a separately reviewed source build; a supplied hash alone does not prove the build process was trustworthy.",
      "If an upgrade authority is present, a matched ELF hash describes the observed deployment only and can change after the read.",
      "A failed or inconclusive run does not validate the target identity."
    ]
  };
}

async function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  if (args.help) {
    console.log(usage());
    return 0;
  }

  // Validate the approval and RPC configuration before making any provider call.
  const config = readOperatorConfiguration(env);
  let target;
  let targetPath = null;
  if (args.target !== null) {
    targetPath = resolve(args.target);
    try {
      target = JSON.parse(readFileSync(targetPath, "utf8"));
    } catch {
      throw codedError("TARGET_JSON_INVALID_OR_UNREADABLE");
    }
    validateLiveTargetSnapshot(target, config.providerId);
  } else {
    target = await buildTargetSnapshotFromDexScreener({
      poolAddress: args.poolAddress,
      baseMint: args.baseMint,
      quoteMint: args.quoteMint,
      rpcProviderId: config.providerId
    });
  }

  if (args.output !== null && targetPath !== null && resolve(args.output) === targetPath) {
    throw codedError("REPORT_MUST_NOT_OVERWRITE_TARGET");
  }

  const generatedAt = new Date().toISOString();
  const requestId = REQUEST_ID_PREFIX + "-" + Date.now().toString(36);
  const reader = new SolanaRpcAccountReader({
    endpoint: config.endpoint,
    providerId: config.providerId,
    timeoutMs: 10_000
  });
  const bundle = await readRaydiumCpmmIdentityBundle(reader, target, {
    commitment: "finalized",
    minContextSlot: config.minContextSlot,
    requestId
  });
  const assessment = await assessRaydiumCpmmIdentityEvidence(target, bundle, {
    nowAt: new Date().toISOString(),
    maxRetrievalAgeMs: config.maxRetrievalAgeMs,
    maxFutureSkewMs: 0,
    minimumContextSlot: config.minContextSlot,
    requiredCommitment: "finalized",
    approvedPoolDecoders: [{
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      decoderId: RAYDIUM_CPMM_DECODER_ID,
      decoderVersion: RAYDIUM_CPMM_DECODER_VERSION
    }],
    allowedTokenProgramIds: [SPL_TOKEN_PROGRAM_ID, SPL_TOKEN_2022_PROGRAM_ID],
    allowedLoaderProgramIds: [UPGRADEABLE_LOADER_PROGRAM_ID]
  });
  const programDeploymentVerification = await buildProgramDeploymentVerification(reader, bundle, config, requestId);
  const report = buildReport({ target, bundle, assessment, config, generatedAt, programDeploymentVerification });
  const output = JSON.stringify(report, null, 2) + "\n";

  if (args.output !== null) {
    try {
      writeFileSync(resolve(args.output), output, { encoding: "utf8", flag: "wx", mode: 0o600 });
    } catch {
      throw codedError("REPORT_CREATE_FAILED_OR_PATH_EXISTS");
    }
  }
  console.log(output);
  const identityPassed = report.result.identityGatePassed;
  const expectedHashSupplied = config.expectedProgramElfSha256 !== null;
  const deployedHashMatched = report.programDeploymentVerification.status === "MATCH";
  return identityPassed && (!expectedHashSupplied || deployedHashMatched) ? 0 : 1;
}

export { buildReport, readOperatorConfiguration };

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().then((code) => {
    process.exitCode = code;
  }).catch((error) => {
    const code = typeof error?.code === "string" && /^[A-Z0-9_]{1,80}$/.test(error.code)
      ? error.code
      : "LIVE_SOURCE_VALIDATION_FAILED";
    console.error("Live-source validation stopped safely: " + code + ". No endpoint or raw account payload is printed.");
    process.exitCode = 2;
  });
}
