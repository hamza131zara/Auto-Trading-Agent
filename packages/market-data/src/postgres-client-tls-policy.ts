/**
 * Driver-neutral PostgreSQL client TLS policy preflight.
 *
 * This module checks operator declarations only. It never creates a TLS
 * context, opens a socket, reads certificates, resolves a hostname or connects
 * to PostgreSQL. A passing report always requires independent review.
 */

export type PostgresTlsMode = "REQUIRE_TLS" | "PREFER_TLS" | "DISABLED";
export type PostgresTlsValidationMode = "REQUIRED" | "DISABLED";
export type PostgresTlsMinimumVersion = "TLS_1_0" | "TLS_1_1" | "TLS_1_2" | "TLS_1_3";
export type PostgresTlsTrustAnchorSource =
  | "APPROVED_CA_BUNDLE"
  | "APPROVED_SYSTEM_TRUST_STORE"
  | "UNVERIFIED";
export type PostgresTlsDriverAdapterState = "NOT_SELECTED" | "UNREVIEWED" | "REVIEWED";
export type PostgresTlsEvidenceState = "VERIFIED" | "UNVERIFIED" | "DISABLED";

export interface PostgresTlsHandshakeTestEvidence {
  readonly trustedCertificateAccepted: boolean;
  readonly untrustedCertificateRejected: boolean;
  readonly hostnameMismatchRejected: boolean;
  readonly expiredCertificateRejected: boolean;
  readonly plaintextEndpointRejected: boolean;
  readonly belowMinimumTlsVersionRejected: boolean;
}

export interface PostgresClientTlsPolicyPlan {
  /** Transport must require TLS before database credentials or data are sent. */
  readonly tlsMode: PostgresTlsMode;
  /** Server certificate chain must validate to the explicitly reviewed trust anchor. */
  readonly certificateChainValidation: PostgresTlsValidationMode;
  /** Requested server endpoint name must be checked against certificate identity. */
  readonly hostnameValidation: PostgresTlsValidationMode;
  /** Name verification must use the endpoint the client actually requested. */
  readonly hostnameVerificationNameSource: "REQUESTED_ENDPOINT_NAME" | "UNVERIFIED";
  /** Permit neither a plaintext downgrade nor retry without TLS. */
  readonly plaintextFallbackAllowed: boolean;
  /** Explicitly reject insecure driver flags that disable certificate validation. */
  readonly allowInvalidCertificates: boolean;
  /** Explicitly reject insecure driver flags that disable endpoint-name validation. */
  readonly allowInvalidHostnames: boolean;
  /** Minimum protocol version; TLS 1.0/1.1 are deprecated and blocked. */
  readonly minimumTlsVersion: PostgresTlsMinimumVersion;
  /** Trust-anchor source reviewed for this service, not a private file path. */
  readonly trustAnchorSource: PostgresTlsTrustAnchorSource;
  /** Safe evidence identifier for trust-anchor ownership and rotation review. */
  readonly trustAnchorEvidenceReference: string | null;
  /** Safe evidence identifier for the target service certificate/name policy. */
  readonly serverIdentityEvidenceReference: string | null;
  /** Whether the selected driver adapter's TLS option mapping has been reviewed. */
  readonly driverAdapterState: PostgresTlsDriverAdapterState;
  /** Safe review evidence identifier; null until an adapter has been selected and reviewed. */
  readonly driverAdapterEvidenceReference: string | null;
  /** Certificate expiry monitoring must be active and reviewed. */
  readonly certificateExpiryMonitoring: PostgresTlsEvidenceState;
  /** Certificate issuance/rotation ownership and runbook must be reviewed. */
  readonly certificateRotationRunbook: PostgresTlsEvidenceState;
  /** Owner-supplied alert lead time for certificate expiry. */
  readonly certificateExpiryAlertLeadDays: number;
  /** Results from an isolated test matrix using the actual selected driver. */
  readonly handshakeTests: PostgresTlsHandshakeTestEvidence;
}

export type PostgresClientTlsPolicyStatus =
  | "TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED"
  | "TLS_CERTIFICATE_TRUST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED"
  | "TLS_HANDSHAKE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED"
  | "TLS_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED"
  | "TECHNICAL_TLS_POLICY_CHECKS_PASSED_REVIEW_REQUIRED";

