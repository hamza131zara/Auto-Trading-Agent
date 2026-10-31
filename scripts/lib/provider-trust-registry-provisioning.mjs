import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { inspectMigrationSet } from "./migration-governance.mjs";

export const PROVIDER_TRUST_REGISTRY_PROVISIONING_PACKET_VERSION =
  "ata.provider-trust-registry-provisioning-packet.v1";
export const PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID =
  "20261031_phase6_provider_trust_registry_high_water_marks";

const SHA256 = /^[a-f0-9]{64}$/;
const REGISTRY_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const ROOT_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CHANGE_ID = /^[A-Z][A-Z0-9-]{4,63}$/;
const REF = /^[a-z][a-z0-9+.-]*:\/\/[A-Za-z0-9][A-Za-z0-9._:/#-]{2,255}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const MAX_PACKET_AGE_MS = 7 * 24 * 60 * 60 * 1_000;
const MAX_ENDPOINT_LENGTH = 2_048;
const MAX_DNS_ADDRESSES = 16;

const FORBIDDEN_KEYS = new Set([
  "apikey",
  "accesstoken",
  "authorization",
  "bearertoken",
  "connectionstring",
  "credential",
  "password",
  "privatekey",
  "secret",
  "seedphrase",
  "signingkey",
  "token",
  "walletsecret"
]);

const APPROVAL_ROLES = Object.freeze([
  "registry-owner",
  "security-reviewer",
  "database-operator",
  "service-owner"
]);

function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value, keys) {
  if (!isRecord(value)) return false;
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index]);
}

function add(errors, code) {
  if (!errors.includes(code)) errors.push(code);
}

function inspectCredentialMaterial(value, errors, path = "$") {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      inspectCredentialMaterial(item, errors, path + "[" + index + "]")
    );
    return;
  }
  if (isRecord(value)) {
    for (const [key, child] of Object.entries(value)) {
      const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (FORBIDDEN_KEYS.has(normalized) ||
          /(private.?key|seed.?phrase|wallet.?secret|connection.?string)/i.test(key)) {
        add(errors, "PACKET_CONTAINS_CREDENTIAL_FIELD");
      }
      inspectCredentialMaterial(child, errors, path + "." + key);
    }
    return;
  }
  if (typeof value === "string" &&
      (/-----BEGIN [A-Z0-9 ]*KEY-----/i.test(value) ||
       /(?:postgres(?:ql)?:\/\/|bearer\s+[A-Za-z0-9._~-]{12,}|\bgh[pousr]_[A-Za-z0-9]{20,}\b|\bsk_live_[A-Za-z0-9]{12,}\b)/i.test(value))) {
    add(errors, "PACKET_CONTAINS_INLINE_CREDENTIAL_OR_KEY_MATERIAL");
  }
}

function validTimestamp(value) {
  if (typeof value !== "string" || !UTC.test(value)) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString() === value;
}

function requireReference(value, errors, code) {
  if (typeof value !== "string" || !REF.test(value)) add(errors, code);
}

function requireTrue(value, errors, code) {
  if (value !== true) add(errors, code);
}

function canonicalIpAddress(value) {
  if (typeof value !== "string") return null;
  const family = isIP(value);
  if (family === 4) {
    const parts = value.split(".");
    if (parts.length !== 4) return null;
    const octets = parts.map(Number);
    if (octets.some((octet, index) =>
      !/^(0|[1-9][0-9]{0,2})$/.test(parts[index]) || octet > 255
    )) return null;
    if (octets[0] === 0 ||
        octets[0] === 127 ||
        (octets[0] === 169 && octets[1] === 254) ||
        octets[0] >= 224) return null;
    return octets.join(".");
  }
  if (family === 6) {
    if (value.includes("%")) return null;
    try {
      const hostname = new URL("https://[" + value + "]/").hostname;
      if (!hostname.startsWith("[") || !hostname.endsWith("]")) return null;
      const canonical = hostname.slice(1, -1);
      const normalized = canonical.toLowerCase();
      if (normalized === "::" ||
          normalized === "::1" ||
          normalized.startsWith("fe80:") ||
          normalized.startsWith("ff") ||
          normalized.startsWith("::ffff:")) return null;
      return normalized;
    } catch {
      return null;
    }
  }
  return null;
}

