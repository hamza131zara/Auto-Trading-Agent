# Phase 6.34 — PostgreSQL observability, monitoring and incident controls

## Objective

Provide a bounded read-only operational snapshot for the PostgreSQL provider-health store, evaluate it against explicitly supplied owner policy, and define an incident response path. The module does not run on a timer, send notifications, open connections, change database settings, write records, restart services or authorize deployment.

## Implemented read-only snapshot

The function assessPostgresProviderHealthOperationalMonitoring(client, policy) executes one aggregate SELECT through an already connected PostgreSQL monitoring client. It reports:

- Current database connections compared with PostgreSQL max_connections.
- Active query count, longest active query and oldest open transaction.
- Idle-in-transaction count and oldest idle transaction.
- Sessions waiting on a database lock.
- Deadlock count since the last PostgreSQL statistics reset and that reset timestamp.
- Database size in exact decimal bytes and snapshot timestamp.

The statement never selects query text, connection strings, client addresses, request parameters or credential material. Driver errors are mapped to a stable sanitized store error. All values are validated before a report is returned.

A dedicated monitoring identity with effective pg_read_all_stats privileges (or a PostgreSQL superuser during the disposable CI test) is required for database-wide activity visibility. An ordinary runtime role is reported as CURRENT_ROLE_ONLY; the function will not misrepresent a partial view as complete. Activity collection also requires track_activities to be enabled.

## Threshold and status behavior

No production thresholds are hard-coded. The caller must supply every limit: connection utilization percentage, oldest transaction age, longest active query, idle-in-transaction count/age, lock waits, cumulative deadlocks and database size. A threshold is breached only when the observed metric is strictly greater than the supplied limit.

- ALERT_REVIEW_REQUIRED: one or more caller-supplied limits are exceeded. Escalate through the separately configured on-call process; do not treat this result as an automated remediation instruction.
- MONITORING_SCOPE_LIMITED_REVIEW_REQUIRED: no measured breach, but the current role cannot see all sessions or track_activities is disabled.
- TECHNICAL_MONITORING_CHECKS_PASSED_REVIEW_REQUIRED: current snapshot is complete and no supplied limit is exceeded. This is not a deployment approval or guarantee of healthy future operation.
A malformed client, policy or database response rejects with a sanitized error. A failed snapshot must not be recorded as a healthy sample.

Connection utilization is a database-wide aggregate where visibility allows it; it is not a substitute for validating each application's pool size, reserved connection slots, aggregate worker count or connection acquisition timeouts. Deadlocks are cumulative since stats_reset, not a rate; compare successive snapshots or use an external time-series system before treating an increase as a new incident.

## Deployment and alerting model (manual owner configuration remains required)

Keep three identities separate:

1. Migration owner: schema changes only, controlled maintenance window.
2. Runtime role: existing least-privilege SELECT/INSERT/UPDATE access to the two provider-health tables; do not grant it pg_read_all_stats.
3. Monitoring role: read-only operational view, separately protected and approved; grant only the monitoring visibility required by the selected PostgreSQL policy. Do not use the runtime credential for monitoring.

An external monitoring scheduler may call this read-only function with owner-selected thresholds and cadence. It must persist timestamped snapshots in an approved monitoring system, deliver alerts to an owner-approved destination and require acknowledgement/escalation. This repository change does not implement the scheduler, alert receiver, notification channel or monitoring-store retention.

Suggested response sequence:

1. **Connection pressure:** check aggregate and per-process pool utilization, connection wait time, worker count and reserved-slot headroom. Stop adding workers; scale only after an owner-approved capacity review.
2. **Long/open or idle transactions:** identify the owning service/worker using the approved monitoring console, preserve incident evidence, stop the faulty worker through its normal control plane and verify transaction rollback. Do not terminate arbitrary backend PIDs automatically.
3. **Lock waits/deadlocks:** inspect the approved blocking-session report and recent deployment/change record; preserve sanitized evidence; resolve through the owning service's controlled transaction boundary.
4. **Database size:** compare current growth with retention and backup/PITR capacity; verify backup destinations and free storage before maintenance. Do not delete rows, leases or history as an automatic response.
5. **Missing/limited telemetry:** page the monitoring owner to verify pg_read_all_stats scope, track_activities, stats-reset time and collector connectivity. Never interpret a missing sample as zero load.

For every incident record: snapshot timestamp, stable reason codes, threshold policy version, database/service release reference, incident/change ID, acknowledged owner, action, recovery verification and closure evidence. Never record SQL text, credentials, connection URLs, wallet material or raw secrets in the monitoring report.

## Acceptance and safety boundary

- [x] Add a single-query, read-only PostgreSQL operational snapshot.
- [x] Validate metrics and require explicit caller-supplied thresholds with no production defaults.
- [x] Detect connection pressure, open/idle transactions, active query duration, lock waits, deadlocks and database size threshold breaches.
- [x] Distinguish database-wide statistics visibility from current-role-only visibility and block a complete-monitoring claim when visibility or activity tracking is limited.
- [x] Add deterministic unit tests and a real PostgreSQL 18.6 integration check.
- [x] Keep all provider/deployment/trading authorization values false; sanitize malformed and driver-error paths.
- [ ] Select a dedicated production monitoring identity and approve its exact statistics visibility grants.
- [ ] Approve threshold values, collection cadence, durable retention, alert destination, on-call acknowledgement and escalation policy.
- [ ] Verify production TLS, pool limits, global connection capacity, backup/PITR and incident exercises.
- [ ] Obtain owner operational approval before enabling any customer runtime.

No production database or provider/RPC endpoint was contacted. The automated query is tested only against the disposable PostgreSQL 18.6 CI service. No schema migration, database write, new dependency, credential, spend, wallet, signer, order or transaction is introduced. Phase 6 remains ACTIVE; provider activation and trading remain unauthorized.
