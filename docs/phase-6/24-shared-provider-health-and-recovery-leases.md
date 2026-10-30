# Phase 6.24 — Shared provider health and distributed recovery-probe leases

## Status

Merged through [PR #43](https://github.com/hamza131zara/Auto-Trading-Agent/pull/43), commit `9ccae49c0981303ac1d31bef5226317dcb29e318`. Post-merge CI [run #274](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41024455297) passed 262/262 tests, repository validation, typecheck/build, dependency audit (zero vulnerabilities), and Gitleaks. PR #43 also passed Dependency Review and both CodeQL analyses. This change adds a driver-neutral PostgreSQL store, schema migration and orchestrator integration. It does not connect to a database or apply the migration. No provider/RPC calls, API credentials, spending, provider activation, signing or trading were performed.

## Why this step is required

Phase 6.23's in-memory health map and single-flight set protect only one process. Two workers could each observe a circuit-open provider after cooldown and both begin a recovery probe. A worker restart also reset its process-local health snapshot. Phase 6.24 moves health and the exclusive recovery claim into shared PostgreSQL state while retaining the existing pure reducers and read-only adapter boundary.

## Store and schema

- `packages/market-data/src/provider-health-store.ts` defines `ProviderHealthStore`, a driver-neutral pool/client contract, and `PostgresProviderHealthStore`.
- `infra/migrations/20261030_phase6_provider_health_and_recovery_leases.sql` creates `provider_health` and `provider_recovery_probe_leases`.
- `packages/market-data/package.json` exports `@ata/market-data/provider-health-store`.

Provider health is stored by provider ID with state, failure count, last success/failure/request times, latency, circuit expiry, safe error class, version and update time. Writes execute in a row-locked transaction and use a monotonic BIGINT version. Older health results cannot overwrite newer timestamps.

The lease table keeps one row per provider after release/expiry so fencing tokens remain monotonic. An atomic `INSERT ... ON CONFLICT ... DO UPDATE ... WHERE expires_at <= clock_timestamp()` claim only succeeds if the provider is still `CIRCUIT_OPEN`, its cooldown has elapsed, and no active lease exists.

## Distributed lease rules

- All expiry and renewal decisions use PostgreSQL `clock_timestamp()`, not a worker clock.
- Only one worker wins a provider's active recovery lease.
- Lease expiry permits a new worker to claim; each new claim increments a PostgreSQL BIGINT fencing token.
- A stale worker cannot renew, release, or publish a recovery result using an older fencing token.
- Recovery health update and lease release occur in one transaction. If the lease expires before commit, the transaction rolls back and the observation is not admitted.
- A circuit-open health result cannot be changed without the current unexpired lease.
- Worker tokens are CSPRNG-derived one-time bearer values. Only their SHA-256 digests are stored; raw tokens are retained in process memory only and never logged or persisted.
- Worker IDs are labels, not secrets. They must identify a process/instance uniquely for operational traceability.

The orchestrator accepts an injected `ProviderHealthStore` and lease configuration. Each collection refreshes health from the shared store. Before an elapsed-cooldown recovery request it atomically claims a lease. The configured lease duration must exceed the adapter request timeout by at least one second, and cannot exceed five minutes. The fetch is still bounded by the existing abort timeout; if it outlives the lease, the result is discarded.

## Deterministic tests

- `test/provider-health-store.test.mjs` covers no-early-claim, one winner under concurrent claim attempts, expiry/reclaim with fencing increment, renewal ownership, stale-token rejection, atomic health/release, required recovery lease and monotonic result versioning.
- `test/provider-orchestrator-shared-health.test.mjs` covers two independent orchestrator instances sharing one health store, one recovery-probe winner, blocked competing worker, expired-worker result rejection and fail-closed storage read failure.
- Existing orchestrator and market-data tests remain unchanged.

The store tests use a deterministic fake PostgreSQL pool/client to exercise transaction ordering and adapter behavior. They do not constitute a PostgreSQL engine integration test, do not test a real database's lock scheduler, and do not verify a particular driver's connection-pool implementation.

## Driver, migration and deployment boundary

No PostgreSQL driver dependency is added. The application must inject an adapter satisfying `PostgresPoolLike` around its selected driver after a separate version/security/compatibility review. The SQL migration is committed but has not been applied to any database. A dedicated ephemeral-PostgreSQL integration run is still required before any multi-process deployment; it must exercise real concurrent claim transactions, expiry/reclaim, transaction rollback and fencing with at least two database connections.

The store is process-agnostic but the current orchestrator's local in-flight set remains a same-process optimization. Shared leases are the cross-process correctness boundary only for recovery probes; ordinary provider requests may overlap across workers and health writes are serialized by row locks. No queue, worker service, scheduler, or production deployment is created here.

## Safety and open approvals

Provider profiles remain `UNVERIFIED`, production approvals remain false, and all diagnostic terms/rights gates remain unchanged. This shared store does not turn provider health into source independence or freshness, and it cannot authorize trading. The DEX/Raydium pool thresholds and 10-bps Pyth diagnostic tolerance are unchanged. No production database configuration or credentials have been introduced.


## Follow-on real-engine verification

Phase 6.25 adds the actual PostgreSQL engine gate in [the real PostgreSQL integration runbook](25-real-postgres-integration.md). The fake-pool tests above remain valuable unit-level coverage, but should not be counted as real database concurrency evidence. Do not approve multi-process deployment until the 6.25 workflow passes and operational database decisions are reviewed separately.
