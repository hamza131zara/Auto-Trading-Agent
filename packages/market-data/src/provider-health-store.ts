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
const LEASE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const LEASE_DURATION_MIN_MS = 1_000;
const LEASE_DURATION_MAX_MS = 300_000;
const POSTGRES_BIGINT_MAX = 9_223_372_036_854_775_807n;

export interface ProviderHealthVersionedRecord {
  readonly health: ProviderHealthSnapshot;
  readonly version: string;
}

export interface RecoveryProbeLease {
  readonly providerId: string;
  readonly ownerId: string;
  readonly leaseToken: string;
  readonly fencingToken: string;
  readonly acquiredAt: string;
  readonly expiresAt: string;
}

export interface RecoveryProbeLeaseClaim {
  readonly providerId: string;
  readonly ownerId: string;
  readonly leaseToken: string;
  readonly leaseDurationMs: number;
}

export interface RecoveryProbeLeaseIdentity {
  readonly providerId: string;
  readonly ownerId: string;
  readonly leaseToken: string;
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
    typeof input.leaseToken === "string" &&
    LEASE_TOKEN_PATTERN.test(input.leaseToken) &&
    typeof input.fencingToken === "string" &&
    /^[1-9][0-9]{0,18}$/.test(input.fencingToken) &&
    BigInt(input.fencingToken) <= POSTGRES_BIGINT_MAX;
}

async function hashLeaseToken(token: string): Promise<string> {
  try {
    const digest = await globalThis.crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(token)
    );
    return Array.from(new Uint8Array(digest), (value) =>
      value.toString(16).padStart(2, "0")
    ).join("");
  } catch {
    throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
  }
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

function readLeaseRow(row: LeaseDbRow, leaseToken: string): RecoveryProbeLease {
  const acquiredAt = toIsoTimestamp(row.acquired_at);
  const expiresAt = toIsoTimestamp(row.expires_at);
  const fencingToken = String(row.fencing_token);
  if (!isSafeProviderId(row.provider_id) ||
      typeof row.owner_id !== "string" ||
      !SAFE_OWNER_ID.test(row.owner_id) ||
      typeof row.lease_token_hash !== "string" ||
      !SHA256_HEX.test(row.lease_token_hash) ||
      !/^[1-9][0-9]{0,18}$/.test(fencingToken) ||
      BigInt(fencingToken) > POSTGRES_BIGINT_MAX ||
      acquiredAt === null ||
      expiresAt === null) {
    throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
  }
  return {
    providerId: row.provider_id,
    ownerId: row.owner_id,
    leaseToken,
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
        const leaseTokenHash = await hashLeaseToken(lease.leaseToken);
        const leaseResult = await client.query<LeaseDbRow>(
          `/* recovery_lease:lock_for_result */
           SELECT provider_id, owner_id, lease_token_hash, fencing_token, acquired_at, expires_at
             FROM public.provider_recovery_probe_leases
            WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
              AND fencing_token = $4 AND expires_at > clock_timestamp()
            FOR UPDATE`,
          [lease.providerId, lease.ownerId, leaseTokenHash, lease.fencingToken]
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
        const leaseTokenHash = await hashLeaseToken(lease.leaseToken);
        const released = await client.query(
          `/* recovery_lease:release_after_result */
           UPDATE public.provider_recovery_probe_leases
              SET owner_id = NULL, lease_token_hash = NULL,
                  expires_at = clock_timestamp(), released_at = clock_timestamp()
            WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
              AND fencing_token = $4 AND expires_at > clock_timestamp()
            RETURNING provider_id`,
          [lease.providerId, lease.ownerId, leaseTokenHash, lease.fencingToken]
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
        typeof input.leaseToken !== "string" ||
        !LEASE_TOKEN_PATTERN.test(input.leaseToken) ||
        !validateLeaseDuration(input.leaseDurationMs)) {
      throw new ProviderHealthStoreError("INVALID_INPUT");
    }
    try {
      const leaseTokenHash = await hashLeaseToken(input.leaseToken);
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
        [input.providerId, input.ownerId, leaseTokenHash, input.leaseDurationMs]
      );
      return result.rows.length === 0 ? null : readLeaseRow(result.rows[0]!, input.leaseToken);
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
      const leaseTokenHash = await hashLeaseToken(input.leaseToken);
      const result = await this.pool.query<LeaseDbRow>(
        `/* recovery_lease:renew */
         UPDATE public.provider_recovery_probe_leases
            SET expires_at = clock_timestamp() + ($5::bigint * interval '1 millisecond')
          WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
            AND fencing_token = $4 AND expires_at > clock_timestamp()
          RETURNING provider_id, owner_id, lease_token_hash, fencing_token, acquired_at, expires_at`,
        [input.providerId, input.ownerId, leaseTokenHash, input.fencingToken, input.leaseDurationMs]
      );
      return result.rows.length === 0 ? null : readLeaseRow(result.rows[0]!, input.leaseToken);
    } catch (error) {
      if (error instanceof ProviderHealthStoreError) throw error;
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }
  }

  /** A stale worker cannot release a newer worker's lease because the fence must match. */
  async releaseRecoveryProbeLease(input: RecoveryProbeLeaseIdentity): Promise<boolean> {
    if (!isValidLeaseIdentity(input)) throw new ProviderHealthStoreError("INVALID_INPUT");
    try {
      const leaseTokenHash = await hashLeaseToken(input.leaseToken);
      const result = await this.pool.query(
        `/* recovery_lease:release */
         UPDATE public.provider_recovery_probe_leases
            SET owner_id = NULL, lease_token_hash = NULL,
                expires_at = clock_timestamp(), released_at = clock_timestamp()
          WHERE provider_id = $1 AND owner_id = $2 AND lease_token_hash = $3
            AND fencing_token = $4
          RETURNING provider_id`,
        [input.providerId, input.ownerId, leaseTokenHash, input.fencingToken]
      );
      return result.rows.length === 1;
    } catch {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }
  }
}


