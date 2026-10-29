import type { SolanaRpcRawAccount } from "./solana-rpc-reader.js";
import { isSolanaPublicKey } from "./index.js";

export const SPL_TOKEN_PROGRAM_ID = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";
export const SPL_TOKEN_2022_PROGRAM_ID = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

const BASE_MINT_LENGTH = 82;
const BASE_TOKEN_ACCOUNT_LENGTH = 165;
const EXTENDED_ACCOUNT_TYPE_OFFSET = 165;
const TOKEN_2022_MINT_ACCOUNT_TYPE = 1;
const TOKEN_2022_TOKEN_ACCOUNT_TYPE = 2;
const MAX_TOKEN_DATA_BYTES = 2_000_000;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const CANONICAL_BASE64_PATTERN = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

export type SplTokenProgramKind = "SPL_TOKEN" | "TOKEN_2022";
export type TokenAccountState = "UNINITIALIZED" | "INITIALIZED" | "FROZEN";
export type TokenExtensionState = "NONE" | "PRESENT_UNINSPECTED";

export type SplTokenDecodeErrorCode =
  | "ACCOUNT_MISSING"
  | "ACCOUNT_ENVELOPE_INVALID"
  | "ACCOUNT_SPACE_MISMATCH"
  | "UNSUPPORTED_TOKEN_PROGRAM"
  | "TOKEN_DATA_MISSING"
  | "TOKEN_DATA_TOO_LARGE"
  | "INVALID_BASE64"
  | "INVALID_DATA_LENGTH"
  | "INVALID_TOKEN_2022_ACCOUNT_TYPE"
  | "INVALID_TOKEN_2022_PADDING"
  | "INVALID_OPTION_TAG"
  | "INVALID_INITIALIZATION_STATE"
  | "INVALID_PUBLIC_KEY_BYTES";

export type SplTokenDecodeResult<T> =
  | {
      readonly status: "DECODED";
      readonly value: T;
      readonly errorCode: null;
    }
  | {
      readonly status: "EXTENSIONS_UNINSPECTED";
      readonly value: T;
      readonly errorCode: null;
    }
  | {
      readonly status: "ERROR";
      readonly value: null;
      readonly errorCode: SplTokenDecodeErrorCode;
    };

interface DecodedTokenBase {
  readonly address: string;
  readonly tokenProgramId: string;
  readonly programKind: SplTokenProgramKind;
  readonly extensionState: TokenExtensionState;
  /**
   * True means the fixed base state was parsed and no extension bytes remain uninspected.
   * It does not mean the token is safe, liquid, transferable, or suitable for trading.
   */
  readonly baseStateEligibleForIdentityEvidence: boolean;
}

export interface DecodedSplTokenMint extends DecodedTokenBase {
  readonly kind: "MINT";
  readonly mintAuthority: string | null;
  readonly supply: string;
  readonly decimals: number;
  readonly initialized: boolean;
  readonly freezeAuthority: string | null;
}

export interface DecodedSplTokenAccount extends DecodedTokenBase {
  readonly kind: "TOKEN_ACCOUNT";
  readonly mint: string;
  /** Authority stored in the token account base state; distinct from program owner. */
  readonly authority: string;
  readonly amount: string;
  readonly delegate: string | null;
  readonly state: TokenAccountState;
  readonly nativeReserveLamports: string | null;
  readonly delegatedAmount: string;
  readonly closeAuthority: string | null;
}

function error<T>(errorCode: SplTokenDecodeErrorCode): SplTokenDecodeResult<T> {
  return { status: "ERROR", value: null, errorCode };
}

function decodeBase64Strict(input: string): Uint8Array | null {
  if (input.length > Math.ceil(MAX_TOKEN_DATA_BYTES / 3) * 4 ||
      input.length % 4 !== 0 ||
      !CANONICAL_BASE64_PATTERN.test(input)) {
    return null;
  }
  let binary: string;
  try {
    binary = globalThis.atob(input);
  } catch {
    return null;
  }
  if (binary.length > MAX_TOKEN_DATA_BYTES) return null;
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  // Require canonical base64, not just a permissively decoded input.
  let encoded = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset]!;
    const hasB = offset + 1 < bytes.length;
    const hasC = offset + 2 < bytes.length;
    const b = hasB ? bytes[offset + 1]! : 0;
    const c = hasC ? bytes[offset + 2]! : 0;
    encoded += alphabet[a >> 2];
    encoded += alphabet[((a & 3) << 4) | (b >> 4)];
    encoded += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : "=";
    encoded += hasC ? alphabet[c & 63] : "=";
  }
  return encoded === input ? bytes : null;
}

