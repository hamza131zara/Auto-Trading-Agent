# Phase 6.41 — Production node-postgres adapter

## Scope and approval

Owner approval explicitly selects `pg@8.23.1` for production adapter implementation and review. This approval does not authorize a hosted database connection, production database deployment, provider activation, wallet signing, order placement or trading.

The adapter is implemented in `packages/market-data/src/postgres-pg-adapter.ts` and exported as `@ata/market-data/postgres-pg-adapter`. It implements the existing structural `PostgresPoolLike` contract consumed by `PostgresProviderHealthStore`; the persistence/store SQL and transaction contract remain unchanged.

## Configuration contract

The adapter accepts exact, explicit connection fields. It does not accept a connection URI. Configuration requires:

- DNS hostname (IP literals are rejected), port, database, runtime user and password supplied by the deployment boundary.
- An owner-approved PEM CA certificate bundle.
- A bounded pool maximum and a bounded maximum pending-acquisition count.
- Physical connection, acquisition, idle, statement, lock, idle-in-transaction and shutdown-drain timeouts.
- A bounded connection lifetime and an application name.

The adapter maps TLS to the requested DNS hostname, CA bundle, `rejectUnauthorized: true`, and TLS 1.2 minimum. It deliberately omits `connectionString`, because node-postgres documents that SSL parameters in a connection string can replace the supplied SSL object. The six isolated TLS handshake checks from Phase 6.40 remain evidence for the driver's TLS implementation; they do not verify any future production CA or endpoint.

Session timeouts are sent using PostgreSQL's `options` parameter. The configuration values are numeric, validated, and serialized without interpolating user-controlled SQL.

## Lifecycle behavior

- New acquisition requests are rejected after shutdown begins.
- The adapter rejects callers once its configured pending-acquisition admission bound is reached.
- Acquisition timeout is enforced at the adapter boundary. A timed-out underlying pool request continues to occupy an admission slot until the driver settles it; if a client arrives late, it is immediately released.
- Checked-out clients expose idempotent release.
- Query/driver errors are mapped to stable codes and raw driver messages are not returned.
- Shutdown calls `pool.end()`, waits up to the configured drain deadline, and reports a sanitized drain-timeout error. It does not forcibly terminate in-flight SQL at the adapter boundary.

## Verification in this PR

Unit tests cover effective TLS and timeout options, rejection of URI/IP configuration, the structural store interface, idempotent client release, bounded acquisition, late-client release, and shutdown admission behavior.

Required CI verification remains: repository validation, typecheck/build, full unit tests, npm audit, CodeQL, secret scanning, and the existing PostgreSQL persistence/recovery and disposable TLS workflows.

## Limitations and outstanding gates

This milestone is implementation and review only. Before any production deployment, a deployment owner must still provide and independently verify the target CA and DNS identity, runtime secret delivery, least-privilege database role, deployment-specific aggregate pool budget, encrypted backup/retention/PITR, a successful restore drill, migration-owner separation/rollback, monitoring identity/thresholds/alert routing, and operational approval.

The adapter does not connect automatically, create credentials, run migrations, activate providers, access a wallet, sign transactions, or authorize trading.

Status: **IN REVIEW — NOT PRODUCTION DEPLOYED**.
