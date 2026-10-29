import {
  assessOnChainIdentityEvidence,
  isSolanaPublicKey,
  validateCanonicalMarketSnapshot,
  type OnChainIdentityAssessment,
  type OnChainIdentityStatus
} from "./index.js";
import {
  decodeSplTokenAccount,
  decodeSplTokenMint,
  inspectToken2022ExtensionLayout,
  assessToken2022ExtensionPolicy,
  SPL_TOKEN_2022_PROGRAM_ID
} from "./solana-token-account-decoder.js";
import type { SolanaRpcRawAccount, SolanaRpcAccountBundle } from "./solana-rpc-reader.js";
import { SolanaRpcAccountReader } from "./solana-rpc-reader.js";

export const RAYDIUM_CPMM_PROGRAM_ID = "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C";
export const RAYDIUM_CPMM_DECODER_ID = "raydium-cp-swap-pool-state";
export const RAYDIUM_CPMM_DECODER_VERSION = "0.1.0";
export const RAYDIUM_CPMM_POOL_STATE_LENGTH = 637;
export const RAYDIUM_CPMM_AMM_CONFIG_LENGTH = 236;

const POOL_STATE_DISCRIMINATOR = new Uint8Array([
  0xf7, 0xed, 0xe3, 0xf5, 0xd7, 0xc3, 0xde, 0x46
]);
const AMM_CONFIG_DISCRIMINATOR = new Uint8Array([
  0xda, 0xf4, 0x21, 0x68, 0xcb, 0xcb, 0x2b, 0x6f
]);
const POOL_STATE_OFFSETS = {
  ammConfig: 8,
  poolCreator: 40,
  token0Vault: 72,
  token1Vault: 104,
  lpMint: 136,
  token0Mint: 168,
  token1Mint: 200,
  token0Program: 232,
  token1Program: 264,
  observationKey: 296,
  authBump: 328,
  status: 329,
  lpMintDecimals: 330,
  mint0Decimals: 331,
  mint1Decimals: 332,
  lpSupply: 333,
  protocolFeesToken0: 341,
  protocolFeesToken1: 349,
  fundFeesToken0: 357,
  fundFeesToken1: 365,
  openTime: 373,
  recentEpoch: 381,
  creatorFeeOn: 389,
  enableCreatorFee: 390,
  padding1: 391,
  creatorFeesToken0: 397,
  creatorFeesToken1: 405,
  padding: 413
} as const;

const AMM_CONFIG_SEED = "amm_config";
const POOL_SEED = "pool";
const POOL_VAULT_SEED = "pool_vault";
const LP_MINT_SEED = "pool_lp_mint";
const OBSERVATION_SEED = "observation";
const AUTHORITY_SEED = "vault_and_lp_mint_auth_seed";
const PDA_MARKER = "ProgramDerivedAddress";
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const BASE58_INDEX = new Map(Array.from(BASE58_ALPHABET, (character, index) => [character, BigInt(index)]));
const UTF8 = new TextEncoder();
const ED25519_P = (1n << 255n) - 19n;

export type RaydiumCpmmPoolDecodeErrorCode =
  | "INVALID_ACCOUNT_ENVELOPE"
  | "POOL_ACCOUNT_MISSING"
  | "WRONG_POOL_PROGRAM_OWNER"
  | "POOL_ACCOUNT_EXECUTABLE"
  | "ACCOUNT_SPACE_MISMATCH"
  | "INVALID_BASE64"
  | "INVALID_DATA_LENGTH"
  | "INVALID_POOL_DISCRIMINATOR"
  | "INVALID_STATUS_FLAGS"
  | "INVALID_BOOLEAN"
  | "INVALID_CREATOR_FEE_MODE"
  | "INVALID_MINT_ORDER"
  | "INVALID_PUBLIC_KEY_BYTES";

export interface RaydiumCpmmPoolState {
  readonly address: string;
  readonly programId: string;
  readonly ammConfig: string;
  readonly poolCreator: string;
  readonly token0Vault: string;
  readonly token1Vault: string;
  readonly lpMint: string;
  readonly token0Mint: string;
  readonly token1Mint: string;
  readonly token0Program: string;
  readonly token1Program: string;
  readonly observationKey: string;
  readonly authBump: number;
  readonly status: number;
  readonly swapsEnabled: boolean;
  readonly depositsEnabled: boolean;
  readonly withdrawalsEnabled: boolean;
  readonly lpMintDecimals: number;
  readonly mint0Decimals: number;
  readonly mint1Decimals: number;
  readonly lpSupply: string;
  readonly protocolFeesToken0: string;
  readonly protocolFeesToken1: string;
  readonly fundFeesToken0: string;
  readonly fundFeesToken1: string;
  readonly openTime: string;
  readonly recentEpoch: string;
  readonly creatorFeeOn: "BOTH_TOKENS" | "TOKEN_0_ONLY" | "TOKEN_1_ONLY";
  readonly enableCreatorFee: boolean;
  readonly padding1Hex: string;
  readonly creatorFeesToken0: string;
  readonly creatorFeesToken1: string;
  readonly paddingHex: string;
  /** Informational only: Raydium's source also supports a signer-created non-PDA pool account. */
  readonly canonicalPoolPdaMatches: boolean | null;
}

export type RaydiumCpmmPoolDecodeResult =
  | { readonly status: "DECODED"; readonly value: RaydiumCpmmPoolState; readonly errorCode: null }
  | { readonly status: "ERROR"; readonly value: null; readonly errorCode: RaydiumCpmmPoolDecodeErrorCode };

export interface RaydiumCpmmAmmConfigState {
  readonly address: string;
  readonly programId: string;
  readonly bump: number;
  readonly disableCreatePool: boolean;
  readonly index: number;
  readonly tradeFeeRate: string;
  readonly protocolFeeRate: string;
  readonly fundFeeRate: string;
  readonly createPoolFee: string;
  readonly protocolOwner: string;
  readonly fundOwner: string;
  readonly creatorFeeRate: string;
  readonly creatorFeeShareRate: string;
}

