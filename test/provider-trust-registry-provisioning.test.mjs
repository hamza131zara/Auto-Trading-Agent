import assert from "node:assert/strict";
import {
  mkdtemp,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { inspectMigrationSet } from "../scripts/lib/migration-governance.mjs";
import {
  getProviderTrustRegistryDeploymentDescriptorSha256,
  PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID,
  PROVIDER_TRUST_REGISTRY_PROVISIONING_PACKET_VERSION,
  validateProviderTrustRegistryProvisioningPacket
} from "../scripts/lib/provider-trust-registry-provisioning.mjs";

const NOW = "2026-11-01T00:00:00.000Z";
const migrationInventory = inspectMigrationSet();
const highWaterMigration = migrationInventory.migrations.find((item) =>
  item.id === PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID
);
const CLI = fileURLToPath(new URL(
  "../scripts/validate-provider-trust-registry-provisioning.mjs",
  import.meta.url
));

function reference(value) {
  return "evidence://" + value;
}

function validPacket(overrides = {}) {
  const registry = {
    registryId: "owner-provider-trust",
    rootKeyId: "owner-root-01",
    endpointUrl: "https://registry.example.net/v1/signed-snapshot",
    dnsAllowedAddresses: ["8.8.8.8", "2001:4860:4860::8888"],
    rootSpkiSha256: "a".repeat(64),
    endpointOwnershipReviewRef: reference("endpoint-ownership-001"),
    dnsAllowlistReviewRef: reference("dns-allowlist-001"),
    tlsEndpointReviewRef: reference("tls-endpoint-001"),
    rootCeremonyEvidenceRef: reference("root-ceremony-001"),
    rootCustodyReviewRef: reference("root-custody-001"),
    rootRecoveryReviewRef: reference("root-recovery-001"),
    rotationRunbookRef: reference("root-rotation-runbook-001"),
    revocationRunbookRef: reference("root-revocation-runbook-001"),
    reviewedAt: "2026-10-31T09:00:00.000Z"
  };
  registry.deploymentDescriptorSha256 =
    getProviderTrustRegistryDeploymentDescriptorSha256(registry);

  return {
    schemaVersion: PROVIDER_TRUST_REGISTRY_PROVISIONING_PACKET_VERSION,
    changeId: "CHG-2026-046-08",
    environment: "staging",
    createdAt: "2026-10-31T12:00:00.000Z",
    expiresAt: "2026-11-04T12:00:00.000Z",
    promotionEvidenceRef: null,
    registry,
    persistence: {
      highWaterMigrationId: PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID,
      highWaterMigrationSha256: highWaterMigration.sha256,
      migrationAppliedAt: "2026-10-31T10:00:00.000Z",
      migrationApplicationEvidenceRef: reference("high-water-migration-applied-001"),
      highWaterMarkReadbackEvidenceRef: reference("high-water-readback-001"),
      runtimeRoleReviewRef: reference("runtime-role-review-001"),
      tlsVerifyFullReviewRef: reference("database-tls-verify-full-001"),
      backupEvidenceRef: reference("database-backup-001"),
      backupVerifiedAt: "2026-10-31T10:30:00.000Z",
      restoreDrillEvidenceRef: reference("database-restore-drill-001"),
      restoreDrillVerifiedAt: "2026-10-25T10:30:00.000Z",
      antiRollbackRecoveryReviewRef: reference("anti-rollback-recovery-001")
    },
    operations: {
      monitoringPlanRef: reference("registry-monitoring-plan-001"),
      alertRouteReviewRef: reference("registry-alert-route-001"),
      incidentRunbookRef: reference("registry-incident-runbook-001"),
      rotationExerciseRef: reference("registry-rotation-exercise-001"),
      rotationExerciseAt: "2026-10-28T10:00:00.000Z",
      revocationExerciseRef: reference("registry-revocation-exercise-001"),
      revocationExerciseAt: "2026-10-28T11:00:00.000Z",
      registryOutageDrillRef: reference("registry-outage-drill-001"),
      registryOutageDrillAt: "2026-10-28T12:00:00.000Z",
      freshSnapshotPerDecision: true,
      staleSnapshotFallbackDisabled: true,
      registryOutageDeniesProviderUse: true,
      providerActivationDisabled: true,
      tradingDisabled: true
    },
    configDelivery: {
      destinationSecureStoreRef: reference("secure-config-store-001"),
      accessReviewRef: reference("secure-config-access-review-001"),
      auditTrailReviewRef: reference("secure-config-audit-review-001"),
      independentChannelReviewRef: reference("independent-channel-review-001"),
      valuesOutsideRepository: true,
      privateMaterialExcluded: true
    },
    freshnessPolicy: {
      maxRegistryReviewAgeDays: 30,
      maxBackupAgeHours: 48,
      maxRestoreDrillAgeDays: 90,
      maxOperationalExerciseAgeDays: 30
    },
    approvals: [
      {
        role: "registry-owner",
        approverRef: reference("person-registry-owner"),
        evidenceRef: reference("approval-registry-owner-001"),
        approvedAt: "2026-10-31T12:10:00.000Z"
      },
      {
        role: "security-reviewer",
        approverRef: reference("person-security-reviewer"),
        evidenceRef: reference("approval-security-reviewer-001"),
        approvedAt: "2026-10-31T12:15:00.000Z"
      },
      {
        role: "database-operator",
        approverRef: reference("person-database-operator"),
        evidenceRef: reference("approval-database-operator-001"),
        approvedAt: "2026-10-31T12:20:00.000Z"
      },
      {
        role: "service-owner",
        approverRef: reference("person-service-owner"),
        evidenceRef: reference("approval-service-owner-001"),
        approvedAt: "2026-10-31T12:25:00.000Z"
      }
    ],
    maintenanceWindow: {
      startsAt: "2026-11-01T02:00:00.000Z",
      endsAt: "2026-11-01T04:00:00.000Z"
    },
    ...overrides
  };
}

function validate(packet, options = {}) {
  return validateProviderTrustRegistryProvisioningPacket(packet, {
    now: NOW,
    migrationInventory,
    ...options
  });
}

function hasReason(result, code) {
  return result.reasonCodes.includes(code);
}

test("accepts a complete packet only as a technical precheck requiring review", () => {
  assert.equal(migrationInventory.ok, true);
  const result = validate(validPacket());

  assert.equal(result.valid, true, result.reasonCodes.join(", "));
  assert.equal(result.status, "TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED");
  assert.equal(result.migrationId, PROVIDER_TRUST_REGISTRY_HIGH_WATER_MIGRATION_ID);
  assert.equal(result.migrationSha256, highWaterMigration.sha256);
  assert.match(result.deploymentDescriptorSha256, /^[a-f0-9]{64}$/);
  assert.deepEqual(result.reasonCodes, []);
  assert.equal(result.registryProvisioningAuthorized, false);
  assert.equal(result.providerActivationAuthorized, false);
  assert.equal(result.tradingAuthorized, false);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.reasonCodes), true);
});