export interface PostgresClientTlsPolicyAssessment {
  readonly status: PostgresClientTlsPolicyStatus;
  readonly policy: Readonly<{
    tlsMode: PostgresTlsMode;
    certificateChainValidation: PostgresTlsValidationMode;
    hostnameValidation: PostgresTlsValidationMode;
    hostnameVerificationNameSource: "REQUESTED_ENDPOINT_NAME" | "UNVERIFIED";
    plaintextFallbackAllowed: boolean;
    allowInvalidCertificates: boolean;
    allowInvalidHostnames: boolean;
    minimumTlsVersion: PostgresTlsMinimumVersion;
    trustAnchorSource: PostgresTlsTrustAnchorSource;
    driverAdapterState: PostgresTlsDriverAdapterState;
  }>;
  readonly evidence: Readonly<{
    trustAnchorEvidenceReference: string | null;
    serverIdentityEvidenceReference: string | null;
    driverAdapterEvidenceReference: string | null;
    certificateExpiryMonitoring: PostgresTlsEvidenceState;
    certificateRotationRunbook: PostgresTlsEvidenceState;
    certificateExpiryAlertLeadDays: number;
    handshakeTests: Readonly<PostgresTlsHandshakeTestEvidence>;
  }>;
  readonly reasonCodes: readonly string[];
  readonly humanReviewRequired: readonly string[];
  readonly productionTlsApproved: false;
  readonly databaseDeploymentApproved: false;
  readonly providerActivationAuthorized: false;
  readonly tradingAuthorized: false;
}

const REQUIRED_KEYS = Object.freeze([
  "tlsMode",
  "certificateChainValidation",
  "hostnameValidation",
  "hostnameVerificationNameSource",
  "plaintextFallbackAllowed",
  "allowInvalidCertificates",
  "allowInvalidHostnames",
  "minimumTlsVersion",
  "trustAnchorSource",
  "trustAnchorEvidenceReference",
  "serverIdentityEvidenceReference",
  "driverAdapterState",
  "driverAdapterEvidenceReference",
  "certificateExpiryMonitoring",
  "certificateRotationRunbook",
  "certificateExpiryAlertLeadDays",
  "handshakeTests"
] as const);

const HANDSHAKE_TEST_KEYS = Object.freeze([
  "trustedCertificateAccepted",
  "untrustedCertificateRejected",
  "hostnameMismatchRejected",
  "expiredCertificateRejected",
  "plaintextEndpointRejected",
  "belowMinimumTlsVersionRejected"
] as const);

const HUMAN_REVIEW_REQUIRED = Object.freeze([
  "SELECT_AND_PIN_THE_ACTUAL_POSTGRESQL_DRIVER_AND_VERSION",
  "MAP_THE_SELECTED_DRIVERS_TLS_OPTIONS_TO_CHAIN_AND_ENDPOINT_NAME_VALIDATION",
  "VERIFY_THE_APPROVED_TRUST_ANCHOR_AND_TARGET_ENDPOINT_IDENTITY_OUT_OF_BAND",
  "RUN_HANDSHAKE_NEGATIVE_TESTS_WITH_THE_SELECTED_DRIVER_AND_ISOLATED_TEST_CERTIFICATES",
  "VERIFY_CERTIFICATE_EXPIRY_MONITORING_AND_ROTATION_OWNERSHIP",
  "VERIFY_THE_EFFECTIVE_RUNTIME_CONFIGURATION_NOT_ONLY_THIS_DECLARATION",
  "OWNER_AND_DATABASE_OPERATOR_APPROVAL"
] as const);

const SAFE_EVIDENCE_REFERENCE = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const TLS_VERSIONS = Object.freeze(["TLS_1_0", "TLS_1_1", "TLS_1_2", "TLS_1_3"] as const);
const TRUST_ANCHOR_SOURCES = Object.freeze([
  "APPROVED_CA_BUNDLE",
  "APPROVED_SYSTEM_TRUST_STORE",
  "UNVERIFIED"
] as const);
const DRIVER_STATES = Object.freeze(["NOT_SELECTED", "UNREVIEWED", "REVIEWED"] as const);

function isRecord(value: unknown): value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const sortedExpected = [...expected].sort();
  return actual.length === sortedExpected.length &&
    actual.every((key, index) => key === sortedExpected[index]);
}

function isReference(value: unknown): value is string {
  return typeof value === "string" && SAFE_EVIDENCE_REFERENCE.test(value);
}

function isNullableReference(value: unknown): value is string | null {
  return value === null || isReference(value);
}

function isEvidenceState(value: unknown): value is PostgresTlsEvidenceState {
  return value === "VERIFIED" || value === "UNVERIFIED" || value === "DISABLED";
}

function isHandshakeTests(value: unknown): value is PostgresTlsHandshakeTestEvidence {
  return isRecord(value) &&
    hasExactKeys(value, HANDSHAKE_TEST_KEYS) &&
    HANDSHAKE_TEST_KEYS.every((key) => typeof value[key] === "boolean");
}

function invalidPlan(): never {
  throw new TypeError("INVALID_POSTGRES_CLIENT_TLS_POLICY_PLAN");
}

