/**
 * Phase 6.46 Step 3 — PostgreSQL-backed monotonic trust-registry state.
 *
 * This adapter exposes durable high-water mark read/CAS operations only. It
 * never loads public keys from PostgreSQL as a trust source or authorizes use.
 */
import type { PostgresQueryClient } from "./provider-health-store.js";
import {
  getProviderTrustRegistrySigningPayload,
  PROVIDER_TRUST_REGISTRY_LIMITS,
  PROVIDER_TRUST_REGISTRY_SIGNATURE_ALGORITHM,
  PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
  ProviderTrustRegistryError,
  validateProviderTrustRegistryHighWaterMark
} from "./provider-trust-registry.js";
import type {
  AuthenticatedProviderTrustSnapshot,
  ProviderTrustRegistryHighWaterMark,
  ProviderTrustRegistryHighWaterMarkStore
} from "./provider-trust-registry.js";

const SAFE_REGISTRY_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SHA256_HEX = /^[a-fA-F0-9]{64}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

interface HighWaterMarkDbRow extends Record<string, unknown> {
  registry_id: unknown;
  version: unknown;
  canonical_payload_sha256: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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

function normalizedHighWaterMark(
  value: unknown,
  registryId: string
): ProviderTrustRegistryHighWaterMark {
  try {
    const validated = validateProviderTrustRegistryHighWaterMark(value, registryId);
    return Object.freeze({
      registryId: validated.registryId,
      version: validated.version,
      canonicalPayloadSha256: validated.canonicalPayloadSha256.toLowerCase()
    });
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_INVALID");
  }
}

function readDatabaseRow(
  row: HighWaterMarkDbRow,
  expectedRegistryId: string
): ProviderTrustRegistryHighWaterMark {
  if (row.registry_id !== expectedRegistryId) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_INVALID");
  }
  let version: number | null = null;
  if (typeof row.version === "string" && /^[1-9][0-9]*$/.test(row.version)) {
    const parsed = Number(row.version);
    if (Number.isSafeInteger(parsed) && parsed > 0) version = parsed;
  } else if (typeof row.version === "number" &&
      Number.isSafeInteger(row.version) && row.version > 0) {
    version = row.version;
  }
  if (version === null ||
      typeof row.canonical_payload_sha256 !== "string" ||
      !SHA256_HEX.test(row.canonical_payload_sha256)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_INVALID");
  }
  return Object.freeze({
    registryId: expectedRegistryId,
    version,
    canonicalPayloadSha256: row.canonical_payload_sha256.toLowerCase()
  });
}

/**
 * One SQL statement per operation. PostgreSQL uniqueness and row locks ensure
 * that two workers using the same expected state cannot both advance it.
 */
