/**
 * Cryptographic verification for owner-scoped provider-use decisions.
 *
 * Trust roots are supplied by the caller from an owner-controlled, reviewed
 * configuration source. This module never trusts public keys embedded in a
 * decision manifest and never grants approval merely because a signature is
 * present. Missing, ambiguous, expired, revoked or unverifiable records deny.
 */
import {
  createPublicKey,
  verify as verifyEd25519Signature
} from "node:crypto";
import type {
  ProviderUseDecision,
  ProviderUseDecisionResolver,
  ProviderUsePurpose
} from "./provider-orchestrator.js";

export const PROVIDER_USE_DECISION_ENVELOPE_VERSION = "ata.provider-use-decision.v1" as const;
export const PROVIDER_USE_DECISION_SIGNATURE_ALGORITHM = "Ed25519" as const;

const SIGNING_DOMAIN = "ata.provider-use-decision.signature.v1";
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SAFE_PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256 = /^[a-fA-F0-9]{64}$/;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]{86}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

const DECISION_KEYS = [
  "providerId", "purpose", "decisionId", "owner", "outcome", "scope",
  "decidedAt", "expiresAt", "linkedEvidenceIds", "evidenceManifestSha256"
] as const;
const ENVELOPE_KEYS = ["schemaVersion", "keyId", "algorithm", "decision", "signature"] as const;
const TRUSTED_KEY_KEYS = [
  "keyId", "owner", "publicKeyPem", "notBefore", "expiresAt", "revokedAt",
  "allowedProviderIds", "allowedPurposes"
] as const;

export interface SignedProviderUseDecisionEnvelope {
  readonly schemaVersion: typeof PROVIDER_USE_DECISION_ENVELOPE_VERSION;
  readonly keyId: string;
  readonly algorithm: typeof PROVIDER_USE_DECISION_SIGNATURE_ALGORITHM;
  readonly decision: ProviderUseDecision;
  /** Unpadded base64url encoding of the 64-byte Ed25519 signature. */
  readonly signature: string;
}

/**
 * This trust record must come from owner-controlled configuration, not from the
 * signed manifest being verified. Only an SPKI PUBLIC KEY PEM is accepted.
 */
export interface TrustedProviderDecisionSigningKey {
  readonly keyId: string;
  readonly owner: string;
  readonly publicKeyPem: string;
  readonly notBefore: string;
  readonly expiresAt: string;
  readonly revokedAt: string | null;
  readonly allowedProviderIds: readonly string[];
  readonly allowedPurposes: readonly ProviderUsePurpose[];
}