function bytesToBase58(bytes: Uint8Array): string | null {
  if (bytes.length !== 32) return null;
  let hex = "";
  let leadingZeroes = 0;
  let sawNonZero = false;
  for (const byte of bytes) {
    if (!sawNonZero && byte === 0) leadingZeroes += 1;
    else sawNonZero = true;
    hex += byte.toString(16).padStart(2, "0");
  }
  let value = BigInt("0x" + (hex.length === 0 ? "0" : hex));
  let encoded = "";
  while (value > 0n) {
    const remainder = Number(value % 58n);
    encoded = BASE58_ALPHABET[remainder]! + encoded;
    value /= 58n;
  }
  const address = "1".repeat(leadingZeroes) + encoded;
  return isSolanaPublicKey(address) ? address : null;
}

function readU32LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return bytes[offset]! +
    bytes[offset + 1]! * 0x100 +
    bytes[offset + 2]! * 0x10000 +
    bytes[offset + 3]! * 0x1000000;
}

function readU64LE(bytes: Uint8Array, offset: number): string | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  let value = 0n;
  for (let index = 7; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]!);
  }
  return value.toString(10);
}

function readPubkey(bytes: Uint8Array, offset: number): string | null {
  if (offset < 0 || offset + 32 > bytes.length) return null;
  return bytesToBase58(bytes.slice(offset, offset + 32));
}

interface OptionalPubkey {
  readonly valid: boolean;
  readonly value: string | null;
}

function readCOptionPubkey(bytes: Uint8Array, offset: number): OptionalPubkey {
  const tag = readU32LE(bytes, offset);
  if (tag !== 0 && tag !== 1) return { valid: false, value: null };
  if (tag === 0) return { valid: true, value: null };
  const value = readPubkey(bytes, offset + 4);
  return { valid: value !== null, value };
}

interface OptionalU64 {
  readonly valid: boolean;
  readonly value: string | null;
}

function readCOptionU64(bytes: Uint8Array, offset: number): OptionalU64 {
  const tag = readU32LE(bytes, offset);
  if (tag !== 0 && tag !== 1) return { valid: false, value: null };
  if (tag === 0) return { valid: true, value: null };
  const value = readU64LE(bytes, offset + 4);
  return { valid: value !== null, value };
}

function decodeInput(
  account: SolanaRpcRawAccount
): { readonly bytes: Uint8Array; readonly programId: string; readonly kind: SplTokenProgramKind } | SplTokenDecodeErrorCode {
  if (typeof account !== "object" || account === null ||
      typeof account.address !== "string" ||
      !isSolanaPublicKey(account.address) ||
      typeof account.exists !== "boolean" ||
      (account.executable !== null && typeof account.executable !== "boolean")) {
    return "ACCOUNT_ENVELOPE_INVALID";
  }
  if (!account.exists) return "ACCOUNT_MISSING";
  if (account.executable !== false ||
      typeof account.ownerProgramId !== "string" ||
      !isSolanaPublicKey(account.ownerProgramId)) {
    return "ACCOUNT_ENVELOPE_INVALID";
  }
  let kind: SplTokenProgramKind;
  if (account.ownerProgramId === SPL_TOKEN_PROGRAM_ID) kind = "SPL_TOKEN";
  else if (account.ownerProgramId === SPL_TOKEN_2022_PROGRAM_ID) kind = "TOKEN_2022";
  else return "UNSUPPORTED_TOKEN_PROGRAM";
  if (typeof account.dataBase64 !== "string") return "TOKEN_DATA_MISSING";
  const bytes = decodeBase64Strict(account.dataBase64);
  if (bytes === null) {
    if (account.dataBase64.length > Math.ceil(MAX_TOKEN_DATA_BYTES / 3) * 4) {
      return "TOKEN_DATA_TOO_LARGE";
    }
    return "INVALID_BASE64";
  }
  if (!Number.isSafeInteger(account.space) || account.space !== bytes.length) {
    return "ACCOUNT_SPACE_MISMATCH";
  }
  return { bytes, programId: account.ownerProgramId, kind };
}

function prepareBaseState(
  input: ReturnType<typeof decodeInput>,
  baseLength: number,
  expectedToken2022AccountType: number
): { readonly bytes: Uint8Array; readonly programId: string; readonly kind: SplTokenProgramKind; readonly extensionState: TokenExtensionState } | SplTokenDecodeErrorCode {
  if (typeof input === "string") return input;
  const { bytes, programId, kind } = input;
  if (kind === "SPL_TOKEN") {
    if (bytes.length !== baseLength) return "INVALID_DATA_LENGTH";
    return { bytes, programId, kind, extensionState: "NONE" };
  }
  if (bytes.length < baseLength) return "INVALID_DATA_LENGTH";
  if (bytes.length === baseLength) {
    return { bytes, programId, kind, extensionState: "NONE" };
  }
  // Token-2022 extended accounts are padded to the 165-byte account base length,
  // followed by a one-byte account type and TLV data.
  if (bytes.length < EXTENDED_ACCOUNT_TYPE_OFFSET + 1) return "INVALID_DATA_LENGTH";
  for (let index = baseLength; index < EXTENDED_ACCOUNT_TYPE_OFFSET; index += 1) {
    if (bytes[index] !== 0) return "INVALID_TOKEN_2022_PADDING";
  }
  if (bytes[EXTENDED_ACCOUNT_TYPE_OFFSET] !== expectedToken2022AccountType) {
    return "INVALID_TOKEN_2022_ACCOUNT_TYPE";
  }
  return { bytes, programId, kind, extensionState: "PRESENT_UNINSPECTED" };
}

