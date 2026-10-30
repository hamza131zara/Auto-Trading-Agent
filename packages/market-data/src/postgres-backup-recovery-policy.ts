/**
 * Offline PostgreSQL backup, retention and recovery-policy assessment.
 *
 * This module validates only operator-declared policy values. It performs no
 * database, storage, KMS, object-store, provider or network operation. All
 * successful assessments remain review-required and non-authorizing.
 */

export type RecoveryEvidenceState = "VERIFIED" | "UNVERIFIED" | "DISABLED";

export type BackupDestinationState =
  | "APPROVED_RESTRICTED_OFFSITE"
  | "LOCAL_ONLY"
  | "UNVERIFIED";

export interface PostgresBackupRecoveryPolicyPlan {
  /** Declared maximum interval between successful base backups. */
  readonly backupIntervalMinutes: number;
  /** Maximum permitted age of a successful base backup before an alert is required. */
  readonly maximumBackupAgeMinutes: number;
  /** Age of the most recent successful base backup. */
  readonly lastSuccessfulBackupAgeMinutes: number;
  /** Declared retention for base backups and associated recovery material. */
  readonly backupRetentionDays: number;
  /** Maximum acceptable data-loss window, supplied by the service owner. */
  readonly recoveryPointObjectiveSeconds: number;
  /** Maximum acceptable service-restoration duration, supplied by the owner. */
  readonly recoveryTimeObjectiveSeconds: number;
  /** Whether WAL archiving and point-in-time recovery are part of the plan. */
  readonly pointInTimeRecoveryEnabled: boolean;
  /** Retention window for WAL/PITR recovery points; must be zero when PITR is disabled. */
  readonly pointInTimeRecoveryRetentionDays: number;
  /** Declared maximum WAL archival lag; must be zero when PITR is disabled. */
  readonly maxWalArchiveLagSeconds: number;
  /** Age of the most recent successful backup-integrity verification. */
  readonly lastBackupIntegrityCheckAgeHours: number;
  /** Maximum permitted age for backup-integrity verification. */
  readonly maximumBackupIntegrityCheckAgeHours: number;
  /** Age of the most recent successful isolated restore drill. */
  readonly lastRestoreDrillAgeDays: number;
  /** Maximum permitted age for a successful restore drill. */
  readonly maximumRestoreDrillAgeDays: number;
  /** Measured duration of the most recent successful restore drill. */
  readonly lastRestoreDrillDurationSeconds: number;
  /** Whether application-level invariants and smoke validation were completed in that drill. */
  readonly restoreDrillApplicationValidation: RecoveryEvidenceState;
  /** Owner-declared verification state for backup encryption at rest. */
  readonly backupEncryptionAtRest: RecoveryEvidenceState;
  /** Owner-declared verification state for backup transport encryption. */
  readonly backupEncryptionInTransit: RecoveryEvidenceState;
  /** Declared destination class; only a reviewed restricted off-site destination qualifies. */
  readonly backupDestination: BackupDestinationState;
  /** Owner-declared verification state for digest verification after remote upload. */
  readonly remoteDigestVerification: RecoveryEvidenceState;
  /** Whether the WAL archival path has independently reviewed lag/gap monitoring. */
  readonly walArchiveMonitoring: RecoveryEvidenceState;
}

export type PostgresBackupRecoveryPolicyStatus =
  | "RECOVERY_OBJECTIVES_NOT_MET_REVIEW_REQUIRED"
  | "BACKUP_POLICY_CONFIGURATION_INVALID_REVIEW_REQUIRED"
  | "PITR_RETENTION_POLICY_INVALID_REVIEW_REQUIRED"
  | "RECOVERY_EVIDENCE_STALE_REVIEW_REQUIRED"
  | "BACKUP_PROTECTION_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED"
  | "TECHNICAL_RECOVERY_POLICY_CHECKS_PASSED_REVIEW_REQUIRED";