export type RaydiumCpmmAmmConfigDecodeResult =
  | { readonly status: "DECODED"; readonly value: RaydiumCpmmAmmConfigState; readonly errorCode: null }
  | { readonly status: "ERROR"; readonly value: null; readonly errorCode: RaydiumCpmmPoolDecodeErrorCode };

export interface RaydiumCpmmIdentityReadRequest {
  readonly commitment: "confirmed" | "finalized";
  readonly minContextSlot: number;
  readonly requestId: string;
  readonly signal?: AbortSignal;
}

export type RaydiumCpmmIdentityStatus =
  | "MATCH"
  | "SYNTHETIC_MATCH"
  | "MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "INVALID_INPUT";

export interface RaydiumCpmmIdentityAssessment {
  readonly status: RaydiumCpmmIdentityStatus;
  readonly reasonCodes: readonly string[];
  readonly mismatchFields: readonly string[];
  readonly sourceProviderId: string | null;
  readonly contextSlot: number | null;
  readonly pool: RaydiumCpmmPoolState | null;
  readonly ammConfig: RaydiumCpmmAmmConfigState | null;
  readonly underlyingIdentityAssessment: OnChainIdentityAssessment | null;
  readonly canProceedToIndependentSafetyReview: boolean;
  readonly tradingAuthorized: false;
}

