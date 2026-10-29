import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildMarketDataReportSection,
  buildOnChainReserveEvidence,
  buildTargetSnapshotFromDexScreener,
  parseArgs,
  readOperatorConfiguration,
  validateLiveTargetSnapshot,
  validateRpcEndpoint
} from "../scripts/validate-raydium-live-source.mjs";
import { DexScreenerPairsAdapter } from "../packages/market-data/dist/providers/dex-screener.js";

const replay = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const baseTarget = structuredClone(replay.cases.find((item) => item.caseId === "fresh-source").snapshot);
baseTarget.cluster = "mainnet-beta";
baseTarget.poolAddress = "11111111111111111111111111111111";
baseTarget.dexProgramAddress = null;
baseTarget.provenance = {
  ...baseTarget.provenance,
  providerId: "independent-indexer",
  sourceKind: "INDEXED_API",
  requestId: "indexer-request-001",
  rawPayloadSha256: "a".repeat(64),
  synthetic: false
};

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(Array.from(BASE58_ALPHABET, (character, index) => [character, BigInt(index)]));
function decode58(text) {
  let value = 0n;
  for (const character of text) {
    const digit = BASE58_INDEX.get(character);
    assert.notEqual(digit, undefined);
    value = value * 58n + digit;
  }
  const bodyBytes = [];
  while (value > 0n) {
    bodyBytes.unshift(Number(value & 0xffn));
    value >>= 8n;
  }
  let leading = 0;
  while (leading < text.length && text[leading] === "1") leading += 1;
  return Buffer.concat([Buffer.alloc(leading), Buffer.from(bodyBytes)]);
}
function writePubkey(bytes, offset, address) {
  const decoded = decode58(address);
  assert.equal(decoded.length, 32);
  decoded.copy(bytes, offset);
}
function writeU64(bytes, offset, amount) {
  let value = BigInt(amount);
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = Number(value & 0xffn);
    value >>= 8n;
  }
}
function mintAccount(address, decimals) {
  const bytes = Buffer.alloc(82);
  bytes.writeBigUInt64LE(1_000_000n, 36);
  bytes[44] = decimals;
  bytes[45] = 1;
  return rawAccount(address, "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", bytes);
}
function tokenVault(address, mint, rawAmount) {
  const bytes = Buffer.alloc(165);
  writePubkey(bytes, 0, mint);
  writePubkey(bytes, 32, "11111111111111111111111111111111");
  writeU64(bytes, 64, rawAmount);
  bytes[108] = 1;
  return rawAccount(address, "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA", bytes);
}
function rawAccount(address, ownerProgramId, data) {
  return {
    address,
    exists: true,
    ownerProgramId,
    executable: false,
    dataBase64: Buffer.from(data).toString("base64"),
    space: data.length
  };
}

test("on-chain reserve report derives exact vault amounts and quote-per-base ratio at the RPC context slot", () => {
  const baseVaultAddress = "7VLUXrnSSDo9BfCa4NWaQs68g7ddDY1sdXBKW6Xswj9Y";
  const quoteVaultAddress = "3rzbbW5Q8MA7sCaowf28hNgACNPecdS2zceWy7Ptzua9";
  const baseMint = "So11111111111111111111111111111111111111112";
  const quoteMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const pool = {
    token0Mint: baseMint,
    token1Mint: quoteMint,
    token0Vault: baseVaultAddress,
    token1Vault: quoteVaultAddress
  };
  const target = { baseMint, quoteMint };
  const bundle = {
    source: {
      providerId: "solana-public-shared",
      commitment: "finalized",
      contextSlot: 462900001,
      requestId: "unit-rpc-reserves",
      rawPayloadSha256: "b".repeat(64)
    },
    accounts: [
      mintAccount(baseMint, 9),
      mintAccount(quoteMint, 6),
      tokenVault(baseVaultAddress, baseMint, "123456789000"),
      tokenVault(quoteVaultAddress, quoteMint, "12345678900")
    ]
  };
  const report = buildOnChainReserveEvidence(target, bundle, pool);
  assert.equal(report.state, "DECODED");
  assert.equal(report.contextSlot, 462900001);
  assert.equal(report.baseReserveAmount, "123.456789");
  assert.equal(report.quoteReserveAmount, "12345.6789");
  assert.equal(report.baseVaultAmountRaw, "123456789000");
  assert.equal(report.quoteVaultAmountRaw, "12345678900");
  assert.equal(report.reserveRatioQuotePerBase, "100");
  assert.equal(report.independentComparisonStatus, "NOT_ASSESSED");
});