export interface PostgresBackupRecoveryPolicyAssessment {
  readonly status: PostgresBackupRecoveryPolicyStatus;
  readonly policy: Readonly<{
    backupIntervalMinutes: number;
    maximumBackupAgeMinutes: number;
    backupRetentionDays: number;
    recoveryPointObjectiveSeconds: number;
    recoveryTimeObjectiveSeconds: number;
    pointInTimeRecoveryEnabled: boolean;
    pointInTimeRecoveryRetentionDays: number;
    maxWalArchiveLagSeconds: number;
  }>;
  readonly evidence: Readonly<{
    lastSuccessfulBackupAgeMinutes: number;
    lastBackupIntegrityCheckAgeHours: number;
    maximumBackupIntegrityCheckAgeHours: number;
    lastRestoreDrillAgeDays: number;
    maximumRestoreDrillAgeDays: number;
    lastRestoreDrillDurationSeconds: number;
    restoreDrillApplicationValidation: RecoveryEvidenceState;
    backupEncryptionAtRest: RecoveryEvidenceState;
    backupEncryptionInTransit: RecoveryEvidenceState;
    backupDestination: BackupDestinationState;
    remoteDigestVerification: RecoveryEvidenceState;
    walArchiveMonitoring: RecoveryEvidenceState;
  }>;
  readonly calculated: Readonly<{
    backupIntervalSeconds: number;
    maximumBackupAgeSeconds: number;
    maximumDeclaredDataLossSeconds: number;
    restoreDrillWithinRto: boolean;
  }>;
  readonly reasonCodes: readonly string[];
  readonly humanReviewRequired: readonly string[];
  readonly productionRecoveryApproved: false;
  readonly databaseDeploymentApproved: false;
  readonly providerActivationAuthorized: false;
  readonly tradingAuthorized: false;
}

const REQUIRED_KEYS = Object.freeze([
  "backupIntervalMinutes",
  "maximumBackupAgeMinutes",
  "lastSuccessfulBackupAgeMinutes",
  "backupRetentionDays",
  "recoveryPointObjectiveSeconds",
  "recoveryTimeObjectiveSeconds",
  "pointInTimeRecoveryEnabled",
  "pointInTimeRecoveryRetentionDays",
  "maxWalArchiveLagSeconds",
  "lastBackupIntegrityCheckAgeHours",
  "maximumBackupIntegrityCheckAgeHours",
  "lastRestoreDrillAgeDays",
  "maximumRestoreDrillAgeDays",
  "lastRestoreDrillDurationSeconds",
  "restoreDrillApplicationValidation",
  "backupEncryptionAtRest",
  "backupEncryptionInTransit",
  "backupDestination",
  "remoteDigestVerification",
  "walArchiveMonitoring"
] as const);

const EVIDENCE_STATES = Object.freeze([
  "VERIFIED",
  "UNVERIFIED",
  "DISABLED"
] as const);

const BACKUP_DESTINATIONS = Object.freeze([
  "APPROVED_RESTRICTED_OFFSITE",
  "LOCAL_ONLY",
  "UNVERIFIED"
] as const);

const HUMAN_REVIEW_REQUIRED = Object.freeze([
  "AUTHENTICATE_BACKUP_SCHEDULE_RETENTION_AND_TARGET_SERVICE_CONFIGURATION",
  "VERIFY_LAST_SUCCESSFUL_BACKUP_AGE_AND_ALERT_THRESHOLD",
  "VERIFY_OFFSITE_DESTINATION_ACCESS_CONTROLS_AND_ENCRYPTION_AT_REST_AND_IN_TRANSIT",
  "VERIFY_REMOTE_DIGEST_CHAIN_AND_BACKUP_INTEGRITY_MONITORING",
  "VERIFY_WAL_ARCHIVE_CONTINUITY_LAG_ALERTS_AND_PITR_RESTORE_CAPABILITY",
  "REVIEW_RESTORE_DRILL_ARTIFACTS_DATA_INTEGRITY_AND_APPLICATION_LEVEL_VALIDATION",
  "APPROVE_SERVICE_SPECIFIC_RPO_RTO_RETENTION_AND_RESTORE_DRILL_CADENCE",
  "OWNER_AND_DATABASE_OPERATOR_APPROVAL"
] as const);

