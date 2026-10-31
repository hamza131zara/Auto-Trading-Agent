/**
 * Production node-postgres adapter.
 *
 * This module accepts explicit connection fields only (never a connection URI),
 * enforces verified TLS, bounds acquisition waiters, and exposes a draining
 * shutdown boundary. It does not create credentials, choose a host, activate a
 * provider, or authorize database deployment or trading.
 */
import { Pool } from "pg";
import type {
  PostgresPoolLike,
  PostgresQueryClient,
  PostgresQueryResult
} from "./provider-health-store.js";

export interface PostgresPgAdapterConfig {
  readonly host: string;
  readonly port: number;
  readonly database: string;
  readonly user: string;
  readonly password: string;
  /** PEM-encoded, owner-approved CA bundle. */
  readonly caCertificate: string;
  readonly maxConnections: number;
  readonly connectionTimeoutMs: number;
  readonly acquisitionTimeoutMs: number;
  readonly idleTimeoutMs: number;
  readonly maximumConnectionLifetimeSeconds: number;
  readonly statementTimeoutMs: number;
  readonly lockTimeoutMs: number;
  readonly idleInTransactionTimeoutMs: number;
  readonly maximumPendingAcquisitions: number;
  readonly shutdownDrainTimeoutMs: number;
  readonly applicationName: string;
}

export type PostgresPgAdapterErrorCode =
  | "INVALID_CONFIGURATION"
  | "POOL_CLOSING"
  | "POOL_QUEUE_FULL"
  | "ACQUISITION_TIMEOUT"
  | "DATABASE_OPERATION_FAILED"
  | "SHUTDOWN_DRAIN_TIMEOUT";

export class PostgresPgAdapterError extends Error {
  readonly code: PostgresPgAdapterErrorCode;
  constructor(code: PostgresPgAdapterErrorCode) {
    super(code);
    this.name = "PostgresPgAdapterError";
    this.code = code;
  }
}

interface PgClientLike {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
  release(): void;
}

interface PgPoolLike {
  query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<{ rows: Row[] }>;
  connect(): Promise<PgClientLike>;
  end(): Promise<void>;
  on(event: "error", listener: (error: Error) => void): unknown;
  readonly waitingCount: number;
  readonly totalCount: number;
  readonly idleCount: number;
}

const CONFIG_KEYS = [
  "host", "port", "database", "user", "password", "caCertificate",
  "maxConnections", "connectionTimeoutMs", "acquisitionTimeoutMs",
  "idleTimeoutMs", "maximumConnectionLifetimeSeconds",
  "statementTimeoutMs", "lockTimeoutMs", "idleInTransactionTimeoutMs",
  "maximumPendingAcquisitions", "shutdownDrainTimeoutMs", "applicationName"
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function positiveInteger(value: unknown, maximum = 2_147_483_647): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum;
}

function validateConfig(value: unknown): asserts value is PostgresPgAdapterConfig {
  if (!isPlainRecord(value)) throw new PostgresPgAdapterError("INVALID_CONFIGURATION");
  const keys = Object.keys(value).sort();
  const expected = [...CONFIG_KEYS].sort();
  if (keys.length !== expected.length || !keys.every((key, index) => key === expected[index])) {
    throw new PostgresPgAdapterError("INVALID_CONFIGURATION");
  }
  const host = value.host;
  if (typeof host !== "string" || host.length > 253 ||
      host !== host.trim() || host.includes(":") || /^[0-9.]+$/.test(host) ||
      !/^(?=.{1,253}$)(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)(?:\.(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?))*$/.test(host) ||
      !positiveInteger(value.port, 65_535) ||
      typeof value.database !== "string" || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,62}$/.test(value.database) ||
      typeof value.user !== "string" || !/^[a-zA-Z0-9_][a-zA-Z0-9_.-]{0,62}$/.test(value.user) ||
      typeof value.password !== "string" || value.password.length < 1 || value.password.length > 4096 ||
      typeof value.caCertificate !== "string" || !value.caCertificate.includes("-----BEGIN CERTIFICATE-----") ||
      !positiveInteger(value.maxConnections, 500) ||
      !positiveInteger(value.connectionTimeoutMs) ||
      !positiveInteger(value.acquisitionTimeoutMs) ||
      !positiveInteger(value.idleTimeoutMs) ||
      !positiveInteger(value.maximumConnectionLifetimeSeconds) ||
      !positiveInteger(value.statementTimeoutMs) ||
      !positiveInteger(value.lockTimeoutMs) ||
      !positiveInteger(value.idleInTransactionTimeoutMs) ||
      !positiveInteger(value.maximumPendingAcquisitions, 100_000) ||
      !positiveInteger(value.shutdownDrainTimeoutMs) ||
      typeof value.applicationName !== "string" ||
      !/^[a-zA-Z0-9_.:-]{1,63}$/.test(value.applicationName) ||
      value.acquisitionTimeoutMs > value.connectionTimeoutMs ||
      value.lockTimeoutMs >= value.statementTimeoutMs) {
    throw new PostgresPgAdapterError("INVALID_CONFIGURATION");
  }
}

