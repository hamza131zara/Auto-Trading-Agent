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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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


export type Token2022StateKind = "MINT" | "TOKEN_ACCOUNT";

export interface Token2022ExtensionEntry {
  /** Raw extension enum value from the TLV header; it is not a safety classification. */
  readonly typeCode: number;
  readonly length: number;
  /** Byte offset in the decoded account data; the payload itself is not returned. */
  readonly valueOffset: number;
}

export type Token2022TlvErrorCode =
  | SplTokenDecodeErrorCode
  | "NO_EXTENSION_ENTRIES"
  | "INVALID_TLV_HEADER"
  | "TLV_LENGTH_OUT_OF_BOUNDS"
  | "DUPLICATE_EXTENSION_TYPE"
  | "INVALID_TLV_TERMINATOR";

export type Token2022ExtensionLayoutResult =
  | {
      readonly status: "NO_EXTENSIONS";
      readonly address: string;
      readonly accountKind: Token2022StateKind;
      readonly extensions: readonly [];
      readonly baseStateEligibleForIdentityEvidence: false;
      readonly errorCode: null;
    }
  | {
      readonly status: "INSPECTED";
      readonly address: string;
      readonly accountKind: Token2022StateKind;
      readonly extensions: readonly Token2022ExtensionEntry[];
      readonly terminatedByUninitializedType: boolean;
      readonly trailingZeroPaddingBytes: number;
      /** Even structurally valid extension TLVs need a separate semantic policy. */
      readonly baseStateEligibleForIdentityEvidence: false;
      readonly errorCode: null;
    }
  | {
      readonly status: "ERROR";
      readonly address: string | null;
      readonly accountKind: Token2022StateKind;
      readonly extensions: readonly [];
      readonly baseStateEligibleForIdentityEvidence: false;
      readonly errorCode: Token2022TlvErrorCode;
    };

function readU16LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 2 > bytes.length) return null;
  return bytes[offset]! + bytes[offset + 1]! * 0x100;
}

/**
 * Validates the structural Token-2022 TLV framing only. It returns numeric
 * extension IDs and offsets, never extension values, and never classifies the
 * semantic/safety effect of an extension. Any account with extension entries
 * remains ineligible for on-chain identity evidence until a separately reviewed
 * extension policy validates all known and unknown extension semantics.
 */
export function inspectToken2022ExtensionLayout(
  account: SolanaRpcRawAccount,
  accountKind: Token2022StateKind
): Token2022ExtensionLayoutResult {
  const fail = (errorCode: Token2022TlvErrorCode): Token2022ExtensionLayoutResult => ({
    status: "ERROR",
    address: typeof account?.address === "string" ? account.address : null,
    accountKind,
    extensions: [],
    baseStateEligibleForIdentityEvidence: false,
    errorCode
  });

  if (accountKind !== "MINT" && accountKind !== "TOKEN_ACCOUNT") {
    return fail("ACCOUNT_ENVELOPE_INVALID");
  }
  const input = decodeInput(account);
  if (typeof input === "string") return fail(input);
  if (input.kind !== "TOKEN_2022" || input.programId !== SPL_TOKEN_2022_PROGRAM_ID) {
    return fail("UNSUPPORTED_TOKEN_PROGRAM");
  }

  const baseLength = accountKind === "MINT" ? BASE_MINT_LENGTH : BASE_TOKEN_ACCOUNT_LENGTH;
  const expectedType = accountKind === "MINT"
    ? TOKEN_2022_MINT_ACCOUNT_TYPE
    : TOKEN_2022_TOKEN_ACCOUNT_TYPE;
  const prepared = prepareBaseState(input, baseLength, expectedType);
  if (typeof prepared === "string") return fail(prepared);
  if (prepared.extensionState === "NONE") {
    return {
      status: "NO_EXTENSIONS",
      address: account.address,
      accountKind,
      extensions: [],
      // Layout absence does not validate base state; the base decoder must run separately.
      baseStateEligibleForIdentityEvidence: false,
      errorCode: null
    };
  }

  const bytes = prepared.bytes;
  let offset = EXTENDED_ACCOUNT_TYPE_OFFSET + 1;
  const extensions: Token2022ExtensionEntry[] = [];
  const seen = new Set<number>();
  let terminatedByUninitializedType = false;
  let trailingZeroPaddingBytes = 0;

  while (offset < bytes.length) {
    const remaining = bytes.length - offset;
    if (remaining < 4) {
      for (let index = offset; index < bytes.length; index += 1) {
        if (bytes[index] !== 0) return fail("INVALID_TLV_HEADER");
      }
      trailingZeroPaddingBytes = remaining;
      offset = bytes.length;
      break;
    }

    const typeCode = readU16LE(bytes, offset);
    const length = readU16LE(bytes, offset + 2);
    if (typeCode === null || length === null) return fail("INVALID_TLV_HEADER");

    if (typeCode === 0) {
      if (length !== 0) return fail("INVALID_TLV_TERMINATOR");
      for (let index = offset + 4; index < bytes.length; index += 1) {
        if (bytes[index] !== 0) return fail("INVALID_TLV_TERMINATOR");
      }
      terminatedByUninitializedType = true;
      trailingZeroPaddingBytes = bytes.length - (offset + 4);
      offset = bytes.length;
      break;
    }

    if (seen.has(typeCode)) return fail("DUPLICATE_EXTENSION_TYPE");
    const valueOffset = offset + 4;
    const valueEnd = valueOffset + length;
    if (valueEnd > bytes.length) return fail("TLV_LENGTH_OUT_OF_BOUNDS");

    extensions.push({ typeCode, length, valueOffset });
    seen.add(typeCode);
    offset = valueEnd;
  }

  if (extensions.length === 0) return fail("NO_EXTENSION_ENTRIES");
  return {
    status: "INSPECTED",
    address: account.address,
    accountKind,
    extensions,
    terminatedByUninitializedType,
    trailingZeroPaddingBytes,
    baseStateEligibleForIdentityEvidence: false,
    errorCode: null
  };
}


