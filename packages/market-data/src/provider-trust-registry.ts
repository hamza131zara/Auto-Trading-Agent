/**
 * Phase 6.46 — signed provider trust-registry protocol contract.
 *
 * The registry snapshot authenticates the provider-decision signing-key set.
 * It does not replace the existing ata.provider-use-decision.v1 signatures.
 * This module has no network client, credentials, or implicit trust bootstrap.
 */
import type { TrustedProviderDecisionSigningKey } from "./provider-use-decision-verifier.js";
import type { ProviderUsePurpose } from "./provider-orchestrator.js";

export const PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION =
  "ata.provider-trust-registry-snapshot.v1" as const;
export const PROVIDER_TRUST_REGISTRY_SIGNATURE_ALGORITHM = "Ed25519" as const;
export const PROVIDER_TRUST_REGISTRY_SIGNING_DOMAIN =
  "ata.provider-trust-registry.snapshot.signature.v1" as const;

export const PROVIDER_TRUST_REGISTRY_LIMITS = Object.freeze({
  maxSnapshotBytes: 48 * 1024,
  maxKeys: 64,
  maxAgeMs: 300_000,
  maxRequestTimeoutMs: 5_000
});

const SNAPSHOT_PAYLOAD_KEYS = [
  "schemaVersion",
  "registryId",
  "rootKeyId",
  "algorithm",
  "version",
  "issuedAt",
  "expiresAt",
  "keys"
] as const;
const SNAPSHOT_ENVELOPE_KEYS = [...SNAPSHOT_PAYLOAD_KEYS, "signature"] as const;
const TRUSTED_KEY_KEYS = [
  "keyId",
  "owner",
  "publicKeyPem",
  "notBefore",
  "expiresAt",
  "revokedAt",
  "allowedProviderIds",
  "allowedPurposes"
] as const;
const SAFE_REGISTRY_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const SHA256_HEX = /^[a-fA-F0-9]{64}$/;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]{86}$/;

/** Exact signed JSON wire payload. The signature is deliberately separate. */
export interface ProviderTrustRegistrySnapshotPayload {
  readonly schemaVersion: typeof PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION;
  /** Stable owner-assigned identifier; never a URL or a response-selected host. */
  readonly registryId: string;
  /** Must equal the independently pinned deployment trust-anchor key ID. */
  readonly rootKeyId: string;
  readonly algorithm: typeof PROVIDER_TRUST_REGISTRY_SIGNATURE_ALGORITHM;
  /** Positive safe integer, strictly monotonic per registry. */
  readonly version: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
  /** Complete replacement set; omitted prior keys are no longer trusted. */
  readonly keys: readonly TrustedProviderDecisionSigningKey[];
}

/** Exact top-level registry snapshot envelope. */
export interface ProviderTrustRegistrySnapshotEnvelope
  extends ProviderTrustRegistrySnapshotPayload {
  /** Unpadded base64url encoding of the 64-byte Ed25519 signature. */
  readonly signature: string;
}

/** Deployment-provisioned trust. Neither field may come from the registry response. */
export interface ProviderTrustRegistryTrustAnchor {
  readonly registryId: string;
  readonly rootKeyId: string;
  readonly rootPublicKeyPem: string;
  /** SHA-256 of DER SubjectPublicKeyInfo bytes, as lowercase/uppercase hex. */
  readonly expectedSpkiSha256: string;
}