test("on-chain reserve report rejects a vault whose decoded mint does not match the target", () => {
  const baseVaultAddress = "7VLUXrnSSDo9BfCa4NWaQs68g7ddDY1sdXBKW6Xswj9Y";
  const quoteVaultAddress = "3rzbbW5Q8MA7sCaowf28hNgACNPecdS2zceWy7Ptzua9";
  const baseMint = "So11111111111111111111111111111111111111112";
  const quoteMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const pool = {
    token0Mint: baseMint,
    token1Mint: quoteMint,
    token0Vault: baseVaultAddress,
    token1Vault: quoteVaultAddress
  };
  const bundle = {
    source: { providerId: "rpc-test", commitment: "finalized", contextSlot: 5 },
    accounts: [
      mintAccount(baseMint, 9),
      mintAccount(quoteMint, 6),
      tokenVault(baseVaultAddress, quoteMint, "123456789000"),
      tokenVault(quoteVaultAddress, quoteMint, "12345678900")
    ]
  };
  const report = buildOnChainReserveEvidence({ baseMint, quoteMint }, bundle, pool);
  assert.equal(report.state, "MISMATCH");
  assert.deepEqual(report.reasonCodes, ["BASE_VAULT_MINT_MISMATCH"]);
  assert.equal(report.reserveRatioQuotePerBase, null);
});

test("live market-data report preserves provider measures and marks absent source time UNKNOWN", () => {
  const target = structuredClone(baseTarget);
  target.retrievedAt = "2026-10-29T08:13:26.000Z";
  target.observedAt = null;
  target.sourceEventAt = null;
  target.price = { value: "100.5107", unit: "USD_PER_BASE", assetId: null };
  target.liquidity = { value: "86", unit: "USD", assetId: null };
  target.volume24h = { value: "2", unit: "USD", assetId: null };
  target.buys24h = 44;
  target.sells24h = 80;

  const report = buildMarketDataReportSection(target);
  assert.equal(report.retrievedAt, target.retrievedAt);
  assert.equal(report.price.value, "100.5107");
  assert.equal(report.liquidity.value, "86");
  assert.equal(report.volume24h.value, "2");
  assert.equal(report.buys24h, 44);
  assert.equal(report.sells24h, 80);
  assert.equal(report.sourceTimestampStatus, "UNKNOWN");
  assert.deepEqual(report.sourceFreshness, {
    state: "UNKNOWN",
    reasonCodes: ["SOURCE_TIMESTAMP_MISSING"]
  });
  assert.match(report.interpretation, /not independently validated/);
});

test("live market-data report never labels source time as fresh without an approved freshness policy", () => {
  const target = structuredClone(baseTarget);
  target.observedAt = "2026-10-29T08:13:20.000Z";
  target.sourceEventAt = "2026-10-29T08:13:20.000Z";

  const report = buildMarketDataReportSection(target);
  assert.equal(report.sourceTimestampStatus, "PRESENT_BUT_NOT_ASSESSED");
  assert.deepEqual(report.sourceFreshness, {
    state: "NOT_ASSESSED",
    reasonCodes: ["SOURCE_SPECIFIC_FRESHNESS_POLICY_NOT_CONFIGURED"]
  });
  assert.notEqual(report.sourceFreshness.state, "FRESH");
});

test("live-source target requires a real indexed snapshot with verifiable provenance", () => {
  assert.equal(validateLiveTargetSnapshot(baseTarget, "approved-rpc").poolAddress, baseTarget.poolAddress);
});

test("live-source target rejects synthetic and replay-fixture evidence", () => {
  const target = structuredClone(baseTarget);
  target.provenance.synthetic = true;
  assert.throws(() => validateLiveTargetSnapshot(target, "approved-rpc"), {
    code: "TARGET_MUST_BE_REAL_INDEXED_SOURCE_EVIDENCE"
  });

  const replayTarget = structuredClone(baseTarget);
  replayTarget.provenance.sourceKind = "REPLAY_FIXTURE";
  replayTarget.provenance.synthetic = true;
  assert.throws(() => validateLiveTargetSnapshot(replayTarget, "approved-rpc"), {
    code: "TARGET_MUST_BE_REAL_INDEXED_SOURCE_EVIDENCE"
  });
});