/**
 * Read-only production preflight for the shared provider-health PostgreSQL store.
 *
 * This checks the database-observable portion of the runtime role/transport
 * contract. It deliberately never returns READY: client-side certificate and
 * hostname verification, pool limits, backup/restore, migration controls,
 * monitoring and owner approval require separate evidence.
 */
export type PostgresProviderHealthReadinessStatus =
  | "BLOCKED"
  | "TECHNICAL_CHECKS_PASSED_REVIEW_REQUIRED";

export interface PostgresProviderHealthDatabaseReadiness {
  readonly status: PostgresProviderHealthReadinessStatus;
  readonly runtimeRole: string;
  readonly checks: Readonly<{
    schemaPresent: boolean;
    runtimeRoleNotSuperuser: boolean;
    runtimeRoleHasNoTableOwnerMembership: boolean;
    publicSchemaUsage: boolean;
    requiredTablePrivileges: boolean;
    noExcessPrivileges: boolean;
    transportEncrypted: boolean;
  }>;
  readonly reasonCodes: readonly string[];
  readonly humanReviewRequired: readonly string[];
  readonly providerHealthStoreDeploymentApproved: false;
  readonly tradingAuthorized: false;
}

interface PostgresProviderHealthReadinessRow extends Record<string, unknown> {
  runtime_role: unknown;
  runtime_is_superuser: unknown;
  runtime_has_owner_membership: unknown;
  schema_present: unknown;
  public_schema_usage: unknown;
  health_can_select: unknown;
  health_can_insert: unknown;
  health_can_update: unknown;
  lease_can_select: unknown;
  lease_can_insert: unknown;
  lease_can_update: unknown;
  runtime_has_excess_privileges: unknown;
  transport_encrypted: unknown;
}

