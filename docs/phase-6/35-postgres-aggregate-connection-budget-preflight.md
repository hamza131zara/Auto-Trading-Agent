# Phase 6.35 — PostgreSQL aggregate connection-budget preflight

## Objective

Make connection-capacity planning deterministic across every concurrently running agent instance and the other services sharing the same PostgreSQL server. The preflight is offline and driver-neutral: it evaluates operator-supplied capacity declarations, does not read a connection string, open a database connection, select a driver, configure a pool or authorize deployment.

## Contract and calculation

The package export @ata/market-data/postgres-connection-budget provides assessPostgresConnectionBudget(plan). The plan must explicitly declare:

- PostgreSQL max_connections.
- Total reserved connection slots and an additional safety buffer.
- Maximum concurrently running agent instances, including the approved autoscaling/rolling-deployment ceiling.
- Maximum pool size per agent instance.
- Separate peak connections for monitoring, migrations and all other services sharing the same server.
- Minimum required free-connection headroom after the planned workload.

The arithmetic is:

    usableConnectionBudget = maxConnections
      - reservedConnections
      - safetyBufferConnections

    runtimePoolCeiling = runtimeInstanceCount
      * maxPoolConnectionsPerInstance

    plannedTotalConnections = runtimePoolCeiling
      + monitoringConnections
      + migrationConnections
      + otherServiceConnections

    remainingHeadroom = usableConnectionBudget - plannedTotalConnections

All numeric fields are validated bounded integers and aggregate multiplication is performed with BigInt before conversion to safe report numbers. Missing categories, extra fields (including DSNs/credential-shaped fields), negative/fractional counts and a fully consumed reserved budget are rejected. No missing service demand is silently treated as zero.

## Result semantics

- CAPACITY_EXCEEDED_REVIEW_REQUIRED: planned aggregate demand exceeds the usable budget.
- HEADROOM_BELOW_MINIMUM_REVIEW_REQUIRED: the plan fits, but leaves less free capacity than the explicitly supplied minimum.
- TECHNICAL_CAPACITY_CHECKS_PASSED_REVIEW_REQUIRED: arithmetic fits the declared budget and headroom. It is not proof that the declarations match the actual cluster or workload.

Every returned report is immutable and keeps database deployment approval, provider activation and trading authorization false. The evaluator never chooses production thresholds, adjusts a pool or retries a connection.

## Operator evidence still required

Before using a plan for a production design, the owner/database operator must independently verify the server's max_connections and reserved slots, every service's maximum concurrent demand, the maximum autoscaling/rolling-overlap instance count, monitoring/migration connection demand and a documented headroom decision.

Pool lifecycle and timeout settings are deliberately not normalized across drivers. After an owner-selected PostgreSQL driver/adapter is reviewed, separately map and test its connection-acquire timeout, connection timeout, idle lifetime, statement/transaction timeouts, pool min/max and shutdown behavior. The actual driver TLS configuration must require certificate-chain and hostname verification (equivalent to verify-full); a plan or boolean assertion is not proof of that configuration. No database driver is selected by this preflight.

## Acceptance and safety boundary

- [x] Add an offline aggregate budget calculator for runtime replicas, per-replica pool ceilings, monitoring/migration and other service demand.
- [x] Subtract operator-declared reserved slots and safety buffer before evaluating the workload.
- [x] Require an explicit minimum free-connection headroom; do not invent server capacity or workload defaults.
- [x] Reject incomplete/unknown/credential-shaped input, non-integer values and invalid capacity declarations.
- [x] Use exact integer arithmetic for aggregate pool multiplication and return immutable, review-required results.
- [x] Add regression tests for fit, over-capacity, insufficient headroom, missing workload groups, malicious extra fields, malformed values and large aggregate multiplication.
- [ ] Verify declared server settings, autoscaling/rollout maximum, per-instance pool ceilings and all shared service consumers against the actual proposed environment.
- [ ] Select and independently review the production driver; map/test its timeout, pool lifecycle, shutdown and strict TLS certificate/hostname configuration.
- [ ] Obtain owner and database-operator approval for the actual capacity plan and connection headroom.

This step performs no database connection or mutation, provider/API/RPC request, deployment, credential handling, spend or trading action. It adds no dependency and creates no production connection pool. Phase 6 remains ACTIVE; production database deployment, provider activation and trading remain unauthorized.