function validateEndpoint(value, errors) {
  if (typeof value !== "string" ||
      value.length === 0 ||
      value.length > MAX_ENDPOINT_LENGTH) {
    add(errors, "REGISTRY_ENDPOINT_INVALID");
    return null;
  }
  let url;
  try {
    url = new URL(value);
  } catch {
    add(errors, "REGISTRY_ENDPOINT_INVALID");
    return null;
  }
  const host = url.hostname.startsWith("[")
    ? url.hostname.slice(1, -1)
    : url.hostname;
  const sensitiveQueryNames = new Set([
    "access_token", "apikey", "api_key", "auth", "authorization",
    "key", "password", "secret", "signature", "token"
  ]);
  const queryNames = [...url.searchParams.keys()].map((name) => name.toLowerCase());
  if (url.protocol !== "https:" ||
      url.href !== value ||
      url.username !== "" ||
      url.password !== "" ||
      url.hash !== "" ||
      url.hostname.length === 0 ||
      isIP(host) !== 0 ||
      url.pathname === "/" ||
      queryNames.length > 16 ||
      queryNames.some((name) => sensitiveQueryNames.has(name)) ||
      url.search.length > 512) {
    add(errors, "REGISTRY_ENDPOINT_NOT_FIXED_CANONICAL_HTTPS");
    return null;
  }
  return url;
}

export function getProviderTrustRegistryDeploymentDescriptorSha256(input) {
  if (!isRecord(input) ||
      typeof input.registryId !== "string" ||
      typeof input.rootKeyId !== "string" ||
      typeof input.endpointUrl !== "string" ||
      typeof input.rootSpkiSha256 !== "string" ||
      !Array.isArray(input.dnsAllowedAddresses)) {
    throw new TypeError("REGISTRY_DEPLOYMENT_DESCRIPTOR_INVALID");
  }

  const descriptor = {
    schemaVersion: "ata.provider-trust-registry-deployment-descriptor.v1",
    registryId: input.registryId,
    rootKeyId: input.rootKeyId,
    endpointUrl: input.endpointUrl,
    dnsAllowedAddresses: [...input.dnsAllowedAddresses].sort(),
    rootSpkiSha256: input.rootSpkiSha256
  };
  return createHash("sha256")
    .update(JSON.stringify(descriptor), "utf8")
    .digest("hex");
}