const POSTGRES_PROVIDER_HEALTH_READINESS_SQL = `
  WITH app_relations AS (
    SELECT
      to_regclass('public.provider_health') AS health_table,
      to_regclass('public.provider_recovery_probe_leases') AS lease_table
  )
  SELECT
    current_user::text AS runtime_role,
    EXISTS (
      SELECT 1 FROM pg_roles
       WHERE rolname = current_user AND rolsuper
    ) AS runtime_is_superuser,
    EXISTS (
      SELECT 1
        FROM pg_class AS relation
       WHERE relation.oid IN (health_table::oid, lease_table::oid)
         AND relation.relkind = 'r'
         AND pg_has_role(current_user, relation.relowner, 'MEMBER')
    ) AS runtime_has_owner_membership,
    (
      SELECT count(*) = 2
        FROM pg_class AS relation
       WHERE relation.oid IN (health_table::oid, lease_table::oid)
         AND relation.relkind = 'r'
    ) AS schema_present,
    has_schema_privilege(current_user, 'public', 'USAGE') AS public_schema_usage,
    CASE WHEN health_table IS NULL THEN false
      ELSE has_table_privilege(current_user, health_table, 'SELECT') END AS health_can_select,
    CASE WHEN health_table IS NULL THEN false
      ELSE has_table_privilege(current_user, health_table, 'INSERT') END AS health_can_insert,
    CASE WHEN health_table IS NULL THEN false
      ELSE has_table_privilege(current_user, health_table, 'UPDATE') END AS health_can_update,
    CASE WHEN lease_table IS NULL THEN false
      ELSE has_table_privilege(current_user, lease_table, 'SELECT') END AS lease_can_select,
    CASE WHEN lease_table IS NULL THEN false
      ELSE has_table_privilege(current_user, lease_table, 'INSERT') END AS lease_can_insert,
    CASE WHEN lease_table IS NULL THEN false
      ELSE has_table_privilege(current_user, lease_table, 'UPDATE') END AS lease_can_update,
    (
      CASE WHEN health_table IS NULL THEN false ELSE
        has_table_privilege(current_user, health_table, 'DELETE')
        OR has_table_privilege(current_user, health_table, 'TRUNCATE')
        OR has_table_privilege(current_user, health_table, 'REFERENCES')
        OR has_table_privilege(current_user, health_table, 'TRIGGER')
      END
      OR CASE WHEN lease_table IS NULL THEN false ELSE
        has_table_privilege(current_user, lease_table, 'DELETE')
        OR has_table_privilege(current_user, lease_table, 'TRUNCATE')
        OR has_table_privilege(current_user, lease_table, 'REFERENCES')
        OR has_table_privilege(current_user, lease_table, 'TRIGGER')
      END
      OR has_schema_privilege(current_user, 'public', 'CREATE')
      OR has_database_privilege(current_user, current_database(), 'CREATE')
    ) AS runtime_has_excess_privileges,
    COALESCE((
      SELECT ssl FROM pg_stat_ssl WHERE pid = pg_backend_pid()
    ), false) AS transport_encrypted
  FROM app_relations
`;

const POSTGRES_PROVIDER_HEALTH_HUMAN_REVIEW_ITEMS = Object.freeze([
  "CLIENT_TLS_CERTIFICATE_CHAIN_AND_HOSTNAME_VERIFICATION",
  "CONNECTION_POOL_CAPACITY_AND_TIMEOUTS",
  "ENCRYPTED_BACKUP_RETENTION_AND_POINT_IN_TIME_RECOVERY",
  "SUCCESSFUL_RESTORE_DRILL_EVIDENCE",
  "SEPARATE_MIGRATION_ROLE_AND_REVIEWED_ROLLBACK_PLAN",
  "DATABASE_MONITORING_ALERTS_AND_INCIDENT_RUNBOOK",
  "OWNER_OPERATIONAL_APPROVAL"
] as const);

function parsePostgresBoolean(value: unknown): boolean | null {
  if (value === true || value === "t" || value === "true") return true;
  if (value === false || value === "f" || value === "false") return false;
  return null;
}

/**
 * Inspect the database-observable runtime-role and connection properties with
 * one SELECT statement. The supplied client must already be connected using
 * the runtime role being assessed; no connection or setting is changed here.
 */
