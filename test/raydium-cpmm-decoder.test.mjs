import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  RAYDIUM_CPMM_DECODER_ID,
  RAYDIUM_CPMM_DECODER_VERSION,
  RAYDIUM_CPMM_AMM_CONFIG_LENGTH,
  RAYDIUM_CPMM_POOL_STATE_LENGTH,
  RAYDIUM_CPMM_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  assessRaydiumCpmmIdentityEvidence,
  decodeRaydiumCpmmAmmConfig,
  decodeRaydiumCpmmPool,
  deriveRaydiumCpmmAmmConfigPda,
  deriveRaydiumCpmmAuthorityPda,
  deriveRaydiumCpmmLpMintPda,
  deriveRaydiumCpmmObservationPda,
  deriveRaydiumCpmmPoolPda,
  deriveRaydiumCpmmVaultPda,
  findSolanaProgramAddress,
  readRaydiumCpmmIdentityBundle
} from "../packages/market-data/dist/index.js";
import { SolanaRpcAccountReader } from "../packages/market-data/dist/index.js";

const replay = JSON.parse(
  readFileSync(new URL("./fixtures/market-data/replay-v1.json", import.meta.url), "utf8")
);
const original = replay.cases.find((item) => item.caseId === "fresh-source").snapshot;
const quoteMint = "So11111111111111111111111111111111111111112";
const baseMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const ownerAuthority = "11111111111111111111111111111111";
const loaderProgramId = "BPFLoaderUpgradeab1e11111111111111111111111";
const tokenProgramId = SPL_TOKEN_PROGRAM_ID;
const nowAt = "2026-10-29T00:01:00.000Z";
const retrievedAt = "2026-10-29T00:00:59.000Z";

const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const ALPHABET_INDEX = new Map(Array.from(ALPHABET, (c, i) => [c, BigInt(i)]));

function encode58(bytes) {
  let zeroes = 0;
  while (zeroes < bytes.length && bytes[zeroes] === 0) zeroes += 1;
  let n = 0n;
  for (const byte of bytes) n = (n << 8n) | BigInt(byte);
  let output = "";
  while (n > 0n) {
    output = ALPHABET[Number(n % 58n)] + output;
    n /= 58n;
  }
  return "1".repeat(zeroes) + output;
}

function decode58(text) {
  let n = 0n;
  for (const character of text) {
    const digit = ALPHABET_INDEX.get(character);
    assert.notEqual(digit, undefined, "valid base58 test key");
    n = n * 58n + digit;
  }
  const hex = n === 0n ? "" : n.toString(16).padStart(n.toString(16).length + (n.toString(16).length % 2), "0");
  const body = hex.length ? Buffer.from(hex, "hex") : Buffer.alloc(0);
  let zeroes = 0;
  while (zeroes < text.length && text[zeroes] === "1") zeroes += 1;
  return Buffer.concat([Buffer.alloc(zeroes), body]);
}

function makeKey(value) {
  const bytes = new Uint8Array(32);
  bytes[0] = value & 0xff;
  bytes[1] = (value * 7) & 0xff;
  bytes[30] = (value * 13) & 0xff;
  bytes[31] = value;
  return encode58(bytes);
}

function writePubkey(bytes, offset, address) {
  const key = decode58(address);
  assert.equal(key.length, 32);
  bytes.set(key, offset);
}

function writeU64(bytes, offset, input) {
  let value = BigInt(input);
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = Number(value & 0xffn);
    value >>= 8n;
  }
}

function writeCOptionPubkeyNone(bytes, offset) {
  bytes[offset] = 0;
  bytes[offset + 1] = 0;
  bytes[offset + 2] = 0;
  bytes[offset + 3] = 0;
}

function ammConfigData(index, bump) {
  const bytes = new Uint8Array(RAYDIUM_CPMM_AMM_CONFIG_LENGTH);
  bytes.set([0xda, 0xf4, 0x21, 0x68, 0xcb, 0xcb, 0x2b, 0x6f], 0);
  bytes[8] = bump;
  bytes[9] = 0;
  bytes[10] = index & 0xff;
  bytes[11] = (index >>> 8) & 0xff;
  writePubkey(bytes, 44, makeKey(41));
  writePubkey(bytes, 76, makeKey(42));
  for (const offset of [12, 20, 28, 36, 108, 116]) writeU64(bytes, offset, "0");
  return bytes;
}

