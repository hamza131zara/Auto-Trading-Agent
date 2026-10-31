/**
 * Phase 6.46 Step 2 — root-authenticated provider trust-registry snapshots.
 *
 * This module is deliberately transport-free. It authenticates bounded bytes
 * against an independently provisioned Ed25519 SPKI root and never selects a
 * registry endpoint, loads credentials, or authorizes provider use by itself.
 */
import {
  createHash,
  createPublicKey,
  timingSafeEqual,
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

    const rootPublicKey = loadPinnedRootPublicKey(anchor);
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
    const payloadBytes = Buffer.from(signingPayload, "utf8");

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

    const canonicalPayloadSha256 = createHash("sha256")
      .update(payloadBytes)
      .digest("hex");
    const keys = Object.freeze(envelope.keys.map((key) => Object.freeze({
      keyId: key.keyId,
      owner: key.owner,
      publicKeyPem: key.publicKeyPem,
      notBefore: key.notBefore,
      expiresAt: key.expiresAt,
      revokedAt: key.revokedAt,
      allowedProviderIds: Object.freeze([...key.allowedProviderIds]),
      allowedPurposes: Object.freeze([...key.allowedPurposes])
    })));

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
      !value.rootPublicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") ||
      !value.rootPublicKeyPem.trimEnd().endsWith("-----END PUBLIC KEY-----")) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
  }
  if (typeof value.expectedSpkiSha256 !== "string" ||
      !SHA256_HEX.test(value.expectedSpkiSha256)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_FINGERPRINT_MISMATCH");
  }
  return value;
}

function loadPinnedRootPublicKey(anchor: ProviderTrustRegistryTrustAnchor) {
  let publicKey: ReturnType<typeof createPublicKey>;
  try {
    publicKey = createPublicKey(anchor.rootPublicKeyPem);
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
  }
  if (publicKey.asymmetricKeyType !== "ed25519") {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROOT_KEY_MISMATCH");
  }

  const spkiDer = publicKey.export({ type: "spki", format: "der" });
  const actualFingerprint = createHash("sha256").update(spkiDer).digest();
  const expectedFingerprint = Buffer.from(anchor.expectedSpkiSha256, "hex");
  if (expectedFingerprint.byteLength !== actualFingerprint.byteLength ||
      !timingSafeEqual(expectedFingerprint, actualFingerprint)) {
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

function decodeCanonicalSignature(value: string): Buffer {
  const decoded = Buffer.from(value, "base64url");
  if (decoded.byteLength !== 64 || decoded.toString("base64url") !== value) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }
  return decoded;
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
  const normalized = value.replace(
    /(?:\.(\d{1,3}))?Z$/,
    (_match, fraction: string | undefined) => `.\${(fraction ?? "").padEnd(3, "0")}Z`
  );
  return new Date(timestamp).toISOString() === normalized;
}
