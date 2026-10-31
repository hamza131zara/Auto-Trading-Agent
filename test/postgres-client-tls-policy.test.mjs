import assert from "node:assert/strict";
import test from "node:test";
import { assessPostgresClientTlsPolicy } from "../packages/market-data/dist/postgres-client-tls-policy.js";

const BASE_PLAN = Object.freeze({
  tlsMode: "REQUIRE_TLS",
  certificateChainValidation: "REQUIRED",
  hostnameValidation: "REQUIRED",
  hostnameVerificationNameSource: "REQUESTED_ENDPOINT_NAME",
  plaintextFallbackAllowed: false,
  allowInvalidCertificates: false,
  allowInvalidHostnames: false,
  minimumTlsVersion: "TLS_1_2",
  trustAnchorSource: "APPROVED_CA_BUNDLE",
  trustAnchorEvidenceReference: "evidence:ca-trust-004",
  serverIdentityEvidenceReference: "evidence:postgres-hostname-002",
  driverAdapterState: "REVIEWED",
  driverAdapterEvidenceReference: "evidence:driver-tls-review-001",
  certificateExpiryMonitoring: "VERIFIED",
  certificateRotationRunbook: "VERIFIED",
  certificateExpiryAlertLeadDays: 30,
  handshakeTests: Object.freeze({
    trustedCertificateAccepted: true,
    untrustedCertificateRejected: true,
    hostnameMismatchRejected: true,
    expiredCertificateRejected: true,
    plaintextEndpointRejected: true,
    belowMinimumTlsVersionRejected: true
  })
});

test("accepts a complete TLS policy declaration but keeps approval review-required", () => {
  const report = assessPostgresClientTlsPolicy(BASE_PLAN);

  assert.equal(report.status, "TECHNICAL_TLS_POLICY_CHECKS_PASSED_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, []);
  assert.equal(report.policy.minimumTlsVersion, "TLS_1_2");
  assert.equal(report.policy.hostnameVerificationNameSource, "REQUESTED_ENDPOINT_NAME");
  assert.equal(report.productionTlsApproved, false);
  assert.equal(report.databaseDeploymentApproved, false);
  assert.equal(report.providerActivationAuthorized, false);
  assert.equal(report.tradingAuthorized, false);
});

test("blocks disabled or opportunistic TLS transport", () => {
  for (const tlsMode of ["DISABLED", "PREFER_TLS"]) {
    const report = assessPostgresClientTlsPolicy({ ...BASE_PLAN, tlsMode });
    assert.equal(report.status, "TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED");
    assert.ok(report.reasonCodes.includes("TLS_TRANSPORT_NOT_STRICTLY_REQUIRED"));
  }
});

test("blocks absent certificate-chain or hostname verification", () => {
  const chain = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    certificateChainValidation: "DISABLED"
  });
  assert.equal(chain.status, "TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.ok(chain.reasonCodes.includes("SERVER_CERTIFICATE_CHAIN_VALIDATION_NOT_REQUIRED"));

  const hostname = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    hostnameValidation: "DISABLED"
  });
  assert.equal(hostname.status, "TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.ok(hostname.reasonCodes.includes("SERVER_ENDPOINT_NAME_VALIDATION_NOT_REQUIRED"));
});

test("blocks plaintext fallback and insecure certificate/hostname override flags", () => {
  const plaintext = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    plaintextFallbackAllowed: true
  });
  assert.equal(plaintext.status, "TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED");
  assert.ok(plaintext.reasonCodes.includes("PLAINTEXT_FALLBACK_IS_ALLOWED"));

  const invalidCert = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    allowInvalidCertificates: true
  });
  assert.ok(invalidCert.reasonCodes.includes("INVALID_SERVER_CERTIFICATES_ARE_ALLOWED"));

  const invalidHost = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    allowInvalidHostnames: true
  });
  assert.ok(invalidHost.reasonCodes.includes("INVALID_SERVER_HOSTNAMES_ARE_ALLOWED"));
});

test("rejects deprecated TLS 1.0 and 1.1 minimum versions", () => {
  for (const minimumTlsVersion of ["TLS_1_0", "TLS_1_1"]) {
    const report = assessPostgresClientTlsPolicy({
      ...BASE_PLAN,
      minimumTlsVersion
    });
    assert.equal(report.status, "TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED");
    assert.ok(report.reasonCodes.includes("DEPRECATED_TLS_VERSION_IS_ALLOWED"));
  }
});

test("requires both an approved trust anchor and target server identity reference", () => {
  const noTrustAnchor = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    trustAnchorSource: "UNVERIFIED",
    trustAnchorEvidenceReference: null
  });
  assert.equal(noTrustAnchor.status, "TLS_CERTIFICATE_TRUST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED");
  assert.ok(noTrustAnchor.reasonCodes.includes("TRUST_ANCHOR_EVIDENCE_NOT_VERIFIED"));

  const noIdentity = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    serverIdentityEvidenceReference: null
  });
  assert.equal(noIdentity.status, "TLS_CERTIFICATE_TRUST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED");
  assert.ok(noIdentity.reasonCodes.includes("SERVER_ENDPOINT_IDENTITY_EVIDENCE_MISSING"));
});

