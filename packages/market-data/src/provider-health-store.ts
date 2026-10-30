import {
  assessProviderAttemptPermission,
  initialProviderHealth,
  recordProviderResult
} from "./index.js";
import type {
  ProviderErrorClass,
  ProviderHealthPolicy,
  ProviderHealthSnapshot,
  ProviderResult
} from "./index.js";

const SAFE_PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_OWNER_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const LEASE_DURATION_MIN_MS = 1_000;
const LEASE_DURATION_MAX_MS = 300_000;

export interface ProviderHealthVersionedRecord {
  readonly health: ProviderHealthSnapshot;
  readonly version: string;
}

export interface RecoveryProbeLease {
  readonly providerId: string;
  readonly ownerId: string;
  readonly leaseTokenHash: string;
  readonly fencingToken: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
}

export interface RecoveryProbeLeaseClaim {
  readonly providerId: string;
  readonly ownerId: string;
  readonly leaseTokenHash: string;
  readonly leaseDurationMs: number;
}

export interface RecoveryProbeLeaseIdentity {
  readonly providerId: string;
  readonly ownerId: string;
  readonly leaseTokenHash: string;
  readonly fencingToken: string;
}

export interface ProviderHealthStoreResult {
  readonly health: ProviderHealthSnapshot;
  readonly version: string;
  readonly recoveryLeaseReleased: boolean;
}

export interface ProviderHealthStore {
  get(providerId: string): Promise<ProviderHealthVersionedRecord | null>;
  recordResult(input: {
    readonly providerId: string;
    readonly result: ProviderResult;
    readonly policy: ProviderHealthPolicy;
    readonly recoveryLease?: RecoveryProbeLeaseIdentity;
  }): Promise<ProviderHealthStoreResult>;
  claimRecoveryProbe(input: RecoveryProbeLeaseClaim): Promise<RecoveryProbeLease | null>;
  renewRecoveryProbeLease(input: RecoveryProbeLeaseIdentity & {
    readonly leaseDurationMs: number;
  }): Promise<RecoveryProbeLease | null>;
  releaseRecoveryProbeLease(input: RecoveryProbeLeaseIdentity): Promise<boolean>;
}

export interface PostgresQueryResult<Row extends Record<string, unknown> = Record<string, unknown>> {
  readonly rows: readonly Row[];
}

export interface PostgresQueryClient {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<PostgresQueryResult<Row>>;
  release?(): void;
}

export interface PostgresPoolLike extends PostgresQueryClient {
  connect(): Promise<PostgresQueryClient>;
}

export type ProviderHealthStoreErrorCode =
  | "INVALID_INPUT"
  | "DATABASE_OPERATION_FAILED"
  | "RECOVERY_LEASE_NOT_OWNED"
  | "PROVIDER_HEALTH_ROW_INVALID"
  | "PROVIDER_RESULT_OUT_OF_ORDER";

export class ProviderHealthStoreError extends Error {
  readonly code: ProviderHealthStoreErrorCode;

  constructor(code: ProviderHealthStoreErrorCode) {
    super(code);
    this.name = "ProviderHealthStoreError";
    this.code = code;
  }
}

interface HealthDbRow extends Record<string, unknown> {
  provider_id: unknown;
  state: unknown;
  consecutive_failures: unknown;
  last_success_at: unknown;
  last_failure_at: unknown;
  last_request_at: unknown;
  last_latency_ms: unknown;
  circuit_open_until: unknown;
  last_error_class: unknown;
  version: unknown;
}