test("binds the packet to the exact owner-selected endpoint, DNS allowlist and root pin descriptor", () => {
  const endpointChanged = validPacket();
  endpointChanged.registry.endpointUrl = "https://changed.example.net/v1/signed-snapshot";
  assert.ok(hasReason(validate(endpointChanged), "REGISTRY_DEPLOYMENT_DESCRIPTOR_DIGEST_MISMATCH"));

  const ipChanged = validPacket();
  ipChanged.registry.dnsAllowedAddresses[0] = "1.1.1.1";
  assert.ok(hasReason(validate(ipChanged), "REGISTRY_DEPLOYMENT_DESCRIPTOR_DIGEST_MISMATCH"));

  const rootChanged = validPacket();
  rootChanged.registry.rootSpkiSha256 = "b".repeat(64);
  assert.ok(hasReason(validate(rootChanged), "REGISTRY_DEPLOYMENT_DESCRIPTOR_DIGEST_MISMATCH"));
});

test("rejects non-HTTPS, credential-bearing, queried, fragmented and IP-literal endpoints", () => {
  for (const endpointUrl of [
    "http://registry.example.net/v1/signed-snapshot",
    "https://user:password@registry.example.net/v1/signed-snapshot",
    "https://registry.example.net/v1/signed-snapshot?token=secret",
    "https://registry.example.net/v1/signed-snapshot#fragment",
    "https://8.8.8.8/v1/signed-snapshot",
    "https://registry.example.net:443/v1/signed-snapshot"
  ]) {
    const packet = validPacket();
    packet.registry.endpointUrl = endpointUrl;
    packet.registry.deploymentDescriptorSha256 =
      getProviderTrustRegistryDeploymentDescriptorSha256(packet.registry);
    assert.ok(
      hasReason(validate(packet), "REGISTRY_ENDPOINT_NOT_FIXED_CANONICAL_HTTPS"),
      endpointUrl
    );
  }
});