test("requires certificate expiry monitoring and a rotation runbook", () => {
  const report = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    certificateExpiryMonitoring: "DISABLED",
    certificateRotationRunbook: "UNVERIFIED"
  });

  assert.equal(report.status, "TLS_CERTIFICATE_TRUST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "CERTIFICATE_EXPIRY_MONITORING_NOT_VERIFIED",
    "CERTIFICATE_ROTATION_RUNBOOK_NOT_VERIFIED"
  ]);
});

test("requires a tested handshake matrix including hostname, CA, expiry and downgrade failures", () => {
  const report = assessPostgresClientTlsPolicy({
    ...BASE_PLAN,
    handshakeTests: {
      ...BASE_PLAN.handshakeTests,
      hostnameMismatchRejected: false,
      expiredCertificateRejected: false,
      belowMinimumTlsVersionRejected: false
    }
  });

  assert.equal(report.status, "TLS_HANDSHAKE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED");
  assert.deepEqual(report.reasonCodes, [
    "HOSTNAME_MISMATCH_REJECTION_TEST_MISSING",
    "EXPIRED_CERTIFICATE_REJECTION_TEST_MISSING",
    "TLS_VERSION_FLOOR_REJECTION_TEST_MISSING"
  ]);
});

test("does not claim readiness when the production driver adapter is not selected", () => {
  for (const driverAdapterState of ["NOT_SELECTED", "UNREVIEWED"]) {
    const report = assessPostgresClientTlsPolicy({
      ...BASE_PLAN,
      driverAdapterState,
      driverAdapterEvidenceReference: null
    });

    assert.equal(report.status, "TLS_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED");
    assert.ok(report.reasonCodes.includes("POSTGRESQL_DRIVER_TLS_ADAPTER_NOT_REVIEWED"));
    assert.equal(report.productionTlsApproved, false);
  }
});

test("rejects reference fields that contain URLs or paths instead of evidence identifiers", () => {
  assert.throws(
    () => assessPostgresClientTlsPolicy({
      ...BASE_PLAN,
      trustAnchorEvidenceReference: "https://db.example.invalid/root-ca.pem"
    }),
    /INVALID_POSTGRES_CLIENT_TLS_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresClientTlsPolicy({
      ...BASE_PLAN,
      driverAdapterEvidenceReference: "/etc/ssl/private/root.pem"
    }),
    /INVALID_POSTGRES_CLIENT_TLS_POLICY_PLAN/
  );
});

test("rejects missing, unknown and secret-shaped input fields", () => {
  const { plaintextFallbackAllowed, ...incomplete } = BASE_PLAN;
  assert.equal(plaintextFallbackAllowed, false);
  assert.throws(
    () => assessPostgresClientTlsPolicy(incomplete),
    /INVALID_POSTGRES_CLIENT_TLS_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresClientTlsPolicy({
      ...BASE_PLAN,
      connectionString: "REDACTED"
    }),
    /INVALID_POSTGRES_CLIENT_TLS_POLICY_PLAN/
  );
  assert.throws(
    () => assessPostgresClientTlsPolicy({
      ...BASE_PLAN,
      trustAnchorEvidenceReference: "evidence:ca-trust-004",
      secretValue: "REDACTED"
    }),
    /INVALID_POSTGRES_CLIENT_TLS_POLICY_PLAN/
  );
});

test("rejects malformed values, unsafe states and out-of-range alert lead times", () => {
  const invalidPlans = [
    { ...BASE_PLAN, tlsMode: "OPTIONAL" },
    { ...BASE_PLAN, certificateChainValidation: true },
    { ...BASE_PLAN, minimumTlsVersion: "TLS_2_0" },
    { ...BASE_PLAN, trustAnchorSource: "SYSTEM_DEFAULT" },
    { ...BASE_PLAN, driverAdapterState: "SELECTED" },
    { ...BASE_PLAN, certificateExpiryAlertLeadDays: 0 },
    { ...BASE_PLAN, certificateExpiryAlertLeadDays: 91 },
    { ...BASE_PLAN, certificateExpiryAlertLeadDays: 1.5 },
    { ...BASE_PLAN, handshakeTests: { ...BASE_PLAN.handshakeTests, hostnameMismatchRejected: "false" } }
  ];

  for (const plan of invalidPlans) {
    assert.throws(
      () => assessPostgresClientTlsPolicy(plan),
      /INVALID_POSTGRES_CLIENT_TLS_POLICY_PLAN/
    );
  }
});

test("freezes the policy, test evidence, reason codes and final assessment", () => {
  const report = assessPostgresClientTlsPolicy(BASE_PLAN);

  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.policy), true);
  assert.equal(Object.isFrozen(report.evidence), true);
  assert.equal(Object.isFrozen(report.evidence.handshakeTests), true);
  assert.equal(Object.isFrozen(report.reasonCodes), true);
  assert.equal(Object.isFrozen(report.humanReviewRequired), true);
});