function mintData(decimals) {
  const bytes = new Uint8Array(82);
  writeCOptionPubkeyNone(bytes, 0);
  writeU64(bytes, 36, "999999999999999999");
  bytes[44] = decimals;
  bytes[45] = 1;
  writeCOptionPubkeyNone(bytes, 46);
  return bytes;
}

function tokenAccountData(mint, authority) {
  const bytes = new Uint8Array(165);
  writePubkey(bytes, 0, mint);
  writePubkey(bytes, 32, authority);
  writeU64(bytes, 64, "250000000000");
  writeCOptionPubkeyNone(bytes, 72);
  bytes[108] = 1;
  // COption<u64> native reserve = None.
  writeU64(bytes, 109, "0");
  bytes[109] = 0;
  bytes[110] = 0;
  bytes[111] = 0;
  bytes[112] = 0;
  writeU64(bytes, 121, "0");
  writeCOptionPubkeyNone(bytes, 129);
  return bytes;
}

function rawAccount(address, ownerProgramId, data, executable = false) {
  return {
    address,
    exists: true,
    ownerProgramId,
    executable,
    dataBase64: Buffer.from(data).toString("base64"),
    space: data.length
  };
}

function poolStateBytes({
  ammConfig,
  poolCreator,
  token0Vault,
  token1Vault,
  lpMint,
  token0Mint,
  token1Mint,
  token0Program = tokenProgramId,
  token1Program = tokenProgramId,
  token0Decimals = token0Mint === baseMint ? 6 : 9,
  token1Decimals = token1Mint === baseMint ? 6 : 9,
  observationKey,
  authBump,
  status = 0
}) {
  const bytes = new Uint8Array(RAYDIUM_CPMM_POOL_STATE_LENGTH);
  bytes.set([0xf7, 0xed, 0xe3, 0xf5, 0xd7, 0xc3, 0xde, 0x46], 0);
  for (const [offset, key] of [
    [8, ammConfig],
    [40, poolCreator],
    [72, token0Vault],
    [104, token1Vault],
    [136, lpMint],
    [168, token0Mint],
    [200, token1Mint],
    [232, token0Program],
    [264, token1Program],
    [296, observationKey]
  ]) writePubkey(bytes, offset, key);
  bytes[328] = authBump;
  bytes[329] = status;
  bytes[330] = 9;
  bytes[331] = token0Decimals;
  bytes[332] = token1Decimals;
  for (const offset of [333, 341, 349, 357, 365, 373, 381, 397, 405]) writeU64(bytes, offset, "0");
  bytes[389] = 0;
  bytes[390] = 0;
  return bytes;
}

async function makeFixture() {
  const orderedMints = [baseMint, quoteMint].sort((a, b) => Buffer.compare(decode58(a), decode58(b)));
  const token0Mint = orderedMints[0];
  const token1Mint = orderedMints[1];
  const configPda = await deriveRaydiumCpmmAmmConfigPda(7);
  const ammConfig = configPda.address;
  const pool = await deriveRaydiumCpmmPoolPda(ammConfig, token0Mint, token1Mint);
  const authority = await deriveRaydiumCpmmAuthorityPda();
  const token0Vault = await deriveRaydiumCpmmVaultPda(pool.address, token0Mint);
  const token1Vault = await deriveRaydiumCpmmVaultPda(pool.address, token1Mint);
  const lpMint = await deriveRaydiumCpmmLpMintPda(pool.address);
  const observation = await deriveRaydiumCpmmObservationPda(pool.address);
  const state = poolStateBytes({
    ammConfig,
    poolCreator: makeKey(32),
    token0Vault: token0Vault.address,
    token1Vault: token1Vault.address,
    lpMint: lpMint.address,
    token0Mint,
    token1Mint,
    observationKey: observation.address,
    authBump: authority.bump
  });
  const rawAccounts = new Map([
    [pool.address, rawAccount(pool.address, RAYDIUM_CPMM_PROGRAM_ID, state)],
    [RAYDIUM_CPMM_PROGRAM_ID, rawAccount(RAYDIUM_CPMM_PROGRAM_ID, loaderProgramId, new Uint8Array([1, 2, 3]), true)],
    [ammConfig, rawAccount(ammConfig, RAYDIUM_CPMM_PROGRAM_ID, ammConfigData(7, configPda.bump))],
    [lpMint.address, rawAccount(lpMint.address, SPL_TOKEN_PROGRAM_ID, mintData(9))],
    [baseMint, rawAccount(baseMint, tokenProgramId, mintData(6))],
    [quoteMint, rawAccount(quoteMint, tokenProgramId, mintData(9))],
    [token0Vault.address, rawAccount(token0Vault.address, tokenProgramId, tokenAccountData(token0Mint, authority.address))],
    [token1Vault.address, rawAccount(token1Vault.address, tokenProgramId, tokenAccountData(token1Mint, authority.address))],
    [observation.address, rawAccount(observation.address, RAYDIUM_CPMM_PROGRAM_ID, new Uint8Array([9, 8, 7]))]
  ]);
  const target = structuredClone(original);
  target.cluster = "mainnet-beta";
  target.poolAddress = pool.address;
  target.baseMint = baseMint;
  target.quoteMint = quoteMint;
  // This target is deliberately synthetic. The integrated gate must never call it a live match.
  target.provenance.sourceKind = "REPLAY_FIXTURE";
  target.provenance.synthetic = true;
  return {
    target, pool, state, rawAccounts, token0Mint, token1Mint, authority,
    token0Vault, token1Vault, lpMint, observation, configPda
  };
}

