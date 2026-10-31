/**
 * Phase 6.46 Step 2 — root-authenticated provider trust-registry snapshots.
 *
 * This module is deliberately transport-free. It authenticates bounded bytes
 * against an independently provisioned Ed25519 SPKI root and never selects a
 * registry endpoint, loads credentials, or authorizes provider use by itself.
 */
import {
  createPublicKey,
  verify as verifyEd25519Signature
} from "node:crypto";
import {
  getProviderTrustRegistrySigningPayload,
  PROVIDER_TRUST_REGISTRY_LIMITS,
  ProviderTrustRegistryError,
  validateProviderTrustRegistrySnapshotEnvelope
} from "./provider-trust-registry.js";
import type {
  AuthenticatedProviderTrustSnapshot,
  ProviderTrustRegistrySnapshotEnvelope,
  ProviderTrustRegistryTrustAnchor,
  ProviderTrustSnapshotAuthenticator
} from "./provider-trust-registry.js";

const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SHA256_HEX = /^[a-fA-F0-9]{64}$/;
const SAFE_REGISTRY_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const MAX_JSON_DEPTH = 32;
const PUBLIC_KEY_BEGIN = "-----BEGIN PUBLIC KEY-----";
const PUBLIC_KEY_END = "-----END PUBLIC KEY-----";
const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const BASE64URL = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

/**
 * Production authenticator for exact registry snapshot bytes. Parsing rejects
 * duplicate object member names before canonical payload reconstruction.
 */
export class Ed25519ProviderTrustSnapshotAuthenticator
implements ProviderTrustSnapshotAuthenticator {
  async authenticate(input: {
    readonly snapshotBytes: Uint8Array;
    readonly trustAnchor: ProviderTrustRegistryTrustAnchor;
    readonly now: string;
    readonly retrievedAt: string;
    readonly maxSnapshotAgeMs: number;
  }): Promise<AuthenticatedProviderTrustSnapshot> {
    if (!(input.snapshotBytes instanceof Uint8Array)) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
    }
    if (input.snapshotBytes.byteLength > PROVIDER_TRUST_REGISTRY_LIMITS.maxSnapshotBytes) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_RESPONSE_TOO_LARGE");
    }
    if (input.snapshotBytes.byteLength === 0 ||
        !isValidUtcTimestamp(input.now) ||
        !isValidUtcTimestamp(input.retrievedAt) ||
        !Number.isSafeInteger(input.maxSnapshotAgeMs) ||
        input.maxSnapshotAgeMs < 1 ||
        input.maxSnapshotAgeMs > PROVIDER_TRUST_REGISTRY_LIMITS.maxAgeMs) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
    }

    const anchor = validateTrustAnchor(input.trustAnchor);
    const envelope = parseAndValidateEnvelope(input.snapshotBytes);
    if (envelope.registryId !== anchor.registryId) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_IDENTITY_MISMATCH");
    }
    if (envelope.rootKeyId !== anchor.rootKeyId) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
    }

    const rootPublicKey = await loadPinnedRootPublicKey(anchor);
    const signingPayload = getProviderTrustRegistrySigningPayload({
      schemaVersion: envelope.schemaVersion,
      registryId: envelope.registryId,
      rootKeyId: envelope.rootKeyId,
      algorithm: envelope.algorithm,
      version: envelope.version,
      issuedAt: envelope.issuedAt,
      expiresAt: envelope.expiresAt,
      keys: envelope.keys
    });
    const signatureBytes = decodeCanonicalSignature(envelope.signature);
    const payloadBytes = new TextEncoder().encode(signingPayload);

    let signatureValid = false;
    try {
      signatureValid = verifyEd25519Signature(
        null,
        payloadBytes,
        rootPublicKey,
        signatureBytes
      );
    } catch {
      signatureValid = false;
    }
    if (!signatureValid) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_AUTHENTICATION_FAILED");
    }

    const nowMs = Date.parse(input.now);
    const issuedAtMs = Date.parse(envelope.issuedAt);
    const expiresAtMs = Date.parse(envelope.expiresAt);
    if (issuedAtMs > nowMs) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_FROM_FUTURE");
    }
    if (expiresAtMs <= nowMs) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_EXPIRED");
    }
    if (nowMs - issuedAtMs > input.maxSnapshotAgeMs) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_STALE");
    }

    const canonicalPayloadSha256 = bytesToHex(
      new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", payloadBytes))
    );
    const keys = Object.freeze(envelope.keys.map((key) => {
      let providerDecisionKey: ReturnType<typeof createPublicKey>;
      try {
        providerDecisionKey = createPublicKey(key.publicKeyPem);
      } catch {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_KEY_INVALID");
      }
      if (providerDecisionKey.asymmetricKeyType !== "ed25519") {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_KEY_INVALID");
      }
      return Object.freeze({
        keyId: key.keyId,
        owner: key.owner,
        publicKeyPem: key.publicKeyPem,
        notBefore: key.notBefore,
        expiresAt: key.expiresAt,
        revokedAt: key.revokedAt,
        allowedProviderIds: Object.freeze([...key.allowedProviderIds]),
        allowedPurposes: Object.freeze([...key.allowedPurposes])
      });
    }));

    return Object.freeze({
      registryId: envelope.registryId,
      rootKeyId: envelope.rootKeyId,
      version: envelope.version,
      issuedAt: envelope.issuedAt,
      expiresAt: envelope.expiresAt,
      retrievedAt: input.retrievedAt,
      canonicalPayloadSha256,
      keys
    });
  }
}