function validateRegistry(registry, errors) {
  const keys = [
    "registryId",
    "rootKeyId",
    "endpointUrl",
    "dnsAllowedAddresses",
    "rootSpkiSha256",
    "deploymentDescriptorSha256",
    "endpointOwnershipReviewRef",
    "dnsAllowlistReviewRef",
    "tlsEndpointReviewRef",
    "rootCeremonyEvidenceRef",
    "rootCustodyReviewRef",
    "rootRecoveryReviewRef",
    "rotationRunbookRef",
    "revocationRunbookRef",
    "reviewedAt"
  ];
  if (!hasExactKeys(registry, keys)) {
    add(errors, "REGISTRY_SECTION_SHAPE_INVALID");
    return;
  }

  if (typeof registry.registryId !== "string" || !REGISTRY_ID.test(registry.registryId)) {
    add(errors, "REGISTRY_ID_INVALID");
  }
  if (typeof registry.rootKeyId !== "string" || !ROOT_KEY_ID.test(registry.rootKeyId)) {
    add(errors, "REGISTRY_ROOT_KEY_ID_INVALID");
  }
  validateEndpoint(registry.endpointUrl, errors);

  if (typeof registry.rootSpkiSha256 !== "string" || !SHA256.test(registry.rootSpkiSha256)) {
    add(errors, "REGISTRY_ROOT_SPKI_FINGERPRINT_INVALID");
  }
  if (!Array.isArray(registry.dnsAllowedAddresses) ||
      registry.dnsAllowedAddresses.length < 1 ||
      registry.dnsAllowedAddresses.length > MAX_DNS_ADDRESSES) {
    add(errors, "REGISTRY_DNS_ALLOWLIST_INVALID");
  } else {
    const normalized = registry.dnsAllowedAddresses.map(canonicalIpAddress);
    if (normalized.some((address, index) =>
      address === null || address !== registry.dnsAllowedAddresses[index]
    ) || new Set(normalized).size !== normalized.length) {
      add(errors, "REGISTRY_DNS_ALLOWLIST_INVALID");
    }
  }

  try {
    const expected = getProviderTrustRegistryDeploymentDescriptorSha256(registry);
    if (registry.deploymentDescriptorSha256 !== expected) {
      add(errors, "REGISTRY_DEPLOYMENT_DESCRIPTOR_DIGEST_MISMATCH");
    }
  } catch {
    add(errors, "REGISTRY_DEPLOYMENT_DESCRIPTOR_INVALID");
  }

  for (const [field, code] of [
    ["endpointOwnershipReviewRef", "REGISTRY_ENDPOINT_OWNERSHIP_EVIDENCE_MISSING"],
    ["dnsAllowlistReviewRef", "REGISTRY_DNS_REVIEW_EVIDENCE_MISSING"],
    ["tlsEndpointReviewRef", "REGISTRY_TLS_REVIEW_EVIDENCE_MISSING"],
    ["rootCeremonyEvidenceRef", "REGISTRY_ROOT_CEREMONY_EVIDENCE_MISSING"],
    ["rootCustodyReviewRef", "REGISTRY_ROOT_CUSTODY_EVIDENCE_MISSING"],
    ["rootRecoveryReviewRef", "REGISTRY_ROOT_RECOVERY_EVIDENCE_MISSING"],
    ["rotationRunbookRef", "REGISTRY_ROTATION_RUNBOOK_MISSING"],
    ["revocationRunbookRef", "REGISTRY_REVOCATION_RUNBOOK_MISSING"]
  ]) requireReference(registry[field], errors, code);

  if (!validTimestamp(registry.reviewedAt)) {
    add(errors, "REGISTRY_REVIEW_TIMESTAMP_INVALID");
  }
}

function validatePersistence(persistence, migrationInventory, nowMs, errors) {
  const keys = [
    "highWaterMigrationId",
    "highWaterMigrationSha256",
    "migrationAppliedAt",
    "migrationApplicationEvidenceRef",
    "highWaterMarkReadbackEvidenceRef",
    "runtimeRoleReviewRef",
    "tlsVerifyFullReviewRef",
    "backupEvidenceRef",
    "backupVerifiedAt",
    "restoreDrillEvidenceRef",
    "restoreDrillVerifiedAt",
    "antiRollbackRecoveryReviewRef"
  ];
  if (!hasExactKeys(persistence, keys)) {
    add(errors, "PERSISTENCE_SECTION_SHAPE_INVALID");
    return;
  }

  if (persistence.highWaterMigrationId !== PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID) {
    add(errors, "HIGH_WATER_MIGRATION_ID_MISMATCH");
  }
  const migration = migrationInventory?.migrations?.find((item) =>
    item.id === PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID
  );
  if (!migrationInventory?.ok || !migration ||
      persistence.highWaterMigrationSha256 !== migration.sha256) {
    add(errors, "HIGH_WATER_MIGRATION_NOT_BOUND_TO_CURRENT_INVENTORY");
  }
  if (!validTimestamp(persistence.migrationAppliedAt) ||
      Date.parse(persistence.migrationAppliedAt) > nowMs) {
    add(errors, "HIGH_WATER_MIGRATION_APPLIED_AT_INVALID");
  }

  for (const [field, code] of [
    ["migrationApplicationEvidenceRef", "HIGH_WATER_MIGRATION_EVIDENCE_MISSING"],
    ["highWaterMarkReadbackEvidenceRef", "HIGH_WATER_MARK_READBACK_EVIDENCE_MISSING"],
    ["runtimeRoleReviewRef", "RUNTIME_ROLE_REVIEW_EVIDENCE_MISSING"],
    ["tlsVerifyFullReviewRef", "DATABASE_TLS_VERIFY_FULL_EVIDENCE_MISSING"],
    ["backupEvidenceRef", "DATABASE_BACKUP_EVIDENCE_MISSING"],
    ["restoreDrillEvidenceRef", "DATABASE_RESTORE_DRILL_EVIDENCE_MISSING"],
    ["antiRollbackRecoveryReviewRef", "ANTI_ROLLBACK_RECOVERY_REVIEW_MISSING"]
  ]) requireReference(persistence[field], errors, code);

  for (const [field, code] of [
    ["backupVerifiedAt", "DATABASE_BACKUP_TIMESTAMP_INVALID"],
    ["restoreDrillVerifiedAt", "DATABASE_RESTORE_DRILL_TIMESTAMP_INVALID"]
  ]) {
    if (!validTimestamp(persistence[field]) || Date.parse(persistence[field]) > nowMs) {
      add(errors, code);
    }
  }
}