function failDecode(errorCode: RaydiumCpmmPoolDecodeErrorCode): RaydiumCpmmPoolDecodeResult {
  return { status: "ERROR", value: null, errorCode };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase58(input: string): Uint8Array | null {
  if (input.length === 0 || input.length > 64) return null;
  let value = 0n;
  for (const character of input) {
    const digit = BASE58_INDEX.get(character);
    if (digit === undefined) return null;
    value = value * 58n + digit;
  }
  const encodedHex = value.toString(16);
  const normalizedHex = encodedHex.length % 2 === 0 ? encodedHex : "0" + encodedHex;
  const body = value === 0n ? new Uint8Array(0) : hexToBytes(normalizedHex);
  let leadingZeroes = 0;
  while (leadingZeroes < input.length && input[leadingZeroes] === "1") leadingZeroes += 1;
  const bytes = new Uint8Array(leadingZeroes + body.length);
  bytes.set(body, leadingZeroes);
  return encodeBase58(bytes) === input ? bytes : null;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function encodeBase58(bytes: Uint8Array): string {
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let output = "";
  while (value > 0n) {
    const remainder = Number(value % 58n);
    output = BASE58_ALPHABET[remainder]! + output;
    value /= 58n;
  }
  return "1".repeat(leadingZeroes) + output;
}

function publicKeyFromBytes(bytes: Uint8Array, offset: number): string | null {
  if (offset < 0 || offset + 32 > bytes.length) return null;
  const key = encodeBase58(bytes.slice(offset, offset + 32));
  return isSolanaPublicKey(key) ? key : null;
}

function readU32LE(bytes: Uint8Array, offset: number): number | null {
  if (offset < 0 || offset + 4 > bytes.length) return null;
  return (bytes[offset]! +
    bytes[offset + 1]! * 0x100 +
    bytes[offset + 2]! * 0x10000 +
    bytes[offset + 3]! * 0x1000000) >>> 0;
}

function readU64LE(bytes: Uint8Array, offset: number): string | null {
  if (offset < 0 || offset + 8 > bytes.length) return null;
  let value = 0n;
  for (let index = 7; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]!);
  }
  return value.toString(10);
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function decodeBase64Strict(input: string): Uint8Array | null {
  if (input.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(input)) return null;
  let binary: string;
  try {
    binary = globalThis.atob(input);
  } catch {
    return null;
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  let canonical = "";
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  for (let offset = 0; offset < bytes.length; offset += 3) {
    const a = bytes[offset]!;
    const hasB = offset + 1 < bytes.length;
    const hasC = offset + 2 < bytes.length;
    const b = hasB ? bytes[offset + 1]! : 0;
    const c = hasC ? bytes[offset + 2]! : 0;
    canonical += alphabet[a >> 2];
    canonical += alphabet[((a & 3) << 4) | (b >> 4)];
    canonical += hasB ? alphabet[((b & 15) << 2) | (c >> 6)] : "=";
    canonical += hasC ? alphabet[c & 63] : "=";
  }
  return canonical === input ? bytes : null;
}

function mod(value: bigint, modulus = ED25519_P): bigint {
  const result = value % modulus;
  return result < 0n ? result + modulus : result;
}

function modPow(base: bigint, exponent: bigint, modulus = ED25519_P): bigint {
  let value = mod(base, modulus);
  let power = exponent;
  let result = 1n;
  while (power > 0n) {
    if ((power & 1n) === 1n) result = (result * value) % modulus;
    value = (value * value) % modulus;
    power >>= 1n;
  }
  return result;
}

const ED25519_D = mod(-121665n * modPow(121666n, ED25519_P - 2n));
const ED25519_SQRT_M1 = modPow(2n, (ED25519_P - 1n) / 4n);

/** Solana rejects PDAs that decompress to a valid Edwards25519 curve point. */
function isEd25519CurvePoint(compressed: Uint8Array): boolean {
  if (compressed.length !== 32) return false;
  const bytes = compressed.slice();
  const sign = bytes[31]! >>> 7;
  bytes[31] = bytes[31]! & 0x7f;
  let y = 0n;
  for (let index = 31; index >= 0; index -= 1) y = (y << 8n) | BigInt(bytes[index]!);
  if (y >= ED25519_P) return false;
  const ySquared = mod(y * y);
  const numerator = mod(ySquared - 1n);
  const denominator = mod(ED25519_D * ySquared + 1n);
  if (denominator === 0n) return false;
  const xSquared = mod(numerator * modPow(denominator, ED25519_P - 2n));
  let x = modPow(xSquared, (ED25519_P + 3n) / 8n);
  if (mod(x * x) !== xSquared) x = mod(x * ED25519_SQRT_M1);
  if (mod(x * x) !== xSquared) return false;
  if (x === 0n && sign === 1) return false;
  return true;
}

function concatenate(parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((total, part) => total + part.length, 0);
  const joined = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    joined.set(part, offset);
    offset += part.length;
  }
  return joined;
}

async function createProgramAddress(
  seeds: readonly Uint8Array[],
  programId: string
): Promise<string | null> {
  if (seeds.length > 16 || seeds.some((seed) => seed.length > 32)) {
    throw new RangeError("Solana PDA seeds exceed the protocol bounds");
  }
  const programBytes = decodeBase58(programId);
  if (programBytes === null || programBytes.length !== 32) {
    throw new TypeError("programId must be a 32-byte Solana public key");
  }
  const digestInput = concatenate([
    ...seeds,
    programBytes,
    UTF8.encode(PDA_MARKER)
  ]);
  const digest = new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", digestInput));
  if (isEd25519CurvePoint(digest)) return null;
  return encodeBase58(digest);
}

export async function findSolanaProgramAddress(
  seeds: readonly (string | Uint8Array)[],
  programId: string
): Promise<{ readonly address: string; readonly bump: number }> {
  if (seeds.length > 15) throw new RangeError("At most 15 non-bump seeds may be supplied");
  const seedBytes = seeds.map((seed) => typeof seed === "string" ? UTF8.encode(seed) : seed);
  if (seedBytes.some((seed) => seed.length > 32)) throw new RangeError("Each PDA seed must be at most 32 bytes");
  for (let bump = 255; bump >= 0; bump -= 1) {
    const address = await createProgramAddress([...seedBytes, new Uint8Array([bump])], programId);
    if (address !== null) return { address, bump };
  }
  throw new Error("No viable Solana program-derived address found");
}

export async function deriveRaydiumCpmmAuthorityPda(): Promise<{ readonly address: string; readonly bump: number }> {
  return findSolanaProgramAddress([AUTHORITY_SEED], RAYDIUM_CPMM_PROGRAM_ID);
}

export async function deriveRaydiumCpmmAmmConfigPda(index: number): Promise<{ readonly address: string; readonly bump: number }> {
  if (!Number.isSafeInteger(index) || index < 0 || index > 0xffff) {
    throw new RangeError("Raydium CPMM AMM config index must be an unsigned 16-bit integer");
  }
  // The upstream Rust source uses index.to_be_bytes() for the PDA seed.
  return findSolanaProgramAddress([
    AMM_CONFIG_SEED,
    new Uint8Array([(index >>> 8) & 0xff, index & 0xff])
  ], RAYDIUM_CPMM_PROGRAM_ID);
}

export async function deriveRaydiumCpmmLpMintPda(poolAddress: string): Promise<{ readonly address: string; readonly bump: number }> {
  if (!isSolanaPublicKey(poolAddress)) throw new TypeError("poolAddress must be a Solana public key");
  return findSolanaProgramAddress([LP_MINT_SEED, poolAddress], RAYDIUM_CPMM_PROGRAM_ID);
}

export async function deriveRaydiumCpmmObservationPda(poolAddress: string): Promise<{ readonly address: string; readonly bump: number }> {
  if (!isSolanaPublicKey(poolAddress)) throw new TypeError("poolAddress must be a Solana public key");
  return findSolanaProgramAddress([OBSERVATION_SEED, poolAddress], RAYDIUM_CPMM_PROGRAM_ID);
}

export async function deriveRaydiumCpmmVaultPda(
  poolAddress: string,
  tokenMint: string
): Promise<{ readonly address: string; readonly bump: number }> {
  if (!isSolanaPublicKey(poolAddress) || !isSolanaPublicKey(tokenMint)) {
    throw new TypeError("poolAddress and tokenMint must be Solana public keys");
  }
  return findSolanaProgramAddress([POOL_VAULT_SEED, poolAddress, tokenMint], RAYDIUM_CPMM_PROGRAM_ID);
}

export async function deriveRaydiumCpmmPoolPda(
  ammConfig: string,
  token0Mint: string,
  token1Mint: string
): Promise<{ readonly address: string; readonly bump: number }> {
  const config = decodeBase58(ammConfig);
  const token0 = decodeBase58(token0Mint);
  const token1 = decodeBase58(token1Mint);
  if (config === null || config.length !== 32 ||
      token0 === null || token0.length !== 32 ||
      token1 === null || token1.length !== 32) {
    throw new TypeError("AMM config and mint addresses must be Solana public keys");
  }
  if (compareBytes(token0, token1) >= 0) {
    throw new TypeError("Raydium CPMM token0 mint must sort before token1 by public-key bytes");
  }
  return findSolanaProgramAddress([POOL_SEED, ammConfig, token0Mint, token1Mint], RAYDIUM_CPMM_PROGRAM_ID);
}

function compareBytes(left: Uint8Array, right: Uint8Array): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return left.length - right.length;
}

