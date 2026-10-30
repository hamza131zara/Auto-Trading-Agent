import assert from "node:assert/strict";
import test from "node:test";
import { assessPostgresBackupRecoveryPolicy } from "../packages/market-data/dist/postgres-backup-recovery-policy.js";

const BASE_PLAN = Object.freeze({
  backupIntervalMinutes: 60,
  maximumBackupAgeMinutes: 90,
  lastSuccessfulBackupAgeMinutes: 45,
  backupRetentionDays: 35,
  recoveryPointObjectiveSeconds: 6_000,
  recoveryTimeObjectiveSeconds: 7_200,
  pointInTimeRecoveryEnabled: true,
  pointInTimeRecoveryRetentionDays: 14,
  maxWalArchiveLagSeconds: 300,
  lastBackupIntegrityCheckAgeHours: 1,
  maximumBackupIntegrityCheckAgeHours: 24,
  lastRestoreDrillAgeDays: 5,
  maximumRestoreDrillAgeDays: 30,
  lastRestoreDrillDurationSeconds: 4_200,
  restoreDrillApplicationValidation: "VERIFIED",
  backupEncryptionAtRest: "VERIFIED",
  backupEncryptionInTransit: "VERIFIED",
  backupDestination: "APPROVED_RESTRICTED_OFFSITE",
  remoteDigestVerification: "VERIFIED",
  walArchiveMonitoring: "VERIFIED"
});

test("accepts a coherent declared backup/PITR policy but keeps it review-required", () => {
  const report = assessPostgresBackupRecoveryPolicy(BASE_PLAN);

  assert.equal(report.status, "TECHNICAL_RECOVERY_POLICY_CHECKS_PASSED_REVIEW_REQUIRED");
  assert.deepEqual(report.calculated, {
    backupIntervalSeconds: 3_600,
    maximumBackupAgeSeconds: 5_400,
    maximumDeclaredDataLossSeconds: 5_700,
    restoreDrillWithinRto: true
  });
  assert.deepEqual(report.reasonCodes, []);
  assert.ok(report.humanReviewRequired.length >= 6);
  assert.equal(report.productionRecoveryApproved, false);
  assert.equal(report.databaseDeploymentApproved, false);
  assert.equal(report.providerActivationAuthorized, false);
  assert.equal(report.tradingAuthorized, false);
});

test("blocks a maximum backup-age alert threshold shorter than the declared backup cadence", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    maximumBackupAgeMinutes: 59
  });

  assert.equal(report.status, "BACKUP_POLICY_CONFIGURATION_INVALID_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "MAXIMUM_BACKUP_AGE_BELOW_DECLARED_BACKUP_INTERVAL"
  ]);
});

test("blocks a maximum backup age longer than the declared base-backup retention", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    maximumBackupAgeMinutes: 50_000,
    backupRetentionDays: 30,
    recoveryPointObjectiveSeconds: 3_000_300
  });

  assert.equal(report.status, "BACKUP_POLICY_CONFIGURATION_INVALID_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "MAXIMUM_BACKUP_AGE_EXCEEDS_BACKUP_RETENTION"
  ]);
});

test("blocks maximum backup age plus WAL lag when it exceeds the declared RPO", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    recoveryPointObjectiveSeconds: 5_699
  });

  assert.equal(report.status, "RECOVERY_OBJECTIVES_NOT_MET_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, ["DECLARED_BACKUP_AND_WAL_LAG_EXCEED_RPO"]);
  assert.equal(report.calculated.maximumDeclaredDataLossSeconds, 5_700);
});

test("blocks a restore drill whose measured duration exceeds the declared RTO", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    lastRestoreDrillDurationSeconds: 7_201
  });

  assert.equal(report.status, "RECOVERY_OBJECTIVES_NOT_MET_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, ["LAST_RESTORE_DRILL_DURATION_EXCEEDS_RTO"]);
  assert.equal(report.calculated.restoreDrillWithinRto, false);
});

test("blocks PITR retention longer than the declared base-backup retention", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    pointInTimeRecoveryRetentionDays: 36
  });

  assert.equal(report.status, "PITR_RETENTION_POLICY_INVALID_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, ["PITR_RETENTION_OR_WAL_CONFIGURATION_INCONSISTENT"]);
});

test("requires zero PITR retention, WAL lag and WAL monitoring when PITR is disabled", () => {
  const validDisabledPitr = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    pointInTimeRecoveryEnabled: false,
    pointInTimeRecoveryRetentionDays: 0,
    maxWalArchiveLagSeconds: 0,
    walArchiveMonitoring: "DISABLED"
  });
  assert.equal(validDisabledPitr.status, "TECHNICAL_RECOVERY_POLICY_CHECKS_PASSED_REVIEW_REQUIRED");
  assert.equal(validDisabledPitr.calculated.maximumDeclaredDataLossSeconds, 5_400);

  const invalidDisabledPitr = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    pointInTimeRecoveryEnabled: false,
    pointInTimeRecoveryRetentionDays: 0,
    maxWalArchiveLagSeconds: 1,
    walArchiveMonitoring: "DISABLED"
  });
  assert.equal(invalidDisabledPitr.status, "PITR_RETENTION_POLICY_INVALID_REVIEW_REQUIRED");
});

