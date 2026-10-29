import assert from "node:assert/strict";
import test from "node:test";
import {
  SPL_TOKEN_2022_PROGRAM_ID,
  inspectToken2022ExtensionLayout
} from "../packages/market-data/dist/index.js";

const address = "11111111111111111111111111111111";

function mintExtended(payloadLength = 0) {
  const bytes = new Uint8Array(166 + payloadLength);
  bytes[165] = 1; // Token-2022 AccountType::Mint.
  return bytes;
}

function accountExtended(payloadLength = 0) {
  const bytes = new Uint8Array(166 + payloadLength);
  bytes[165] = 2; // Token-2022 AccountType::Account.
  return bytes;
}

function putTlv(bytes, offset, typeCode, value) {
  bytes[offset] = typeCode & 0xff;
  bytes[offset + 1] = (typeCode >>> 8) & 0xff;
  bytes[offset + 2] = value.length & 0xff;
  bytes[offset + 3] = (value.length >>> 8) & 0xff;
  bytes.set(value, offset + 4);
  return offset + 4 + value.length;
}

function rpcAccount(bytes, overrides = {}) {
  return {
    address,
    exists: true,
    ownerProgramId: SPL_TOKEN_2022_PROGRAM_ID,
    executable: false,
    dataBase64: Buffer.from(bytes).toString("base64"),
    space: bytes.length,
    ...overrides
  };
}

test("exact Token-2022 base mint/account layouts are reported as no extensions", () => {
  const mint = inspectToken2022ExtensionLayout(
    rpcAccount(new Uint8Array(82)),
    "MINT"
  );
  const account = inspectToken2022ExtensionLayout(
    rpcAccount(new Uint8Array(165)),
    "TOKEN_ACCOUNT"
  );
  assert.equal(mint.status, "NO_EXTENSIONS");
  assert.equal(mint.baseStateEligibleForIdentityEvidence, true);
  assert.equal(account.status, "NO_EXTENSIONS");
  assert.equal(account.baseStateEligibleForIdentityEvidence, true);
});

test("parses a MintCloseAuthority-style TLV header but does not inspect the extension payload", () => {
  const bytes = mintExtended(36);
  const offset = putTlv(bytes, 166, 3, new Uint8Array(32));
  assert.equal(offset, bytes.length);
  const result = inspectToken2022ExtensionLayout(rpcAccount(bytes), "MINT");
  assert.equal(result.status, "INSPECTED");
  assert.deepEqual(result.extensions, [{ typeCode: 3, length: 32, valueOffset: 170 }]);
  assert.equal(result.terminatedByUninitializedType, false);
  assert.equal(result.trailingZeroPaddingBytes, 0);
  assert.equal(result.baseStateEligibleForIdentityEvidence, false);
});

test("parses a zero-length ImmutableOwner-style TLV entry for a token account", () => {
  const bytes = accountExtended(4);
  putTlv(bytes, 166, 7, new Uint8Array(0));
  const result = inspectToken2022ExtensionLayout(rpcAccount(bytes), "TOKEN_ACCOUNT");
  assert.equal(result.status, "INSPECTED");
  assert.deepEqual(result.extensions, [{ typeCode: 7, length: 0, valueOffset: 170 }]);
  assert.equal(result.baseStateEligibleForIdentityEvidence, false);
});

test("handles an uninitialized-type terminator with zero padding after valid entries", () => {
  const bytes = mintExtended(40);
  let offset = putTlv(bytes, 166, 3, new Uint8Array(32));
  bytes.set([0, 0, 0, 0], offset);
  const result = inspectToken2022ExtensionLayout(rpcAccount(bytes), "MINT");
  assert.equal(result.status, "INSPECTED");
  assert.equal(result.terminatedByUninitializedType, true);
  assert.equal(result.extensions.length, 1);
});

test("rejects an extended state with no extension entries", () => {
  const result = inspectToken2022ExtensionLayout(rpcAccount(mintExtended()), "MINT");
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "NO_EXTENSION_ENTRIES");
});

test("rejects a TLV header cut off at the end of the account", () => {
  const bytes = mintExtended(2);
  bytes.set([3, 0], 166);
  const result = inspectToken2022ExtensionLayout(rpcAccount(bytes), "MINT");
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "INVALID_TLV_HEADER");
});

test("rejects TLV lengths that exceed the remaining account bytes", () => {
  const bytes = mintExtended(10);
  bytes.set([3, 0, 32, 0], 166);
  const result = inspectToken2022ExtensionLayout(rpcAccount(bytes), "MINT");
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "TLV_LENGTH_OUT_OF_BOUNDS");
});

test("rejects duplicate extension types rather than silently choosing one", () => {
  const bytes = accountExtended(8);
  let offset = putTlv(bytes, 166, 7, new Uint8Array(0));
  putTlv(bytes, offset, 7, new Uint8Array(0));
  const result = inspectToken2022ExtensionLayout(rpcAccount(bytes), "TOKEN_ACCOUNT");
  assert.equal(result.status, "ERROR");
  assert.equal(result.errorCode, "DUPLICATE_EXTENSION_TYPE");
});

test("rejects invalid terminators and non-zero content after terminator", () => {
  const nonzeroTerminator = mintExtended(4);
  nonzeroTerminator.set([0, 0, 1, 0], 166);
  assert.equal(
    inspectToken2022ExtensionLayout(rpcAccount(nonzeroTerminator), "MINT").errorCode,
    "INVALID_TLV_TERMINATOR"
  );

  const bytes = mintExtended(12);
  let offset = putTlv(bytes, 166, 3, new Uint8Array(0));
  bytes.set([0, 0, 0, 0, 9, 0, 0, 0], offset);
  assert.equal(
    inspectToken2022ExtensionLayout(rpcAccount(bytes), "MINT").errorCode,
    "INVALID_TLV_TERMINATOR"
  );
});

test("rejects malformed program owner, size, marker and padding", () => {
  const bytes = mintExtended(4);
  putTlv(bytes, 166, 3, new Uint8Array(0));
  assert.equal(
    inspectToken2022ExtensionLayout(rpcAccount(bytes, { space: bytes.length + 1 }), "MINT").errorCode,
    "ACCOUNT_SPACE_MISMATCH"
  );
  assert.equal(
    inspectToken2022ExtensionLayout(rpcAccount(bytes, { ownerProgramId: address }), "MINT").errorCode,
    "UNSUPPORTED_TOKEN_PROGRAM"
  );

  const badMarker = mintExtended(4);
  badMarker[165] = 2;
  assert.equal(
    inspectToken2022ExtensionLayout(rpcAccount(badMarker), "MINT").errorCode,
    "INVALID_TOKEN_2022_ACCOUNT_TYPE"
  );
  const badPadding = mintExtended(4);
  badPadding[120] = 1;
  assert.equal(
    inspectToken2022ExtensionLayout(rpcAccount(badPadding), "MINT").errorCode,
    "INVALID_TOKEN_2022_PADDING"
  );
});

test("structural inspection never authorizes identity evidence or trading", () => {
  const bytes = mintExtended(4);
  putTlv(bytes, 166, 3, new Uint8Array(0));
  const result = inspectToken2022ExtensionLayout(rpcAccount(bytes), "MINT");
  assert.equal(result.status, "INSPECTED");
  assert.equal(result.baseStateEligibleForIdentityEvidence, false);
  // This function only reports TLV framing; it does not expose any trading authorization.
  assert.equal("tradingAuthorized" in result, false);
});