export function decodeRaydiumCpmmPool(account: SolanaRpcRawAccount): RaydiumCpmmPoolDecodeResult {
  if (!isRecord(account) ||
      typeof account.address !== "string" ||
      !isSolanaPublicKey(account.address) ||
      typeof account.exists !== "boolean" ||
      (account.ownerProgramId !== null && typeof account.ownerProgramId !== "string") ||
      (account.executable !== null && typeof account.executable !== "boolean") ||
      (account.dataBase64 !== null && typeof account.dataBase64 !== "string") ||
      (account.space !== null && typeof account.space !== "number")) {
    return failDecode("INVALID_ACCOUNT_ENVELOPE");
  }
  if (!account.exists) return failDecode("POOL_ACCOUNT_MISSING");
  if (account.ownerProgramId !== RAYDIUM_CPMM_PROGRAM_ID) return failDecode("WRONG_POOL_PROGRAM_OWNER");
  if (account.executable !== false) return failDecode("POOL_ACCOUNT_EXECUTABLE");
  if (typeof account.dataBase64 !== "string") return failDecode("INVALID_ACCOUNT_ENVELOPE");
  const bytes = decodeBase64Strict(account.dataBase64);
  if (bytes === null) return failDecode("INVALID_BASE64");
  if (account.space !== bytes.length) return failDecode("ACCOUNT_SPACE_MISMATCH");
  if (bytes.length !== RAYDIUM_CPMM_POOL_STATE_LENGTH) return failDecode("INVALID_DATA_LENGTH");
  for (let index = 0; index < POOL_STATE_DISCRIMINATOR.length; index += 1) {
    if (bytes[index] !== POOL_STATE_DISCRIMINATOR[index]) return failDecode("INVALID_POOL_DISCRIMINATOR");
  }

  const keyFields = [
    ["ammConfig", POOL_STATE_OFFSETS.ammConfig],
    ["poolCreator", POOL_STATE_OFFSETS.poolCreator],
    ["token0Vault", POOL_STATE_OFFSETS.token0Vault],
    ["token1Vault", POOL_STATE_OFFSETS.token1Vault],
    ["lpMint", POOL_STATE_OFFSETS.lpMint],
    ["token0Mint", POOL_STATE_OFFSETS.token0Mint],
    ["token1Mint", POOL_STATE_OFFSETS.token1Mint],
    ["token0Program", POOL_STATE_OFFSETS.token0Program],
    ["token1Program", POOL_STATE_OFFSETS.token1Program],
    ["observationKey", POOL_STATE_OFFSETS.observationKey]
  ] as const;
  const keys = new Map<string, string>();
  for (const [name, offset] of keyFields) {
    const publicKey = publicKeyFromBytes(bytes, offset);
    if (publicKey === null) return failDecode("INVALID_PUBLIC_KEY_BYTES");
    keys.set(name, publicKey);
  }
  const token0Bytes = decodeBase58(keys.get("token0Mint")!);
  const token1Bytes = decodeBase58(keys.get("token1Mint")!);
  if (token0Bytes === null || token1Bytes === null) return failDecode("INVALID_PUBLIC_KEY_BYTES");
  if (compareBytes(token0Bytes, token1Bytes) >= 0) return failDecode("INVALID_MINT_ORDER");

  const authBump = bytes[POOL_STATE_OFFSETS.authBump]!;
  const status = bytes[POOL_STATE_OFFSETS.status]!;
  if ((status & ~0x07) !== 0) return failDecode("INVALID_STATUS_FLAGS");
  const enableCreatorFeeByte = bytes[POOL_STATE_OFFSETS.enableCreatorFee]!;
  if (enableCreatorFeeByte !== 0 && enableCreatorFeeByte !== 1) return failDecode("INVALID_BOOLEAN");
  const creatorFeeOnByte = bytes[POOL_STATE_OFFSETS.creatorFeeOn]!;
  if (creatorFeeOnByte !== 0 && creatorFeeOnByte !== 1 && creatorFeeOnByte !== 2) {
    return failDecode("INVALID_CREATOR_FEE_MODE");
  }
  const numberFields = [
    ["lpSupply", POOL_STATE_OFFSETS.lpSupply],
    ["protocolFeesToken0", POOL_STATE_OFFSETS.protocolFeesToken0],
    ["protocolFeesToken1", POOL_STATE_OFFSETS.protocolFeesToken1],
    ["fundFeesToken0", POOL_STATE_OFFSETS.fundFeesToken0],
    ["fundFeesToken1", POOL_STATE_OFFSETS.fundFeesToken1],
    ["openTime", POOL_STATE_OFFSETS.openTime],
    ["recentEpoch", POOL_STATE_OFFSETS.recentEpoch],
    ["creatorFeesToken0", POOL_STATE_OFFSETS.creatorFeesToken0],
    ["creatorFeesToken1", POOL_STATE_OFFSETS.creatorFeesToken1]
  ] as const;
  const values = new Map<string, string>();
  for (const [name, offset] of numberFields) {
    const value = readU64LE(bytes, offset);
    if (value === null) return failDecode("INVALID_DATA_LENGTH");
    values.set(name, value);
  }

  const canonicalPoolPdaMatches: boolean | null = null;
  // A canonical pool PDA is useful provenance, but not required: upstream
  // initialization also permits a signer-created pool account with the same layout.
  // The caller/assessment derives and verifies the PDA when the AMM config is known.
  const value: RaydiumCpmmPoolState = {
    address: account.address,
    programId: RAYDIUM_CPMM_PROGRAM_ID,
    ammConfig: keys.get("ammConfig")!,
    poolCreator: keys.get("poolCreator")!,
    token0Vault: keys.get("token0Vault")!,
    token1Vault: keys.get("token1Vault")!,
    lpMint: keys.get("lpMint")!,
    token0Mint: keys.get("token0Mint")!,
    token1Mint: keys.get("token1Mint")!,
    token0Program: keys.get("token0Program")!,
    token1Program: keys.get("token1Program")!,
    observationKey: keys.get("observationKey")!,
    authBump,
    status,
    swapsEnabled: (status & 0x04) === 0,
    depositsEnabled: (status & 0x01) === 0,
    withdrawalsEnabled: (status & 0x02) === 0,
    lpMintDecimals: bytes[POOL_STATE_OFFSETS.lpMintDecimals]!,
    mint0Decimals: bytes[POOL_STATE_OFFSETS.mint0Decimals]!,
    mint1Decimals: bytes[POOL_STATE_OFFSETS.mint1Decimals]!,
    lpSupply: values.get("lpSupply")!,
    protocolFeesToken0: values.get("protocolFeesToken0")!,
    protocolFeesToken1: values.get("protocolFeesToken1")!,
    fundFeesToken0: values.get("fundFeesToken0")!,
    fundFeesToken1: values.get("fundFeesToken1")!,
    openTime: values.get("openTime")!,
    recentEpoch: values.get("recentEpoch")!,
    creatorFeeOn: creatorFeeOnByte === 0 ? "BOTH_TOKENS" : creatorFeeOnByte === 1 ? "TOKEN_0_ONLY" : "TOKEN_1_ONLY",
    enableCreatorFee: enableCreatorFeeByte === 1,
    padding1Hex: bytesToHex(bytes.slice(POOL_STATE_OFFSETS.padding1, POOL_STATE_OFFSETS.creatorFeesToken0)),
    creatorFeesToken0: values.get("creatorFeesToken0")!,
    creatorFeesToken1: values.get("creatorFeesToken1")!,
    paddingHex: bytesToHex(bytes.slice(POOL_STATE_OFFSETS.padding)),
    canonicalPoolPdaMatches
  };

  return { status: "DECODED", value, errorCode: null };
}

