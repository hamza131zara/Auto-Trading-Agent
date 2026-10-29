import assert from "node:assert/strict";
import test from "node:test";
import {
  SPL_TOKEN_2022_PROGRAM_ID,
  SPL_TOKEN_PROGRAM_ID,
  decodeSplTokenAccount,
  decodeSplTokenMint
} from "../packages/market-data/dist/index.js";

const mintAddress = "So11111111111111111111111111111111111111112";
const otherMint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const authority = "11111111111111111111111111111111";
const freezeAuthority = "11111111111111111111111111111112";
const delegate = "11111111111111111111111111111113";
const closeAuthority = "11111111111111111111111111111114";
const tokenAccountAddress = "11111111111111111111111111111115";

const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(Array.from(BASE58_ALPHABET, (character, index) => [character, index]));

function decodePublicKey(address) {
  let value = 0n;
  for (const character of address) {
    const digit = BASE58_INDEX.get(character);
    assert.notEqual(digit, undefined);
    value = value * 58n + BigInt(digit);
  }
  let hex = value.toString(16);
  if (hex.length % 2) hex = "0" + hex;
  const body = [];
  for (let index = 0; index < hex.length; index += 2) {
    body.push(Number.parseInt(hex.slice(index, index + 2), 16));
  }
  const leadingZeroes = address.match(/^1*/)?.[0].length ?? 0;
  const bytes = new Uint8Array(leadingZeroes + body.length);
  bytes.set(body, leadingZeroes);
  assert.equal(bytes.length, 32);
  return bytes;
}

function writeU32(bytes, offset, value) {
  bytes[offset] = value & 0xff;
  bytes[offset + 1] = (value >>> 8) & 0xff;
  bytes[offset + 2] = (value >>> 16) & 0xff;
  bytes[offset + 3] = (value >>> 24) & 0xff;
}

function writeU64(bytes, offset, value) {
  let remaining = BigInt(value);
  for (let index = 0; index < 8; index += 1) {
    bytes[offset + index] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
}

function writePubkey(bytes, offset, address) {
  bytes.set(decodePublicKey(address), offset);
}

function writeCOptionPubkey(bytes, offset, address) {
  writeU32(bytes, offset, address === null ? 0 : 1);
  if (address !== null) writePubkey(bytes, offset + 4, address);
}

function writeCOptionU64(bytes, offset, value) {
  writeU32(bytes, offset, value === null ? 0 : 1);
  if (value !== null) writeU64(bytes, offset + 4, value);
}

function mintBytes(length = 82) {
  const bytes = new Uint8Array(length);
  writeCOptionPubkey(bytes, 0, authority);
  writeU64(bytes, 36, "1234567890123456789");
  bytes[44] = 9;
  bytes[45] = 1;
  writeCOptionPubkey(bytes, 46, freezeAuthority);
  return bytes;
}

function tokenAccountBytes(length = 165) {
  const bytes = new Uint8Array(length);
  writePubkey(bytes, 0, mintAddress);
  writePubkey(bytes, 32, authority);
  writeU64(bytes, 64, "1844674407370955161");
  writeCOptionPubkey(bytes, 72, delegate);
  bytes[108] = 1;
  writeCOptionU64(bytes, 109, "2039280");
  writeU64(bytes, 121, "1234567890123456");
  writeCOptionPubkey(bytes, 129, closeAuthority);
  return bytes;
}

function rawAccount(address, programId, bytes, overrides = {}) {
  return {
    address,
    exists: true,
    ownerProgramId: programId,
    executable: false,
    dataBase64: Buffer.from(bytes).toString("base64"),
    space: bytes.length,
    ...overrides
  };
}

test("decodes the classic SPL Token mint base fields without numeric precision loss", () => {
  const bytes = mintBytes();
  const result = decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_PROGRAM_ID, bytes));
  assert.equal(result.status, "DECODED");
  assert.equal(result.errorCode, null);
  assert.deepEqual(result.value, {
    kind: "MINT",
    address: mintAddress,
    tokenProgramId: SPL_TOKEN_PROGRAM_ID,
    programKind: "SPL_TOKEN",
    mintAuthority: authority,
    supply: "1234567890123456789",
    decimals: 9,
    initialized: true,
    freezeAuthority,
    extensionState: "NONE",
    baseStateEligibleForIdentityEvidence: true
  });
});

test("decodes token-account mint, authority, state and large amounts as strings", () => {
  const result = decodeSplTokenAccount(
    rawAccount(tokenAccountAddress, SPL_TOKEN_PROGRAM_ID, tokenAccountBytes())
  );
  assert.equal(result.status, "DECODED");
  assert.equal(result.value.kind, "TOKEN_ACCOUNT");
  assert.equal(result.value.mint, mintAddress);
  assert.equal(result.value.authority, authority);
  assert.equal(result.value.amount, "1844674407370955161");
  assert.equal(result.value.delegate, delegate);
  assert.equal(result.value.state, "INITIALIZED");
  assert.equal(result.value.nativeReserveLamports, "2039280");
  assert.equal(result.value.delegatedAmount, "1234567890123456");
  assert.equal(result.value.closeAuthority, closeAuthority);
  assert.equal(result.value.baseStateEligibleForIdentityEvidence, true);
});