function validateOperations(operations, errors) {
  const keys = [
    "monitoringPlanRef",
    "alertRouteReviewRef",
    "incidentRunbookRef",
    "rotationExerciseRef",
    "rotationExerciseAt",
    "revocationExerciseRef",
    "revocationExerciseAt",
    "registryOutageDrillRef",
    "registryOutageDrillAt",
    "freshSnapshotPerDecision",
    "staleSnapshotFallbackDisabled",
    "registryOutageDeniesProviderUse",
    "providerActivationDisabled",
    "tradingDisabled"
  ];
  if (!hasExactKeys(operations, keys)) {
    add(errors, "OPERATIONS_SECTION_SHAPE_INVALID");
    return;
  }

  for (const [field, code] of [
    ["monitoringPlanRef", "REGISTRY_MONITORING_PLAN_MISSING"],
    ["alertRouteReviewRef", "REGISTRY_ALERT_ROUTE_REVIEW_MISSING"],
    ["incidentRunbookRef", "REGISTRY_INCIDENT_RUNBOOK_MISSING"],
    ["rotationExerciseRef", "REGISTRY_ROTATION_EXERCISE_MISSING"],
    ["revocationExerciseRef", "REGISTRY_REVOCATION_EXERCISE_MISSING"],
    ["registryOutageDrillRef", "REGISTRY_OUTAGE_DRILL_MISSING"]
  ]) requireReference(operations[field], errors, code);

  for (const [field, code] of [
    ["rotationExerciseAt", "REGISTRY_ROTATION_EXERCISE_TIMESTAMP_INVALID"],
    ["revocationExerciseAt", "REGISTRY_REVOCATION_EXERCISE_TIMESTAMP_INVALID"],
    ["registryOutageDrillAt", "REGISTRY_OUTAGE_DRILL_TIMESTAMP_INVALID"]
  ]) {
    if (!validTimestamp(operations[field])) add(errors, code);
  }

  requireTrue(operations.freshSnapshotPerDecision, errors, "FRESH_SNAPSHOT_PER_DECISION_NOT_DECLARED");
  requireTrue(operations.staleSnapshotFallbackDisabled, errors, "STALE_SNAPSHOT_FALLBACK_NOT_DISABLED");
  requireTrue(operations.registryOutageDeniesProviderUse, errors, "REGISTRY_OUTAGE_FAIL_CLOSED_NOT_DECLARED");
  requireTrue(operations.providerActivationDisabled, errors, "PROVIDER_ACTIVATION_MUST_REMAIN_DISABLED");
  requireTrue(operations.tradingDisabled, errors, "TRADING_MUST_REMAIN_DISABLED");
}

