# Phase 6.31 — PostgreSQL runtime-role and transport preflight

## Purpose

Phase 6.25 proved the shared provider-health store against a disposable PostgreSQL engine using independent connections. This step adds a read-only pre-deployment diagnostic for the database-observable security posture of the runtime role.

The preflight is intended to run through the same already-connected database client and role that the customer runtime will use. It does not open a connection, change role, modify configuration, write data, apply migrations, or make a provider/RPC request.

## Checks performed

A single read-only SQL statement verifies:

- Both required public tables exist as ordinary tables.
- The current runtime role is not a PostgreSQL superuser.
- The runtime role is not the owner of either table and is not a member of either table-owner role.
- The role has schema USAGE and only the table operations required by the store: SELECT, INSERT and UPDATE on both tables.
- The role does not have unnecessary DELETE, TRUNCATE, REFERENCES or TRIGGER privileges on the two tables, CREATE on the public schema, or CREATE on the current database.
- The current PostgreSQL backend reports that its database connection is encrypted.

The result includes stable reason codes and does not expose raw driver errors, database hostnames, connection strings, query parameters or credentials.

## Interpretation

The diagnostic has only two statuses:

- `BLOCKED`: one or more database-observable requirements failed.
- `TECHNICAL_CHECKS_PASSED_REVIEW_REQUIRED`: all checked conditions passed, but this is explicitly not a deployment approval.

It never returns READY. A database-side query cannot prove that the client verified the server certificate chain and hostname (for example, a driver's strict `verify-full` configuration), nor can it prove deployment-level pool limits, aggregate connection capacity, statement/connection timeouts, encrypted backup policy, point-in-time recovery, a successful restore drill, separate migration ownership, a reviewed rollback procedure, monitoring/alerting or an owner-approved operating model. Those items remain mandatory human/first-party evidence.

The production PostgreSQL driver and provider-health-store deployment are still unselected/unapproved. The runtime role should be created separately from the migration owner, granted only the exact operations required by the store, and configured with verified TLS by the deployment owner. Do not infer or copy a connection string into the repository.

## Test coverage and safety boundary

- Unit tests cover passing technical checks, plaintext transport, superuser/owner membership, excess or missing grants, malformed metadata, sanitized driver failure and invalid client input.
- The dedicated PostgreSQL 18.6 CI workflow creates a disposable NOLOGIN runtime role, grants only the required operations, assesses it through `SET ROLE`, and confirms that the database reports the local test connection as unencrypted.
- The integration test's local plaintext result is intentionally BLOCKED. It is not a TLS-production test and does not alter the disposable workflow to claim TLS.
- No production connection, provider API, Solana RPC, credential, key, spend, signer, order or transaction is introduced.

## Acceptance

- [x] Implement a one-query, read-only runtime-role/transport preflight.
- [x] Require table presence, non-superuser/non-owner role, schema USAGE and exact SELECT/INSERT/UPDATE grants.
- [x] Reject excess table, schema and database privileges.
- [x] Keep TLS encryption as a required technical check and state explicitly that client certificate/hostname validation cannot be verified by the SQL query.
- [x] Ensure even a technically passing report remains REVIEW_REQUIRED and always keeps provider-health deployment approval and trading authorization false.
- [x] Cover the least-privilege role on real disposable PostgreSQL in CI.
- [ ] Obtain owner-selected production driver/client TLS configuration and first-party verification of certificate-chain and hostname validation.
- [x] Add a read-only, policy-driven PostgreSQL activity/connection/lock/deadlock/size snapshot and deterministic alert evaluation (Phase 6.34).
- [ ] Approve deployment-specific pool sizing/timeouts, backups/retention/PITR, a successful restore drill, migration-owner separation/rollback, production monitoring identity/thresholds/alert route and operational sign-off.

Phase 6 remains ACTIVE. This is a technical preflight only; it does not satisfy provider lineage, commercial rights, freshness, independent market-data agreement, qualifying-pool, production-provider or roadmap exit requirements.