/** Canonical UTF-8 payload signed by the pinned registry root. */
export function getProviderTrustRegistrySigningPayload(
  snapshot: ProviderTrustRegistrySnapshotPayload
): string {
  const input: unknown = snapshot;
  if (!isRecord(input) || !hasExactKeys(input, SNAPSHOT_PAYLOAD_KEYS) ||
      input.schemaVersion !== PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION ||
      typeof input.registryId !== "string" || !SAFE_REGISTRY_ID.test(input.registryId) ||
      typeof input.rootKeyId !== "string" || !SAFE_KEY_ID.test(input.rootKeyId) ||
      input.algorithm !== PROVIDER_TRUST_REGISTRY_SIGNATURE_ALGORITHM ||
      typeof input.version !== "number" || !Number.isSafeInteger(input.version) ||
      input.version < 1 ||
      !validUtcTimestamp(input.issuedAt) ||
      !validUtcTimestamp(input.expiresAt) ||
      Date.parse(input.expiresAt) <= Date.parse(input.issuedAt) ||
      !Array.isArray(input.keys) ||
      input.keys.length > PROVIDER_TRUST_REGISTRY_LIMITS.maxKeys) {
    throw new TypeError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }

  const keys = input.keys.map((candidate) => {
    if (!isRecord(candidate) || !hasExactKeys(candidate, TRUSTED_KEY_KEYS) ||
        typeof candidate.keyId !== "string" || !SAFE_KEY_ID.test(candidate.keyId) ||
        typeof candidate.owner !== "string" || candidate.owner.trim().length === 0 ||
        candidate.owner.length > 160 ||
        typeof candidate.publicKeyPem !== "string" ||
        candidate.publicKeyPem.length > 4096 ||
        !candidate.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") ||
        !candidate.publicKeyPem.trimEnd().endsWith("-----END PUBLIC KEY-----") ||
        !validUtcTimestamp(candidate.notBefore) ||
        !validUtcTimestamp(candidate.expiresAt) ||
        !(candidate.revokedAt === null || validUtcTimestamp(candidate.revokedAt)) ||
        !isUniqueStringArray(candidate.allowedProviderIds, SAFE_REGISTRY_ID) ||
        !isUniquePurposeArray(candidate.allowedPurposes)) {
      throw new TypeError("TRUST_REGISTRY_SNAPSHOT_KEY_INVALID");
    }

    return {
      keyId: candidate.keyId,
      owner: candidate.owner,
      publicKeyPem: candidate.publicKeyPem,
      notBefore: candidate.notBefore,
      expiresAt: candidate.expiresAt,
      revokedAt: candidate.revokedAt,
      allowedProviderIds: [...candidate.allowedProviderIds],
      allowedPurposes: [...candidate.allowedPurposes]
    };
  });

  if (new Set(keys.map((key) => key.keyId)).size !== keys.length) {
    throw new TypeError("TRUST_REGISTRY_SNAPSHOT_DUPLICATE_KEY_ID");
  }

  // Explicit field order and domain separation are part of the wire protocol.
  return JSON.stringify({
    domain: PROVIDER_TRUST_REGISTRY_SIGNING_DOMAIN,
    schemaVersion: input.schemaVersion,
    registryId: input.registryId,
    rootKeyId: input.rootKeyId,
    algorithm: input.algorithm,
    version: input.version,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    keys
  });
}

export interface ProviderTrustRegistryRequest {
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  /** Concrete transports must use redirect:"error"; redirects are not trusted by default. */
  readonly redirect: "error";
  readonly acceptContentType: "application/json";
  readonly signal?: AbortSignal;
}

/** Transport returns bounded, untrusted bytes only. */
export interface ProviderTrustRegistryTransport {
  readSnapshot(request: ProviderTrustRegistryRequest): Promise<Uint8Array>;
}

export interface AuthenticatedProviderTrustSnapshot {
  readonly registryId: string;
  readonly rootKeyId: string;
  readonly version: number;
  readonly issuedAt: string;
  readonly expiresAt: string;
  readonly retrievedAt: string;
  /** SHA-256 digest of the canonical unsigned signing payload. */
  readonly canonicalPayloadSha256: string;
  readonly keys: readonly TrustedProviderDecisionSigningKey[];
}

/**
 * Verifies exact snapshot bytes against the independently provisioned root key,
 * checks the SPKI fingerprint and wire schema, and applies the issue/expiry
 * window. The returned keys must be a complete immutable replacement set.
 */
export interface ProviderTrustSnapshotAuthenticator {
  authenticate(input: {
    readonly snapshotBytes: Uint8Array;
    readonly trustAnchor: ProviderTrustRegistryTrustAnchor;
    readonly now: string;
    readonly retrievedAt: string;
    readonly maxSnapshotAgeMs: number;
  }): Promise<AuthenticatedProviderTrustSnapshot>;
}

