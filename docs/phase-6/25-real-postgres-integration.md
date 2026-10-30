# Phase 6.25 — Real PostgreSQL integration and distributed recovery verification

## Status

Implementation is on branch `phase6-25-real-postgres-integration` and awaits its dedicated PostgreSQL CI run and the normal repository checks. The workflow provisions an isolated PostgreSQL 18.6 service container and uses two independent Node.js connection pools. It does not use a hosted database, project secrets, provider endpoints, Solana RPC, or a live trading environment.

The PostgreSQL driver `pg@8.23.1` is installed as a pinned, transient test dependency by the dedicated workflow. It is not added to the runtime application, workspace manifests, or committed lockfile. This verifies that the existing structural `PostgresPoolLike` boundary works with node-postgres without choosing a production database adapter.

## What is tested against PostgreSQL itself

The integration test is `test/provider-health-store.postgres.integration.test.mjs`; the workflow is `.github/workflows/phase6-postgres-integration.yml`.

- Applies `20261030_phase6_provider_health_and_recovery_leases.sql` twice to verify idempotent migration behavior.
- Creates and reads provider health through separate store instances, checking persisted state and monotonic version values.
- Proves workers are connected to distinct PostgreSQL backend PIDs before racing lease claims.
- Starts two real concurrent recovery claims against one elapsed-cooldown circuit. Exactly one claim must succeed.
- Confirms that only a SHA-256 token digest is stored in the lease table; the bearer token returned to the worker is not persisted.
- Renews an active lease and checks its expiry against PostgreSQL's own `clock_timestamp()`; an expired/replaced worker cannot renew.
- Lets the renewed lease expire, reclaims it from the other worker, and checks that the fencing token increases.
- Rejects the stale worker's release and health write, while verifying that the shared health row and version remain unchanged.
- Publishes the new worker's recovery success and confirms that health persistence and lease release commit together.
- Forces an out-of-order recovery result to fail inside the transaction, then checks that both the prior health version and active lease survive rollback.

The integration test requires a database called `ata_phase6_test` on loopback (localhost, 127.0.0.1 or ::1) and port 5432. It rejects non-local hosts or other database names before attempting a connection. It uses random provider IDs and deletes only those test rows. Without the required environment variable the test is skipped by ordinary unit-test runs; the dedicated workflow sets `REQUIRE_PG_INTEGRATION=true`, so a missing URL fails rather than producing a false green result.

## CI service and exact test driver

- PostgreSQL image: `postgres:18.6`, the currently supported PostgreSQL 18 minor release at the time this workflow was authored.
- Driver: `pg@8.23.1`, pinned at install time for the Node 24 test runner.
- Database: `ata_phase6_test`; credentials are fixed test-only values scoped to the disposable service container.
- Trigger: pull requests, pushes to `main`, and manual workflow dispatch.
- Application runtime dependencies remain unchanged. No production connection string is defined.

## Interpretation and limits

A passing run establishes that the Phase 6.24 schema and store queries behave against a real PostgreSQL 18.6 engine under the covered concurrency, expiry, fencing and rollback scenarios. It also establishes compatibility with the pinned test-only node-postgres pool interface.

It does **not** approve node-postgres for production, add database credentials/configuration to the application, apply the migration to any production or hosted database, or approve a multi-process deployment. Production connection security, TLS policy, pool sizing/timeouts, backup/restore, migration ownership/rollback, monitoring and owner approval remain separate operational decisions. Health persistence also does not validate provider lineage, data freshness, provider commercial terms, or market-data correctness.

No provider or RPC calls are performed, no API keys or spend are introduced, and signing, order placement and trading remain disabled and unauthorized.