export type Token2022ExtensionImpact =
  | "TRANSFER_FEE_OR_WITHHELD_VALUE"
  | "MINT_LIFECYCLE_AUTHORITY"
  | "CONFIDENTIAL_TRANSFER_STATE"
  | "DEFAULT_ACCOUNT_STATE"
  | "ACCOUNT_AUTHORITY_CONSTRAINT"
  | "REQUIRED_TRANSFER_MEMO"
  | "TRANSFER_RESTRICTION"
  | "ACCRUAL_OR_UI_AMOUNT_SEMANTICS"
  | "CPI_OPERATION_CONSTRAINT"
  | "PERMANENT_DELEGATE_AUTHORITY"
  | "TRANSFER_HOOK_PROGRAM"
  | "CONFIDENTIAL_FEE_STATE"
  | "METADATA_POINTER_OR_CONTENT"
  | "TOKEN_GROUP_LINKAGE"
  | "CONFIDENTIAL_SUPPLY_CONTROL"
  | "PAUSE_CONTROL"
  | "PERMISSIONED_BURN_CONTROL";

export interface KnownToken2022ExtensionDefinition {
  readonly typeCode: number;
  readonly name: string;
  readonly validAccountKind: Token2022StateKind;
  readonly impact: Token2022ExtensionImpact;
  readonly reviewRequirement: "PHASE_7_REVIEW_REQUIRED";
  readonly semanticSource: "spl-token-2022-interface@3.1.2";
}

/**
 * Snapshot of the 29-variant ExtensionType enum in
 * spl-token-2022-interface 3.1.2. This is an inventory for fail-closed routing,
 * not an executable allowlist and not a judgment that any extension is safe.
 * Refresh this map whenever the upstream enum/version changes.
 */