export async function assessPostgresProviderHealthDatabaseReadiness(
  client: Pick<PostgresQueryClient, "query">
): Promise<PostgresProviderHealthDatabaseReadiness> {
  if (!isRecord(client) || typeof client.query !== "function") {
    throw new ProviderHealthStoreError("INVALID_INPUT");
  }

  try {
    const result = await client.query<PostgresProviderHealthReadinessRow>(
      POSTGRES_PROVIDER_HEALTH_READINESS_SQL
    );
    if (!Array.isArray(result.rows) || result.rows.length !== 1) {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }

    const row = result.rows[0]!;
    if (typeof row.runtime_role !== "string" ||
        row.runtime_role.trim().length === 0 ||
        row.runtime_role.length > 128) {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }

    const requireBoolean = (value: unknown): boolean => {
      const parsed = parsePostgresBoolean(value);
      if (parsed === null) throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
      return parsed;
    };

    const runtimeIsSuperuser = requireBoolean(row.runtime_is_superuser);
    const runtimeHasOwnerMembership = requireBoolean(row.runtime_has_owner_membership);
    const schemaPresent = requireBoolean(row.schema_present);
    const publicSchemaUsage = requireBoolean(row.public_schema_usage);
    const requiredTablePrivileges =
      requireBoolean(row.health_can_select) &&
      requireBoolean(row.health_can_insert) &&
      requireBoolean(row.health_can_update) &&
      requireBoolean(row.lease_can_select) &&
      requireBoolean(row.lease_can_insert) &&
      requireBoolean(row.lease_can_update);
    const hasExcessPrivileges = requireBoolean(row.runtime_has_excess_privileges);
    const transportEncrypted = requireBoolean(row.transport_encrypted);

    const checks = Object.freeze({
      schemaPresent,
      runtimeRoleNotSuperuser: !runtimeIsSuperuser,
      runtimeRoleHasNoTableOwnerMembership: !runtimeHasOwnerMembership,
      publicSchemaUsage,
      requiredTablePrivileges,
      noExcessPrivileges: !hasExcessPrivileges,
      transportEncrypted
    });

    const reasonCodes: string[] = [];
    if (!checks.schemaPresent) reasonCodes.push("REQUIRED_TABLES_MISSING_OR_INVALID");
    if (!checks.runtimeRoleNotSuperuser) reasonCodes.push("RUNTIME_ROLE_IS_SUPERUSER");
    if (!checks.runtimeRoleHasNoTableOwnerMembership) {
      reasonCodes.push("RUNTIME_ROLE_HAS_TABLE_OWNER_MEMBERSHIP");
    }
    if (!checks.publicSchemaUsage) reasonCodes.push("PUBLIC_SCHEMA_USAGE_MISSING");
    if (!checks.requiredTablePrivileges) reasonCodes.push("REQUIRED_TABLE_PRIVILEGES_MISSING");
    if (!checks.noExcessPrivileges) reasonCodes.push("RUNTIME_ROLE_HAS_EXCESS_PRIVILEGES");
    if (!checks.transportEncrypted) reasonCodes.push("DATABASE_CONNECTION_NOT_ENCRYPTED");

    return Object.freeze({
      status: reasonCodes.length === 0
        ? "TECHNICAL_CHECKS_PASSED_REVIEW_REQUIRED"
        : "BLOCKED",
      runtimeRole: row.runtime_role,
      checks,
      reasonCodes: Object.freeze(reasonCodes),
      humanReviewRequired: POSTGRES_PROVIDER_HEALTH_HUMAN_REVIEW_ITEMS,
      providerHealthStoreDeploymentApproved: false as const,
      tradingAuthorized: false as const
    });
  } catch (error) {
    if (error instanceof ProviderHealthStoreError) throw error;
    // Do not expose hostnames, database names, query details or driver messages.
    throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
  }
}