function policy() {
  return {
    nowAt,
    maxRetrievalAgeMs: 60_000,
    maxFutureSkewMs: 0,
    minimumContextSlot: 400,
    requiredCommitment: "finalized",
    approvedPoolDecoders: [{
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      decoderId: RAYDIUM_CPMM_DECODER_ID,
      decoderVersion: RAYDIUM_CPMM_DECODER_VERSION
    }],
    allowedTokenProgramIds: [SPL_TOKEN_PROGRAM_ID, "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb"],
    allowedLoaderProgramIds: [loaderProgramId]
  };
}

test("Solana PDA derivation matches the independently published Raydium authority test vector", async () => {
  const actual = await findSolanaProgramAddress(
    ["vault_and_lp_mint_auth_seed"],
    RAYDIUM_CPMM_PROGRAM_ID
  );
  assert.deepEqual(actual, {
    address: "GpMZbSM2GgvTKHJirzeGfMFoaZ8UR2X7F4v8vHTvxFbL",
    bump: 253
  });
});

test("decodes the pinned Raydium CPMM PoolState discriminator and packed offsets", async () => {
  const fixture = await makeFixture();
  const decoded = decodeRaydiumCpmmPool(fixture.rawAccounts.get(fixture.pool.address));
  assert.equal(decoded.status, "DECODED");
  assert.equal(decoded.value.address, fixture.pool.address);
  assert.equal(decoded.value.programId, RAYDIUM_CPMM_PROGRAM_ID);
  assert.equal(decoded.value.ammConfig, makeKey(31));
  assert.equal(decoded.value.token0Mint, fixture.token0Mint);
  assert.equal(decoded.value.token1Mint, fixture.token1Mint);
  assert.equal(decoded.value.authBump, fixture.authority.bump);
  assert.equal(decoded.value.status, 0);
  assert.equal(decoded.value.swapsEnabled, true);
  assert.equal(decoded.value.lpSupply, "0");
  assert.equal(decoded.value.canonicalPoolPdaMatches, null);
});

test("rejects an incorrect owner, executable state, size and Anchor discriminator", async () => {
  const fixture = await makeFixture();
  const poolRaw = fixture.rawAccounts.get(fixture.pool.address);
  assert.equal(decodeRaydiumCpmmPool({ ...poolRaw, ownerProgramId: loaderProgramId }).errorCode, "WRONG_POOL_PROGRAM_OWNER");
  assert.equal(decodeRaydiumCpmmPool({ ...poolRaw, executable: true }).errorCode, "POOL_ACCOUNT_EXECUTABLE");
  assert.equal(decodeRaydiumCpmmPool({ ...poolRaw, space: poolRaw.space + 1 }).errorCode, "ACCOUNT_SPACE_MISMATCH");
  const badBytes = Buffer.from(poolRaw.dataBase64, "base64");
  badBytes[0] ^= 0xff;
  assert.equal(decodeRaydiumCpmmPool({ ...poolRaw, dataBase64: badBytes.toString("base64") }).errorCode, "INVALID_POOL_DISCRIMINATOR");
});