export const TOKEN2022_EXTENSION_SEMANTICS: readonly KnownToken2022ExtensionDefinition[] = [
  { typeCode: 1, name: "TransferFeeConfig", validAccountKind: "MINT", impact: "TRANSFER_FEE_OR_WITHHELD_VALUE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 2, name: "TransferFeeAmount", validAccountKind: "TOKEN_ACCOUNT", impact: "TRANSFER_FEE_OR_WITHHELD_VALUE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 3, name: "MintCloseAuthority", validAccountKind: "MINT", impact: "MINT_LIFECYCLE_AUTHORITY", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 4, name: "ConfidentialTransferMint", validAccountKind: "MINT", impact: "CONFIDENTIAL_TRANSFER_STATE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 5, name: "ConfidentialTransferAccount", validAccountKind: "TOKEN_ACCOUNT", impact: "CONFIDENTIAL_TRANSFER_STATE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 6, name: "DefaultAccountState", validAccountKind: "MINT", impact: "DEFAULT_ACCOUNT_STATE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 7, name: "ImmutableOwner", validAccountKind: "TOKEN_ACCOUNT", impact: "ACCOUNT_AUTHORITY_CONSTRAINT", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 8, name: "MemoTransfer", validAccountKind: "TOKEN_ACCOUNT", impact: "REQUIRED_TRANSFER_MEMO", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 9, name: "NonTransferable", validAccountKind: "MINT", impact: "TRANSFER_RESTRICTION", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 10, name: "InterestBearingConfig", validAccountKind: "MINT", impact: "ACCRUAL_OR_UI_AMOUNT_SEMANTICS", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 11, name: "CpiGuard", validAccountKind: "TOKEN_ACCOUNT", impact: "CPI_OPERATION_CONSTRAINT", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 12, name: "PermanentDelegate", validAccountKind: "MINT", impact: "PERMANENT_DELEGATE_AUTHORITY", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 13, name: "NonTransferableAccount", validAccountKind: "TOKEN_ACCOUNT", impact: "TRANSFER_RESTRICTION", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 14, name: "TransferHook", validAccountKind: "MINT", impact: "TRANSFER_HOOK_PROGRAM", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 15, name: "TransferHookAccount", validAccountKind: "TOKEN_ACCOUNT", impact: "TRANSFER_HOOK_PROGRAM", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 16, name: "ConfidentialTransferFeeConfig", validAccountKind: "MINT", impact: "CONFIDENTIAL_FEE_STATE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 17, name: "ConfidentialTransferFeeAmount", validAccountKind: "TOKEN_ACCOUNT", impact: "CONFIDENTIAL_FEE_STATE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 18, name: "MetadataPointer", validAccountKind: "MINT", impact: "METADATA_POINTER_OR_CONTENT", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 19, name: "TokenMetadata", validAccountKind: "MINT", impact: "METADATA_POINTER_OR_CONTENT", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 20, name: "GroupPointer", validAccountKind: "MINT", impact: "TOKEN_GROUP_LINKAGE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 21, name: "TokenGroup", validAccountKind: "MINT", impact: "TOKEN_GROUP_LINKAGE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 22, name: "GroupMemberPointer", validAccountKind: "MINT", impact: "TOKEN_GROUP_LINKAGE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 23, name: "TokenGroupMember", validAccountKind: "MINT", impact: "TOKEN_GROUP_LINKAGE", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 24, name: "ConfidentialMintBurn", validAccountKind: "MINT", impact: "CONFIDENTIAL_SUPPLY_CONTROL", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 25, name: "ScaledUiAmount", validAccountKind: "MINT", impact: "ACCRUAL_OR_UI_AMOUNT_SEMANTICS", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 26, name: "Pausable", validAccountKind: "MINT", impact: "PAUSE_CONTROL", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 27, name: "PausableAccount", validAccountKind: "TOKEN_ACCOUNT", impact: "PAUSE_CONTROL", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" },
  { typeCode: 28, name: "PermissionedBurn", validAccountKind: "MINT", impact: "PERMISSIONED_BURN_CONTROL", reviewRequirement: "PHASE_7_REVIEW_REQUIRED", semanticSource: "spl-token-2022-interface@3.1.2" }
] as const;

export interface Token2022ExtensionPolicyEntry {
  readonly typeCode: number;
  readonly name: string | null;
  readonly disposition: "KNOWN_REQUIRES_PHASE_7_REVIEW" | "UNKNOWN_EXTENSION_BLOCKED" | "INVALID_ACCOUNT_KIND";
  readonly impact: Token2022ExtensionImpact | "UNKNOWN";
}

export type Token2022ExtensionPolicyResult =
  | {
      readonly status: "NO_EXTENSIONS";
      readonly address: string;
      readonly accountKind: Token2022StateKind;
      readonly entries: readonly [];
      readonly extensionPolicySatisfied: true;
      /** Base-state decoding and the rest of the identity gate must still pass. */
      readonly identityEvidenceEligible: false;
    }
  | {
      readonly status: "BLOCKED";
      readonly address: string;
      readonly accountKind: Token2022StateKind;
      readonly entries: readonly Token2022ExtensionPolicyEntry[];
      readonly extensionPolicySatisfied: false;
      readonly identityEvidenceEligible: false;
      readonly reasonCodes: readonly string[];
    }
  | {
      readonly status: "INVALID_INPUT";
      readonly address: string | null;
      readonly accountKind: Token2022StateKind;
      readonly entries: readonly [];
      readonly extensionPolicySatisfied: false;
      readonly identityEvidenceEligible: false;
      readonly reasonCodes: readonly string[];
    };

/**
 * Fail-closed semantic routing for the official ExtensionType enum snapshot.
 * Known extensions are named and categorized, but none is auto-approved.
 * Unknown/future IDs and wrong account-kind usage are blocked. Full byte-level
 * extension decoding and token-risk evaluation remain separate Phase 7 work.
 */
export function assessToken2022ExtensionPolicy(
  layout: Token2022ExtensionLayoutResult
): Token2022ExtensionPolicyResult {
  if (!isRecord(layout) ||
      (layout.status !== "NO_EXTENSIONS" && layout.status !== "INSPECTED") ||
      typeof layout.address !== "string" ||
      !isSolanaPublicKey(layout.address) ||
      (layout.accountKind !== "MINT" && layout.accountKind !== "TOKEN_ACCOUNT") ||
      !Array.isArray(layout.extensions)) {
    return {
      status: "INVALID_INPUT",
      address: isRecord(layout) && typeof layout.address === "string" ? layout.address : null,
      accountKind: isRecord(layout) && layout.accountKind === "TOKEN_ACCOUNT" ? "TOKEN_ACCOUNT" : "MINT",
      entries: [],
      extensionPolicySatisfied: false,
      identityEvidenceEligible: false,
      reasonCodes: ["INVALID_EXTENSION_LAYOUT"]
    };
  }

  if (layout.status === "NO_EXTENSIONS") {
    if (layout.extensions.length !== 0 || layout.errorCode !== null) {
      return {
        status: "INVALID_INPUT",
        address: layout.address,
        accountKind: layout.accountKind,
        entries: [],
        extensionPolicySatisfied: false,
        identityEvidenceEligible: false,
        reasonCodes: ["INCONSISTENT_NO_EXTENSION_LAYOUT"]
      };
    }
    return {
      status: "NO_EXTENSIONS",
      address: layout.address,
      accountKind: layout.accountKind,
      entries: [],
      extensionPolicySatisfied: true,
      identityEvidenceEligible: false
    };
  }

  if (layout.extensions.length === 0 ||
      layout.errorCode !== null ||
      layout.extensions.some((entry) =>
        !isRecord(entry) ||
        !Number.isSafeInteger(entry.typeCode) ||
        (entry.typeCode as number) <= 0 ||
        !Number.isSafeInteger(entry.length) ||
        (entry.length as number) < 0 ||
        !Number.isSafeInteger(entry.valueOffset) ||
        (entry.valueOffset as number) < 0
      )) {
    return {
      status: "INVALID_INPUT",
      address: layout.address,
      accountKind: layout.accountKind,
      entries: [],
      extensionPolicySatisfied: false,
      identityEvidenceEligible: false,
      reasonCodes: ["INVALID_EXTENSION_ENTRIES"]
    };
  }

  const entries: Token2022ExtensionPolicyEntry[] = [];
  for (const extension of layout.extensions) {
    const definition = TOKEN2022_EXTENSION_SEMANTICS.find((item) => item.typeCode === extension.typeCode);
    if (definition === undefined) {
      entries.push({
        typeCode: extension.typeCode,
        name: null,
        disposition: "UNKNOWN_EXTENSION_BLOCKED",
        impact: "UNKNOWN"
      });
    } else if (definition.validAccountKind !== layout.accountKind) {
      entries.push({
        typeCode: extension.typeCode,
        name: definition.name,
        disposition: "INVALID_ACCOUNT_KIND",
        impact: definition.impact
      });
    } else {
      entries.push({
        typeCode: extension.typeCode,
        name: definition.name,
        disposition: "KNOWN_REQUIRES_PHASE_7_REVIEW",
        impact: definition.impact
      });
    }
  }

  const hasBlockers = entries.some((item) => item.disposition !== "KNOWN_REQUIRES_PHASE_7_REVIEW");
  return {
    status: "BLOCKED",
    address: layout.address,
    accountKind: layout.accountKind,
    entries,
    extensionPolicySatisfied: false,
    identityEvidenceEligible: false,
    reasonCodes: [
      ...(hasBlockers ? ["UNKNOWN_OR_SCOPE_INVALID_EXTENSION"] : []),
      "TOKEN_2022_EXTENSION_REQUIRES_PHASE_7_REVIEW"
    ]
  };
}