export class PostgresProviderTrustRegistryHighWaterMarkStore
implements ProviderTrustRegistryHighWaterMarkStore {
  private readonly client: Pick<PostgresQueryClient, "query">;

  constructor(client: Pick<PostgresQueryClient, "query">) {
    if (!isRecord(client) || typeof client.query !== "function") {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
    }
    this.client = client;
  }

  async read(registryId: string): Promise<ProviderTrustRegistryHighWaterMark | null> {
    if (typeof registryId !== "string" || !SAFE_REGISTRY_ID.test(registryId)) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_INVALID");
    }
    try {
      const result = await this.client.query<HighWaterMarkDbRow>(
        "/* provider_trust_registry_high_water_mark:read */ " +
        "SELECT registry_id, version::text AS version, " +
        "canonical_payload_sha256::text AS canonical_payload_sha256 " +
        "FROM public.provider_trust_registry_high_water_marks WHERE registry_id = $1",
        [registryId]
      );
      if (!Array.isArray(result.rows) || result.rows.length > 1) {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_INVALID");
      }
      return result.rows.length === 0
        ? null
        : readDatabaseRow(result.rows[0]!, registryId);
    } catch (error) {
      if (error instanceof ProviderTrustRegistryError) throw error;
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
    }
  }

  /**
   * Strictly advances one registry row. Empty expected state uses INSERT with
   * conflict-deny; otherwise UPDATE matches both expected version and digest.
   */
  async compareAndSet(input: {
    readonly expected: ProviderTrustRegistryHighWaterMark | null;
    readonly next: ProviderTrustRegistryHighWaterMark;
  }): Promise<boolean> {
    if (!isRecord(input) || !isRecord(input.next)) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_INVALID");
    }
    const next = normalizedHighWaterMark(input.next, input.next.registryId);
    let expected: ProviderTrustRegistryHighWaterMark | null = null;
    if (input.expected !== null) {
      if (!isRecord(input.expected)) {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_INVALID");
      }
      expected = normalizedHighWaterMark(input.expected, next.registryId);
      if (next.version <= expected.version) {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_VERSION_INVALID");
      }
    }

    try {
      const result = expected === null
        ? await this.client.query<HighWaterMarkDbRow>(
          "/* provider_trust_registry_high_water_mark:insert_cas */ " +
          "INSERT INTO public.provider_trust_registry_high_water_marks " +
          "(registry_id, version, canonical_payload_sha256, updated_at) " +
          "VALUES ($1, $2::bigint, $3, clock_timestamp()) " +
          "ON CONFLICT (registry_id) DO NOTHING " +
          "RETURNING registry_id, version::text AS version, " +
          "canonical_payload_sha256::text AS canonical_payload_sha256",
          [next.registryId, String(next.version), next.canonicalPayloadSha256]
        )
        : await this.client.query<HighWaterMarkDbRow>(
          "/* provider_trust_registry_high_water_mark:update_cas */ " +
          "UPDATE public.provider_trust_registry_high_water_marks " +
          "SET version = $4::bigint, canonical_payload_sha256 = $5, updated_at = clock_timestamp() " +
          "WHERE registry_id = $1 AND version = $2::bigint AND canonical_payload_sha256 = $3 " +
          "RETURNING registry_id, version::text AS version, " +
          "canonical_payload_sha256::text AS canonical_payload_sha256",
          [
            next.registryId,
            String(expected.version),
            expected.canonicalPayloadSha256,
            String(next.version),
            next.canonicalPayloadSha256
          ]
        );

      if (!Array.isArray(result.rows) || result.rows.length > 1) {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
      }
      return result.rows.length === 1;
    } catch (error) {
      if (error instanceof ProviderTrustRegistryError) throw error;
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
    }
  }
}

/**
 * Advances durable anti-rollback state before returning a snapshot to its
 * caller. Same-version/same-digest replay is allowed only after freshness and
 * canonical-digest revalidation. Rollback, equivocation, storage failures and
 * CAS races reject rather than exposing candidate keys.
 */
