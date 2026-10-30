# Phase 6.36 — PostgreSQL backup, PITR and recovery-policy preflight

## Objective

Provide an offline, deterministic check of owner-declared backup and recovery objectives before any production database design is approved. The preflight evaluates backup cadence, retention, point-in-time recovery (PITR), WAL archive lag, RPO/RTO, integrity-check age, restore-drill age/duration, encryption declarations and off-site destination classification.

This is a policy arithmetic/consistency check only. It does not create a backup, inspect an object store or KMS, query PostgreSQL, verify a remote digest, test WAL archiving, contact a service, store credentials or approve production recovery.

## Contract and calculations

The package export `@ata/market-data/postgres-backup-recovery-policy` provides `assessPostgresBackupRecoveryPolicy(input)`. The input must explicitly provide every required field. Missing, unknown and credential-shaped keys are rejected, and numeric values must be bounded safe integers.

For a plan with PITR enabled:

```text
maximumDeclaredDataLossSeconds =
  maximumBackupAgeMinutes * 60 + maxWalArchiveLagSeconds
```

For PITR disabled, the declared maximum data-loss window is the maximum permitted backup age. The evaluator separately requires this maximum age to be at least the nominal backup interval and checks the age of the last successful backup. A declared policy fails its RPO check when the calculated maximum window exceeds the owner-supplied RPO.

The last declared successful restore-drill duration is compared with the owner-supplied RTO. PITR retention must be positive and cannot exceed the declared base-backup retention. When PITR is disabled, PITR retention, WAL lag and WAL-archive monitoring must all be explicitly disabled/zero.

The evaluator checks the age of the last successful base backup, backup-integrity check and restore drill against their explicitly supplied maximum ages. The maximum backup age must be at least the nominal backup interval and cannot exceed base-backup retention. Application-level validation in the last restore drill must be declared verified; a database restore alone is not an end-to-end recovery test. It requires declared verified states for application-level restore-drill validation, encryption at rest, encryption in transit, a restricted off-site destination, remote digest verification and (when PITR is enabled) WAL-archive monitoring.

## Result semantics

- `RECOVERY_OBJECTIVES_NOT_MET_REVIEW_REQUIRED`: maximum permitted backup age plus WAL lag exceeds RPO, or the last restore drill exceeded RTO.
- `BACKUP_POLICY_CONFIGURATION_INVALID_REVIEW_REQUIRED`: maximum backup age is shorter than the declared backup interval or longer than base-backup retention.
- `PITR_RETENTION_POLICY_INVALID_REVIEW_REQUIRED`: PITR retention exceeds base-backup retention or PITR/WAL fields are inconsistent.
- `RECOVERY_EVIDENCE_STALE_REVIEW_REQUIRED`: the last successful backup, backup-integrity verification or restore-drill evidence is older than its declared maximum age.
- `BACKUP_PROTECTION_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED`: application-level restore-drill validation, encryption, off-site destination, remote digest or WAL monitoring is not declared verified.
- `TECHNICAL_RECOVERY_POLICY_CHECKS_PASSED_REVIEW_REQUIRED`: all supplied declarations are internally consistent. This is not evidence that they are true or that production recovery works.

Every result is immutable and permanently leaves production recovery approval, database deployment approval, provider activation and trading authorization false. A caller-supplied `VERIFIED` value is an assertion, not an authenticated proof.

## Required owner/operator evidence before production

The owner and database operator must independently review the actual service configuration, backup schedule, retention lifecycle, restricted off-site account/bucket access, encryption settings and service-side custody safeguards, remote digest chain, WAL archival continuity and gap alerts, PITR capability, integrity-check results, restore logs, application-level data invariants and cutover duration.

RPO and RTO must be approved for the actual service and workload. A restore drill must be performed in a separately authorized isolated environment and must include application-level validation, not merely successful completion of `pg_restore`. The approved recovery runbook must name the operator, approver, alert route, escalation path and rollback/forward-recovery decision process.

## Acceptance and safety boundary

- [x] Add an offline deterministic policy evaluator with explicit RPO/RTO and backup/PITR declarations.
- [x] Calculate the worst declared data-loss window from the maximum permitted backup age and WAL lag; require a coherent age threshold and block an RPO miss.
- [x] Detect an over-age last successful backup separately from an over-age integrity verification.
- [x] Require backup-age thresholds to fit both the declared schedule and retention window; require application-level restore-drill validation.
- [x] Reject RPO/RTO misses, inconsistent PITR retention, stale integrity/restore evidence and incomplete protection declarations.
- [x] Reject missing/unknown/credential-shaped fields and malformed or out-of-range values.
- [x] Return immutable review-required reports; production recovery, database deployment, provider activation and trading remain unauthorized.
- [x] Add regression tests for passing declarations, RPO/RTO failures, retention inconsistency, PITR disabled consistency, stale evidence, missing protection declarations, unsafe input and immutable results.
- [ ] Verify every declaration against the chosen production service, storage, encryption, monitoring and restore evidence.
- [ ] Obtain owner/database-operator approval of RPO/RTO, retention, off-site destination, PITR and restore-drill cadence.
- [ ] Complete a separately authorized production-like restore drill and application-level validation.

The evaluator is offline, adds no dependency, makes no database/storage/provider/RPC request and incurs no spend. It does not close the external evidence or approval gates. Phase 6 remains ACTIVE; provider activation and trading remain unauthorized.