export interface ProviderTrustRegistryHighWaterMark {
  readonly registryId: string;
  readonly version: number;
  readonly canonicalPayloadSha256: string;
}

/** Durable transactional anti-rollback storage; process memory is insufficient. */
export interface ProviderTrustRegistryHighWaterMarkStore {
  read(registryId: string): Promise<ProviderTrustRegistryHighWaterMark | null>;
  compareAndSet(input: {
    readonly expected: ProviderTrustRegistryHighWaterMark | null;
    readonly next: ProviderTrustRegistryHighWaterMark;
  }): Promise<boolean>;
}

export interface ProviderTrustRegistryState {
  readonly expectedRegistryId: string;
  readonly maxSnapshotAgeMs: number;
  readonly highWaterMarkStore: ProviderTrustRegistryHighWaterMarkStore;
}

/**
 * Owner-selected loader contract. Implementations must enforce the byte/key/time
 * limits, HTTPS and fixed-origin policy, authenticate before using keys, and
 * atomically persist the high-water mark before returning the snapshot. They
 * must reject lower versions and same-version digest equivocation. An identical
 * version+digest replay is permitted only while the snapshot remains valid.
 * Failed refreshes never fall back to cached keys.
 */
export interface ProviderTrustRegistry {
  loadCurrentSnapshot(input: {
    readonly now: string;
    readonly trustAnchor: ProviderTrustRegistryTrustAnchor;
    readonly state: ProviderTrustRegistryState;
    readonly transport: ProviderTrustRegistryTransport;
    readonly authenticator: ProviderTrustSnapshotAuthenticator;
  }): Promise<AuthenticatedProviderTrustSnapshot>;
}

export type ProviderTrustRegistryFailureCode =
  | "TRUST_REGISTRY_UNAVAILABLE"
  | "TRUST_REGISTRY_RESPONSE_TOO_LARGE"
  | "TRUST_REGISTRY_SNAPSHOT_INVALID"
  | "TRUST_REGISTRY_SNAPSHOT_KEY_INVALID"
  | "TRUST_REGISTRY_DUPLICATE_KEY_ID"
  | "TRUST_REGISTRY_IDENTITY_MISMATCH"
  | "TRUST_REGISTRY_ROOT_KEY_MISMATCH"
  | "TRUST_REGISTRY_ROOT_FINGERPRINT_MISMATCH"
  | "TRUST_REGISTRY_AUTHENTICATION_FAILED"
  | "TRUST_REGISTRY_SNAPSHOT_STALE"
  | "TRUST_REGISTRY_SNAPSHOT_FROM_FUTURE"
  | "TRUST_REGISTRY_SNAPSHOT_EXPIRED"
  | "TRUST_REGISTRY_ROLLBACK_DETECTED"
  | "TRUST_REGISTRY_VERSION_EQUIVOCATION"
  | "TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE"
  | "TRUST_REGISTRY_HIGH_WATER_MARK_CONFLICT"
  | "TRUST_REGISTRY_VERSION_INVALID"
  | "TRUST_REGISTRY_KEY_LIMIT_EXCEEDED";

/** Sanitized stable failure; do not attach response bodies, URLs, or key material. */
export class ProviderTrustRegistryError extends Error {
  readonly code: ProviderTrustRegistryFailureCode;

  constructor(code: ProviderTrustRegistryFailureCode) {
    super(code);
    this.name = "ProviderTrustRegistryError";
    this.code = code;
  }
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

function validUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    UTC_TIMESTAMP.test(value) &&
    Number.isFinite(Date.parse(value));
}

function isUniqueStringArray(
  value: unknown,
  pattern: RegExp
): value is string[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => typeof entry === "string" && pattern.test(entry)) &&
    new Set(value).size === value.length;
}

function isUniquePurposeArray(value: unknown): value is ProviderUsePurpose[] {
  return Array.isArray(value) &&
    value.length > 0 &&
    value.every((entry) => entry === "DIAGNOSTIC" || entry === "PRODUCTION") &&
    new Set(value).size === value.length;
}