interface LeaseDbRow extends Record<string, unknown> {
  provider_id: unknown;
  owner_id: unknown;
  lease_token_hash: unknown;
  fencing_token: unknown;
  acquired_at: unknown;
  expires_at: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSafeProviderId(value: unknown): value is string {
  return typeof value === "string" && SAFE_PROVIDER_ID.test(value);
}

function isValidLeaseIdentity(input: unknown): input is RecoveryProbeLeaseIdentity {
  return isRecord(input) &&
    isSafeProviderId(input.providerId) &&
    typeof input.ownerId === "string" &&
    SAFE_OWNER_ID.test(input.ownerId) &&
    typeof input.leaseTokenHash === "string" &&
    SHA256_HEX.test(input.leaseTokenHash) &&
    typeof input.fencingToken === "string" &&
    /^[1-9][0-9]{0,18}$/.test(input.fencingToken);
}

function validateLeaseDuration(value: unknown): value is number {
  return Number.isSafeInteger(value) &&
    (value as number) >= LEASE_DURATION_MIN_MS &&
    (value as number) <= LEASE_DURATION_MAX_MS;
}

function toIsoTimestamp(value: unknown): string | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value.toISOString();
  if (typeof value === "string" && Number.isFinite(Date.parse(value))) return new Date(value).toISOString();
  return null;
}

function parseNullableTimestamp(value: unknown): string | null | undefined {
  if (value === null) return null;
  return toIsoTimestamp(value) ?? undefined;
}

function parseSafeInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^[0-9]+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

function parseFiniteNonNegative(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return null;
}

function readHealthRow(row: HealthDbRow): ProviderHealthVersionedRecord {
  if (!isSafeProviderId(row.provider_id) ||
      typeof row.state !== "string" ||
      !["UNKNOWN", "HEALTHY", "DEGRADED", "UNAVAILABLE", "CIRCUIT_OPEN"].includes(row.state)) {
    throw new ProviderHealthStoreError("PROVIDER_HEALTH_ROW_INVALID");
  }

  const consecutiveFailures = parseSafeInteger(row.consecutive_failures);
  const lastSuccessAt = parseNullableTimestamp(row.last_success_at);
  const lastFailureAt = parseNullableTimestamp(row.last_failure_at);
  const lastRequestAt = parseNullableTimestamp(row.last_request_at);
  const lastLatencyMs = row.last_latency_ms === null ? null : parseFiniteNonNegative(row.last_latency_ms);
  const circuitOpenUntil = parseNullableTimestamp(row.circuit_open_until);
  const lastErrorClass = row.last_error_class === null ? null : row.last_error_class;
  const version = typeof row.version === "string" && /^[1-9][0-9]*$/.test(row.version)
    ? row.version
    : typeof row.version === "number" && Number.isSafeInteger(row.version) && row.version >= 1
      ? String(row.version)
      : null;
  const allowedErrors: readonly string[] = ["TIMEOUT", "RATE_LIMIT", "NETWORK", "HTTP", "PARSE", "AUTH", "UNKNOWN"];

  if (consecutiveFailures === null ||
      lastSuccessAt === undefined ||
      lastFailureAt === undefined ||
      lastRequestAt === undefined ||
      (row.last_latency_ms !== null && lastLatencyMs === null) ||
      circuitOpenUntil === undefined ||
      (lastErrorClass !== null && (typeof lastErrorClass !== "string" || !allowedErrors.includes(lastErrorClass))) ||
      version === null) {
    throw new ProviderHealthStoreError("PROVIDER_HEALTH_ROW_INVALID");
  }

  const health: ProviderHealthSnapshot = {
    providerId: row.provider_id,
    state: row.state as ProviderHealthSnapshot["state"],
    consecutiveFailures,
    lastSuccessAt,
    lastFailureAt,
    lastRequestAt,
    lastLatencyMs,
    circuitOpenUntil,
    lastErrorClass: lastErrorClass as ProviderErrorClass | null
  };
  const validation = assessProviderAttemptPermission({
    health,
    nowAt: lastRequestAt ?? "2000-01-01T00:00:00.000Z",
    maxHealthAgeMs: Number.MAX_SAFE_INTEGER,
    recoveryProbeInFlight: false
  });
  if (validation.status === "INVALID_INPUT") {
    throw new ProviderHealthStoreError("PROVIDER_HEALTH_ROW_INVALID");
  }
  return { health, version };
}