test("decodes absent optional authorities as null", () => {
  const bytes = mintBytes();
  writeCOptionPubkey(bytes, 0, null);
  writeCOptionPubkey(bytes, 46, null);
  const mint = decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_PROGRAM_ID, bytes));
  assert.equal(mint.status, "DECODED");
  assert.equal(mint.value.mintAuthority, null);
  assert.equal(mint.value.freezeAuthority, null);

  const account = tokenAccountBytes();
  writeCOptionPubkey(account, 72, null);
  writeCOptionU64(account, 109, null);
  writeCOptionPubkey(account, 129, null);
  const decodedAccount = decodeSplTokenAccount(
    rawAccount(tokenAccountAddress, SPL_TOKEN_PROGRAM_ID, account)
  );
  assert.equal(decodedAccount.status, "DECODED");
  assert.equal(decodedAccount.value.delegate, null);
  assert.equal(decodedAccount.value.nativeReserveLamports, null);
  assert.equal(decodedAccount.value.closeAuthority, null);
});

test("marks Token-2022 extension data uninspected and blocks identity evidence use", () => {
  const bytes = mintBytes(167);
  bytes[165] = 1; // Token-2022 AccountType::Mint; TLV bytes intentionally not decoded.
  bytes[166] = 1;
  const result = decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_2022_PROGRAM_ID, bytes));
  assert.equal(result.status, "EXTENSIONS_UNINSPECTED");
  assert.equal(result.value.extensionState, "PRESENT_UNINSPECTED");
  assert.equal(result.value.baseStateEligibleForIdentityEvidence, false);
  assert.equal(result.value.decimals, 9);
});

test("marks extended Token-2022 token accounts uninspected and ineligible", () => {
  const bytes = tokenAccountBytes(170);
  bytes[165] = 2; // Token-2022 AccountType::Account; extension TLV is not decoded.
  const result = decodeSplTokenAccount(
    rawAccount(tokenAccountAddress, SPL_TOKEN_2022_PROGRAM_ID, bytes)
  );
  assert.equal(result.status, "EXTENSIONS_UNINSPECTED");
  assert.equal(result.value.extensionState, "PRESENT_UNINSPECTED");
  assert.equal(result.value.baseStateEligibleForIdentityEvidence, false);
});

test("rejects invalid Token-2022 account type and non-zero mint padding", () => {
  const badType = mintBytes(166);
  badType[165] = 2;
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_2022_PROGRAM_ID, badType)).errorCode,
    "INVALID_TOKEN_2022_ACCOUNT_TYPE"
  );

  const badPadding = mintBytes(166);
  badPadding[100] = 7;
  badPadding[165] = 1;
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_2022_PROGRAM_ID, badPadding)).errorCode,
    "INVALID_TOKEN_2022_PADDING"
  );
});

test("rejects unsupported program owners and data/space mismatch", () => {
  const bytes = mintBytes();
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, authority, bytes)).errorCode,
    "UNSUPPORTED_TOKEN_PROGRAM"
  );
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_PROGRAM_ID, bytes, { space: 83 })).errorCode,
    "ACCOUNT_SPACE_MISMATCH"
  );
});

test("rejects malformed base64, option tags and state bytes", () => {
  const bytes = mintBytes();
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_PROGRAM_ID, bytes, { dataBase64: "####" })).errorCode,
    "INVALID_BASE64"
  );
  const invalidOption = mintBytes();
  writeU32(invalidOption, 0, 2);
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_PROGRAM_ID, invalidOption)).errorCode,
    "INVALID_OPTION_TAG"
  );
  const invalidInit = mintBytes();
  invalidInit[45] = 2;
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_PROGRAM_ID, invalidInit)).errorCode,
    "INVALID_INITIALIZATION_STATE"
  );
  const invalidAccountState = tokenAccountBytes();
  invalidAccountState[108] = 3;
  assert.equal(
    decodeSplTokenAccount(rawAccount(tokenAccountAddress, SPL_TOKEN_PROGRAM_ID, invalidAccountState)).errorCode,
    "INVALID_INITIALIZATION_STATE"
  );
});

test("rejects unsupported lengths and missing accounts", () => {
  assert.equal(
    decodeSplTokenMint(rawAccount(mintAddress, SPL_TOKEN_PROGRAM_ID, mintBytes(83))).errorCode,
    "INVALID_DATA_LENGTH"
  );
  const missing = {
    address: mintAddress,
    exists: false,
    ownerProgramId: null,
    executable: null,
    dataBase64: null,
    space: null
  };
  assert.equal(decodeSplTokenMint(missing).errorCode, "ACCOUNT_MISSING");
});

test("reports initialized, frozen and uninitialized token account states distinctly", () => {
  for (const [stateByte, stateName, eligible] of [
    [0, "UNINITIALIZED", false],
    [1, "INITIALIZED", true],
    [2, "FROZEN", false]
  ]) {
    const bytes = tokenAccountBytes();
    bytes[108] = stateByte;
    const result = decodeSplTokenAccount(
      rawAccount(tokenAccountAddress, SPL_TOKEN_PROGRAM_ID, bytes)
    );
    assert.equal(result.value.state, stateName);
    assert.equal(result.value.baseStateEligibleForIdentityEvidence, eligible);
  }
});
