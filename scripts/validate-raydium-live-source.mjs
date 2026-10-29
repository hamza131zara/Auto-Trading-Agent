#!/usr/bin/env node
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DexScreenerPairsAdapter } from "@ata/market-data/providers/dex-screener";
import {
  RAYDIUM_CPMM_DECODER_ID,
  RAYDIUM_CPMM_DECODER_VERSION,
  RAYDIUM_CPMM_POOL_STATE_LENGTH,
  RAYDIUM_CPMM_AMM_CONFIG_LENGTH,
  RAYDIUM_CPMM_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  SPL_TOKEN_2022_PROGRAM_ID,
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
  const requestedAt = now();
  const request = {
    cluster: "mainnet-beta",
    baseMint,
    quoteMint,
    poolAddress,
    requestedAt
  };
  let raw;
  try {
    raw = await adapter.fetchRaw(request, new AbortController().signal);
  } catch (error) {
    // Pass through only the adapter's stable code; never log the URL or remote body.
    if (typeof error?.code === "string" && /^[A-Z0-9_]{1,48}$/.test(error.code)) {
      throw codedError("INDEXED_API_" + error.code);
    }
    throw codedError("INDEXED_API_REQUEST_FAILED");
  }
  const retrievedAt = now();
  const normalized = adapter.normalize(raw, { requestedAt, retrievedAt, requestId });
  if (normalized.errors.length > 0 || normalized.observations.length !== 1) {
    const detail = String(normalized.errors[0] ?? "OBSERVATION_COUNT")
      .replace(/[^A-Z0-9_]/g, "_")
      .slice(0, 48);
    throw codedError("INDEXED_TARGET_" + detail);
  }
  return validateLiveTargetSnapshot(normalized.observations[0], rpcProviderId);
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

  return { endpoint, providerId, minContextSlot, maxRetrievalAgeMs };
}

function buildReport({ target, bundle, assessment, config, generatedAt }) {
  const pool = assessment.pool;
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
  const report = buildReport({ target, bundle, assessment, config, generatedAt });
  const output = JSON.stringify(report, null, 2) + "\n";

  if (args.output !== null) {
    try {
      writeFileSync(resolve(args.output), output, { encoding: "utf8", flag: "wx", mode: 0o600 });
    } catch {
      throw codedError("REPORT_CREATE_FAILED_OR_PATH_EXISTS");
    }
  }
  console.log(output);
  return report.result.identityGatePassed ? 0 : 1;
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