function readLeaseRow(row: LeaseDbRow): RecoveryProbeLease {
  const acquiredAt = toIsoTimestamp(row.acquired_at);
  const expiresAt = toIsoTimestamp(row.expires_at);
  const fencingToken = String(row.fencing_token);
  if (!isSafeProviderId(row.provider_id) ||
      typeof row.owner_id !== "string" ||
      !SAFE_OWNER_ID.test(row.owner_id) ||
      typeof row.lease_token_hash !== "string" ||
      !SHA256_HEX.test(row.lease_token_hash) ||
      !/^[1-9][0-9]{0,18}$/.test(fencingToken) ||
      acquiredAt === null ||
      expiresAt === null) {
    throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
  }
  return {
    providerId: row.provider_id,
    ownerId: row.owner_id,
    leaseTokenHash: row.lease_token_hash,
    fencingToken,
    acquiredAt,
    expiresAt
  };
}

function healthParameters(health: ProviderHealthSnapshot): readonly unknown[] {
  return [
    health.providerId, health.state, health.consecutiveFailures,
    health.lastSuccessAt, health.lastFailureAt, health.lastRequestAt,
    health.lastLatencyMs, health.circuitOpenUntil, health.lastErrorClass
  ];
}

/** PostgreSQL-backed store. The application injects a PostgreSQL pool/driver. */
export class PostgresProviderHealthStore implements ProviderHealthStore {
  private readonly pool: PostgresPoolLike;

  constructor(pool: PostgresPoolLike) {
    if (!isRecord(pool) || typeof pool.query !== "function" || typeof pool.connect !== "function") {
      throw new ProviderHealthStoreError("INVALID_INPUT");
    }
    this.pool = pool;
  }

  async get(providerId: string): Promise<ProviderHealthVersionedRecord | null> {
    if (!isSafeProviderId(providerId)) throw new ProviderHealthStoreError("INVALID_INPUT");
    try {
      const result = await this.pool.query<HealthDbRow>(
        `/* provider_health:load */
         SELECT provider_id, state, consecutive_failures, last_success_at,
                last_failure_at, last_request_at, last_latency_ms,
                circuit_open_until, last_error_class, version
           FROM public.provider_health WHERE provider_id = $1`,
        [providerId]
      );
      return result.rows.length === 0 ? null : readHealthRow(result.rows[0]!);
    } catch (error) {
      if (error instanceof ProviderHealthStoreError) throw error;
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }
  }