export function decodeRaydiumCpmmAmmConfig(account: SolanaRpcRawAccount): RaydiumCpmmAmmConfigDecodeResult {
  if (!isRecord(account) ||
      typeof account.address !== "string" ||
      !isSolanaPublicKey(account.address) ||
      typeof account.exists !== "boolean" ||
      (account.ownerProgramId !== null && typeof account.ownerProgramId !== "string") ||
      (account.executable !== null && typeof account.executable !== "boolean") ||
      (account.dataBase64 !== null && typeof account.dataBase64 !== "string") ||
      (account.space !== null && typeof account.space !== "number")) {
    return failDecode("INVALID_ACCOUNT_ENVELOPE");
  }
  if (!account.exists) return failDecode("POOL_ACCOUNT_MISSING");
  if (account.ownerProgramId !== RAYDIUM_CPMM_PROGRAM_ID) return failDecode("WRONG_POOL_PROGRAM_OWNER");
  if (account.executable !== false) return failDecode("POOL_ACCOUNT_EXECUTABLE");
  if (typeof account.dataBase64 !== "string") return failDecode("INVALID_ACCOUNT_ENVELOPE");
  const bytes = decodeBase64Strict(account.dataBase64);
  if (bytes === null) return failDecode("INVALID_BASE64");
  if (account.space !== bytes.length) return failDecode("ACCOUNT_SPACE_MISMATCH");
  if (bytes.length !== RAYDIUM_CPMM_AMM_CONFIG_LENGTH) return failDecode("INVALID_DATA_LENGTH");
  for (let index = 0; index < AMM_CONFIG_DISCRIMINATOR.length; index += 1) {
    if (bytes[index] !== AMM_CONFIG_DISCRIMINATOR[index]) return failDecode("INVALID_POOL_DISCRIMINATOR");
  }

  const disableCreatePool = bytes[9]!;
  if (disableCreatePool !== 0 && disableCreatePool !== 1) return failDecode("INVALID_BOOLEAN");
  const index = readU16LE(bytes, 10);
  const protocolOwner = publicKeyFromBytes(bytes, 44);
  const fundOwner = publicKeyFromBytes(bytes, 76);
  const tradeFeeRate = readU64LE(bytes, 12);
  const protocolFeeRate = readU64LE(bytes, 20);
  const fundFeeRate = readU64LE(bytes, 28);
  const createPoolFee = readU64LE(bytes, 36);
  const creatorFeeRate = readU64LE(bytes, 108);
  const creatorFeeShareRate = readU64LE(bytes, 116);
  if (index === null || protocolOwner === null || fundOwner === null ||
      tradeFeeRate === null || protocolFeeRate === null ||
      fundFeeRate === null || createPoolFee === null ||
      creatorFeeRate === null || creatorFeeShareRate === null) {
    return failDecode("INVALID_DATA_LENGTH");
  }
  return {
    status: "DECODED",
    errorCode: null,
    value: {
      address: account.address,
      programId: RAYDIUM_CPMM_PROGRAM_ID,
      bump: bytes[8]!,
      disableCreatePool: disableCreatePool === 1,
      index,
      tradeFeeRate,
      protocolFeeRate,
      fundFeeRate,
      createPoolFee,
      protocolOwner,
      fundOwner,
      creatorFeeRate,
      creatorFeeShareRate
    }
  };
}

function result(
  status: RaydiumCpmmIdentityStatus,
  reasonCodes: readonly string[],
  mismatchFields: readonly string[] = [],
  bundle?: SolanaRpcAccountBundle,
  pool?: RaydiumCpmmPoolState,
  underlyingIdentityAssessment?: OnChainIdentityAssessment,
  canProceedToIndependentSafetyReview = false,
  ammConfig?: RaydiumCpmmAmmConfigState
): RaydiumCpmmIdentityAssessment {
  return {
    status,
    reasonCodes: [...reasonCodes],
    mismatchFields: [...mismatchFields],
    sourceProviderId: bundle?.source.providerId ?? null,
    contextSlot: bundle?.source.contextSlot ?? null,
    pool: pool ?? null,
    ammConfig: ammConfig ?? null,
    underlyingIdentityAssessment: underlyingIdentityAssessment ?? null,
    canProceedToIndependentSafetyReview,
    tradingAuthorized: false
  };
}

function extensionEvidenceBlocked(
  account: SolanaRpcRawAccount,
  kind: "MINT" | "TOKEN_ACCOUNT"
): boolean {
  if (account.ownerProgramId !== SPL_TOKEN_2022_PROGRAM_ID) return false;
  const layout = inspectToken2022ExtensionLayout(account, kind);
  const policy = assessToken2022ExtensionPolicy(layout);
  return policy.status !== "NO_EXTENSIONS" || !policy.extensionPolicySatisfied;
}

/**
 * Builds the exact six-account read request required to inspect a Raydium CPMM
 * pool and its token identities. This only reads; it never selects a production
 * provider and never creates a transaction. Injected fetch results are synthetic
 * through SolanaRpcAccountReader's explicit test boundary.
 */