/**
 * Policy-driven, read-only PostgreSQL operational snapshot.
 * Query text, connection strings, client addresses and request parameters are never selected.
 * A separate role with pg_read_all_stats is required for complete database-wide visibility.
 */
export interface PostgresProviderHealthMonitoringPolicy {
  readonly maxConnectionUtilizationPercent: number;
  readonly maxOldestOpenTransactionSeconds: number;
  readonly maxLongestActiveQuerySeconds: number;
  readonly maxIdleInTransactionCount: number;
  readonly maxOldestIdleInTransactionSeconds: number;
  readonly maxLockWaitCount: number;
  readonly maxDeadlocksSinceStatsReset: number;
  readonly maxDatabaseSizeBytes: string;
}

export type PostgresProviderHealthMonitoringStatus =
  | "ALERT_REVIEW_REQUIRED"
  | "MONITORING_SCOPE_LIMITED_REVIEW_REQUIRED"
  | "TECHNICAL_MONITORING_CHECKS_PASSED_REVIEW_REQUIRED";

export interface PostgresProviderHealthOperationalMonitoring {
  readonly status: PostgresProviderHealthMonitoringStatus;
  readonly monitoringRole: string;
  readonly activityVisibility: "DATABASE_WIDE" | "CURRENT_ROLE_ONLY";
  readonly activityTrackingEnabled: boolean;
  readonly metrics: Readonly<{
    currentDatabaseConnections: number;
    maxConnections: number;
    connectionUtilizationPercent: number;
    activeQueryCount: number;
    oldestOpenTransactionSeconds: number;
    longestActiveQuerySeconds: number;
    idleInTransactionCount: number;
    oldestIdleInTransactionSeconds: number;
    lockWaitCount: number;
    deadlocksSinceStatsReset: number;
    statsResetAt: string | null;
    databaseSizeBytes: string;
    sampledAt: string;
  }>;
  readonly thresholdBreaches: readonly string[];
  readonly reasonCodes: readonly string[];
  readonly humanReviewRequired: readonly string[];
  readonly providerHealthMonitoringApproved: false;
  readonly providerActivationAuthorized: false;
  readonly tradingAuthorized: false;
}

interface PostgresProviderHealthMonitoringRow extends Record<string, unknown> {
  monitoring_role: unknown;
  role_is_superuser: unknown;
  has_read_all_stats: unknown;
  activity_tracking_enabled: unknown;
  current_database_connections: unknown;
  max_connections: unknown;
  active_query_count: unknown;
  oldest_open_transaction_seconds: unknown;
  longest_active_query_seconds: unknown;
  idle_in_transaction_count: unknown;
  oldest_idle_in_transaction_seconds: unknown;
  lock_wait_count: unknown;
  deadlocks_since_stats_reset: unknown;
  stats_reset_at: unknown;
  database_size_bytes: unknown;
  sampled_at: unknown;
}