  async recordResult(input: {
    readonly providerId: string;
    readonly result: ProviderResult;
    readonly policy: ProviderHealthPolicy;
    readonly recoveryLease?: RecoveryProbeLeaseIdentity;
  }): Promise<ProviderHealthStoreResult> {
    if (!isRecord(input) ||
        !isSafeProviderId(input.providerId) ||
        !isRecord(input.result) ||
        !isRecord(input.policy) ||
        !Number.isSafeInteger(input.policy.failureThreshold) ||
        (input.policy.failureThreshold as number) < 1 ||
        !Number.isSafeInteger(input.policy.cooldownMs) ||
        (input.policy.cooldownMs as number) < 1 ||
        (input.recoveryLease !== undefined &&
          (!isValidLeaseIdentity(input.recoveryLease) || input.recoveryLease.providerId !== input.providerId))) {
      throw new ProviderHealthStoreError("INVALID_INPUT");
    }

    let client: PostgresQueryClient | null = null;
    let transactionOpen = false;
    try {
      client = await this.pool.connect();
      await client.query("BEGIN");
      transactionOpen = true;

      const healthResult = await client.query<HealthDbRow>(
        `/* provider_health:lock */
         SELECT provider_id, state, consecutive_failures, last_success_at,
                last_failure_at, last_request_at, last_latency_ms,
                circuit_open_until, last_error_class, version
           FROM public.provider_health WHERE provider_id = $1 FOR UPDATE`,
        [input.providerId]
      );
      const previous = healthResult.rows.length === 0
        ? initialProviderHealth(input.providerId)
        : readHealthRow(healthResult.rows[0]!).health;

      // Once a circuit is open, only the worker holding the current distributed
      // recovery lease may write the probe result back to shared health state.
      if (previous.state === "CIRCUIT_OPEN" && input.recoveryLease === undefined) {
        throw new ProviderHealthStoreError("RECOVERY_LEASE_NOT_OWNED");
      }

      if (input.recoveryLease !== undefined) {
        const lease = input.recoveryLease;
        const leaseResult = await client.query<LeaseDbRow>(
          `/* recovery_lease:lock_for_result */
           SELECT provider_id, owner_id, lease_token_hash, fencing_token, acquired_at, expires_at
             FROM public.provider_recovery_probe_leases
            WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
              AND fencing_token = $4 AND expires_at > clock_timestamp()
            FOR UPDATE`,
          [lease.providerId, lease.ownerId, lease.leaseTokenHash, lease.fencingToken]
        );
        if (leaseResult.rows.length !== 1) {
          throw new ProviderHealthStoreError("RECOVERY_LEASE_NOT_OWNED");
        }
      }

      let next: ProviderHealthSnapshot;
      try {
        next = recordProviderResult(previous, input.result, input.policy);
      } catch {
        throw new ProviderHealthStoreError("PROVIDER_RESULT_OUT_OF_ORDER");
      }

      const upsert = await client.query<HealthDbRow>(
        `/* provider_health:upsert */
         INSERT INTO public.provider_health (
           provider_id, state, consecutive_failures, last_success_at,
           last_failure_at, last_request_at, last_latency_ms,
           circuit_open_until, last_error_class, version, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, clock_timestamp())
         ON CONFLICT (provider_id) DO UPDATE SET
           state = EXCLUDED.state,
           consecutive_failures = EXCLUDED.consecutive_failures,
           last_success_at = EXCLUDED.last_success_at,
           last_failure_at = EXCLUDED.last_failure_at,
           last_request_at = EXCLUDED.last_request_at,
           last_latency_ms = EXCLUDED.last_latency_ms,
           circuit_open_until = EXCLUDED.circuit_open_until,
           last_error_class = EXCLUDED.last_error_class,
           version = public.provider_health.version + 1,
           updated_at = clock_timestamp()
         WHERE public.provider_health.last_request_at IS NULL
            OR EXCLUDED.last_request_at >= public.provider_health.last_request_at
         RETURNING provider_id, state, consecutive_failures, last_success_at,
                   last_failure_at, last_request_at, last_latency_ms,
                   circuit_open_until, last_error_class, version`,
        healthParameters(next)
      );
      if (upsert.rows.length !== 1) {
        throw new ProviderHealthStoreError("PROVIDER_RESULT_OUT_OF_ORDER");
      }
      const stored = readHealthRow(upsert.rows[0]!);

      let recoveryLeaseReleased = false;
      if (input.recoveryLease !== undefined) {
        const lease = input.recoveryLease;
        const released = await client.query(
          `/* recovery_lease:release_after_result */
           UPDATE public.provider_recovery_probe_leases
              SET owner_id = NULL, lease_token_hash = NULL,
                  expires_at = clock_timestamp(), released_at = clock_timestamp()
            WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
              AND fencing_token = $4 AND expires_at > clock_timestamp()
            RETURNING provider_id`,
          [lease.providerId, lease.ownerId, lease.leaseTokenHash, lease.fencingToken]
        );
        if (released.rows.length !== 1) {
          throw new ProviderHealthStoreError("RECOVERY_LEASE_NOT_OWNED");
        }
        recoveryLeaseReleased = true;
      }

      await client.query("COMMIT");
      transactionOpen = false;
      return { health: stored.health, version: stored.version, recoveryLeaseReleased };
    } catch (error) {
      if (client !== null && transactionOpen) {
        try { await client.query("ROLLBACK"); } catch { /* preserve original store error */ }
      }
      if (error instanceof ProviderHealthStoreError) throw error;
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    } finally {
      client?.release?.();
    }
  }