test("live-source target requires distinct indexer and RPC providers plus a digest", () => {
  assert.throws(() => validateLiveTargetSnapshot(baseTarget, "independent-indexer"), {
    code: "TARGET_AND_RPC_PROVIDERS_MUST_DIFFER"
  });

  const noDigest = structuredClone(baseTarget);
  noDigest.provenance.rawPayloadSha256 = null;
  assert.throws(() => validateLiveTargetSnapshot(noDigest, "approved-rpc"), {
    code: "TARGET_SOURCE_PROVENANCE_REQUIRED"
  });
});

test("live-source target rejects a conflicting claimed DEX program", () => {
  const target = structuredClone(baseTarget);
  target.dexProgramAddress = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
  assert.throws(() => validateLiveTargetSnapshot(target, "approved-rpc"), {
    code: "TARGET_DEX_PROGRAM_CONFLICTS_WITH_CANDIDATE"
  });
});

test("RPC endpoint policy requires HTTPS and rejects URL user-info and fragments", () => {
  assert.equal(validateRpcEndpoint("https://rpc.example.test/path").startsWith("https://"), true);
  for (const endpoint of [
    "http://rpc.example.test",
    "https://user:password@rpc.example.test/path",
    "https://rpc.example.test/path#fragment",
    "not-a-url"
  ]) {
    assert.throws(() => validateRpcEndpoint(endpoint));
  }
});

test("CLI refuses to proceed without explicit read-only mainnet approval", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate-raydium-live-source.mjs",
    "--target",
    "this-file-must-not-be-read-before-approval.json"
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ATA_SOLANA_RPC_URL: "https://127.0.0.1:1/never-contacted",
      ATA_SOLANA_RPC_PROVIDER_ID: "approved-rpc",
      ATA_LIVE_SOURCE_APPROVAL: "",
      ATA_LIVE_TARGET_SOURCE_APPROVAL: "",
      ATA_LIVE_PROVIDER_TERMS_APPROVAL: ""
    }
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /READ_ONLY_MAINNET_APPROVAL_REQUIRED/);
  assert.doesNotMatch(result.stderr, /127\.0\.0\.1|never-contacted/);
});


test("live mode requires the exact pair and both mint addresses; it never auto-selects a pair", () => {
  assert.deepEqual(
    parseArgs(["--pool-address", baseTarget.poolAddress, "--base-mint", baseTarget.baseMint, "--quote-mint", baseTarget.quoteMint]),
    {
      target: null,
      output: null,
      poolAddress: baseTarget.poolAddress,
      baseMint: baseTarget.baseMint,
      quoteMint: baseTarget.quoteMint,
      help: false
    }
  );
  assert.throws(
    () => parseArgs(["--pool-address", baseTarget.poolAddress]),
    { code: "PAIR_IDENTITY_ARGUMENTS_INCOMPLETE" }
  );
  assert.throws(
    () => parseArgs(["--target", "snapshot.json", "--pool-address", baseTarget.poolAddress, "--base-mint", baseTarget.baseMint, "--quote-mint", baseTarget.quoteMint]),
    { code: "TARGET_MODE_ARGUMENT_CONFLICT" }
  );
});

test("mocked DEX Screener adapter data cannot become an eligible live target", async () => {
  const fixtureText = readFileSync(
    new URL("./fixtures/market-data/dexscreener-pair-v1.json", import.meta.url),
    "utf8"
  );
  const adapter = new DexScreenerPairsAdapter(async () =>
    new Response(fixtureText, { status: 200, headers: { "content-type": "application/json" } })
  );
  const times = ["2026-10-29T00:00:00.000Z", "2026-10-29T00:00:02.000Z"];
  await assert.rejects(
    buildTargetSnapshotFromDexScreener({
      poolAddress: baseTarget.poolAddress,
      baseMint: baseTarget.baseMint,
      quoteMint: baseTarget.quoteMint,
      rpcProviderId: "approved-rpc",
      adapter,
      now: () => times.shift()
    }),
    { code: "TARGET_MUST_BE_REAL_INDEXED_SOURCE_EVIDENCE" }
  );
});