const POSTGRES_PROVIDER_HEALTH_MONITORING_SQL = [
  "WITH monitoring_role AS (",
  "  SELECT",
  "    current_user::text AS monitoring_role,",
  "    COALESCE((SELECT rolsuper FROM pg_roles WHERE rolname = current_user), false) AS role_is_superuser,",
  "    pg_has_role(current_user, 'pg_read_all_stats', 'USAGE') AS has_read_all_stats,",
  "    current_setting('track_activities')::boolean AS activity_tracking_enabled,",
  "    current_setting('max_connections')::integer AS max_connections,",
  "    statement_timestamp() AS sampled_at",
  "),",
  "activity AS (",
  "  SELECT",
  "    count(*) FILTER (WHERE datname = current_database())::text AS current_database_connections,",
  "    count(*) FILTER (WHERE datname = current_database() AND pid <> pg_backend_pid() AND state = 'active')::text AS active_query_count,",
  "    COALESCE(MAX(FLOOR(EXTRACT(EPOCH FROM (statement_timestamp() - xact_start)))) FILTER (WHERE datname = current_database() AND pid <> pg_backend_pid() AND xact_start IS NOT NULL), 0)::text AS oldest_open_transaction_seconds,",
  "    COALESCE(MAX(FLOOR(EXTRACT(EPOCH FROM (statement_timestamp() - query_start)))) FILTER (WHERE datname = current_database() AND pid <> pg_backend_pid() AND state = 'active' AND query_start IS NOT NULL), 0)::text AS longest_active_query_seconds,",
  "    count(*) FILTER (WHERE datname = current_database() AND state LIKE 'idle in transaction%')::text AS idle_in_transaction_count,",
  "    COALESCE(MAX(FLOOR(EXTRACT(EPOCH FROM (statement_timestamp() - xact_start)))) FILTER (WHERE datname = current_database() AND state LIKE 'idle in transaction%' AND xact_start IS NOT NULL), 0)::text AS oldest_idle_in_transaction_seconds,",
  "    count(*) FILTER (WHERE datname = current_database() AND pid <> pg_backend_pid() AND wait_event_type = 'Lock')::text AS lock_wait_count",
  "  FROM pg_stat_activity",
  "),",
  "database_stats AS (",
  "  SELECT deadlocks::text AS deadlocks_since_stats_reset, stats_reset",
  "  FROM pg_stat_database",
  "  WHERE datname = current_database()",
  ")",
  "SELECT",
  "  monitoring_role.monitoring_role,",
  "  monitoring_role.role_is_superuser,",
  "  monitoring_role.has_read_all_stats,",
  "  monitoring_role.activity_tracking_enabled,",
  "  monitoring_role.max_connections::text AS max_connections,",
  "  activity.current_database_connections,",
  "  activity.active_query_count,",
  "  activity.oldest_open_transaction_seconds,",
  "  activity.longest_active_query_seconds,",
  "  activity.idle_in_transaction_count,",
  "  activity.oldest_idle_in_transaction_seconds,",
  "  activity.lock_wait_count,",
  "  database_stats.deadlocks_since_stats_reset,",
  "  database_stats.stats_reset AS stats_reset_at,",
  "  pg_database_size(current_database())::text AS database_size_bytes,",
  "  monitoring_role.sampled_at",
  "FROM monitoring_role CROSS JOIN activity CROSS JOIN database_stats"
].join("\n");

const POSTGRES_PROVIDER_HEALTH_MONITORING_REVIEW_ITEMS = Object.freeze([
  "DEDICATED_MONITORING_IDENTITY_AND_PG_READ_ALL_STATS_APPROVAL",
  "OWNER_APPROVED_ALERT_THRESHOLDS_AND_EVALUATION_CADENCE",
  "ALERT_DESTINATION_ON_CALL_ACKNOWLEDGEMENT_AND_ESCALATION",
  "APPLICATION_POOL_LIMITS_AND_AGGREGATE_CONNECTION_BUDGET",
  "CLIENT_TLS_CERTIFICATE_CHAIN_AND_HOSTNAME_VERIFICATION",
  "BACKUP_ENCRYPTION_RETENTION_PITR_AND_RESTORE_EVIDENCE",
  "OWNER_OPERATIONAL_APPROVAL"
] as const);

function parseMonitoringPolicy(
  value: unknown
): PostgresProviderHealthMonitoringPolicy | null {
  if (!isRecord(value)) return null;
  const keys = [
    "maxConnectionUtilizationPercent",
    "maxOldestOpenTransactionSeconds",
    "maxLongestActiveQuerySeconds",
    "maxIdleInTransactionCount",
    "maxOldestIdleInTransactionSeconds",
    "maxLockWaitCount",
    "maxDeadlocksSinceStatsReset",
    "maxDatabaseSizeBytes"
  ];
  const actualKeys = Object.keys(value).sort();
  const expectedKeys = [...keys].sort();
  if (actualKeys.length !== expectedKeys.length ||
      !actualKeys.every((key, index) => key === expectedKeys[index])) return null;

  const numericKeys = keys.slice(0, 7) as readonly (keyof Omit<
    PostgresProviderHealthMonitoringPolicy,
    "maxDatabaseSizeBytes"
  >)[];
  for (const key of numericKeys) {
    const minimum = key === "maxConnectionUtilizationPercent" ? 1 : 0;
    const maximum = key === "maxConnectionUtilizationPercent" ? 100 : Number.MAX_SAFE_INTEGER;
    const field = value[key];
    if (typeof field !== "number" || !Number.isSafeInteger(field) ||
        field < minimum || field > maximum) return null;
  }
  if (typeof value.maxDatabaseSizeBytes !== "string" ||
      !/^(?:0|[1-9][0-9]{0,39})$/.test(value.maxDatabaseSizeBytes)) return null;

  return value as unknown as PostgresProviderHealthMonitoringPolicy;
}