function validateConfigDelivery(delivery, registry, errors) {
  const keys = [
    "destinationSecureStoreRef",
    "accessReviewRef",
    "auditTrailReviewRef",
    "independentChannelReviewRef",
    "valuesOutsideRepository",
    "privateMaterialExcluded"
  ];
  if (!hasExactKeys(delivery, keys)) {
    add(errors, "CONFIG_DELIVERY_SECTION_SHAPE_INVALID");
    return;
  }

  for (const [field, code] of [
    ["destinationSecureStoreRef", "CONFIG_SECURE_STORE_REFERENCE_MISSING"],
    ["accessReviewRef", "CONFIG_STORE_ACCESS_REVIEW_MISSING"],
    ["auditTrailReviewRef", "CONFIG_STORE_AUDIT_REVIEW_MISSING"],
    ["independentChannelReviewRef", "CONFIG_INDEPENDENT_CHANNEL_REVIEW_MISSING"]
  ]) requireReference(delivery[field], errors, code);

  requireTrue(delivery.valuesOutsideRepository, errors, "TRUST_CONFIG_MUST_REMAIN_OUTSIDE_REPOSITORY");
  requireTrue(delivery.privateMaterialExcluded, errors, "PRIVATE_MATERIAL_MUST_NOT_ENTER_PACKET");

  if (isRecord(registry)) {
    const endpoint = validateEndpoint(registry.endpointUrl, []);
    if (endpoint === null) return;
  }
}

function validateFreshnessPolicy(policy, registry, persistence, operations, nowMs, errors) {
  const keys = [
    "maxRegistryReviewAgeDays",
    "maxBackupAgeHours",
    "maxRestoreDrillAgeDays",
    "maxOperationalExerciseAgeDays"
  ];
  if (!hasExactKeys(policy, keys)) {
    add(errors, "FRESHNESS_POLICY_SHAPE_INVALID");
    return;
  }

  const limits = [
    ["maxRegistryReviewAgeDays", 1, 365],
    ["maxBackupAgeHours", 1, 720],
    ["maxRestoreDrillAgeDays", 1, 365],
    ["maxOperationalExerciseAgeDays", 1, 365]
  ];
  for (const [field, minimum, maximum] of limits) {
    const value = policy[field];
    if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
      add(errors, "FRESHNESS_POLICY_LIMIT_INVALID");
    }
  }

  const checkAge = (timestamp, maximumAgeMs, code) => {
    if (!validTimestamp(timestamp) ||
        Date.parse(timestamp) > nowMs ||
        nowMs - Date.parse(timestamp) > maximumAgeMs) {
      add(errors, code);
    }
  };

  if (Number.isSafeInteger(policy.maxRegistryReviewAgeDays) &&
      policy.maxRegistryReviewAgeDays >= 1 &&
      policy.maxRegistryReviewAgeDays <= 365) {
    checkAge(
      registry?.reviewedAt,
      policy.maxRegistryReviewAgeDays * 24 * 60 * 60 * 1_000,
      "REGISTRY_REVIEW_EVIDENCE_STALE"
    );
  }
  if (Number.isSafeInteger(policy.maxBackupAgeHours) &&
      policy.maxBackupAgeHours >= 1 &&
      policy.maxBackupAgeHours <= 720) {
    checkAge(
      persistence?.backupVerifiedAt,
      policy.maxBackupAgeHours * 60 * 60 * 1_000,
      "DATABASE_BACKUP_EVIDENCE_STALE"
    );
  }
  if (Number.isSafeInteger(policy.maxRestoreDrillAgeDays) &&
      policy.maxRestoreDrillAgeDays >= 1 &&
      policy.maxRestoreDrillAgeDays <= 365) {
    checkAge(
      persistence?.restoreDrillVerifiedAt,
      policy.maxRestoreDrillAgeDays * 24 * 60 * 60 * 1_000,
      "DATABASE_RESTORE_DRILL_EVIDENCE_STALE"
    );
  }
  if (Number.isSafeInteger(policy.maxOperationalExerciseAgeDays) &&
      policy.maxOperationalExerciseAgeDays >= 1 &&
      policy.maxOperationalExerciseAgeDays <= 365) {
    const maxAge = policy.maxOperationalExerciseAgeDays * 24 * 60 * 60 * 1_000;
    checkAge(operations?.rotationExerciseAt, maxAge, "REGISTRY_ROTATION_EXERCISE_STALE");
    checkAge(operations?.revocationExerciseAt, maxAge, "REGISTRY_REVOCATION_EXERCISE_STALE");
    checkAge(operations?.registryOutageDrillAt, maxAge, "REGISTRY_OUTAGE_DRILL_STALE");
  }
}

