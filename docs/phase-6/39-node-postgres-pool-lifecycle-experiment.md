# Phase 6.39 — Test-only node-postgres pool lifecycle experiment

## Purpose and decision status

Exercise the repository's existing test-only PostgreSQL client against the disposable PostgreSQL 18.6 CI service. The exact package under test is \`pg@8.23.1\` (node-postgres), matching the version already pinned by the Phase 6.25 workflow.

**This is not production-driver selection or approval.** The package remains transiently installed by CI using \`npm install --no-save --package-lock=false\`; it is not added to an application/workspace dependency or committed lockfile. No production adapter, DSN, TLS setting, connection secret or runtime configuration is introduced. Owner selection and production evidence remain open.

At the time this phase was prepared (31 October 2026), npm lists \`8.23.1\` as the latest \`pg\` release. The repository's Node engine is Node 24, and the test workflow pins PostgreSQL 18.6.

## Actual behavior under test

The dedicated workflow first applies the existing Phase 6 migration in its disposable service. A separate lifecycle test then creates only local connections to \`ata_phase6_test\` and checks:

1. The installed \`pg\` package really is exactly 8.23.1.
2. A second acquisition against a saturated one-client pool times out under \`connectionTimeoutMillis\`, and the pool waiting count returns to zero.
3. PostgreSQL \`statement_timeout\` cancels a long query with SQLSTATE \`57014\`; the same client remains usable after resetting the setting.
4. PostgreSQL \`lock_timeout\` aborts a blocked advisory-lock attempt with SQLSTATE \`55P03\`, and the transaction is rolled back before the client is reused.
5. PostgreSQL \`idle_in_transaction_session_timeout\` terminates an abandoned transaction backend; the test verifies its PID disappears from \`pg_stat_activity\` and destroys the broken client.
6. A small adapter-side admission gate caps pending acquisitions at two and rejects the next caller before it reaches node-postgres. The test checks the underlying \`waitingCount\` never exceeds the cap.
7. \`pool.end()\` stops new acquisitions and waits for an already checked-out client to be released before resolving.

Timeout tests use temporary session-level settings and advisory locks only. They do not alter PostgreSQL server configuration or committed schema. The test rejects non-loopback hosts, unexpected databases, usernames, ports, query parameters and URL fragments before creating a connection.

## Important findings and design implications

- node-postgres documents FIFO waiting when a pool is full and exposes \`waitingCount\`; its documented pool configuration has no hard maximum waiting-queue setting. A production adapter must therefore place an explicit bounded admission layer in front of the pool. The small admission gate in this experiment demonstrates that pattern but is not shipped as a production adapter.
- \`connectionTimeoutMillis\` is tested for a saturated-pool acquisition wait. A separate black-hole network/handshake timeout test is not claimed here.
- \`statement_timeout\`, \`lock_timeout\` and \`idle_in_transaction_session_timeout\` are PostgreSQL server/session controls exercised through the client; they are not claimed to be interchangeable with a client-side query deadline.
- \`pool.end()\` drains checked-out clients, but the service must stop accepting application work before calling it. A production shutdown supervisor would still need a bounded outer deadline and an explicit incomplete-drain outcome.
- This test does not test TLS, CA/hostname verification, authentication methods, server certificates, provider/API connectivity, hosted PostgreSQL, production backup storage, or live runtime configuration.

## Official references

- node-postgres pool API: https://node-postgres.com/apis/pool
- node-postgres client API: https://node-postgres.com/apis/client
- npm package and release metadata: https://www.npmjs.com/package/pg
- PostgreSQL 18 client connection defaults: https://www.postgresql.org/docs/18/runtime-config-client.html

## Acceptance and safety boundary

- [x] Reuse the exact pinned test-only \`pg@8.23.1\` package already proven against PostgreSQL 18.6.
- [x] Add a separate, required CI test step for real pool acquisition, statement/lock/idle-transaction timeout and shutdown behavior.
- [x] Verify the package version at test runtime and fail closed if it is not the pin.
- [x] Demonstrate an explicit adapter-side pending-acquisition cap without changing production code.
- [x] Restrict the test URL to the disposable local integration database; keep credentials only in the workflow service environment.
- [ ] Owner explicitly selects or rejects \`pg@8.23.1\` as the production driver.
- [ ] If selected, implement and review a production adapter with strict TLS, bounded admission, safe transaction/cancellation handling, readiness/shutdown orchestration and approved pool/capacity limits.
- [ ] Run the selected production adapter's TLS certificate/hostname/downgrade matrix and effective runtime-setting verification.
- [ ] Obtain separate database deployment, backup/PITR, monitoring, provider and trading approvals.

A passing run is evidence for this exact test-only package/version in this disposable test environment only. It does not approve production driver selection, deployment, provider activation or trading. Phase 6 remains ACTIVE.