export async function readRaydiumCpmmIdentityBundle(
  reader: SolanaRpcAccountReader,
  targetInput: unknown,
  request: RaydiumCpmmIdentityReadRequest
): Promise<SolanaRpcAccountBundle> {
  if (!isRecord(targetInput) ||
      !validateCanonicalMarketSnapshot(targetInput).valid ||
      targetInput.cluster !== "mainnet-beta" ||
      typeof targetInput.poolAddress !== "string" ||
      !isSolanaPublicKey(targetInput.poolAddress) ||
      typeof targetInput.baseMint !== "string" ||
      !isSolanaPublicKey(targetInput.baseMint) ||
      typeof targetInput.quoteMint !== "string" ||
      !isSolanaPublicKey(targetInput.quoteMint) ||
      targetInput.baseMint === targetInput.quoteMint ||
      (request.commitment !== "confirmed" && request.commitment !== "finalized") ||
      !Number.isSafeInteger(request.minContextSlot) ||
      request.minContextSlot < 0 ||
      typeof request.requestId !== "string" ||
      !/^[A-Za-z0-9._:-]{1,110}$/.test(request.requestId)) {
    throw new TypeError("Invalid Raydium CPMM identity-read target or request");
  }

  // The pool state contains the AMM-config and LP-mint addresses, so first perform
  // a bounded one-account discovery read, then re-read the complete exact bundle
  // at minContextSlot >= the discovery slot. The returned bundle is only the second
  // response, keeping all evidence consumed by the validator on one shared slot.
  const discovery = await reader.readAccounts({
    addresses: [targetInput.poolAddress],
    commitment: request.commitment,
    minContextSlot: request.minContextSlot,
    requestId: request.requestId + "-discovery",
    ...(request.signal === undefined ? {} : { signal: request.signal })
  });
  const discoveryPool = discovery.accounts[0];
  if (!discoveryPool?.exists) throw new TypeError("Raydium CPMM discovery pool account is missing");
  const decoded = decodeRaydiumCpmmPool(discoveryPool);
  if (decoded.status !== "DECODED") {
    throw new TypeError("Raydium CPMM discovery failed (" + decoded.errorCode + ")");
  }
  const state = decoded.value;
  const targetMatches =
    (state.token0Mint === targetInput.baseMint && state.token1Mint === targetInput.quoteMint) ||
    (state.token0Mint === targetInput.quoteMint && state.token1Mint === targetInput.baseMint);
  if (!targetMatches) throw new TypeError("Raydium CPMM pool mints do not match requested target");

  const lpMint = await deriveRaydiumCpmmLpMintPda(targetInput.poolAddress);
  const baseVault = await deriveRaydiumCpmmVaultPda(targetInput.poolAddress, targetInput.baseMint);
  const quoteVault = await deriveRaydiumCpmmVaultPda(targetInput.poolAddress, targetInput.quoteMint);
  const observation = await deriveRaydiumCpmmObservationPda(targetInput.poolAddress);
  const addresses = [
    targetInput.poolAddress,
    RAYDIUM_CPMM_PROGRAM_ID,
    state.ammConfig,
    lpMint.address,
    targetInput.baseMint,
    targetInput.quoteMint,
    baseVault.address,
    quoteVault.address,
    observation.address
  ];
  if (new Set(addresses).size !== addresses.length) {
    throw new TypeError("Raydium identity account addresses must be distinct");
  }
  return reader.readAccounts({
    addresses,
    commitment: request.commitment,
    minContextSlot: Math.max(request.minContextSlot, discovery.source.contextSlot),
    requestId: request.requestId + "-identity",
    ...(request.signal === undefined ? {} : { signal: request.signal })
  });
}

function isRawAccount(value: unknown): value is SolanaRpcRawAccount {
  return isRecord(value) &&
    typeof value.address === "string" &&
    isSolanaPublicKey(value.address) &&
    typeof value.exists === "boolean" &&
    (value.ownerProgramId === null || typeof value.ownerProgramId === "string") &&
    (value.executable === null || typeof value.executable === "boolean") &&
    (value.dataBase64 === null || typeof value.dataBase64 === "string") &&
    (value.space === null || typeof value.space === "number");
}

/**
 * End-to-end candidate assessment: raw same-slot account bundle -> Raydium
 * PoolState decode -> SPL Token mint/vault base state -> previously reviewed
 * generic on-chain identity evidence gate. A MATCH only advances to independent
 * safety review; synthetic bundles stay SYNTHETIC_MATCH. Token-2022 extension
 * data is blocked until Phase 7 semantic/risk policy approves it. No trading.
 */