/** Factory for dependency injection; no network or key bootstrap is performed. */
export function createEd25519ProviderTrustSnapshotAuthenticator():
ProviderTrustSnapshotAuthenticator {
  return new Ed25519ProviderTrustSnapshotAuthenticator();
}

function validateTrustAnchor(
  value: ProviderTrustRegistryTrustAnchor
): ProviderTrustRegistryTrustAnchor {
  if (!isRecord(value) ||
      !hasExactKeys(value, [
        "registryId",
        "rootKeyId",
        "rootPublicKeyPem",
        "expectedSpkiSha256"
      ]) ||
      typeof value.registryId !== "string" ||
      !SAFE_REGISTRY_ID.test(value.registryId) ||
      typeof value.rootKeyId !== "string" ||
      !SAFE_KEY_ID.test(value.rootKeyId)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_IDENTITY_MISMATCH");
  }

  if (typeof value.rootPublicKeyPem !== "string" ||
      value.rootPublicKeyPem.length > 4096 ||
      !value.rootPublicKeyPem.startsWith(PUBLIC_KEY_BEGIN) ||
      !value.rootPublicKeyPem.includes(PUBLIC_KEY_END) ||
      value.rootPublicKeyPem.slice(value.rootPublicKeyPem.lastIndexOf(PUBLIC_KEY_END) + PUBLIC_KEY_END.length).trim() !== "") {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
  }
  if (typeof value.expectedSpkiSha256 !== "string" ||
      !SHA256_HEX.test(value.expectedSpkiSha256)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_FINGERPRINT_MISMATCH");
  }
  return value;
}

async function loadPinnedRootPublicKey(anchor: ProviderTrustRegistryTrustAnchor) {
  const body = anchor.rootPublicKeyPem
    .slice(PUBLIC_KEY_BEGIN.length, anchor.rootPublicKeyPem.lastIndexOf(PUBLIC_KEY_END))
    .replace(/\s/g, "");
  const spkiDer = decodeStandardBase64(body);
  if (spkiDer === null || spkiDer.byteLength === 0) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
  }

  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = createPublicKey(anchor.rootPublicKeyPem);
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
  }
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
  }

  const actualFingerprint = new Uint8Array(
    await globalThis.crypto.subtle.digest("SHA-256", spkiDer)
  );
  const expectedFingerprint = decodeHex(anchor.expectedSpkiSha256);
  if (expectedFingerprint === null || !fixedTimeEqual(expectedFingerprint, actualFingerprint)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_FINGERPRINT_MISMATCH");
  }
  return publicKey;
}

function parseAndValidateEnvelope(bytes: Uint8Array): ProviderTrustRegistrySnapshotEnvelope {
  let source: string;
  try {
    source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }

  let parsed: unknown;
  try {
    parsed = parseJsonRejectingDuplicateKeys(source);
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }

  try {
    return validateProviderTrustRegistrySnapshotEnvelope(parsed);
  } catch (error) {
    if (error instanceof TypeError &&
        error.message === "TRUST_REGISTRY_SNAPSHOT_DUPLICATE_KEY_ID") {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_DUPLICATE_KEY_ID");
    }
    if (error instanceof TypeError &&
        error.message === "TRUST_REGISTRY_SNAPSHOT_KEY_INVALID") {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_KEY_INVALID");
    }
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }
}

function decodeCanonicalSignature(value: string): Uint8Array {
  const decoded = decodeBase64Url(value);
  if (decoded === null || decoded.byteLength !== 64) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }
  return decoded;
}

function decodeBase64Url(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]{86}$/.test(value)) return null;
  return decodeSixBitCharacters(value, BASE64URL, 64);
}

function decodeStandardBase64(value: string): Uint8Array | null {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) {
    return null;
  }
  const padding = value.endsWith("==") ? 2 : value.endsWith("=") ? 1 : 0;
  return decodeSixBitCharacters(value.slice(0, value.length - padding), BASE64, undefined);
}