function requireMonitoringInteger(value: unknown): number {
  const parsed = parseSafeInteger(value);
  if (parsed === null) throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
  return parsed;
}

function requireMonitoringTimestamp(value: unknown, nullable = false): string | null {
  if (nullable && value === null) return null;
  const parsed = toIsoTimestamp(value);
  if (parsed === null) throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
  return parsed;
}

/**
 * Use one read-only aggregate query through an already-connected monitoring client.
 * No connection creation, role switch, configuration change, write, notification,
 * provider request, Solana RPC request or trading authorization is performed.
 * Thresholds are mandatory caller-supplied policy; no production defaults exist.
 */
export async function assessPostgresProviderHealthOperationalMonitoring(
  client: Pick<PostgresQueryClient, "query">,
  policyInput: PostgresProviderHealthMonitoringPolicy
): Promise<PostgresProviderHealthOperationalMonitoring> {
  if (!isRecord(client) || typeof client.query !== "function" ||
      parseMonitoringPolicy(policyInput) === null) {
    throw new ProviderHealthStoreError("INVALID_INPUT");
  }
  const policy = policyInput;

  try {
    const result = await client.query<PostgresProviderHealthMonitoringRow>(
      POSTGRES_PROVIDER_HEALTH_MONITORING_SQL
    );
    if (!Array.isArray(result.rows) || result.rows.length !== 1) {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }
    const row = result.rows[0]!;
    if (typeof row.monitoring_role !== "string" ||
        row.monitoring_role.trim().length === 0 ||
        row.monitoring_role.length > 128) {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }

    const roleIsSuperuser = parsePostgresBoolean(row.role_is_superuser);
    const hasReadAllStats = parsePostgresBoolean(row.has_read_all_stats);
    const activityTrackingEnabled = parsePostgresBoolean(row.activity_tracking_enabled);
    if (roleIsSuperuser === null || hasReadAllStats === null || activityTrackingEnabled === null) {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }

    const currentDatabaseConnections = requireMonitoringInteger(row.current_database_connections);
    const maxConnections = requireMonitoringInteger(row.max_connections);
    if (maxConnections < 1) throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");

    const activeQueryCount = requireMonitoringInteger(row.active_query_count);
    const oldestOpenTransactionSeconds = requireMonitoringInteger(row.oldest_open_transaction_seconds);
    const longestActiveQuerySeconds = requireMonitoringInteger(row.longest_active_query_seconds);
    const idleInTransactionCount = requireMonitoringInteger(row.idle_in_transaction_count);
    const oldestIdleInTransactionSeconds = requireMonitoringInteger(row.oldest_idle_in_transaction_seconds);
    const lockWaitCount = requireMonitoringInteger(row.lock_wait_count);
    const deadlocksSinceStatsReset = requireMonitoringInteger(row.deadlocks_since_stats_reset);
    if (typeof row.database_size_bytes !== "string" ||
        !/^(?:0|[1-9][0-9]{0,39})$/.test(row.database_size_bytes)) {
      throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
    }

    const statsResetAt = requireMonitoringTimestamp(row.stats_reset_at, true);
    const sampledAt = requireMonitoringTimestamp(row.sampled_at);
    const databaseWideVisibility = roleIsSuperuser || hasReadAllStats;
    const connectionUtilizationPercent =
      Math.round((currentDatabaseConnections / maxConnections) * 10_000) / 100;

    const metrics = Object.freeze({
      currentDatabaseConnections,
      maxConnections,
      connectionUtilizationPercent,
      activeQueryCount,
      oldestOpenTransactionSeconds,
      longestActiveQuerySeconds,
      idleInTransactionCount,
      oldestIdleInTransactionSeconds,
      lockWaitCount,
      deadlocksSinceStatsReset,
      statsResetAt,
      databaseSizeBytes: row.database_size_bytes,
      sampledAt
    });

    const thresholdBreaches: string[] = [];
    if (currentDatabaseConnections * 100 >
        maxConnections * policy.maxConnectionUtilizationPercent) {
      thresholdBreaches.push("CONNECTION_UTILIZATION_ABOVE_THRESHOLD");
    }
    if (oldestOpenTransactionSeconds > policy.maxOldestOpenTransactionSeconds) {
      thresholdBreaches.push("OLDEST_OPEN_TRANSACTION_ABOVE_THRESHOLD");
    }
    if (longestActiveQuerySeconds > policy.maxLongestActiveQuerySeconds) {
      thresholdBreaches.push("LONGEST_ACTIVE_QUERY_ABOVE_THRESHOLD");
    }
    if (idleInTransactionCount > policy.maxIdleInTransactionCount) {
      thresholdBreaches.push("IDLE_IN_TRANSACTION_COUNT_ABOVE_THRESHOLD");
    }
    if (oldestIdleInTransactionSeconds > policy.maxOldestIdleInTransactionSeconds) {
      thresholdBreaches.push("OLDEST_IDLE_IN_TRANSACTION_ABOVE_THRESHOLD");
    }
    if (lockWaitCount > policy.maxLockWaitCount) {
      thresholdBreaches.push("LOCK_WAIT_COUNT_ABOVE_THRESHOLD");
    }
    if (deadlocksSinceStatsReset > policy.maxDeadlocksSinceStatsReset) {
      thresholdBreaches.push("DEADLOCKS_SINCE_STATS_RESET_ABOVE_THRESHOLD");
    }
    if (BigInt(row.database_size_bytes) > BigInt(policy.maxDatabaseSizeBytes)) {
      thresholdBreaches.push("DATABASE_SIZE_ABOVE_THRESHOLD");
    }

    const activityVisibility = databaseWideVisibility ? "DATABASE_WIDE" : "CURRENT_ROLE_ONLY";
    const reasonCodes = [...thresholdBreaches];
    if (!databaseWideVisibility) reasonCodes.push("POSTGRES_ACTIVITY_VISIBILITY_LIMITED");
    if (!activityTrackingEnabled) reasonCodes.push("POSTGRES_ACTIVITY_TRACKING_DISABLED");

    const status: PostgresProviderHealthMonitoringStatus = thresholdBreaches.length > 0
      ? "ALERT_REVIEW_REQUIRED"
      : (!databaseWideVisibility || !activityTrackingEnabled)
        ? "MONITORING_SCOPE_LIMITED_REVIEW_REQUIRED"
        : "TECHNICAL_MONITORING_CHECKS_PASSED_REVIEW_REQUIRED";

    return Object.freeze({
      status,
      monitoringRole: row.monitoring_role,
      activityVisibility,
      activityTrackingEnabled,
      metrics,
      thresholdBreaches: Object.freeze(thresholdBreaches),
      reasonCodes: Object.freeze(reasonCodes),
      humanReviewRequired: POSTGRES_PROVIDER_HEALTH_MONITORING_REVIEW_ITEMS,
      providerHealthMonitoringApproved: false as const,
      providerActivationAuthorized: false as const,
      tradingAuthorized: false as const
    });
  } catch (error) {
    if (error instanceof ProviderHealthStoreError) throw error;
    // Driver errors can include SQL, database identifiers or credential-bearing URLs.
    throw new ProviderHealthStoreError("DATABASE_OPERATION_FAILED");
  }
}
