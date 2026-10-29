import { isSolanaPublicKey } from "./index.js";
import type { SolanaRpcRawAccount } from "./solana-rpc-reader.js";

export const UPGRADEABLE_LOADER_PROGRAM_ID = "BPFLoaderUpgradeab1e11111111111111111111111";
const PROGRAM_STATE_TAG = 2;
const PROGRAMDATA_STATE_TAG = 3;
const PROGRAM_ACCOUNT_DATA_LENGTH = 36;
const PROGRAMDATA_METADATA_LENGTH = 45;
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const BASE58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export interface UpgradeableProgramAccountInspection {
  readonly valid: boolean;
  readonly programDataAddress: string | null;
  readonly reasonCodes: readonly string[];
}

export type ProgramDeploymentVerificationStatus =
  | "MATCH"
  | "HASH_MISMATCH"
  | "MISMATCH"
  | "INSUFFICIENT_EVIDENCE"
  | "INVALID_INPUT"
  | "SYNTHETIC_MATCH"
  | "SYNTHETIC_MISMATCH";

export interface ProgramDeploymentVerificationResult {
  readonly status: ProgramDeploymentVerificationStatus;
  readonly reasonCodes: readonly string[];
  readonly programId: string;
  readonly programDataAddress: string | null;
  readonly loaderProgramId: string;
  readonly deploymentSlot: string | null;
  readonly upgradeAuthorityPresent: boolean | null;
  readonly programAccountContextSlot: number | null;
  readonly programDataContextSlot: number | null;
  readonly expectedElfSha256: string | null;
  readonly observedElfSha256: string | null;
  readonly elfByteLength: number | null;
  readonly synthetic: boolean;
  readonly tradingAuthorized: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function decodeBase64(value: unknown): Uint8Array | null {
  if (typeof value !== "string" || value.length === 0 || value.length % 4 !== 0 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) return null;
  try {
    const decoded = atob(value);
    const bytes = Uint8Array.from(decoded, (character) => character.charCodeAt(0));
    return bytes.length === 0 ? null : bytes;
  } catch {
    return null;
  }
}

function encodeBase58(bytes: Uint8Array): string {
  let leadingZeroes = 0;
  while (leadingZeroes < bytes.length && bytes[leadingZeroes] === 0) leadingZeroes += 1;
  let value = 0n;
  for (const byte of bytes) value = (value << 8n) | BigInt(byte);
  let encoded = "";
  while (value > 0n) {
    encoded = BASE58_ALPHABET[Number(value % 58n)] + encoded;
    value /= 58n;
  }
  return "1".repeat(leadingZeroes) + encoded;
}

function readU32LE(bytes: Uint8Array, offset: number): number {
  return (bytes[offset]! | (bytes[offset + 1]! << 8) |
    (bytes[offset + 2]! << 16) | (bytes[offset + 3]! << 24)) >>> 0;
}

function readU64LE(bytes: Uint8Array, offset: number): string {
  let value = 0n;
  for (let index = 7; index >= 0; index -= 1) {
    value = (value << 8n) | BigInt(bytes[offset + index]!);
  }
  return value.toString();
}

function safeAccountBytes(account: unknown): Uint8Array | null {
  if (!isRecord(account) || account.exists !== true ||
      typeof account.dataBase64 !== "string" ||
      !Number.isSafeInteger(account.space) ||
      (account.space as number) < 0) return null;
  const bytes = decodeBase64(account.dataBase64);
  if (bytes === null || bytes.length !== account.space) return null;
  return bytes;
}

export function inspectUpgradeableProgramAccount(
  programAccount: SolanaRpcRawAccount,
  expectedProgramId: string,
  loaderProgramId = UPGRADEABLE_LOADER_PROGRAM_ID
): UpgradeableProgramAccountInspection {
  const fail = (code: string): UpgradeableProgramAccountInspection => ({
    valid: false, programDataAddress: null, reasonCodes: [code]
  });
  if (!isSolanaPublicKey(expectedProgramId) || !isSolanaPublicKey(loaderProgramId) ||
      !isRecord(programAccount) || typeof programAccount.address !== "string") {
    return fail("PROGRAM_ACCOUNT_INPUT_INVALID");
  }
  if (programAccount.address !== expectedProgramId) return fail("PROGRAM_ADDRESS_MISMATCH");
  if (programAccount.exists !== true) return fail("PROGRAM_ACCOUNT_MISSING");
  if (programAccount.ownerProgramId !== loaderProgramId || programAccount.executable !== true) {
    return fail("PROGRAM_LOADER_OR_EXECUTABLE_MISMATCH");
  }
  const bytes = safeAccountBytes(programAccount);
  if (bytes === null || bytes.length !== PROGRAM_ACCOUNT_DATA_LENGTH) {
    return fail("PROGRAM_ACCOUNT_LAYOUT_INVALID");
  }
  if (readU32LE(bytes, 0) !== PROGRAM_STATE_TAG) return fail("PROGRAM_STATE_TAG_INVALID");
  const programDataAddress = encodeBase58(bytes.slice(4, 36));
  if (!isSolanaPublicKey(programDataAddress)) return fail("PROGRAMDATA_ADDRESS_INVALID");
  return { valid: true, programDataAddress, reasonCodes: ["PROGRAMDATA_POINTER_DECODED"] };
}

async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (value) => value.toString(16).padStart(2, "0")).join("");
}