  /** Atomic INSERT/UPSERT claim; only elapsed CIRCUIT_OPEN providers are eligible. */
  async claimRecoveryProbe(input: RecoveryProbeLeaseClaim): Promise<RecoveryProbeLease | null> {
    if (!isRecord(input) ||
        !isSafeProviderId(input.providerId) ||
        typeof input.ownerId !== "string" ||
        !SAFE_OWNER_ID.test(input.ownerId) ||
        typeof input.leaseTokenHash !== "string" ||
        !SHA256_HEX.test(input.leaseTokenHash) ||
        !validateLeaseDuration(input.leaseDurationMs)) {
      throw new ProviderHealthStoreError("INVALID_INPUT");
    }
    try {
      const result = await this.pool.query<LeaseDbRow>(
        `/* recovery_lease:claim */
         WITH eligible_health AS (
           SELECT provider_id FROM public.provider_health
            WHERE provider_id = $1 AND state = 'CIRCUIT_OPEN'
              AND circuit_open_until <= clock_timestamp()
            FOR UPDATE
         )
         INSERT INTO public.provider_recovery_probe_leases (
           provider_id, owner_id, lease_token_hash, acquired_at,
           expires_at, fencing_token, released_at
         )
         SELECT provider_id, $2, $3, clock_timestamp(),
                clock_timestamp() + ($4::bigint * interval '1 millisecond'), 1, NULL
           FROM eligible_health
         ON CONFLICT (provider_id) DO UPDATE SET
           owner_id = EXCLUDED.owner_id,
           lease_token_hash = EXCLUDED.lease_token_hash,
           acquired_at = clock_timestamp(),
           expires_at = clock_timestamp() + ($4::bigint * interval '1 millisecond'),
           fencing_token = public.provider_recovery_probe_leases.fencing_token + 1,
           released_at = NULL
         WHERE public.provider_recovery_probe_leases.expires_at <= clock_timestamp()
         RETURNING provider_id, owner_id, lease_token_hash, fencing_token, acquired_at, expires_at`,
        [input.providerId, input.ownerId, input.leaseTokenHash, input.leaseDurationMs]
      );
      return result.rows.length === 0 ? null : readLeaseRow(result.rows[0]!);
    } catch (error) {
      if (error instanceof ProviderHealthStoreError) throw error;
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }
  }

  /** Expired leases cannot be renewed; recovery must acquire a new fencing token. */
  async renewRecoveryProbeLease(
    input: RecoveryProbeLeaseIdentity & { readonly leaseDurationMs: number }
  ): Promise<RecoveryProbeLease | null> {
    if (!isValidLeaseIdentity(input) || !validateLeaseDuration(input.leaseDurationMs)) {
      throw new ProviderHealthStoreError("INVALID_INPUT");
    }
    try {
      const result = await this.pool.query<LeaseDbRow>(
        `/* recovery_lease:renew */
         UPDATE public.provider_recovery_probe_leases
            SET expires_at = clock_timestamp() + ($5::bigint * interval '1 millisecond')
          WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
            AND fencing_token = $4 AND expires_at > clock_timestamp()
          RETURNING provider_id, owner_id, lease_token_hash, fencing_token, acquired_at, expires_at`,
        [input.providerId, input.ownerId, input.leaseTokenHash, input.fencingToken, input.leaseDurationMs]
      );
      return result.rows.length === 0 ? null : readLeaseRow(result.rows[0]!);
    } catch (error) {
      if (error instanceof ProviderHealthStoreError) throw error;
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }
  }

  /** A stale worker cannot release a newer worker's lease because the fence must match. */
  async releaseRecoveryProbeLease(input: RecoveryProbeLeaseIdentity): Promise<boolean> {
    if (!isValidLeaseIdentity(input)) throw new ProviderHealthStoreError("INVALID_INPUT");
    try {
      const result = await this.pool.query(
        `/* recovery_lease:release */
         UPDATE public.provider_recovery_probe_leases
            SET owner_id = NULL, lease_token_hash = NULL,
                expires_at = clock_timestamp(), released_at = clock_timestamp()
          WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
            AND fencing_token = $4
          RETURNING provider_id`,
        [input.providerId, input.ownerId, input.leaseTokenHash, input.fencingToken]
      );
      return result.rows.length === 1;
    } catch {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }
  }
}