/** Build the effective pg.Pool options from validated explicit configuration. */
export function buildPostgresPgPoolOptions(configInput: unknown): Readonly<Record<string, unknown>> {
  validateConfig(configInput);
  const config = configInput;
  return Object.freeze({
    host: config.host,
    port: config.port,
    database: config.database,
    user: config.user,
    password: config.password,
    application_name: config.applicationName,
    max: config.maxConnections,
    connectionTimeoutMillis: config.connectionTimeoutMs,
    idleTimeoutMillis: config.idleTimeoutMs,
    maxLifetimeSeconds: config.maximumConnectionLifetimeSeconds,
    allowExitOnIdle: false,
    // Never pass connectionString: node-postgres URL SSL parameters can override
    // this explicit, security-critical TLS configuration.
    ssl: Object.freeze({
      ca: config.caCertificate,
      rejectUnauthorized: true,
      minVersion: "TLSv1.2",
      servername: config.host
    }),
    options: [
      "-c", "statement_timeout=" + config.statementTimeoutMs,
      "-c", "lock_timeout=" + config.lockTimeoutMs,
      "-c", "idle_in_transaction_session_timeout=" + config.idleInTransactionTimeoutMs
    ].join(" ")
  });
}

/** Concrete adapter for the existing structural PostgresPoolLike contract. */
export class PostgresPgPoolAdapter implements PostgresPoolLike {
  private readonly pool: PgPoolLike;
  private readonly config: PostgresPgAdapterConfig;
  private closing = false;
  private pendingAcquisitions = 0;
  private closePromise: Promise<void> | null = null;

  constructor(config: PostgresPgAdapterConfig) {
    validateConfig(config);
    // Snapshot validated primitive fields so caller mutation cannot weaken limits.
    this.config = Object.freeze({ ...config });
    this.pool = new Pool(
      buildPostgresPgPoolOptions(this.config)
    ) as unknown as PgPoolLike;
    this.pool.on("error", () => {
      // Never leak driver messages, SQL, hostnames or credential-bearing details.
    });
  }

  async query<Row extends Record<string, unknown> = Record<string, unknown>>(
    sql: string,
    parameters?: readonly unknown[]
  ): Promise<PostgresQueryResult<Row>> {
    const client = await this.connect();
    try {
      const result = await client.query<Row>(sql, parameters);
      return { rows: result.rows };
    } catch {
      throw new PostgresPgAdapterError("DATABASE_OPERATION_FAILED");
    } finally {
      client.release?.();
    }
  }

  async connect(): Promise<PostgresQueryClient> {
    if (this.closing) throw new PostgresPgAdapterError("POOL_CLOSING");
    if (this.pendingAcquisitions >= this.config.maximumPendingAcquisitions) {
      throw new PostgresPgAdapterError("POOL_QUEUE_FULL");
    }
    this.pendingAcquisitions += 1;
    let acquisition: Promise<PgClientLike>;
    try {
      acquisition = this.pool.connect();
    } catch {
      this.pendingAcquisitions -= 1;
      throw new PostgresPgAdapterError("DATABASE_OPERATION_FAILED");
    }

    // Keep the admission slot occupied until the underlying pool request settles,
    // even when the caller's timeout fires. Otherwise timed-out callers could
    // leave hidden waiters in pg's queue while admitting an unbounded replacement.
    const trackedAcquisition = acquisition.then(
      (client) => {
        this.pendingAcquisitions -= 1;
        return client;
      },
      () => {
        this.pendingAcquisitions -= 1;
        throw new PostgresPgAdapterError("DATABASE_OPERATION_FAILED");
      }
    );

    let timer: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        timedOut = true;
        reject(new PostgresPgAdapterError("ACQUISITION_TIMEOUT"));
      }, this.config.acquisitionTimeoutMs);
    });

    try {
      const client = await Promise.race([trackedAcquisition, timeout]);
      return this.wrapClient(client);
    } catch (error) {
      if (timedOut) {
        // The late client is released when the underlying pool request settles.
        void trackedAcquisition.then((client) => client.release(), () => undefined);
      }
      if (error instanceof PostgresPgAdapterError) throw error;
      throw new PostgresPgAdapterError("DATABASE_OPERATION_FAILED");
    } finally {
      if (timer !== undefined) clearTimeout(timer);
    }
  }

  private wrapClient(client: PgClientLike): PostgresQueryClient {
    let released = false;
    return {
      query: async <Row extends Record<string, unknown> = Record<string, unknown>>(
        sql: string,
        parameters?: readonly unknown[]
      ): Promise<PostgresQueryResult<Row>> => {
        if (released) throw new PostgresPgAdapterError("DATABASE_OPERATION_FAILED");
        try {
          const result = await client.query<Row>(sql, parameters);
          return { rows: result.rows };
        } catch {
          throw new PostgresPgAdapterError("DATABASE_OPERATION_FAILED");
        }
      },
      release: () => {
        if (released) return;
        released = true;
        client.release();
      }
    };
  }

  getPoolSnapshot(): Readonly<{
    totalConnections: number;
    idleConnections: number;
    waitingAcquisitions: number;
    closing: boolean;
  }> {
    return Object.freeze({
      totalConnections: this.pool.totalCount,
      idleConnections: this.pool.idleCount,
      waitingAcquisitions: this.pool.waitingCount,
      closing: this.closing
    });
  }

  /** Stop new work, then drain. A timeout never force-closes in-flight queries. */
  close(): Promise<void> {
    if (this.closePromise !== null) return this.closePromise;
    this.closing = true;
    const drain = this.pool.end().then(() => undefined, () => {
      throw new PostgresPgAdapterError("DATABASE_OPERATION_FAILED");
    });
    this.closePromise = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new PostgresPgAdapterError("SHUTDOWN_DRAIN_TIMEOUT"));
      }, this.config.shutdownDrainTimeoutMs);
      void drain.then(() => {
        clearTimeout(timer);
        resolve();
      }, (error: unknown) => {
        clearTimeout(timer);
        reject(error);
      });
    });
    return this.closePromise;
  }
}