export async function advanceProviderTrustRegistryHighWaterMark(input: {
  readonly snapshot: AuthenticatedProviderTrustSnapshot;
  readonly now: string;
  readonly maxSnapshotAgeMs: number;
  readonly store: ProviderTrustRegistryHighWaterMarkStore;
}): Promise<AuthenticatedProviderTrustSnapshot> {
  const snapshot = input?.snapshot;
  if (!isRecord(input) ||
      !isRecord(snapshot) ||
      !hasExactKeys(snapshot, [
        "registryId",
        "rootKeyId",
        "version",
        "issuedAt",
        "expiresAt",
        "retrievedAt",
        "canonicalPayloadSha256",
        "keys"
      ]) ||
      typeof snapshot.registryId !== "string" ||
      !SAFE_REGISTRY_ID.test(snapshot.registryId) ||
      !isValidUtcTimestamp(input.now) ||
      !isValidUtcTimestamp(snapshot.issuedAt) ||
      !isValidUtcTimestamp(snapshot.expiresAt) ||
      !isValidUtcTimestamp(snapshot.retrievedAt) ||
      !Number.isSafeInteger(input.maxSnapshotAgeMs) ||
      input.maxSnapshotAgeMs < 1 ||
      input.maxSnapshotAgeMs > PROVIDER_TRUST_REGISTRY_LIMITS.maxAgeMs ||
      Date.parse(snapshot.issuedAt) > Date.parse(snapshot.retrievedAt) ||
      Date.parse(snapshot.retrievedAt) > Date.parse(input.now) ||
      Date.parse(snapshot.issuedAt) > Date.parse(input.now) ||
      Date.parse(snapshot.expiresAt) <= Date.parse(input.now) ||
      Date.parse(input.now) - Date.parse(snapshot.issuedAt) > input.maxSnapshotAgeMs ||
      typeof snapshot.canonicalPayloadSha256 !== "string" ||
      !SHA256_HEX.test(snapshot.canonicalPayloadSha256) ||
      !Array.isArray(snapshot.keys) ||
      !isRecord(input.store) ||
      typeof input.store.read !== "function" ||
      typeof input.store.compareAndSet !== "function") {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }

  let canonicalPayload: string;
  try {
    canonicalPayload = getProviderTrustRegistrySigningPayload({
      schemaVersion: PROVIDER_TRUST_REGISTRY_SNAPSHOT_VERSION,
      registryId: snapshot.registryId,
      rootKeyId: snapshot.rootKeyId,
      algorithm: PROVIDER_TRUST_REGISTRY_SIGNATURE_ALGORITHM,
      version: snapshot.version,
      issuedAt: snapshot.issuedAt,
      expiresAt: snapshot.expiresAt,
      keys: snapshot.keys
    });
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }

  const encoded = new TextEncoder().encode(canonicalPayload);
  const digestInput = new Uint8Array(encoded.byteLength);
  digestInput.set(encoded);
  let digest: string;
  try {
    const digestBytes = new Uint8Array(
      await globalThis.crypto.subtle.digest("SHA-256", digestInput)
    );
    digest = Array.from(digestBytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
  }
  if (digest !== snapshot.canonicalPayloadSha256.toLowerCase()) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }

  let current: ProviderTrustRegistryHighWaterMark | null;
  try {
    const value = await input.store.read(snapshot.registryId);
    current = value === null
      ? null
      : normalizedHighWaterMark(value, snapshot.registryId);
  } catch (error) {
    if (error instanceof ProviderTrustRegistryError) throw error;
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
  }

  const next: ProviderTrustRegistryHighWaterMark = Object.freeze({
    registryId: snapshot.registryId,
    version: snapshot.version,
    canonicalPayloadSha256: digest
  });

  if (current !== null) {
    if (next.version < current.version) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_ROLLBACK_DETECTED");
    }
    if (next.version === current.version) {
      if (next.canonicalPayloadSha256 !== current.canonicalPayloadSha256) {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_VERSION_EQUIVOCATION");
      }
      return freezeAuthenticatedSnapshot(snapshot);
    }
  }

  let advanced: boolean;
  try {
    advanced = await input.store.compareAndSet({ expected: current, next });
  } catch (error) {
    if (error instanceof ProviderTrustRegistryError) throw error;
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
  }
  if (!advanced) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_CONFLICT");
  }

  return freezeAuthenticatedSnapshot(snapshot);
}

function freezeAuthenticatedSnapshot(
  snapshot: AuthenticatedProviderTrustSnapshot
): AuthenticatedProviderTrustSnapshot {
  const keys = Object.freeze(snapshot.keys.map((key) => Object.freeze({
    keyId: key.keyId,
    owner: key.owner,
    publicKeyPem: key.publicKeyPem,
    notBefore: key.notBefore,
    expiresAt: key.expiresAt,
    revokedAt: key.revokedAt,
    allowedProviderIds: Object.freeze([...key.allowedProviderIds]),
    allowedPurposes: Object.freeze([...key.allowedPurposes])
  })));
  return Object.freeze({ ...snapshot, keys });
}