const MAX_SECONDS = 315_360_000;
const MAX_DAYS = 3_650;
const MAX_HOURS = 87_600;
const MAX_BACKUP_INTERVAL_MINUTES = 525_600;

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isBoundedInteger(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value >= minimum &&
    value <= maximum;
}

function isEvidenceState(value: unknown): value is RecoveryEvidenceState {
  return typeof value === "string" &&
    (EVIDENCE_STATES as readonly string[]).includes(value);
}

function invalidPlan(): never {
  throw new TypeError("INVALID_POSTGRES_BACKUP_RECOVERY_POLICY_PLAN");
}

/**
 * Assess consistency of an operator-declared backup/PITR policy.
 *
 * maximumDeclaredDataLossSeconds = maximum permitted backup age + declared
 * WAL archive lag when PITR is enabled. This arithmetic does not prove that the
 * real backup schedule, WAL archive, monitoring or storage behaves as stated.
 */
export function assessPostgresBackupRecoveryPolicy(
  input: unknown
): PostgresBackupRecoveryPolicyAssessment {
  if (!isRecord(input)) return invalidPlan();

  const actualKeys = Object.keys(input).sort();
  const expectedKeys = [...REQUIRED_KEYS].sort();
  if (actualKeys.length !== expectedKeys.length ||
      !actualKeys.every((key, index) => key === expectedKeys[index])) {
    return invalidPlan();
  }

  if (!isBoundedInteger(input.backupIntervalMinutes, 1, MAX_BACKUP_INTERVAL_MINUTES) ||
      !isBoundedInteger(input.maximumBackupAgeMinutes, 1, MAX_BACKUP_INTERVAL_MINUTES) ||
      !isBoundedInteger(input.lastSuccessfulBackupAgeMinutes, 0, MAX_BACKUP_INTERVAL_MINUTES) ||
      !isBoundedInteger(input.backupRetentionDays, 1, MAX_DAYS) ||
      !isBoundedInteger(input.recoveryPointObjectiveSeconds, 1, MAX_SECONDS) ||
      !isBoundedInteger(input.recoveryTimeObjectiveSeconds, 1, MAX_SECONDS) ||
      typeof input.pointInTimeRecoveryEnabled !== "boolean" ||
      !isBoundedInteger(input.pointInTimeRecoveryRetentionDays, 0, MAX_DAYS) ||
      !isBoundedInteger(input.maxWalArchiveLagSeconds, 0, MAX_SECONDS) ||
      !isBoundedInteger(input.lastBackupIntegrityCheckAgeHours, 0, MAX_HOURS) ||
      !isBoundedInteger(input.maximumBackupIntegrityCheckAgeHours, 1, MAX_HOURS) ||
      !isBoundedInteger(input.lastRestoreDrillAgeDays, 0, MAX_DAYS) ||
      !isBoundedInteger(input.maximumRestoreDrillAgeDays, 1, MAX_DAYS) ||
      !isBoundedInteger(input.lastRestoreDrillDurationSeconds, 1, MAX_SECONDS) ||
      !isEvidenceState(input.restoreDrillApplicationValidation) ||
      !isEvidenceState(input.backupEncryptionAtRest) ||
      !isEvidenceState(input.backupEncryptionInTransit) ||
      !isEvidenceState(input.remoteDigestVerification) ||
      !isEvidenceState(input.walArchiveMonitoring) ||
      typeof input.backupDestination !== "string" ||
      !(BACKUP_DESTINATIONS as readonly string[]).includes(input.backupDestination)) {
    return invalidPlan();
  }

  const backupIntervalSeconds = input.backupIntervalMinutes * 60;
  const maximumBackupAgeSeconds = input.maximumBackupAgeMinutes * 60;
  const maximumDeclaredDataLossSeconds = maximumBackupAgeSeconds +
    (input.pointInTimeRecoveryEnabled ? input.maxWalArchiveLagSeconds : 0);
  const restoreDrillWithinRto =
    input.lastRestoreDrillDurationSeconds <= input.recoveryTimeObjectiveSeconds;

  const reasonCodes: string[] = [];
  const backupAgeThresholdBelowCadence =
    input.maximumBackupAgeMinutes < input.backupIntervalMinutes;
  const maximumBackupAgeExceedsRetention =
    input.maximumBackupAgeMinutes > input.backupRetentionDays * 24 * 60;
  const backupPolicyConfigurationInvalid =
    backupAgeThresholdBelowCadence || maximumBackupAgeExceedsRetention;

  if (backupAgeThresholdBelowCadence) {
    reasonCodes.push("MAXIMUM_BACKUP_AGE_BELOW_DECLARED_BACKUP_INTERVAL");
  }
  if (maximumBackupAgeExceedsRetention) {
    reasonCodes.push("MAXIMUM_BACKUP_AGE_EXCEEDS_BACKUP_RETENTION");
  }
  if (maximumDeclaredDataLossSeconds > input.recoveryPointObjectiveSeconds) {
    reasonCodes.push("DECLARED_BACKUP_AND_WAL_LAG_EXCEED_RPO");
  }
  if (!restoreDrillWithinRto) {
    reasonCodes.push("LAST_RESTORE_DRILL_DURATION_EXCEEDS_RTO");
  }

  const pitrRetentionInvalid = input.pointInTimeRecoveryEnabled
    ? input.pointInTimeRecoveryRetentionDays < 1 ||
      input.pointInTimeRecoveryRetentionDays > input.backupRetentionDays
    : input.pointInTimeRecoveryRetentionDays !== 0 ||
      input.maxWalArchiveLagSeconds !== 0 ||
      input.walArchiveMonitoring !== "DISABLED";

  if (pitrRetentionInvalid) {
    reasonCodes.push("PITR_RETENTION_OR_WAL_CONFIGURATION_INCONSISTENT");
  }

  const lastSuccessfulBackupStale =
    input.lastSuccessfulBackupAgeMinutes > input.maximumBackupAgeMinutes;
  const backupIntegrityCheckStale =
    input.lastBackupIntegrityCheckAgeHours > input.maximumBackupIntegrityCheckAgeHours;
  const restoreDrillStale =
    input.lastRestoreDrillAgeDays > input.maximumRestoreDrillAgeDays;

  if (lastSuccessfulBackupStale) {
    reasonCodes.push("LAST_SUCCESSFUL_BACKUP_IS_STALE");
  }
  if (backupIntegrityCheckStale) {
    reasonCodes.push("BACKUP_INTEGRITY_VERIFICATION_IS_STALE");
  }
  if (restoreDrillStale) {
    reasonCodes.push("RESTORE_DRILL_IS_STALE");
  }

  if (input.restoreDrillApplicationValidation !== "VERIFIED") {
    reasonCodes.push("RESTORE_DRILL_APPLICATION_VALIDATION_NOT_VERIFIED");
  }
  if (input.backupEncryptionAtRest !== "VERIFIED") {
    reasonCodes.push("BACKUP_ENCRYPTION_AT_REST_NOT_VERIFIED");
  }
  if (input.backupEncryptionInTransit !== "VERIFIED") {
    reasonCodes.push("BACKUP_ENCRYPTION_IN_TRANSIT_NOT_VERIFIED");
  }
  if (input.backupDestination !== "APPROVED_RESTRICTED_OFFSITE") {
    reasonCodes.push("RESTRICTED_OFFSITE_BACKUP_DESTINATION_NOT_VERIFIED");
  }
  if (input.remoteDigestVerification !== "VERIFIED") {
    reasonCodes.push("REMOTE_BACKUP_DIGEST_VERIFICATION_NOT_VERIFIED");
  }
  if (input.pointInTimeRecoveryEnabled && input.walArchiveMonitoring !== "VERIFIED") {
    reasonCodes.push("WAL_ARCHIVE_MONITORING_NOT_VERIFIED");
  }

  let status: PostgresBackupRecoveryPolicyStatus;
  if (reasonCodes.includes("DECLARED_BACKUP_AND_WAL_LAG_EXCEED_RPO") ||
      reasonCodes.includes("LAST_RESTORE_DRILL_DURATION_EXCEEDS_RTO")) {
    status = "RECOVERY_OBJECTIVES_NOT_MET_REVIEW_REQUIRED";
  } else if (backupPolicyConfigurationInvalid) {
    status = "BACKUP_POLICY_CONFIGURATION_INVALID_REVIEW_REQUIRED";
  } else if (pitrRetentionInvalid) {
    status = "PITR_RETENTION_POLICY_INVALID_REVIEW_REQUIRED";
  } else if (lastSuccessfulBackupStale || backupIntegrityCheckStale || restoreDrillStale) {
    status = "RECOVERY_EVIDENCE_STALE_REVIEW_REQUIRED";
  } else if (reasonCodes.length > 0) {
    status = "BACKUP_PROTECTION_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED";
  } else {
    status = "TECHNICAL_RECOVERY_POLICY_CHECKS_PASSED_REVIEW_REQUIRED";
  }

  return Object.freeze({
    status,
    policy: Object.freeze({
      backupIntervalMinutes: input.backupIntervalMinutes,
      maximumBackupAgeMinutes: input.maximumBackupAgeMinutes,
      backupRetentionDays: input.backupRetentionDays,
      recoveryPointObjectiveSeconds: input.recoveryPointObjectiveSeconds,
      recoveryTimeObjectiveSeconds: input.recoveryTimeObjectiveSeconds,
      pointInTimeRecoveryEnabled: input.pointInTimeRecoveryEnabled,
      pointInTimeRecoveryRetentionDays: input.pointInTimeRecoveryRetentionDays,
      maxWalArchiveLagSeconds: input.maxWalArchiveLagSeconds
    }),
    evidence: Object.freeze({
      lastSuccessfulBackupAgeMinutes: input.lastSuccessfulBackupAgeMinutes,
      lastBackupIntegrityCheckAgeHours: input.lastBackupIntegrityCheckAgeHours,
      maximumBackupIntegrityCheckAgeHours: input.maximumBackupIntegrityCheckAgeHours,
      lastRestoreDrillAgeDays: input.lastRestoreDrillAgeDays,
      maximumRestoreDrillAgeDays: input.maximumRestoreDrillAgeDays,
      lastRestoreDrillDurationSeconds: input.lastRestoreDrillDurationSeconds,
      restoreDrillApplicationValidation: input.restoreDrillApplicationValidation,
      backupEncryptionAtRest: input.backupEncryptionAtRest,
      backupEncryptionInTransit: input.backupEncryptionInTransit,
      backupDestination: input.backupDestination as BackupDestinationState,
      remoteDigestVerification: input.remoteDigestVerification,
      walArchiveMonitoring: input.walArchiveMonitoring
    }),
    calculated: Object.freeze({
      backupIntervalSeconds,
      maximumBackupAgeSeconds,
      maximumDeclaredDataLossSeconds,
      restoreDrillWithinRto
    }),
    reasonCodes: Object.freeze(reasonCodes),
    humanReviewRequired: HUMAN_REVIEW_REQUIRED,
    productionRecoveryApproved: false as const,
    databaseDeploymentApproved: false as const,
    providerActivationAuthorized: false as const,
    tradingAuthorized: false as const
  });
}