test("marks an over-age last successful backup as stale recovery evidence", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    lastSuccessfulBackupAgeMinutes: 91
  });

  assert.equal(report.status, "RECOVERY_EVIDENCE_STALE_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, ["LAST_SUCCESSFUL_BACKUP_IS_STALE"]);
});

test("marks stale integrity verification and restore-drill evidence", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    lastSuccessfulBackupAgeMinutes: 91,
    lastBackupIntegrityCheckAgeHours: 25,
    lastRestoreDrillAgeDays: 31
  });

  assert.equal(report.status, "RECOVERY_EVIDENCE_STALE_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "LAST_SUCCESSFUL_BACKUP_IS_STALE",
    "BACKUP_INTEGRITY_VERIFICATION_IS_STALE",
    "RESTORE_DRILL_IS_STALE"
  ]);
});

test("blocks unverified encryption, local-only storage and missing remote digest verification", () => {
  const report = assessPostgresBackupRecoveryPolicy({
    ...BASE_PLAN,
    restoreDrillApplicationValidation: "UNVERIFIED",
    backupEncryptionAtRest: "UNVERIFIED",
    backupEncryptionInTransit: "DISABLED",
    backupDestination: "LOCAL_ONLY",
    remoteDigestVerification: "UNVERIFIED",
    walArchiveMonitoring: "UNVERIFIED"
  });

  assert.equal(report.status, "BACKUP_PROTECTION_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "RESTORE_DRILL_APPLICATION_VALIDATION_NOT_VERIFIED",
    "BACKUP_ENCRYPTION_AT_REST_NOT_VERIFIED",
    "BACKUP_ENCRYPTION_IN_TRANSIT_NOT_VERIFIED",
    "RESTRICTED_OFFSITE_BACKUP_DESTINATION_NOT_VERIFIED",
    "REMOTE_BACKUP_DIGEST_VERIFICATION_NOT_VERIFIED",
    "WAL_ARCHIVE_MONITORING_NOT_VERIFIED"
  ]);
});

test("rejects missing, unknown and credential-shaped fields", () => {
  const { backupDestination, ...incomplete } = BASE_PLAN;
  assert.equal(backupDestination, "APPROVED_RESTRICTED_OFFSITE");
  assert.throws(
    () => assessPostgresBackupRecoveryPolicy(incomplete),
    /INVALID_POSTGRES_BACKUP_RECOVERY_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresBackupRecoveryPolicy({
      ...BASE_PLAN,
      connectionString: "postgres://user:password@example.invalid/db"
    }),
    /INVALID_POSTGRES_BACKUP_RECOVERY_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresBackupRecoveryPolicy({
      ...BASE_PLAN,
      unknownPolicyField: true
    }),
    /INVALID_POSTGRES_BACKUP_RECOVERY_POLICY_PLAN/
  );
});

test("rejects malformed, unsafe and out-of-range values", () => {
  const invalidPlans = [
    { ...BASE_PLAN, backupIntervalMinutes: 0 },
    { ...BASE_PLAN, maximumBackupAgeMinutes: 0 },
    { ...BASE_PLAN, lastSuccessfulBackupAgeMinutes: -1 },
    { ...BASE_PLAN, lastRestoreDrillDurationSeconds: 0 },
    { ...BASE_PLAN, backupRetentionDays: 3_651 },
    { ...BASE_PLAN, recoveryPointObjectiveSeconds: 1.5 },
    { ...BASE_PLAN, recoveryTimeObjectiveSeconds: -1 },
    { ...BASE_PLAN, pointInTimeRecoveryEnabled: "true" },
    { ...BASE_PLAN, pointInTimeRecoveryRetentionDays: -1 },
    { ...BASE_PLAN, lastBackupIntegrityCheckAgeHours: 87_601 },
    { ...BASE_PLAN, maximumRestoreDrillAgeDays: 0 },
    { ...BASE_PLAN, backupEncryptionAtRest: "true" },
    { ...BASE_PLAN, restoreDrillApplicationValidation: "complete" },
    { ...BASE_PLAN, backupDestination: "ANY_S3_BUCKET" }
  ];

  for (const plan of invalidPlans) {
    assert.throws(
      () => assessPostgresBackupRecoveryPolicy(plan),
      /INVALID_POSTGRES_BACKUP_RECOVERY_POLICY_PLAN/
    );
  }
});

test("freezes the report, nested records and reason-code array", () => {
  const report = assessPostgresBackupRecoveryPolicy(BASE_PLAN);

  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.policy), true);
  assert.equal(Object.isFrozen(report.evidence), true);
  assert.equal(Object.isFrozen(report.calculated), true);
  assert.equal(Object.isFrozen(report.reasonCodes), true);
  assert.equal(Object.isFrozen(report.humanReviewRequired), true);
});