test("rejects malformed, duplicate, loopback, link-local and multicast DNS allowlist addresses", () => {
  for (const addresses of [
    [],
    ["8.8.8.8", "8.8.8.8"],
    ["127.0.0.1"],
    ["169.254.10.20"],
    ["224.0.0.1"],
    ["not-an-ip"],
    ["2001:0db8:0:0:0:0:0:1"],
    ["fe80::1"],
    ["ff02::1"]
  ]) {
    const packet = validPacket();
    packet.registry.dnsAllowedAddresses = addresses;
    packet.registry.deploymentDescriptorSha256 =
      getProviderTrustRegistryDeploymentDescriptorSha256(packet.registry);
    assert.ok(hasReason(validate(packet), "REGISTRY_DNS_ALLOWLIST_INVALID"), addresses.join(","));
  }
});

test("requires the current committed high-water migration identifier and checksum", () => {
  const wrongId = validPacket();
  wrongId.persistence.highWaterMigrationId = "20261030_other_migration";
  assert.ok(hasReason(validate(wrongId), "HIGH_WATER_MIGRATION_ID_MISMATCH"));

  const wrongDigest = validPacket();
  wrongDigest.persistence.highWaterMigrationSha256 = "b".repeat(64);
  assert.ok(hasReason(validate(wrongDigest), "HIGH_WATER_MIGRATION_NOT_BOUND_TO_CURRENT_INVENTORY"));

  const invalidInventory = validate(validPacket(), {
    migrationInventory: { ok: false, migrations: [] }
  });
  assert.ok(hasReason(invalidInventory, "REPOSITORY_MIGRATION_INVENTORY_INVALID"));
  assert.ok(hasReason(invalidInventory, "HIGH_WATER_MIGRATION_NOT_BOUND_TO_CURRENT_INVENTORY"));
});

test("requires fresh migration, backup, restore and anti-rollback evidence references", () => {
  const packet = validPacket();
  packet.persistence.highWaterMarkReadbackEvidenceRef = "";
  packet.persistence.backupVerifiedAt = "2026-10-28T00:00:00.000Z";
  packet.persistence.restoreDrillVerifiedAt = "2026-07-01T00:00:00.000Z";
  const result = validate(packet);

  assert.ok(hasReason(result, "HIGH_WATER_MARK_READBACK_EVIDENCE_MISSING"));
  assert.ok(hasReason(result, "DATABASE_BACKUP_EVIDENCE_STALE"));
  assert.ok(hasReason(result, "DATABASE_RESTORE_DRILL_EVIDENCE_STALE"));
});