/**
 * Assess a driver-neutral TLS policy declaration.
 *
 * This function does not verify that a driver applies the declarations. In
 * particular, a report with status TECHNICAL_TLS_POLICY_CHECKS_PASSED_REVIEW_REQUIRED
 * is not proof of an actual TLS handshake or a production configuration.
 */
export function assessPostgresClientTlsPolicy(
  input: unknown
): PostgresClientTlsPolicyAssessment {
  if (!isRecord(input) || !hasExactKeys(input, REQUIRED_KEYS)) return invalidPlan();

  if ((input.tlsMode !== "REQUIRE_TLS" &&
       input.tlsMode !== "PREFER_TLS" &&
       input.tlsMode !== "DISABLED") ||
      (input.certificateChainValidation !== "REQUIRED" &&
       input.certificateChainValidation !== "DISABLED") ||
      (input.hostnameValidation !== "REQUIRED" &&
       input.hostnameValidation !== "DISABLED") ||
      (input.hostnameVerificationNameSource !== "REQUESTED_ENDPOINT_NAME" &&
       input.hostnameVerificationNameSource !== "UNVERIFIED") ||
      typeof input.plaintextFallbackAllowed !== "boolean" ||
      typeof input.allowInvalidCertificates !== "boolean" ||
      typeof input.allowInvalidHostnames !== "boolean" ||
      typeof input.minimumTlsVersion !== "string" ||
      !(TLS_VERSIONS as readonly string[]).includes(input.minimumTlsVersion) ||
      typeof input.trustAnchorSource !== "string" ||
      !(TRUST_ANCHOR_SOURCES as readonly string[]).includes(input.trustAnchorSource) ||
      !isNullableReference(input.trustAnchorEvidenceReference) ||
      !isNullableReference(input.serverIdentityEvidenceReference) ||
      typeof input.driverAdapterState !== "string" ||
      !(DRIVER_STATES as readonly string[]).includes(input.driverAdapterState) ||
      !isNullableReference(input.driverAdapterEvidenceReference) ||
      !isEvidenceState(input.certificateExpiryMonitoring) ||
      !isEvidenceState(input.certificateRotationRunbook) ||
      typeof input.certificateExpiryAlertLeadDays !== "number" ||
      !Number.isSafeInteger(input.certificateExpiryAlertLeadDays) ||
      input.certificateExpiryAlertLeadDays < 1 ||
      input.certificateExpiryAlertLeadDays > 90 ||
      !isHandshakeTests(input.handshakeTests)) {
    return invalidPlan();
  }

  const reasonCodes: string[] = [];

  if (input.tlsMode !== "REQUIRE_TLS") {
    reasonCodes.push("TLS_TRANSPORT_NOT_STRICTLY_REQUIRED");
  }
  if (input.certificateChainValidation !== "REQUIRED") {
    reasonCodes.push("SERVER_CERTIFICATE_CHAIN_VALIDATION_NOT_REQUIRED");
  }
  if (input.hostnameValidation !== "REQUIRED" ||
      input.hostnameVerificationNameSource !== "REQUESTED_ENDPOINT_NAME") {
    reasonCodes.push("SERVER_ENDPOINT_NAME_VALIDATION_NOT_REQUIRED");
  }
  if (input.plaintextFallbackAllowed) {
    reasonCodes.push("PLAINTEXT_FALLBACK_IS_ALLOWED");
  }
  if (input.allowInvalidCertificates) {
    reasonCodes.push("INVALID_SERVER_CERTIFICATES_ARE_ALLOWED");
  }
  if (input.allowInvalidHostnames) {
    reasonCodes.push("INVALID_SERVER_HOSTNAMES_ARE_ALLOWED");
  }
  if (input.minimumTlsVersion === "TLS_1_0" || input.minimumTlsVersion === "TLS_1_1") {
    reasonCodes.push("DEPRECATED_TLS_VERSION_IS_ALLOWED");
  }

  const trustAnchorUnverified =
    input.trustAnchorSource === "UNVERIFIED" ||
    input.trustAnchorEvidenceReference === null ||
    input.serverIdentityEvidenceReference === null;
  if (input.trustAnchorSource === "UNVERIFIED" ||
      input.trustAnchorEvidenceReference === null) {
    reasonCodes.push("TRUST_ANCHOR_EVIDENCE_NOT_VERIFIED");
  }
  if (input.serverIdentityEvidenceReference === null) {
    reasonCodes.push("SERVER_ENDPOINT_IDENTITY_EVIDENCE_MISSING");
  }
  if (input.certificateExpiryMonitoring !== "VERIFIED") {
    reasonCodes.push("CERTIFICATE_EXPIRY_MONITORING_NOT_VERIFIED");
  }
  if (input.certificateRotationRunbook !== "VERIFIED") {
    reasonCodes.push("CERTIFICATE_ROTATION_RUNBOOK_NOT_VERIFIED");
  }

  const handshakeTests = input.handshakeTests;
  const failedHandshakeTests: readonly [keyof PostgresTlsHandshakeTestEvidence, string][] = [
    ["trustedCertificateAccepted", "TRUSTED_CERTIFICATE_ACCEPTANCE_TEST_MISSING"],
    ["untrustedCertificateRejected", "UNTRUSTED_CERTIFICATE_REJECTION_TEST_MISSING"],
    ["hostnameMismatchRejected", "HOSTNAME_MISMATCH_REJECTION_TEST_MISSING"],
    ["expiredCertificateRejected", "EXPIRED_CERTIFICATE_REJECTION_TEST_MISSING"],
    ["plaintextEndpointRejected", "PLAINTEXT_ENDPOINT_REJECTION_TEST_MISSING"],
    ["belowMinimumTlsVersionRejected", "TLS_VERSION_FLOOR_REJECTION_TEST_MISSING"]
  ];
  let handshakeTestsIncomplete = false;
  for (const [key, reason] of failedHandshakeTests) {
    if (!handshakeTests[key]) {
      handshakeTestsIncomplete = true;
      reasonCodes.push(reason);
    }
  }

  if (input.driverAdapterState !== "REVIEWED" ||
      input.driverAdapterEvidenceReference === null) {
    reasonCodes.push("POSTGRESQL_DRIVER_TLS_ADAPTER_NOT_REVIEWED");
  }
  if ((input.driverAdapterState === "REVIEWED") !==
      (input.driverAdapterEvidenceReference !== null)) {
    return invalidPlan();
  }

  const transportBlocked =
    input.tlsMode !== "REQUIRE_TLS" ||
    input.certificateChainValidation !== "REQUIRED" ||
    input.hostnameValidation !== "REQUIRED" ||
    input.hostnameVerificationNameSource !== "REQUESTED_ENDPOINT_NAME" ||
    input.plaintextFallbackAllowed ||
    input.allowInvalidCertificates ||
    input.allowInvalidHostnames ||
    input.minimumTlsVersion === "TLS_1_0" ||
    input.minimumTlsVersion === "TLS_1_1";

  const evidenceIncomplete =
    trustAnchorUnverified ||
    input.certificateExpiryMonitoring !== "VERIFIED" ||
    input.certificateRotationRunbook !== "VERIFIED";
  const serverIdentityMissing = input.serverIdentityEvidenceReference === null;

  let status: PostgresClientTlsPolicyStatus;
  if (transportBlocked) {
    status = "TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED";
  } else if (evidenceIncomplete || serverIdentityMissing) {
    status = "TLS_CERTIFICATE_TRUST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED";
  } else if (handshakeTestsIncomplete) {
    status = "TLS_HANDSHAKE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED";
  } else if (input.driverAdapterState !== "REVIEWED" ||
             input.driverAdapterEvidenceReference === null) {
    status = "TLS_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED";
  } else {
    status = "TECHNICAL_TLS_POLICY_CHECKS_PASSED_REVIEW_REQUIRED";
  }

  return Object.freeze({
    status,
    policy: Object.freeze({
      tlsMode: input.tlsMode,
      certificateChainValidation: input.certificateChainValidation,
      hostnameValidation: input.hostnameValidation,
      hostnameVerificationNameSource: input.hostnameVerificationNameSource,
      plaintextFallbackAllowed: input.plaintextFallbackAllowed,
      allowInvalidCertificates: input.allowInvalidCertificates,
      allowInvalidHostnames: input.allowInvalidHostnames,
      minimumTlsVersion: input.minimumTlsVersion,
      trustAnchorSource: input.trustAnchorSource,
      driverAdapterState: input.driverAdapterState
    }),
    evidence: Object.freeze({
      trustAnchorEvidenceReference: input.trustAnchorEvidenceReference,
      serverIdentityEvidenceReference: input.serverIdentityEvidenceReference,
      driverAdapterEvidenceReference: input.driverAdapterEvidenceReference,
      certificateExpiryMonitoring: input.certificateExpiryMonitoring,
      certificateRotationRunbook: input.certificateRotationRunbook,
      certificateExpiryAlertLeadDays: input.certificateExpiryAlertLeadDays,
      handshakeTests: Object.freeze({ ...handshakeTests })
    }),
    reasonCodes: Object.freeze(reasonCodes),
    humanReviewRequired: HUMAN_REVIEW_REQUIRED,
    productionTlsApproved: false as const,
    databaseDeploymentApproved: false as const,
    providerActivationAuthorized: false as const,
    tradingAuthorized: false as const
  });
}