/**
 * Decodes only the fixed base SPL Token mint fields. Token-2022 extension TLV
 * data is not decoded here; any non-empty extension area is reported as
 * PRESENT_UNINSPECTED and is ineligible for identity evidence.
 *
 * Authoritative layout: 82-byte mint base state; 165-byte account base state.
 */
export function decodeSplTokenMint(account: SolanaRpcRawAccount): SplTokenDecodeResult<DecodedSplTokenMint> {
  const input = decodeInput(account);
  const prepared = prepareBaseState(input, BASE_MINT_LENGTH, TOKEN_2022_MINT_ACCOUNT_TYPE);
  if (typeof prepared === "string") return error(prepared);

  const bytes = prepared.bytes;
  const mintAuthority = readCOptionPubkey(bytes, 0);
  const supply = readU64LE(bytes, 36);
  const decimals = bytes[44]!;
  const initializedByte = bytes[45]!;
  const freezeAuthority = readCOptionPubkey(bytes, 46);
  if (!mintAuthority.valid || !freezeAuthority.valid) return error("INVALID_OPTION_TAG");
  if (supply === null) return error("INVALID_DATA_LENGTH");
  if (initializedByte !== 0 && initializedByte !== 1) return error("INVALID_INITIALIZATION_STATE");
  if (mintAuthority.value !== null && !isSolanaPublicKey(mintAuthority.value)) return error("INVALID_PUBLIC_KEY_BYTES");
  if (freezeAuthority.value !== null && !isSolanaPublicKey(freezeAuthority.value)) return error("INVALID_PUBLIC_KEY_BYTES");

  const value: DecodedSplTokenMint = {
    kind: "MINT",
    address: account.address,
    tokenProgramId: prepared.programId,
    programKind: prepared.kind,
    mintAuthority: mintAuthority.value,
    supply,
    decimals,
    initialized: initializedByte === 1,
    freezeAuthority: freezeAuthority.value,
    extensionState: prepared.extensionState,
    baseStateEligibleForIdentityEvidence:
      prepared.extensionState === "NONE" && initializedByte === 1
  };
  return prepared.extensionState === "NONE"
    ? { status: "DECODED", value, errorCode: null }
    : { status: "EXTENSIONS_UNINSPECTED", value, errorCode: null };
}

/** Decodes the fixed 165-byte SPL Token account prefix without floating-point conversions. */
export function decodeSplTokenAccount(account: SolanaRpcRawAccount): SplTokenDecodeResult<DecodedSplTokenAccount> {
  const input = decodeInput(account);
  const prepared = prepareBaseState(input, BASE_TOKEN_ACCOUNT_LENGTH, TOKEN_2022_TOKEN_ACCOUNT_TYPE);
  if (typeof prepared === "string") return error(prepared);

  const bytes = prepared.bytes;
  const mint = readPubkey(bytes, 0);
  const authority = readPubkey(bytes, 32);
  const amount = readU64LE(bytes, 64);
  const delegate = readCOptionPubkey(bytes, 72);
  const stateByte = bytes[108]!;
  const nativeReserve = readCOptionU64(bytes, 109);
  const delegatedAmount = readU64LE(bytes, 121);
  const closeAuthority = readCOptionPubkey(bytes, 129);
  if (mint === null || authority === null) return error("INVALID_PUBLIC_KEY_BYTES");
  if (amount === null || delegatedAmount === null) return error("INVALID_DATA_LENGTH");
  if (!delegate.valid || !nativeReserve.valid || !closeAuthority.valid) return error("INVALID_OPTION_TAG");
  if (stateByte !== 0 && stateByte !== 1 && stateByte !== 2) return error("INVALID_INITIALIZATION_STATE");

  const state: TokenAccountState = stateByte === 0
    ? "UNINITIALIZED"
    : stateByte === 1
      ? "INITIALIZED"
      : "FROZEN";
  const value: DecodedSplTokenAccount = {
    kind: "TOKEN_ACCOUNT",
    address: account.address,
    tokenProgramId: prepared.programId,
    programKind: prepared.kind,
    mint,
    authority,
    amount,
    delegate: delegate.value,
    state,
    nativeReserveLamports: nativeReserve.value,
    delegatedAmount,
    closeAuthority: closeAuthority.value,
    extensionState: prepared.extensionState,
    baseStateEligibleForIdentityEvidence:
      prepared.extensionState === "NONE" && state === "INITIALIZED"
  };
  return prepared.extensionState === "NONE"
    ? { status: "DECODED", value, errorCode: null }
    : { status: "EXTENSIONS_UNINSPECTED", value, errorCode: null };
}