function validateApprovals(approvals, createdAt, nowMs, errors) {
  if (!Array.isArray(approvals) || approvals.length !== APPROVAL_ROLES.length) {
    add(errors, "EXACT_OWNER_APPROVAL_SET_REQUIRED");
    return;
  }

  const roles = new Set();
  const identities = new Set();
  for (const approval of approvals) {
    if (!hasExactKeys(approval, ["role", "approverRef", "evidenceRef", "approvedAt"])) {
      add(errors, "OWNER_APPROVAL_RECORD_INVALID");
      continue;
    }
    if (!APPROVAL_ROLES.includes(approval.role) || roles.has(approval.role)) {
      add(errors, "OWNER_APPROVAL_ROLES_INVALID_OR_DUPLICATE");
    } else {
      roles.add(approval.role);
    }
    requireReference(approval.approverRef, errors, "OWNER_APPROVER_REFERENCE_INVALID");
    requireReference(approval.evidenceRef, errors, "OWNER_APPROVAL_EVIDENCE_MISSING");
    if (identities.has(approval.approverRef)) {
      add(errors, "OWNER_APPROVALS_NOT_INDEPENDENT");
    }
    identities.add(approval.approverRef);
    if (!validTimestamp(approval.approvedAt) ||
        Date.parse(approval.approvedAt) < Date.parse(createdAt) ||
        Date.parse(approval.approvedAt) > nowMs) {
      add(errors, "OWNER_APPROVAL_TIMESTAMP_INVALID");
    }
  }
  if (roles.size !== APPROVAL_ROLES.length) {
    add(errors, "OWNER_APPROVAL_ROLES_INCOMPLETE");
  }
}

function validateMaintenanceWindow(value, nowMs, errors) {
  if (!hasExactKeys(value, ["startsAt", "endsAt"])) {
    add(errors, "MAINTENANCE_WINDOW_INVALID");
    return;
  }
  if (!validTimestamp(value.startsAt) ||
      !validTimestamp(value.endsAt) ||
      Date.parse(value.startsAt) <= nowMs ||
      Date.parse(value.endsAt) <= Date.parse(value.startsAt) ||
      Date.parse(value.endsAt) - Date.parse(value.startsAt) > 12 * 60 * 60 * 1_000) {
    add(errors, "MAINTENANCE_WINDOW_INVALID");
  }
}

/**
 * Offline technical preflight for owner-controlled trust-registry provisioning.
 * A passing report only means the declarations are structurally coherent and
 * bound to this repository's current high-water migration. Evidence references,
 * identities, approvals and external service configuration are not authenticated.
 */