test("requires distinct registry, security, database and service approvers", () => {
  const missing = validPacket();
  missing.approvals.pop();
  assert.ok(hasReason(validate(missing), "EXACT_OWNER_APPROVAL_SET_REQUIRED"));

  const duplicateIdentity = validPacket();
  duplicateIdentity.approvals[1].approverRef = duplicateIdentity.approvals[0].approverRef;
  assert.ok(hasReason(validate(duplicateIdentity), "OWNER_APPROVALS_NOT_INDEPENDENT"));

  const unknownRole = validPacket();
  unknownRole.approvals[0].role = "repository-admin";
  assert.ok(hasReason(validate(unknownRole), "OWNER_APPROVAL_ROLES_INVALID_OR_DUPLICATE"));
});

test("rejects expired packets, future approvals and malformed maintenance windows", () => {
  const expired = validPacket({
    expiresAt: "2026-10-31T23:59:59.000Z"
  });
  assert.ok(hasReason(validate(expired), "PACKET_VALIDITY_WINDOW_INVALID"));

  const futureApproval = validPacket();
  futureApproval.approvals[0].approvedAt = "2026-11-01T00:00:01.000Z";
  assert.ok(hasReason(validate(futureApproval), "OWNER_APPROVAL_TIMESTAMP_INVALID"));

  const window = validPacket();
  window.maintenanceWindow.endsAt = "2026-11-01T01:00:00.000Z";
  assert.ok(hasReason(validate(window), "MAINTENANCE_WINDOW_INVALID"));
});

test("production promotion requires staging evidence and staging cannot claim promotion", () => {
  const production = validPacket({
    environment: "production",
    promotionEvidenceRef: null
  });
  assert.ok(hasReason(validate(production), "PRODUCTION_STAGING_PROMOTION_EVIDENCE_MISSING"));

  const validProduction = validPacket({
    environment: "production",
    promotionEvidenceRef: reference("staging-validation-001")
  });
  const result = validate(validProduction);
  assert.equal(result.valid, true, result.reasonCodes.join(", "));

  const invalidStaging = validPacket({
    promotionEvidenceRef: reference("staging-validation-001")
  });
  assert.ok(hasReason(validate(invalidStaging), "STAGING_PACKET_MUST_NOT_CLAIM_PRODUCTION_PROMOTION"));
});

test("requires fresh registry, database and operational exercise evidence", () => {
  const packet = validPacket();
  packet.registry.reviewedAt = "2026-09-01T00:00:00.000Z";
  packet.operations.rotationExerciseAt = "2026-09-01T00:00:00.000Z";
  packet.operations.revocationExerciseAt = "2026-09-01T00:00:00.000Z";
  packet.operations.registryOutageDrillAt = "2026-09-01T00:00:00.000Z";
  const result = validate(packet);

  assert.ok(hasReason(result, "REGISTRY_REVIEW_EVIDENCE_STALE"));
  assert.ok(hasReason(result, "REGISTRY_ROTATION_EXERCISE_STALE"));
  assert.ok(hasReason(result, "REGISTRY_REVOCATION_EXERCISE_STALE"));
  assert.ok(hasReason(result, "REGISTRY_OUTAGE_DRILL_STALE"));
});

test("requires monitoring, secure delivery and fail-closed operational flags", () => {
  const packet = validPacket();
  packet.operations.staleSnapshotFallbackDisabled = false;
  packet.operations.registryOutageDeniesProviderUse = false;
  packet.operations.providerActivationDisabled = false;
  packet.configDelivery.valuesOutsideRepository = false;
  packet.configDelivery.independentChannelReviewRef = "";

  const result = validate(packet);
  assert.ok(hasReason(result, "STALE_SNAPSHOT_FALLBACK_NOT_DISABLED"));
  assert.ok(hasReason(result, "REGISTRY_OUTAGE_FAIL_CLOSED_NOT_DECLARED"));
  assert.ok(hasReason(result, "PROVIDER_ACTIVATION_MUST_REMAIN_DISABLED"));
  assert.ok(hasReason(result, "TRUST_CONFIG_MUST_REMAIN_OUTSIDE_REPOSITORY"));
  assert.ok(hasReason(result, "CONFIG_INDEPENDENT_CHANNEL_REVIEW_MISSING"));
  assert.equal(result.registryProvisioningAuthorized, false);
});