export interface ProviderUseDecisionVerificationResult {
  readonly authorized: boolean;
  readonly decision: ProviderUseDecision | null;
  readonly reasonCodes: readonly string[];
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

function validUtc(value: unknown): value is string {
  return typeof value === "string" &&
    UTC.test(value) &&
    Number.isFinite(Date.parse(value));
}

function validPurpose(value: unknown): value is ProviderUsePurpose {
  return value === "DIAGNOSTIC" || value === "PRODUCTION";
}

function invalid(reason: string): ProviderUseDecisionVerificationResult {
  return { authorized: false, decision: null, reasonCodes: [reason] };
}

function decodeBase64UrlSignature(value: string): Uint8Array | null {
  if (!BASE64URL_SIGNATURE.test(value)) return null;
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
  const output = new Uint8Array(64);
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

  // A canonical 64-byte base64url value has four zero padding bits.
  if (offset !== output.length || bits !== 4 || accumulator !== 0) return null;
  return output;
}

/**
 * Returns the exact UTF-8 payload that the owner must sign. Property order is
 * explicitly fixed and the signature field is excluded. Do not replace this
 * with signing an arbitrary JSON serialization of the source manifest.
 */
export function getProviderUseDecisionSigningPayload(
  envelopeInput: Omit<SignedProviderUseDecisionEnvelope, "signature">
): string {
  const envelope = envelopeInput as unknown;
  if (!isRecord(envelope) ||
      !hasExactKeys(envelope, ["schemaVersion", "keyId", "algorithm", "decision"]) ||
      !isRecord(envelope.decision) ||
      !hasExactKeys(envelope.decision, DECISION_KEYS)) {
    throw new TypeError("PROVIDER_USE_DECISION_SIGNING_PAYLOAD_INVALID");
  }

  const decision = envelope.decision;
  const payload = {
    domain: SIGNING_DOMAIN,
    schemaVersion: envelope.schemaVersion,
    keyId: envelope.keyId,
    algorithm: envelope.algorithm,
    decision: {
      providerId: decision.providerId,
      purpose: decision.purpose,
      decisionId: decision.decisionId,
      owner: decision.owner,
      outcome: decision.outcome,
      scope: decision.scope,
      decidedAt: decision.decidedAt,
      expiresAt: decision.expiresAt,
      linkedEvidenceIds: decision.linkedEvidenceIds,
      evidenceManifestSha256: decision.evidenceManifestSha256
    }
  };
  return JSON.stringify(payload);
}

function validateDecision(
  value: unknown,
  providerId: string,
  purpose: ProviderUsePurpose,
  at: string
): ProviderUseDecisionVerificationResult | null {
  if (!isRecord(value) || !hasExactKeys(value, DECISION_KEYS) ||
      value.providerId !== providerId ||
      value.purpose !== purpose ||
      typeof value.decisionId !== "string" || !SAFE_ID.test(value.decisionId) ||
      typeof value.owner !== "string" || value.owner.trim().length === 0 || value.owner.length > 160 ||
      typeof value.scope !== "string" || value.scope.trim().length === 0 || value.scope.length > 512 ||
      !["PROCEED_DIAGNOSTIC_ONLY", "PROCEED_PRODUCTION_SCOPE", "REJECT", "DEFER"].includes(String(value.outcome)) ||
      !validUtc(value.decidedAt) ||
      !validUtc(value.expiresAt) ||
      !Array.isArray(value.linkedEvidenceIds) ||
      value.linkedEvidenceIds.length === 0 ||
      !value.linkedEvidenceIds.every((id) => typeof id === "string" && SAFE_ID.test(id)) ||
      new Set(value.linkedEvidenceIds).size !== value.linkedEvidenceIds.length ||
      typeof value.evidenceManifestSha256 !== "string" ||
      !SHA256.test(value.evidenceManifestSha256)) {
    return invalid("PROVIDER_USE_DECISION_INVALID");
  }

  if (Date.parse(value.decidedAt) > Date.parse(at)) {
    return invalid("PROVIDER_USE_DECISION_NOT_YET_EFFECTIVE");
  }
  if (Date.parse(value.expiresAt) <= Date.parse(at)) {
    return invalid("PROVIDER_USE_DECISION_EXPIRED");
  }
  if (value.outcome === "REJECT") return invalid("PROVIDER_USE_DECISION_REJECTED");
  if (value.outcome === "DEFER") return invalid("PROVIDER_USE_DECISION_DEFERRED");
  if (purpose === "DIAGNOSTIC" && value.outcome !== "PROCEED_DIAGNOSTIC_ONLY") {
    return invalid("PROVIDER_DIAGNOSTIC_USE_NOT_APPROVED");
  }
  if (purpose === "PRODUCTION" && value.outcome !== "PROCEED_PRODUCTION_SCOPE") {
    return invalid("PROVIDER_PRODUCTION_USE_NOT_APPROVED");
  }
  return null;
}

function validateTrustedKey(
  value: unknown,
  keyId: string,
  owner: string,
  providerId: string,
  purpose: ProviderUsePurpose,
  at: string
): ProviderUseDecisionVerificationResult | null {
  if (!isRecord(value) || !hasExactKeys(value, TRUSTED_KEY_KEYS) ||
      value.keyId !== keyId ||
      value.owner !== owner ||
      typeof value.keyId !== "string" || !SAFE_KEY_ID.test(value.keyId) ||
      typeof value.owner !== "string" || value.owner.trim().length === 0 || value.owner.length > 160 ||
      typeof value.publicKeyPem !== "string" || value.publicKeyPem.length > 4096 ||
      !value.publicKeyPem.startsWith("-----BEGIN PUBLIC KEY-----") ||
      !value.publicKeyPem.trimEnd().endsWith("-----END PUBLIC KEY-----") ||
      !validUtc(value.notBefore) ||
      !validUtc(value.expiresAt) ||
      !(value.revokedAt === null || validUtc(value.revokedAt)) ||
      !Array.isArray(value.allowedProviderIds) ||
      value.allowedProviderIds.length === 0 ||
      !value.allowedProviderIds.every((id) => typeof id === "string" && SAFE_PROVIDER_ID.test(id)) ||
      new Set(value.allowedProviderIds).size !== value.allowedProviderIds.length ||
      !Array.isArray(value.allowedPurposes) ||
      value.allowedPurposes.length === 0 ||
      !value.allowedPurposes.every(validPurpose) ||
      new Set(value.allowedPurposes).size !== value.allowedPurposes.length) {
    return invalid("PROVIDER_DECISION_TRUSTED_KEY_INVALID");
  }

  if (Date.parse(value.notBefore) > Date.parse(at) ||
      Date.parse(value.expiresAt) <= Date.parse(at) ||
      (value.revokedAt !== null && Date.parse(value.revokedAt) <= Date.parse(at))) {
    return invalid("PROVIDER_DECISION_TRUSTED_KEY_INACTIVE");
  }
  if (!value.allowedProviderIds.includes(providerId) ||
      !value.allowedPurposes.includes(purpose)) {
    return invalid("PROVIDER_DECISION_TRUSTED_KEY_SCOPE_MISMATCH");
  }
  return null;
}

export function verifySignedProviderUseDecision(input: {
  readonly envelope: unknown;
  readonly trustedKeys: readonly TrustedProviderDecisionSigningKey[];
  readonly providerId: string;
  readonly purpose: ProviderUsePurpose;
  readonly at: string;
}): ProviderUseDecisionVerificationResult {
  const { envelope, trustedKeys, providerId, purpose, at } = input;
  if (!SAFE_PROVIDER_ID.test(providerId) || !validPurpose(purpose) || !validUtc(at)) {
    return invalid("PROVIDER_USE_DECISION_VERIFICATION_INPUT_INVALID");
  }
  if (!isRecord(envelope) || !hasExactKeys(envelope, ENVELOPE_KEYS) ||
      envelope.schemaVersion !== PROVIDER_USE_DECISION_ENVELOPE_VERSION ||
      envelope.algorithm !== PROVIDER_USE_DECISION_SIGNATURE_ALGORITHM ||
      typeof envelope.keyId !== "string" || !SAFE_KEY_ID.test(envelope.keyId) ||
      typeof envelope.signature !== "string" || !BASE64URL_SIGNATURE.test(envelope.signature)) {
    return invalid("PROVIDER_USE_DECISION_ENVELOPE_INVALID");
  }

  const decisionFailure = validateDecision(envelope.decision, providerId, purpose, at);
  if (decisionFailure !== null) return decisionFailure;

  if (!Array.isArray(trustedKeys)) return invalid("PROVIDER_DECISION_TRUSTED_KEYS_INVALID");
  const matchingKeys = trustedKeys.filter((key) =>
    isRecord(key) && key.keyId === envelope.keyId
  );
  if (matchingKeys.length !== 1) return invalid("PROVIDER_DECISION_TRUSTED_KEY_MISSING_OR_AMBIGUOUS");

  const owner = (envelope.decision as Record<string, unknown>).owner;
  const keyFailure = validateTrustedKey(
    matchingKeys[0],
    envelope.keyId,
    String(owner),
    providerId,
    purpose,
    at
  );
  if (keyFailure !== null) return keyFailure;

  try {
    const trustedKey = matchingKeys[0] as TrustedProviderDecisionSigningKey;
    const publicKey = createPublicKey(trustedKey.publicKeyPem);
    if (publicKey.asymmetricKeyType !== "ed25519") {
      return invalid("PROVIDER_DECISION_TRUSTED_KEY_ALGORITHM_INVALID");
    }
    const signature = decodeBase64UrlSignature(envelope.signature);
    if (signature === null) {
      return invalid("PROVIDER_USE_DECISION_SIGNATURE_INVALID");
    }

    const payload = getProviderUseDecisionSigningPayload({
      schemaVersion: PROVIDER_USE_DECISION_ENVELOPE_VERSION,
      keyId: envelope.keyId,
      algorithm: PROVIDER_USE_DECISION_SIGNATURE_ALGORITHM,
      decision: envelope.decision as ProviderUseDecision
    });
    const valid = verifyEd25519Signature(
      null,
      new TextEncoder().encode(payload),
      publicKey,
      signature
    );
    if (!valid) return invalid("PROVIDER_USE_DECISION_SIGNATURE_INVALID");

    const decision = envelope.decision as ProviderUseDecision;
    return {
      authorized: true,
      decision: Object.freeze({
        ...decision,
        linkedEvidenceIds: Object.freeze([...decision.linkedEvidenceIds])
      }),
      reasonCodes: []
    };
  } catch {
    return invalid("PROVIDER_USE_DECISION_SIGNATURE_INVALID");
  }
}

/**
 * Build a resolver from owner-controlled signed decision records and a
 * separately configured trusted-key registry. Exactly one envelope may match
 * a provider/purpose pair; ambiguity, bad JSON snapshots and all verification
 * failures return undefined, preserving the orchestrator's default-deny gate.
 */
/**
 * Static resolver for short-lived or externally supervised contexts. A
 * long-running runtime should prefer createReloadableSignedProviderUseDecisionResolver
 * so owner key revocations are observed without restarting the process.
 */
export function createSignedProviderUseDecisionResolver(input: {
  readonly envelopes: readonly unknown[];
  readonly trustedKeys: readonly TrustedProviderDecisionSigningKey[];
}): ProviderUseDecisionResolver {
  let envelopes: unknown[];
  let trustedKeys: TrustedProviderDecisionSigningKey[];
  try {
    envelopes = JSON.parse(JSON.stringify(input.envelopes)) as unknown[];
    trustedKeys = JSON.parse(JSON.stringify(input.trustedKeys)) as TrustedProviderDecisionSigningKey[];
    if (!Array.isArray(envelopes) || !Array.isArray(trustedKeys)) return () => undefined;
  } catch {
    return () => undefined;
  }

  return (providerId, purpose, at) => {
    const matching = envelopes.filter((candidate) =>
      isRecord(candidate) &&
      isRecord(candidate.decision) &&
      candidate.decision.providerId === providerId &&
      candidate.decision.purpose === purpose
    );
    if (matching.length !== 1) return undefined;

    const result = verifySignedProviderUseDecision({
      envelope: matching[0],
      trustedKeys,
      providerId,
      purpose,
      at
    });
    return result.authorized ? result.decision ?? undefined : undefined;
  };
}


export interface TrustedProviderDecisionKeySnapshot {
  /** Time at which the complete key/revocation registry snapshot was read. */
  readonly loadedAt: string;
  readonly keys: readonly TrustedProviderDecisionSigningKey[];
}

/**
 * Build a resolver that reloads the trusted-key registry for every provider
 * attempt. This is intended for long-running processes where key revocation
 * must take effect without restarting the process.
 *
 * The owner-controlled loader must return the current authoritative registry,
 * not a process-local cached copy. A snapshot older than maxSnapshotAgeMs,
 * dated in the future, malformed, or unavailable denies the provider attempt.
 */
export function createReloadableSignedProviderUseDecisionResolver(input: {
  readonly envelopes: readonly unknown[];
  readonly loadTrustedKeySnapshot: () => unknown;
  /** Explicit freshness bound for the revocation registry, limited to five minutes. */
  readonly maxSnapshotAgeMs: number;
}): ProviderUseDecisionResolver {
  let envelopes: unknown[];
  try {
    envelopes = JSON.parse(JSON.stringify(input.envelopes)) as unknown[];
    if (!Array.isArray(envelopes) ||
        !Number.isSafeInteger(input.maxSnapshotAgeMs) ||
        input.maxSnapshotAgeMs < 1 ||
        input.maxSnapshotAgeMs > 300_000 ||
        typeof input.loadTrustedKeySnapshot !== "function") {
      return () => undefined;
    }
  } catch {
    return () => undefined;
  }

  return (providerId, purpose, at) => {
    const matching = envelopes.filter((candidate) =>
      isRecord(candidate) &&
      isRecord(candidate.decision) &&
      candidate.decision.providerId === providerId &&
      candidate.decision.purpose === purpose
    );
    if (matching.length !== 1) return undefined;

    let snapshot: unknown;
    try {
      snapshot = JSON.parse(JSON.stringify(input.loadTrustedKeySnapshot())) as unknown;
    } catch {
      return undefined;
    }
    if (!isRecord(snapshot) ||
        !hasExactKeys(snapshot, ["loadedAt", "keys"]) ||
        !validUtc(snapshot.loadedAt) ||
        !Array.isArray(snapshot.keys) ||
        !validUtc(at)) {
      return undefined;
    }

    const ageMs = Date.parse(at) - Date.parse(snapshot.loadedAt);
    if (ageMs < 0 || ageMs > input.maxSnapshotAgeMs) return undefined;

    const result = verifySignedProviderUseDecision({
      envelope: matching[0],
      trustedKeys: snapshot.keys as TrustedProviderDecisionSigningKey[],
      providerId,
      purpose,
      at
    });
    return result.authorized ? result.decision ?? undefined : undefined;
  };
}
