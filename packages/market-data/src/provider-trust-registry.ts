/**
 * Phase 6.46 — provider trust-registry transport contract.
 *
 * This module deliberately contains no vendor URL, credential lookup, network
 * client, or implicit trust bootstrap. A concrete adapter must be selected by
 * the owner and must authenticate snapshots against an independently pinned
 * trust anchor before returning them to the signed-decision resolver.
 */

export const PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION =
  "ata.provider-trust-registry-snapshot.v1" as const;

export const PROVIDER_TRUST_REGISTRY_LIMITS = Object.freeze({
  maxSnapshotBytes: 48 * 1024,
  maxKeys: 64,
  maxAgeMs: 300_000,
  maxRequestTimeoutMs: 5_000
});

export interface ProviderTrustRegistrySnapshot {
  readonly schemaVersion: typeof PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION;
  /** Stable registry identity configured by the owner, not supplied as trust. */
  readonly registryId: string;
  /** Monotonic unsigned 64-bit decimal sequence; rollback is always denied. */
  readonly sequence: string;
  /** UTC time asserted by the registry and covered by its authenticated payload. */
  readonly issuedAt: string;
  readonly keys: readonly unknown[];
}

export interface AuthenticatedProviderTrustSnapshot {
  readonly registryId: string;
  readonly sequence: bigint;
  readonly issuedAt: string;
  readonly loadedAt: string;
  readonly keys: readonly unknown[];
  readonly payloadSha256: string;
}

export interface ProviderTrustRegistryRequest {
  readonly timeoutMs: number;
  readonly maxResponseBytes: number;
  readonly signal?: AbortSignal;
}

/**
 * Transport returns untrusted bytes only. The consumer MUST authenticate and
 * validate the complete snapshot before exposing keys to authorization code.
 */
export interface ProviderTrustRegistryTransport {
  readSnapshot(request: ProviderTrustRegistryRequest): Promise<Uint8Array>;
}

/**
 * Independent trust-anchor verifier. Implementations must pin the registry
 * identity and verification key outside the fetched snapshot, authenticate
 * the exact canonical payload bytes, and reject unknown algorithms/key IDs.
 */
export interface ProviderTrustSnapshotAuthenticator {
  authenticate(input: {
    readonly snapshotBytes: Uint8Array;
    readonly expectedRegistryId: string;
    readonly now: string;
  }): Promise<AuthenticatedProviderTrustSnapshot>;
}

export interface ProviderTrustRegistryState {
  readonly expectedRegistryId: string;
  readonly maxSnapshotAgeMs: number;
  readonly lastAcceptedSequence: bigint;
}

/**
 * Fail-closed boundary for an owner-selected registry adapter. The adapter
 * implementation must:
 * - enforce the fixed byte/key/time limits above before parsing;
 * - reject redirects unless the owner explicitly pins the final origin;
 * - reject non-HTTPS transport outside controlled tests;
 * - authenticate with an independently pinned trust anchor;
 * - enforce registry identity, UTC timestamps, key count and key schema;
 * - reject future-issued, stale, duplicate, or lower-sequence snapshots;
 * - never fall back to cached keys when refresh fails.
 *
 * Sequence persistence is the caller's responsibility and must be durable
 * across process restarts before this can be used for production authorization.
 */
export interface ProviderTrustRegistry {
  loadCurrentSnapshot(input: {
    readonly now: string;
    readonly state: ProviderTrustRegistryState;
    readonly transport: ProviderTrustRegistryTransport;
    readonly authenticator: ProviderTrustSnapshotAuthenticator;
  }): Promise<AuthenticatedProviderTrustSnapshot>;
}

export type ProviderTrustRegistryFailureCode =
  | "TRUST_REGISTRY_UNAVAILABLE"
  | "TRUST_REGISTRY_RESPONSE_TOO_LARGE"
  | "TRUST_REGISTRY_SNAPSHOT_INVALID"
  | "TRUST_REGISTRY_IDENTITY_MISMATCH"
  | "TRUST_REGISTRY_AUTHENTICATION_FAILED"
  | "TRUST_REGISTRY_SNAPSHOT_STALE"
  | "TRUST_REGISTRY_SNAPSHOT_FROM_FUTURE"
  | "TRUST_REGISTRY_ROLLBACK_DETECTED"
  | "TRUST_REGISTRY_SEQUENCE_INVALID"
  | "TRUST_REGISTRY_KEY_LIMIT_EXCEEDED";

/** A sanitized error; never include response bodies, URLs with secrets, or keys. */
export class ProviderTrustRegistryError extends Error {
  readonly code: ProviderTrustRegistryFailureCode;

  constructor(code: ProviderTrustRegistryFailureCode) {
    super(code);
    this.name = "ProviderTrustRegistryError";
    this.code = code;
  }
}
