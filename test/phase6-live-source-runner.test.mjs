import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  buildTargetSnapshotFromDexScreener,
  parseArgs,
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