/**
 * Compare the exact deployed ELF payload in a loader-v3 ProgramData account with an
 * owner-reviewed reference ELF SHA-256. A hash match proves byte equality to that hash,
 * not that the reference build itself came from an authorized/reproducible source build.
 */
export async function assessUpgradeableProgramDeployment(input: {
  readonly programAccount: SolanaRpcRawAccount;
  readonly programDataAccount: SolanaRpcRawAccount | null;
  readonly expectedProgramId: string;
  readonly expectedElfSha256: string | null;
  readonly programAccountContextSlot: number;
  readonly programDataContextSlot: number | null;
  readonly synthetic: boolean;
  readonly loaderProgramId?: string;
}): Promise<ProgramDeploymentVerificationResult> {
  const loaderProgramId = input.loaderProgramId ?? UPGRADEABLE_LOADER_PROGRAM_ID;
  const base = {
    programId: input.expectedProgramId,
    loaderProgramId,
    programDataAddress: null as string | null,
    deploymentSlot: null as string | null,
    upgradeAuthorityPresent: null as boolean | null,
    programAccountContextSlot: Number.isSafeInteger(input.programAccountContextSlot) && input.programAccountContextSlot >= 0
      ? input.programAccountContextSlot : null,
    programDataContextSlot: Number.isSafeInteger(input.programDataContextSlot) && (input.programDataContextSlot ?? -1) >= 0
      ? input.programDataContextSlot : null,
    expectedElfSha256: input.expectedElfSha256,
    observedElfSha256: null as string | null,
    elfByteLength: null as number | null,
    synthetic: input.synthetic,
    tradingAuthorized: false as const
  };
  const result = (
    status: ProgramDeploymentVerificationStatus,
    reasonCodes: readonly string[],
    overrides: Partial<typeof base> = {}
  ): ProgramDeploymentVerificationResult => ({ ...base, ...overrides, status, reasonCodes });

  if (!isSolanaPublicKey(input.expectedProgramId) || !isSolanaPublicKey(loaderProgramId) ||
      typeof input.synthetic !== "boolean" ||
      !Number.isSafeInteger(input.programAccountContextSlot) || input.programAccountContextSlot < 0 ||
      (input.programDataContextSlot !== null &&
       (!Number.isSafeInteger(input.programDataContextSlot) || input.programDataContextSlot < 0))) {
    return result("INVALID_INPUT", ["PROGRAM_DEPLOYMENT_POLICY_INVALID"]);
  }
  const inspection = inspectUpgradeableProgramAccount(input.programAccount, input.expectedProgramId, loaderProgramId);
  if (!inspection.valid || inspection.programDataAddress === null) {
    const status = inspection.reasonCodes[0] === "PROGRAM_ACCOUNT_MISSING" ? "INSUFFICIENT_EVIDENCE" : "MISMATCH";
    return result(status, inspection.reasonCodes);
  }
  const inspectedBase = { ...base, programDataAddress: inspection.programDataAddress };
  const resultWithInspection = (
    status: ProgramDeploymentVerificationStatus,
    reasonCodes: readonly string[],
    overrides: Partial<typeof base> = {}
  ): ProgramDeploymentVerificationResult => ({ ...inspectedBase, ...overrides, status, reasonCodes });

  if (input.programDataAccount === null || input.programDataContextSlot === null) {
    return resultWithInspection("INSUFFICIENT_EVIDENCE", ["PROGRAMDATA_ACCOUNT_NOT_READ"]);
  }
  if (input.programDataContextSlot < input.programAccountContextSlot) {
    return resultWithInspection("INSUFFICIENT_EVIDENCE", ["PROGRAMDATA_CONTEXT_SLOT_BELOW_PROGRAM_ACCOUNT"]);
  }
  const pd = input.programDataAccount;
  if (pd.address !== inspection.programDataAddress) {
    return resultWithInspection("MISMATCH", ["PROGRAMDATA_ADDRESS_MISMATCH"]);
  }
  if (pd.exists !== true) return resultWithInspection("INSUFFICIENT_EVIDENCE", ["PROGRAMDATA_ACCOUNT_MISSING"]);
  if (pd.ownerProgramId !== loaderProgramId || pd.executable !== false) {
    return resultWithInspection("MISMATCH", ["PROGRAMDATA_LOADER_OR_EXECUTABLE_MISMATCH"]);
  }
  const bytes = safeAccountBytes(pd);
  if (bytes === null || bytes.length < PROGRAMDATA_METADATA_LENGTH + 4) {
    return resultWithInspection("INSUFFICIENT_EVIDENCE", ["PROGRAMDATA_LAYOUT_INVALID"]);
  }
  if (readU32LE(bytes, 0) !== PROGRAMDATA_STATE_TAG) {
    return resultWithInspection("MISMATCH", ["PROGRAMDATA_STATE_TAG_INVALID"]);
  }
  const authorityTag = bytes[12]!;
  if (authorityTag !== 0 && authorityTag !== 1) {
    return resultWithInspection("MISMATCH", ["PROGRAMDATA_UPGRADE_AUTHORITY_TAG_INVALID"]);
  }
  if (authorityTag === 1 && !isSolanaPublicKey(encodeBase58(bytes.slice(13, 45)))) {
    return resultWithInspection("MISMATCH", ["PROGRAMDATA_UPGRADE_AUTHORITY_INVALID"]);
  }
  const elf = bytes.slice(PROGRAMDATA_METADATA_LENGTH);
  if (elf[0] !== 0x7f || elf[1] !== 0x45 || elf[2] !== 0x4c || elf[3] !== 0x46) {
    return resultWithInspection("MISMATCH", ["PROGRAMDATA_ELF_MAGIC_INVALID"]);
  }
  const observedElfSha256 = await sha256Hex(elf);
  const common = {
    deploymentSlot: readU64LE(bytes, 4),
    upgradeAuthorityPresent: authorityTag === 1,
    observedElfSha256,
    elfByteLength: elf.length
  };
  if (input.expectedElfSha256 === null || input.expectedElfSha256 === "") {
    return resultWithInspection("INSUFFICIENT_EVIDENCE", ["EXPECTED_REFERENCE_ELF_SHA256_REQUIRED"], common);
  }
  if (typeof input.expectedElfSha256 !== "string" || !SHA256_PATTERN.test(input.expectedElfSha256)) {
    return resultWithInspection("INVALID_INPUT", ["EXPECTED_REFERENCE_ELF_SHA256_INVALID"], common);
  }
  if (observedElfSha256 !== input.expectedElfSha256) {
    return resultWithInspection(input.synthetic ? "SYNTHETIC_MISMATCH" : "HASH_MISMATCH",
      ["DEPLOYED_ELF_HASH_MISMATCH"], common);
  }
  const reasons = ["DEPLOYED_ELF_HASH_MATCH"];
  if (authorityTag === 1) reasons.push("PROGRAM_REMAINS_UPGRADEABLE");
  return resultWithInspection(input.synthetic ? "SYNTHETIC_MATCH" : "MATCH", reasons, common);
}