test("rejects credential-bearing keys and inline key or connection material", () => {
  const secretKey = validPacket();
  secretKey.registry.password = "test-only-not-a-real-password";
  assert.ok(hasReason(validate(secretKey), "PACKET_CONTAINS_CREDENTIAL_FIELD"));

  const inlineKey = validPacket();
  inlineKey.registry.rootCeremonyEvidenceRef = "-----BEGIN ED25519 PRIVATE KEY-----";
  assert.ok(hasReason(validate(inlineKey), "PACKET_CONTAINS_INLINE_CREDENTIAL_OR_KEY_MATERIAL"));

  const connectionString = validPacket();
  connectionString.persistence.backupEvidenceRef = "postgres://user:pass@host/db";
  assert.ok(hasReason(validate(connectionString), "PACKET_CONTAINS_INLINE_CREDENTIAL_OR_KEY_MATERIAL"));
});

test("rejects unknown fields at the packet root and nested trust sections", () => {
  const rootExtra = validPacket();
  rootExtra.note = "unreviewed-field";
  assert.ok(hasReason(validate(rootExtra), "PACKET_SHAPE_INVALID"));

  const registryExtra = validPacket();
  registryExtra.registry.customEndpointOverride = "https://attacker.example.net/";
  assert.ok(hasReason(validate(registryExtra), "REGISTRY_SECTION_SHAPE_INVALID"));
});

test("descriptor digest is deterministic and insensitive only to DNS allowlist order", () => {
  const packet = validPacket();
  const reordered = structuredClone(packet.registry);
  reordered.dnsAllowedAddresses.reverse();

  assert.equal(
    getProviderTrustRegistryDeploymentDescriptorSha256(packet.registry),
    getProviderTrustRegistryDeploymentDescriptorSha256(reordered)
  );

  const changedPin = {
    ...packet.registry,
    rootSpkiSha256: "c".repeat(64)
  };
  assert.notEqual(
    getProviderTrustRegistryDeploymentDescriptorSha256(packet.registry),
    getProviderTrustRegistryDeploymentDescriptorSha256(changedPin)
  );
});

test("CLI reads a private external packet and emits only redacted review-required metadata", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ata-trust-registry-preflight-"));
  try {
    const packetPath = join(directory, "packet.json");
    const packet = validPacket();
    await writeFile(packetPath, JSON.stringify(packet), { mode: 0o600 });

    const output = execFileSync(process.execPath, [
      CLI,
      "--input",
      packetPath
    ], {
      cwd: process.cwd(),
      encoding: "utf8"
    });
    const report = JSON.parse(output);
    assert.equal(report.valid, true);
    assert.equal(report.status, "TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED");
    assert.equal(report.registryProvisioningAuthorized, false);
    assert.equal(report.providerActivationAuthorized, false);
    assert.equal(report.tradingAuthorized, false);
    assert.equal(output.includes(packet.registry.endpointUrl), false);
    assert.equal(output.includes(packet.registry.dnsAllowedAddresses[0]), false);
    assert.equal(output.includes(packet.registry.rootSpkiSha256), false);
    assert.equal(output.includes(packet.registry.endpointOwnershipReviewRef), false);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("CLI refuses a packet stored inside the working tree", () => {
  assert.throws(
    () => execFileSync(process.execPath, [
      CLI,
      "--input",
      CLI
    ], {
      cwd: process.cwd(),
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"]
    }),
    (error) => {
      assert.equal(error.status, 2);
      assert.match(error.stderr.toString(), /must remain outside the Git working tree/);
      return true;
    }
  );
});