export async function assessRaydiumCpmmIdentityEvidence(
  targetInput: unknown,
  bundleInput: unknown,
  policyInput: unknown
): Promise<RaydiumCpmmIdentityAssessment> {
  if (!isRecord(targetInput) ||
      !validateCanonicalMarketSnapshot(targetInput).valid ||
      targetInput.cluster !== "mainnet-beta" ||
      typeof targetInput.poolAddress !== "string" ||
      !isSolanaPublicKey(targetInput.poolAddress) ||
      typeof targetInput.baseMint !== "string" ||
      !isSolanaPublicKey(targetInput.baseMint) ||
      typeof targetInput.quoteMint !== "string" ||
      !isSolanaPublicKey(targetInput.quoteMint) ||
      targetInput.baseMint === targetInput.quoteMint ||
      !isRecord(bundleInput) ||
      !isRecord(bundleInput.source) ||
      !Array.isArray(bundleInput.accounts) ||
      bundleInput.accounts.length !== 9 ||
      !bundleInput.accounts.every(isRawAccount)) {
    return result("INVALID_INPUT", ["INVALID_TARGET_OR_ACCOUNT_BUNDLE"]);
  }

  const bundle = bundleInput as unknown as SolanaRpcAccountBundle;
  const accounts = bundle.accounts;
  if (new Set(accounts.map((account) => account.address)).size !== 9) {
    return result("INVALID_INPUT", ["DUPLICATE_ACCOUNT_ADDRESS"], [], bundle);
  }
  const byAddress = new Map(accounts.map((account) => [account.address, account]));
  const poolAccount = byAddress.get(targetInput.poolAddress);
  const programAccount = byAddress.get(RAYDIUM_CPMM_PROGRAM_ID);
  const baseMintAccountRaw = byAddress.get(targetInput.baseMint);
  const quoteMintAccountRaw = byAddress.get(targetInput.quoteMint);
  if (!poolAccount || !programAccount || !baseMintAccountRaw || !quoteMintAccountRaw) {
    return result("INVALID_INPUT", ["ACCOUNT_BUNDLE_ADDRESS_SET_MISMATCH"], [], bundle);
  }
  if ([poolAccount, programAccount, baseMintAccountRaw, quoteMintAccountRaw].some((account) => !account.exists)) {
    return result("INSUFFICIENT_EVIDENCE", ["REQUIRED_ACCOUNT_MISSING"], [], bundle);
  }

  const poolResult = decodeRaydiumCpmmPool(poolAccount);
  if (poolResult.status !== "DECODED") {
    return result("MISMATCH", ["RAYDIUM_POOL_DECODE_" + poolResult.errorCode], [], bundle);
  }
  let pool = poolResult.value;
  let canonicalPoolPda: { readonly address: string; readonly bump: number };
  try {
    canonicalPoolPda = await deriveRaydiumCpmmPoolPda(pool.ammConfig, pool.token0Mint, pool.token1Mint);
  } catch {
    return result("MISMATCH", ["POOL_PDA_DERIVATION_FAILED"], ["ammConfig", "token0Mint", "token1Mint"], bundle, pool);
  }
  pool = { ...pool, canonicalPoolPdaMatches: canonicalPoolPda.address === pool.address };

  const expectedConfig = byAddress.get(pool.ammConfig);
  const expectedLpMint = await deriveRaydiumCpmmLpMintPda(pool.address);
  const expectedObservation = await deriveRaydiumCpmmObservationPda(pool.address);
  const expectedBaseVault = await deriveRaydiumCpmmVaultPda(pool.address, targetInput.baseMint);
  const expectedQuoteVault = await deriveRaydiumCpmmVaultPda(pool.address, targetInput.quoteMint);
  const expectedAddresses = new Set([
    pool.address,
    RAYDIUM_CPMM_PROGRAM_ID,
    pool.ammConfig,
    expectedLpMint.address,
    targetInput.baseMint,
    targetInput.quoteMint,
    expectedBaseVault.address,
    expectedQuoteVault.address,
    expectedObservation.address
  ]);
  if (expectedAddresses.size !== 9 || accounts.some((account) => !expectedAddresses.has(account.address))) {
    return result("INVALID_INPUT", ["ACCOUNT_BUNDLE_ADDRESS_SET_MISMATCH"], [], bundle, pool);
  }

  const ammConfigAccount = expectedConfig;
  const lpMintAccount = byAddress.get(expectedLpMint.address);
  const baseVaultRaw = byAddress.get(expectedBaseVault.address);
  const quoteVaultRaw = byAddress.get(expectedQuoteVault.address);
  const observationAccount = byAddress.get(expectedObservation.address);
  if (!ammConfigAccount || !lpMintAccount || !baseVaultRaw || !quoteVaultRaw || !observationAccount) {
    return result("INVALID_INPUT", ["ACCOUNT_BUNDLE_ADDRESS_SET_MISMATCH"], [], bundle, pool);
  }
  if ([ammConfigAccount, lpMintAccount, baseVaultRaw, quoteVaultRaw, observationAccount].some((account) => !account.exists)) {
    return result("INSUFFICIENT_EVIDENCE", ["REQUIRED_ACCOUNT_MISSING"], [], bundle, pool);
  }

  const configResult = decodeRaydiumCpmmAmmConfig(ammConfigAccount);
  if (configResult.status !== "DECODED") {
    return result("MISMATCH", ["RAYDIUM_AMM_CONFIG_DECODE_" + configResult.errorCode], ["ammConfig"], bundle, pool);
  }
  const ammConfig = configResult.value;
  const derivedConfig = await deriveRaydiumCpmmAmmConfigPda(ammConfig.index);
  if (derivedConfig.address !== ammConfig.address ||
      derivedConfig.bump !== ammConfig.bump ||
      pool.ammConfig !== ammConfig.address) {
    return result("MISMATCH", ["AMM_CONFIG_PDA_MISMATCH"], ["ammConfig", "ammConfig.bump"], bundle, pool, undefined, false, ammConfig);
  }
  if (programAccount.address !== RAYDIUM_CPMM_PROGRAM_ID ||
      programAccount.ownerProgramId === null ||
      programAccount.executable !== true) {
    return result("MISMATCH", ["RAYDIUM_PROGRAM_ACCOUNT_INVALID"], ["dexProgramAccount"], bundle, pool, undefined, false, ammConfig);
  }
  if (pool.lpMint !== expectedLpMint.address) {
    return result("MISMATCH", ["LP_MINT_PDA_MISMATCH"], ["lpMint"], bundle, pool, undefined, false, ammConfig);
  }
  if (pool.observationKey !== expectedObservation.address ||
      observationAccount.ownerProgramId !== RAYDIUM_CPMM_PROGRAM_ID ||
      observationAccount.executable !== false) {
    return result("MISMATCH", ["OBSERVATION_ACCOUNT_IDENTITY_MISMATCH"], ["observationKey"], bundle, pool, undefined, false, ammConfig);
  }

  const token0IsBase =
    pool.token0Mint === targetInput.baseMint && pool.token1Mint === targetInput.quoteMint;
  const token0IsQuote =
    pool.token0Mint === targetInput.quoteMint && pool.token1Mint === targetInput.baseMint;
  if (!token0IsBase && !token0IsQuote) {
    return result("MISMATCH", ["POOL_MINTS_DO_NOT_MATCH_TARGET"], ["baseMint", "quoteMint"], bundle, pool, undefined, false, ammConfig);
  }
  const token0MintRaw = token0IsBase ? baseMintAccountRaw : quoteMintAccountRaw;
  const token1MintRaw = token0IsBase ? quoteMintAccountRaw : baseMintAccountRaw;
  const token0VaultAccount = token0IsBase ? baseVaultRaw : quoteVaultRaw;
  const token1VaultAccount = token0IsBase ? quoteVaultRaw : baseVaultRaw;
  if (pool.token0Vault !== token0VaultAccount.address ||
      pool.token1Vault !== token1VaultAccount.address) {
    return result("MISMATCH", ["POOL_VAULT_PDA_MISMATCH"], ["token0Vault", "token1Vault"], bundle, pool, undefined, false, ammConfig);
  }

  const authority = await deriveRaydiumCpmmAuthorityPda();
  if (authority.bump !== pool.authBump) {
    return result("MISMATCH", ["POOL_AUTHORITY_BUMP_MISMATCH"], ["authBump"], bundle, pool, undefined, false, ammConfig);
  }
  const baseMintDecode = decodeSplTokenMint(baseMintAccountRaw);
  const quoteMintDecode = decodeSplTokenMint(quoteMintAccountRaw);
  const lpMintDecode = decodeSplTokenMint(lpMintAccount);
  const baseVaultDecode = decodeSplTokenAccount(baseVaultRaw);
  const quoteVaultDecode = decodeSplTokenAccount(quoteVaultRaw);

  if (lpMintAccount.ownerProgramId !== SPL_TOKEN_PROGRAM_ID || lpMintDecode.status !== "DECODED" ||
      !lpMintDecode.value.initialized || lpMintDecode.value.decimals !== pool.lpMintDecimals ||
      (lpMintDecode.value.mintAuthority !== null && lpMintDecode.value.mintAuthority !== authority.address)) {
    return result("MISMATCH", ["LP_MINT_BASE_STATE_MISMATCH"], ["lpMint"], bundle, pool, undefined, false, ammConfig);
  }
  if (baseMintDecode.status === "DECODED" && quoteMintDecode.status === "DECODED") {
    if (pool.mint0Decimals !== (token0IsBase ? baseMintDecode.value.decimals : quoteMintDecode.value.decimals) ||
        pool.mint1Decimals !== (token0IsBase ? quoteMintDecode.value.decimals : baseMintDecode.value.decimals)) {
      return result("MISMATCH", ["POOL_MINT_DECIMALS_MISMATCH"], ["mint0Decimals", "mint1Decimals"], bundle, pool, undefined, false, ammConfig);
    }
  }
  const poolMintProgramMismatches: string[] = [];
  if (pool.token0Program !== token0MintRaw.ownerProgramId) poolMintProgramMismatches.push("token0Program");
  if (pool.token1Program !== token1MintRaw.ownerProgramId) poolMintProgramMismatches.push("token1Program");
  if (poolMintProgramMismatches.length > 0) {
    return result("MISMATCH", ["POOL_TOKEN_PROGRAM_MISMATCH"], poolMintProgramMismatches, bundle, pool, undefined, false, ammConfig);
  }


  const identityEvidence = {
    source: {
      providerId: bundle.source.providerId,
      commitment: bundle.source.commitment,
      retrievedAt: bundle.source.retrievedAt,
      contextSlot: bundle.source.contextSlot,
      requestedMinContextSlot: bundle.source.requestedMinContextSlot,
      requestId: bundle.source.requestId,
      rawPayloadSha256: bundle.source.rawPayloadSha256,
      synthetic: bundle.source.synthetic
    },
    poolAccount: {
      address: poolAccount.address,
      exists: poolAccount.exists,
      ownerProgramId: poolAccount.ownerProgramId,
      executable: poolAccount.executable
    },
    dexProgramAccount: {
      address: programAccount.address,
      exists: programAccount.exists,
      ownerProgramId: programAccount.ownerProgramId,
      executable: programAccount.executable
    },
    baseMintAccount: {
      address: baseMintAccountRaw.address,
      exists: baseMintAccountRaw.exists,
      ownerProgramId: baseMintAccountRaw.ownerProgramId,
      executable: baseMintAccountRaw.executable,
      initialized: baseMintDecode.value.initialized,
      decimals: baseMintDecode.value.decimals
    },
    quoteMintAccount: {
      address: quoteMintAccountRaw.address,
      exists: quoteMintAccountRaw.exists,
      ownerProgramId: quoteMintAccountRaw.ownerProgramId,
      executable: quoteMintAccountRaw.executable,
      initialized: quoteMintDecode.value.initialized,
      decimals: quoteMintDecode.value.decimals
    },
    baseVaultAccount: {
      address: baseVaultRaw.address,
      exists: baseVaultRaw.exists,
      ownerProgramId: baseVaultRaw.ownerProgramId,
      executable: baseVaultRaw.executable,
      initialized: baseVaultDecode.value.state === "INITIALIZED",
      mint: baseVaultDecode.value.mint,
      authority: baseVaultDecode.value.authority
    },
    quoteVaultAccount: {
      address: quoteVaultRaw.address,
      exists: quoteVaultRaw.exists,
      ownerProgramId: quoteVaultRaw.ownerProgramId,
      executable: quoteVaultRaw.executable,
      initialized: quoteVaultDecode.value.state === "INITIALIZED",
      mint: quoteVaultDecode.value.mint,
      authority: quoteVaultDecode.value.authority
    },
    decodedPool: {
      decoderId: RAYDIUM_CPMM_DECODER_ID,
      decoderVersion: RAYDIUM_CPMM_DECODER_VERSION,
      poolAddress: pool.address,
      dexProgramId: RAYDIUM_CPMM_PROGRAM_ID,
      baseMint: targetInput.baseMint,
      quoteMint: targetInput.quoteMint,
      baseVault: baseVaultRaw.address,
      quoteVault: quoteVaultRaw.address,
      baseVaultAuthority: authority.address,
      quoteVaultAuthority: authority.address
    }
  } as const;

  const assessment = assessOnChainIdentityEvidence(
    targetInput,
    identityEvidence as unknown as Parameters<typeof assessOnChainIdentityEvidence>[1],
    policyInput
  );
  const status: RaydiumCpmmIdentityStatus = assessment.status;
  return result(
    status,
    assessment.reasonCodes,
    assessment.mismatchFields,
    bundle,
    pool,
    assessment,
    assessment.canProceedToIndependentSafetyReview && assessment.status === "MATCH",
    ammConfig
  );
}