export function validateProviderTrustRegistryProvisioningPacket(packet, options = {}) {
  const errors = [];
  const now = options.now === undefined ? new Date() : new Date(options.now);
  if (!Number.isFinite(now.getTime())) {
    return {
      valid: false,
      status: "BLOCKED_REVIEW_REQUIRED",
      reasonCodes: ["VALIDATION_CLOCK_INVALID"],
      registryProvisioningAuthorized: false,
      providerActivationAuthorized: false,
      tradingAuthorized: false
    };
  }
  const nowMs = now.getTime();

  if (!isRecord(packet)) {
    return {
      valid: false,
      status: "BLOCKED_REVIEW_REQUIRED",
      reasonCodes: ["PACKET_OBJECT_REQUIRED"],
      registryProvisioningAuthorized: false,
      providerActivationAuthorized: false,
      tradingAuthorized: false
    };
  }

  inspectCredentialMaterial(packet, errors);
  const topKeys = [
    "schemaVersion",
    "changeId",
    "environment",
    "createdAt",
    "expiresAt",
    "promotionEvidenceRef",
    "registry",
    "persistence",
    "operations",
    "configDelivery",
    "freshnessPolicy",
    "approvals",
    "maintenanceWindow"
  ];
  if (!hasExactKeys(packet, topKeys)) add(errors, "PACKET_SHAPE_INVALID");

  if (packet.schemaVersion !== PROVIDER_TRUST_REGISTRY_PROVISIONING_PACKET_VERSION) {
    add(errors, "PACKET_SCHEMA_VERSION_UNSUPPORTED");
  }
  if (typeof packet.changeId !== "string" || !CHANGE_ID.test(packet.changeId)) {
    add(errors, "CHANGE_CONTROL_ID_INVALID");
  }
  if (packet.environment !== "staging" && packet.environment !== "production") {
    add(errors, "TARGET_ENVIRONMENT_INVALID");
  }
  if (!validTimestamp(packet.createdAt) ||
      !validTimestamp(packet.expiresAt) ||
      Date.parse(packet.createdAt) > nowMs ||
      Date.parse(packet.expiresAt) <= nowMs ||
      Date.parse(packet.expiresAt) <= Date.parse(packet.createdAt) ||
      Date.parse(packet.expiresAt) - Date.parse(packet.createdAt) > MAX_PACKET_AGE_MS) {
    add(errors, "PACKET_VALIDITY_WINDOW_INVALID");
  }

  if (packet.environment === "production") {
    requireReference(
      packet.promotionEvidenceRef,
      errors,
      "PRODUCTION_STAGING_PROMOTION_EVIDENCE_MISSING"
    );
  } else if (packet.promotionEvidenceRef !== null) {
    add(errors, "STAGING_PACKET_MUST_NOT_CLAIM_PRODUCTION_PROMOTION");
  }

  const migrationInventory = options.migrationInventory ?? inspectMigrationSet();
  if (!migrationInventory?.ok) add(errors, "REPOSITORY_MIGRATION_INVENTORY_INVALID");

  validateRegistry(packet.registry, errors);
  validatePersistence(packet.persistence, migrationInventory, nowMs, errors);
  validateOperations(packet.operations, errors);
  validateConfigDelivery(packet.configDelivery, packet.registry, errors);
  validateFreshnessPolicy(
    packet.freshnessPolicy,
    packet.registry,
    packet.persistence,
    packet.operations,
    nowMs,
    errors
  );

  if (validTimestamp(packet.createdAt)) {
    validateApprovals(packet.approvals, packet.createdAt, nowMs, errors);
  } else if (!Array.isArray(packet.approvals)) {
    add(errors, "EXACT_OWNER_APPROVAL_SET_REQUIRED");
  }
  validateMaintenanceWindow(packet.maintenanceWindow, nowMs, errors);

  let descriptorSha256 = null;
  try {
    descriptorSha256 = getProviderTrustRegistryDeploymentDescriptorSha256(packet.registry);
  } catch {
    // The registry validator has already recorded the structural issue.
  }

  const migration = migrationInventory?.migrations?.find((item) =>
    item.id === PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID
  );

  if (errors.length > 0) {
    return Object.freeze({
      valid: false,
      status: "BLOCKED_REVIEW_REQUIRED",
      reasonCodes: Object.freeze(errors),
      environment: ["staging", "production"].includes(packet.environment) ? packet.environment : null,
      changeId: typeof packet.changeId === "string" && CHANGE_ID.test(packet.changeId)
        ? packet.changeId
        : null,
      migrationId: PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID,
      migrationSha256: migration?.sha256 ?? null,
      deploymentDescriptorSha256: descriptorSha256,
      registryProvisioningAuthorized: false,
      providerActivationAuthorized: false,
      tradingAuthorized: false
    });
  }

  return Object.freeze({
    valid: true,
    status: "TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED",
    reasonCodes: Object.freeze([]),
    environment: packet.environment,
    changeId: packet.changeId,
    migrationId: PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID,
    migrationSha256: migration.sha256,
    deploymentDescriptorSha256: descriptorSha256,
    approvalRoles: Object.freeze([...APPROVAL_ROLES]),
    registryProvisioningAuthorized: false,
    providerActivationAuthorized: false,
    tradingAuthorized: false
  });
}
