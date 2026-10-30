# Phase 6.32 — PostgreSQL backup, restore and migration recovery

## Objective

Add reproducible recovery evidence for the shared Phase 6 provider-health database. The automated drill uses only the dedicated disposable PostgreSQL 18.6 CI service. It never connects to a production, hosted, or customer database.

The current migration is transactional on PostgreSQL. This step verifies that an interrupted transaction leaves no partial schema and that the migration can subsequently be applied and re-applied. It also verifies a PostgreSQL custom-format logical backup, archive inspection, restore into a newly created isolated database, and exact recovery of representative health and recovery-lease rows.

## Automated recovery drill

The dedicated workflow installs the pinned test-only `pg@8.23.1` driver and uses the already provisioned `postgres:18.6` service plus the matching `postgres:18.6` client image.

The test is `test/phase6-postgres-recovery.integration.test.mjs`. It:

1. Refuses non-loopback sources, unexpected database names, non-test roles, non-5432 ports, pre-existing restore targets, and any client image other than `postgres:18.6`.
2. Creates only the two exact temporary databases `ata_phase6_restore_test` and `ata_phase6_migration_test`, and drops only those databases it created.
3. Applies the existing migration to the disposable source and inserts unique synthetic health/lease rows.
4. Creates a PostgreSQL custom-format archive using `pg_dump --no-owner --no-privileges`, calculates SHA-256, and checks the archive table of contents.
5. Restores into the empty, separate restore database with `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges`.
6. Verifies the recovered rows, lease digest/fencing token and restored object ownership by the restore role.
7. Simulates a migration worker disappearing after DDL but before COMMIT, verifies PostgreSQL rolled back the open transaction, then applies the migration transactionally and re-applies it to prove idempotency.
8. Deletes temporary test rows, closes pools, removes only the two known test databases, and removes the temporary dump directory.

A green CI drill establishes logical dump/restore and transaction-interruption behavior for this schema and PostgreSQL version. It does not establish production backup encryption, off-site durability, retention, PITR, monitoring, RPO/RTO or a successful customer-environment restore. The temporary archive is removed and is never uploaded as a workflow artifact or committed.

## Production operator runbook — not enabled by this repository change

Before a real customer deployment, the owner and database operator must select the supported PostgreSQL service/version, driver, backup destination, retention, encryption and recovery objectives. Use the offline [Phase 6.36 backup/PITR policy preflight](36-postgres-backup-pitr-policy-preflight.md) to check the declared RPO/RTO, cadence, retention and evidence-age consistency, but treat every supplied verification state as an assertion until independently authenticated. Do not use CI credentials or the test helper against production.

### Before a schema migration

- Confirm a tested, recent backup and enough verified storage.
- Record the migration identifier/checksum, current schema version, deployment release and operator.
- Use a dedicated migration-owner identity; the agent runtime role must not own tables or run schema changes.
- Stop or quiesce writers where required by the migration plan.
- Use a transaction for migrations supported by PostgreSQL transactional DDL. Treat every non-transactional operation as a separately reviewed migration with a forward-recovery plan.
- Record pre/post migration health checks and preserve the previous application release.

### Backup

Use an approved secret manager or a short-lived, owner-only password file; never place passwords, connection URLs, or private paths in command-line arguments, CI logs, shell history, source control or issue comments. For a supported PostgreSQL client, enable strict TLS verification (certificate chain and hostname, equivalent to `sslmode=verify-full`) using the owner's trusted CA bundle.

With connection settings supplied securely through the operator environment and a restricted destination:

```sh
umask 077
pg_dump --format=custom --no-owner --no-privileges --file="$BACKUP_FILE"
pg_restore --list "$BACKUP_FILE" > "$BACKUP_FILE.toc"
sha256sum "$BACKUP_FILE" > "$BACKUP_FILE.sha256"
```

Encrypt the archive at rest and in transit, upload it to the approved restricted backup destination, verify the remote digest, and apply retention/immutability policy. A local checksum alone is not a backup strategy.

### Restore and validation

- Never restore over the only current database. Create a new isolated database or separate instance.
- Verify the archive checksum and inspect its table of contents before restore.
- Restore with `pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$RECOVERY_DATABASE" "$BACKUP_FILE"` using a reviewed owner/migration role.
- Run migration status checks, required schema/object checks, row-count and application-level invariants, and a read-only application smoke test.
- Confirm role ownership/grants, TLS verification, monitoring, connection pool settings and data recency.
- Obtain owner approval for a controlled connection cutover. Keep the prior database and release intact through the agreed rollback window.

### Migration failure and recovery

- For a transactional migration, stop the migration worker and allow PostgreSQL to roll back the uncommitted transaction. Verify the prior schema state.
- For a committed but faulty migration, do not improvise a destructive down migration. Restore the pre-migration backup into a separate recovery database, validate it, and use an owner-approved cutover/forward-fix plan.
- Keep audit records of the failure, backup digest, restore verification, migration identifier, recovery decision, approver and cutover.
- Never silently discard provider-health history or fencing counters. Recovery must preserve the monotonic lease-fencing invariant and must not make an expired worker valid again.

## Acceptance

- [x] Add a database-guarded custom-format `pg_dump` integration drill against a loopback-only disposable database.
- [x] Inspect the archive and verify SHA-256 before and after restore.
- [x] Restore atomically into a newly created, isolated database using no-owner/no-privilege semantics.
- [x] Verify provider-health and recovery-lease row content, including the lease digest and fencing token.
- [x] Simulate interruption after DDL but before COMMIT; verify no partial schema remains.
- [x] Apply the migration transactionally after interruption and verify a second application is idempotent.
- [x] Drop only temporary databases created by the drill and remove the temporary archive; never upload the database dump.
- [ ] Select and approve production backup encryption, restricted/off-site destination, retention and integrity monitoring.
- [x] Add the offline, review-required Phase 6.36 policy evaluator for declared RPO/RTO, PITR retention, WAL lag, integrity and restore evidence.
- [ ] Define and approve service-specific RPO/RTO and PITR requirements; complete a production-like restore drill in a separately authorized environment.
- [ ] Approve production migration ownership, maintenance windows, rollback/forward-fix policy, monitoring and incident runbooks.

This remains a CI-only recovery verification. It creates no production database, provider/RPC call, API key, credential, spend, wallet, signer, order or transaction. Phase 6 remains ACTIVE; provider approval and trading authorization remain false.