test("read helper requests pool/program/mints/derived vaults at an explicit slot and integrated assessment remains synthetic", async () => {
  const fixture = await makeFixture();
  const reader = new SolanaRpcAccountReader({
    endpoint: "https://rpc.example.invalid/path",
    providerId: "test-rpc",
    clock: () => retrievedAt,
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      assert.equal(request.method, "getMultipleAccounts");
      assert.equal(request.params[1].commitment, "finalized");
      assert.equal(request.params[1].minContextSlot, 400);
      assert.equal(request.params[1].encoding, "base64");
      const addresses = request.params[0];
      assert.deepEqual(addresses, [
        fixture.pool.address,
        RAYDIUM_CPMM_PROGRAM_ID,
        baseMint,
        quoteMint,
        (await deriveRaydiumCpmmVaultPda(fixture.pool.address, baseMint)).address,
        (await deriveRaydiumCpmmVaultPda(fixture.pool.address, quoteMint)).address
      ]);
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          context: { slot: 500 },
          value: addresses.map((address) => {
            const account = fixture.rawAccounts.get(address);
            if (!account) return null;
            return {
              data: [account.dataBase64, "base64"],
              executable: account.executable,
              lamports: 1_000_000,
              owner: account.ownerProgramId,
              space: account.space
            };
          })
        }
      }), { status: 200, headers: { "content-type": "application/json" } });
    }
  });
  const bundle = await readRaydiumCpmmIdentityBundle(reader, fixture.target, {
    commitment: "finalized",
    minContextSlot: 400,
    requestId: "raydium-cpmm-test-001"
  });
  assert.equal(bundle.source.contextSlot, 500);
  assert.equal(bundle.source.synthetic, true);
  assert.equal(bundle.accounts.length, 6);
  const assessment = await assessRaydiumCpmmIdentityEvidence(fixture.target, bundle, policy());
  assert.equal(assessment.status, "SYNTHETIC_MATCH");
  assert.equal(assessment.canProceedToIndependentSafetyReview, false);
  assert.equal(assessment.tradingAuthorized, false);
  assert.equal(assessment.pool.canonicalPoolPdaMatches, true);
});

test("blocks pool/vault identity mismatches and missing vault accounts", async () => {
  const fixture = await makeFixture();
  const alteredPoolReader = new SolanaRpcAccountReader({
    endpoint: "https://rpc.example.invalid",
    providerId: "test-rpc",
    clock: () => retrievedAt,
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const addresses = request.params[0];
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          context: { slot: 500 },
          value: addresses.map((address) => {
            const account = fixture.rawAccounts.get(address);
            if (!account) return null;
            const data = Buffer.from(account.dataBase64, "base64");
            if (address === fixture.pool.address) {
              // Keep the layout/discriminator valid but point the state at a different vault.
              writePubkey(data, 72, makeKey(99));
            }
            return {
              data: [data.toString("base64"), "base64"],
              executable: account.executable,
              lamports: 1_000_000,
              owner: account.ownerProgramId,
              space: data.length
            };
          })
        }
      }), { status: 200 });
    }
  });
  const alteredBundle = await readRaydiumCpmmIdentityBundle(alteredPoolReader, fixture.target, {
    commitment: "finalized",
    minContextSlot: 400,
    requestId: "raydium-bad-vault"
  });
  const altered = await assessRaydiumCpmmIdentityEvidence(fixture.target, alteredBundle, policy());
  assert.equal(altered.status, "MISMATCH");
  assert.ok(altered.reasonCodes.includes("POOL_VAULT_PDA_MISMATCH"));
  assert.equal(altered.tradingAuthorized, false);

  const missingVaultReader = new SolanaRpcAccountReader({
    endpoint: "https://rpc.example.invalid",
    providerId: "test-rpc",
    clock: () => retrievedAt,
    fetchImpl: async (_url, init) => {
      const request = JSON.parse(String(init?.body));
      const addresses = request.params[0];
      return new Response(JSON.stringify({
        jsonrpc: "2.0",
        id: request.id,
        result: {
          context: { slot: 500 },
          value: addresses.map((address) => {
            if (address === fixture.token1Vault.address) return null;
            const account = fixture.rawAccounts.get(address);
            if (!account) return null;
            return {
              data: [account.dataBase64, "base64"],
              executable: account.executable,
              lamports: 1_000_000,
              owner: account.ownerProgramId,
              space: account.space
            };
          })
        }
      }), { status: 200 });
    }
  });
  const missingBundle = await readRaydiumCpmmIdentityBundle(missingVaultReader, fixture.target, {
    commitment: "finalized",
    minContextSlot: 400,
    requestId: "raydium-missing-vault"
  });
  const missing = await assessRaydiumCpmmIdentityEvidence(fixture.target, missingBundle, policy());
  assert.equal(missing.status, "INSUFFICIENT_EVIDENCE");
  assert.deepEqual(missing.reasonCodes, ["REQUIRED_ACCOUNT_MISSING"]);
  assert.equal(missing.tradingAuthorized, false);
});