function decodeSixBitCharacters(
  value: string,
  alphabet: string,
  expectedLength: number | undefined
): Uint8Array | null {
  const outputLength = Math.floor(value.length * 6 / 8);
  if (expectedLength !== undefined && outputLength !== expectedLength) return null;
  const output = new Uint8Array(outputLength);
  let accumulator = 0;
  let bits = 0;
  let offset = 0;
  for (const character of value) {
    const digit = alphabet.indexOf(character);
    if (digit < 0) return null;
    accumulator = (accumulator << 6) | digit;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      if (offset >= output.length) return null;
      output[offset] = (accumulator >> bits) & 0xff;
      offset += 1;
      accumulator &= (1 << bits) - 1;
    }
  }
  if (offset !== output.length || accumulator !== 0) return null;
  return output;
}

function decodeHex(value: string): Uint8Array | null {
  if (!/^[a-fA-F0-9]{64}$/.test(value)) return null;
  const output = new Uint8Array(32);
  for (let index = 0; index < output.length; index += 1) {
    output[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return output;
}

function fixedTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.byteLength !== right.byteLength) return false;
  let difference = 0;
  for (let index = 0; index < left.byteLength; index += 1) {
    difference |= left[index]! ^ right[index]!;
  }
  return difference === 0;
}

function bytesToHex(value: Uint8Array): string {
  let result = "";
  for (const byte of value) result += byte.toString(16).padStart(2, "0");
  return result;
}

/**
 * Small bounded JSON parser used only to reject duplicate member names at every
 * object depth. JSON.parse alone silently accepts duplicates with last-key wins.
 */
function parseJsonRejectingDuplicateKeys(source: string): unknown {
  let offset = 0;

  const fail = (): never => {
    throw new SyntaxError("INVALID_JSON");
  };
  const skipWhitespace = (): void => {
    while (offset < source.length &&
      (source[offset] === " " || source[offset] === "\n" ||
       source[offset] === "\r" || source[offset] === "\t")) {
      offset += 1;
    }
  };
  const parseString = (): string => {
    if (source[offset] !== '"') return fail();
    const start = offset;
    offset += 1;
    while (offset < source.length) {
      const character = source.charCodeAt(offset);
      if (character === 0x22) {
        offset += 1;
        try {
          return JSON.parse(source.slice(start, offset)) as string;
        } catch {
          return fail();
        }
      }
      if (character === 0x5c) {
        offset += 2;
        continue;
      }
      if (character < 0x20) return fail();
      offset += 1;
    }
    return fail();
  };

  const parseValue = (depth: number): unknown => {
    if (depth > MAX_JSON_DEPTH) return fail();
    skipWhitespace();
    const character = source[offset];
    if (character === "{") return parseObject(depth + 1);
    if (character === "[") return parseArray(depth + 1);
    if (character === '"') return parseString();
    if (character === "t" && source.slice(offset, offset + 4) === "true") {
      offset += 4;
      return true;
    }
    if (character === "f" && source.slice(offset, offset + 5) === "false") {
      offset += 5;
      return false;
    }
    if (character === "n" && source.slice(offset, offset + 4) === "null") {
      offset += 4;
      return null;
    }
    const numberMatch = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/.exec(
      source.slice(offset)
    );
    if (numberMatch !== null) {
      offset += numberMatch[0].length;
      try {
        return JSON.parse(numberMatch[0]) as number;
      } catch {
        return fail();
      }
    }
    return fail();
  };

  const parseObject = (depth: number): Record<string, unknown> => {
    offset += 1;
    skipWhitespace();
    const result: Record<string, unknown> = Object.create(null) as Record<string, unknown>;
    const seen = new Set<string>();
    if (source[offset] === "}") {
      offset += 1;
      return result;
    }
    while (offset < source.length) {
      skipWhitespace();
      const key = parseString();
      if (seen.has(key)) return fail();
      seen.add(key);
      skipWhitespace();
      if (source[offset] !== ":") return fail();
      offset += 1;
      result[key] = parseValue(depth);
      skipWhitespace();
      if (source[offset] === "}") {
        offset += 1;
        return result;
      }
      if (source[offset] !== ",") return fail();
      offset += 1;
    }
    return fail();
  };

  const parseArray = (depth: number): unknown[] => {
    offset += 1;
    skipWhitespace();
    const result: unknown[] = [];
    if (source[offset] === "]") {
      offset += 1;
      return result;
    }
    while (offset < source.length) {
      result.push(parseValue(depth));
      skipWhitespace();
      if (source[offset] === "]") {
        offset += 1;
        return result;
      }
      if (source[offset] !== ",") return fail();
      offset += 1;
    }
    return fail();
  };

  const value = parseValue(0);
  skipWhitespace();
  if (offset !== source.length) return fail();
  return value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length &&
    actual.every((key, index) => key === required[index]);
}

function isValidUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !UTC_TIMESTAMP.test(value)) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const fraction = /\.(\d{1,3})Z$/.exec(value)?.[1] ?? "";
  const normalized = value.replace(/(?:\.\d{1,3})?Z$/, "." + fraction.padEnd(3, "0") + "Z");
  return new Date(timestamp).toISOString() === normalized;
}
