# Phase 6.38 — PostgreSQL pool lifecycle and timeout policy preflight

## Objective

Define an offline, driver-neutral contract for connection-pool admission, timeout relationships, cancellation and graceful shutdown. Phase 6.35 already calculates the aggregate connection ceiling; this step defines the complementary behavior expected from each selected driver's pool and the PostgreSQL session settings.

No driver is selected by this step. It does not create a pool, connect to PostgreSQL, configure runtime options, cancel statements, terminate sessions, choose workload timeouts or approve deployment.

## Contract

The package export @ata/market-data/postgres-pool-lifecycle-policy exposes assessPostgresPoolLifecyclePolicy(input). It requires explicit, positive integer declarations for:

- Physical connection-establishment timeout and caller acquisition timeout.
- Idle connection timeout and maximum connection lifetime.
- Server-side statement, lock-wait and idle-in-transaction timeouts.
- Graceful shutdown drain window.
- Maximum pending pool acquisitions and explicit queue-overflow behavior.
- Shutdown behavior, selected-driver adapter review state and effective runtime-option mapping evidence.
- An isolated positive test result for each timeout, queue rejection and shutdown behavior.

The evaluator rejects missing/extra fields, malformed numbers, unsupported enums, paths, URLs and credential-shaped references. It does not accept DSNs, pool configuration objects, connection strings, hostnames, secrets or server responses.

## Deterministic consistency rules

- Connection establishment timeout must not exceed the full acquisition wait budget.
- Lock timeout must be strictly shorter than statement timeout so a lock wait cannot outlive the statement budget.
- Graceful shutdown drain time must be at least the declared statement timeout.
- Pool queue overflow must reject instead of allowing an unbounded number of waiting callers.
- Shutdown must stop admitting new acquisitions before draining already accepted work.
- Every timeout, cancellation, queue-rejection and shutdown test must be evidenced before the driver adapter can pass review.

No workload-specific timeout values are recommended or defaulted here. The owner and database operator must choose values from the application's actual latency, transaction and recovery requirements. The evaluator checks internal relationships only.

## Result semantics

- POOL_TIMEOUT_POLICY_BLOCKED_REVIEW_REQUIRED: a declared timeout relationship is inconsistent.
- POOL_ADMISSION_OR_SHUTDOWN_POLICY_BLOCKED_REVIEW_REQUIRED: the queue can grow without a bound or shutdown does not stop admission and drain work.
- POOL_LIFECYCLE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED: one or more isolated behavior tests are missing.
- POOL_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED: the driver is unselected/unreviewed or the effective runtime mapping is not independently verified.
- TECHNICAL_POSTGRES_POOL_POLICY_CHECKS_PASSED_REVIEW_REQUIRED: all declared relationships and evidence flags are present. This is not proof that a real driver enforces them.

All assessments are immutable. Database deployment, provider activation and trading authorization remain false. A supplied VERIFIED state is an assertion and not authenticated evidence.

## Work required after driver selection

The owner must select and pin a PostgreSQL driver and exact version. Review how that version implements physical connect timeout, pool acquisition timeout, idle eviction, maximum connection lifetime, query cancellation, server-side statement/lock/idle-transaction settings, bounded wait queues and graceful shutdown. Verify precedence between driver, role, database and session settings, and confirm that timeout cancellation releases the connection and rolls back or abandons work safely.

Against a disposable PostgreSQL service, verify:

1. Connection establishment and pool acquisition time out at their configured boundaries.
2. Statement, lock-wait and idle-in-transaction timeouts take effect and cancel/abort the expected work.
3. Exhausting the pool rejects excess waiters without an unbounded queue.
4. Shutdown rejects new acquisitions, drains in-flight work within the declared window and reports incomplete drain rather than silently claiming success.
5. The effective runtime and server settings match the reviewed policy, not merely a configuration file or environment declaration.

Reconcile the per-instance pool maximum with the aggregate connection budget in [Phase 6.35](35-postgres-aggregate-connection-budget-preflight.md), and keep strict client TLS verification from [Phase 6.37](37-postgres-client-tls-policy-preflight.md). Do not select the driver or change its settings without the owner's explicit decision.

## Acceptance and safety boundary

- [x] Add an offline driver-neutral evaluator for declared pool timeout, queue and shutdown policy.
- [x] Check connection/acquisition, lock/statement and shutdown/statement timeout relationships.
- [x] Require bounded queue overflow rejection and stop-admission-then-drain shutdown semantics.
- [x] Require an explicit isolated-test matrix for timeout enforcement, cancellation, queue overflow and shutdown.
- [x] Reject malformed, missing, extra, path/URL-like and credential-shaped inputs; return immutable review-required reports.
- [ ] Select and pin the production PostgreSQL driver and version.
- [ ] Verify the actual driver's timeout mapping, cancellation behavior, bounded queue and shutdown lifecycle against disposable PostgreSQL.
- [ ] Verify effective role/database/session settings and reconcile the selected pool maximum with the approved aggregate capacity plan.
- [ ] Obtain owner and database-operator approval before any production database deployment.

This step is offline only. It creates no connection pool, database connection, secret, credential, provider/RPC request, spend, migration, deployment, wallet, signer, order or transaction. Phase 6 remains ACTIVE; provider activation and trading remain unauthorized.