test("CLI checks operator approvals before attempting live indexed API or RPC access", () => {
  const result = spawnSync(process.execPath, [
    "scripts/validate-raydium-live-source.mjs",
    "--pool-address", baseTarget.poolAddress,
    "--base-mint", baseTarget.baseMint,
    "--quote-mint", baseTarget.quoteMint
  ], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      ATA_SOLANA_RPC_URL: "https://api.mainnet.solana.com",
      ATA_SOLANA_RPC_PROVIDER_ID: "solana-public-shared",
      ATA_LIVE_SOURCE_APPROVAL: "",
      ATA_LIVE_TARGET_SOURCE_APPROVAL: "",
      ATA_LIVE_PROVIDER_TERMS_APPROVAL: ""
    }
  });
  assert.equal(result.status, 2);
  assert.match(result.stderr, /READ_ONLY_MAINNET_APPROVAL_REQUIRED/);
  assert.doesNotMatch(result.stderr, /api\.dexscreener\.com|api\.mainnet\.solana\.com/);
});


function validOperatorEnvironment(overrides = {}) {
  return {
    ATA_LIVE_SOURCE_APPROVAL: "APPROVED_READ_ONLY_MAINNET_RPC",
    ATA_LIVE_TARGET_SOURCE_APPROVAL: "INDEPENDENT_INDEXED_SOURCE_REVIEWED",
    ATA_LIVE_PROVIDER_TERMS_APPROVAL: "TERMS_QUOTA_AND_BUDGET_REVIEWED",
    ATA_SOLANA_RPC_URL: "https://rpc.example.invalid/read-only",
    ATA_SOLANA_RPC_PROVIDER_ID: "test-rpc",
    ATA_LIVE_MIN_CONTEXT_SLOT: "1",
    ATA_LIVE_MAX_RETRIEVAL_AGE_MS: "30000",
    ...overrides
  };
}

test("program deployment hash check stays optional unless an owner-reviewed ELF hash is supplied", () => {
  const config = readOperatorConfiguration(validOperatorEnvironment());
  assert.equal(config.expectedProgramElfSha256, null);
  assert.equal(config.expectedProgramElfByteLength, null);
  assert.equal(config.providerId, "test-rpc");
});

test("program deployment reference hash requires a separate affirmative build-review acknowledgement", () => {
  assert.throws(
    () => readOperatorConfiguration(validOperatorEnvironment({
      ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_SHA256: "a".repeat(64),
      ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_BYTES: "16"
    })),
    { code: "PROGRAM_BUILD_HASH_REVIEW_REQUIRED" }
  );
});

test("program deployment reference hash validates format before any provider request", () => {
  assert.throws(
    () => readOperatorConfiguration(validOperatorEnvironment({
      ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_SHA256: "not-a-hash",
      ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_BYTES: "16",
      ATA_LIVE_PROGRAM_BUILD_HASH_REVIEW: "EXPECTED_RAYDIUM_ELF_HASH_REVIEWED"
    })),
    { code: "EXPECTED_PROGRAM_ELF_SHA256_INVALID" }
  );
});

test("reviewed program deployment reference hash is accepted as a per-run evidence input", () => {
  const expected = "b".repeat(64);
  const config = readOperatorConfiguration(validOperatorEnvironment({
    ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_SHA256: expected,
    ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_BYTES: "16",
    ATA_LIVE_PROGRAM_BUILD_HASH_REVIEW: "EXPECTED_RAYDIUM_ELF_HASH_REVIEWED"
  }));
  assert.equal(config.expectedProgramElfSha256, expected);
  assert.equal(config.expectedProgramElfByteLength, 16);
});

test("program reference hash and exact ELF length must be supplied together", () => {
  assert.throws(
    () => readOperatorConfiguration(validOperatorEnvironment({
      ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_SHA256: "a".repeat(64)
    })),
    { code: "EXPECTED_PROGRAM_ELF_HASH_AND_LENGTH_REQUIRED_TOGETHER" }
  );
  assert.throws(
    () => readOperatorConfiguration(validOperatorEnvironment({
      ATA_RAYDIUM_EXPECTED_DEPLOYED_ELF_BYTES: "16"
    })),
    { code: "EXPECTED_PROGRAM_ELF_HASH_AND_LENGTH_REQUIRED_TOGETHER" }
  );
});
