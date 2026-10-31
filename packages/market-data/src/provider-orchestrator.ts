import {
  assessProviderAgreement,
  assessProviderAgreementWithReviewedLineage,
  assessProviderAttemptPermission,
  initialProviderHealth,
  isSolanaPublicKey,
  recordProviderResult,
  validateCanonicalMarketSnapshot
} from "./index.js";
import type {
  ProviderHealthStore,
  RecoveryProbeLeaseIdentity
} from "./provider-health-store.js";
import type {
  CanonicalMarketSnapshot,
  MarketDataAdapter,
  MarketDataRequest,
  ProviderAttemptPermissionStatus,
  ProviderErrorClass,
  ProviderAgreementAssessment,
  ProviderAgreementPolicy,
  ProviderEvidenceCandidate,
  ProviderHealthPolicy,
  ProviderHealthSnapshot,
  ProviderLineageReadinessPolicy,
  ProviderResult,
  ReviewedProviderAgreementAssessment,
  SolanaCluster
} from "./index.js";

const SAFE_SLUG = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_WORKER_ID = /^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/;
const LEASE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.[0-9]{1,3})?Z$/;
const ERROR_CLASSES = new Set<ProviderErrorClass>([
  "TIMEOUT", "RATE_LIMIT", "NETWORK", "HTTP", "PARSE", "AUTH", "UNKNOWN"
]);

export interface MarketDataProviderRegistration {
  readonly adapter: MarketDataAdapter;
  /** Distinct aliases of one upstream must not be represented as independent families. */
  readonly independenceGroupId: string;
  /** Zero is primary; higher priorities are fallbacks. Priorities must be unique. */
  readonly priority: number;
}

export interface ReadOnlyMarketDataTarget {
  readonly cluster: SolanaCluster;
  readonly baseMint: string;
  readonly quoteMint: string;
  readonly poolAddress: string | null;
}

export type ProviderUsePurpose = "DIAGNOSTIC" | "PRODUCTION";

export interface ProviderUseDecision {
  readonly providerId: string;
  readonly purpose: ProviderUsePurpose;
  readonly decisionId: string;
  readonly owner: string;
  readonly outcome:
    | "PROCEED_DIAGNOSTIC_ONLY"
    | "PROCEED_PRODUCTION_SCOPE"
    | "REJECT"
    | "DEFER";
  readonly scope: string;
  readonly decidedAt: string;
  readonly expiresAt: string | null;
  readonly linkedEvidenceIds: readonly string[];
  /** SHA-256 of the exact owner-reviewed evidence manifest used by trusted bootstrap. */
  readonly evidenceManifestSha256: string;
}

export type ProviderUseDecisionResolver = (
  providerId: string,
  purpose: ProviderUsePurpose,
  at: string
) => unknown | Promise<unknown>;

export interface ReadOnlyMarketDataOrchestratorOptions {
  readonly now: () => string;
  readonly healthPolicy: ProviderHealthPolicy;
  readonly maxHealthAgeMs: number;
  readonly requestTimeoutMs: number;
  readonly requestId?: (providerId: string, requestedAt: string) => string | null;
  /** Runtime intent; diagnostic permission never implies production permission. */
  readonly usagePurpose: ProviderUsePurpose;
  /** Missing resolver means default-deny for every provider request. */
  readonly providerUseDecisionResolver?: ProviderUseDecisionResolver;
  /** Optional shared store; inject the same PostgreSQL-backed implementation in every worker. */
  readonly providerHealthStore?: ProviderHealthStore;
  /** Required with providerHealthStore. The token callback must return a fresh CSPRNG-derived one-time bearer token; only its SHA-256 digest is persisted. */
  readonly recoveryProbeLease?: {
    readonly ownerId: string;
    readonly leaseDurationMs: number;
    readonly createLeaseToken: (providerId: string, requestedAt: string) => string;
  };
}

export type ProviderOrchestrationAttemptOutcome =
  | "OBSERVATION_NORMALIZED"
  | "REQUEST_FAILED"
  | "NORMALIZATION_FAILED"
  | "INVALID_OBSERVATION"
  | "BLOCKED";

export interface ProviderOrchestrationAttempt {
  readonly providerId: string;
  readonly independenceGroupId: string;
  readonly priority: number;
  readonly permissionStatus:
    | ProviderAttemptPermissionStatus
    | "BLOCK_PROVIDER_ATTEMPT_IN_FLIGHT"
    | "BLOCK_PROVIDER_USE_NOT_APPROVED";
  readonly outcome: ProviderOrchestrationAttemptOutcome;
  readonly reasonCodes: readonly string[];
  readonly latencyMs: number | null;
}

export interface ReadOnlyMarketDataCollection {
  readonly observations: readonly CanonicalMarketSnapshot[];
  readonly candidates: readonly ProviderEvidenceCandidate[];
  readonly attempts: readonly ProviderOrchestrationAttempt[];
  readonly providerHealth: readonly ProviderHealthSnapshot[];
  /** This adapter orchestration is evidence collection only and can never authorize an order. */
  readonly tradingAuthorized: false;
}

export type ReadOnlyMarketDataAssessmentStatus =
  | "READY_FOR_ON_CHAIN_VALIDATION"
  | "DISAGREEMENT"
  | "INSUFFICIENT_EVIDENCE"
  | "BLOCKED"
  | "INVALID_INPUT";

export interface ReadOnlyMarketDataAssessmentPolicy {
  readonly agreementPolicy: ProviderAgreementPolicy;
  readonly lineagePolicy: ProviderLineageReadinessPolicy;
}

export interface ReadOnlyMarketDataAttemptSummary {
  readonly successfulProviderIds: readonly string[];
  readonly failedProviderIds: readonly string[];
  readonly blockedProviderIds: readonly string[];
  readonly reasonCodes: readonly string[];
}

export interface ReadOnlyMarketDataAssessment {
  readonly status: ReadOnlyMarketDataAssessmentStatus;
  /** Raw agreement is retained for diagnostics and is never an approval by itself. */
  readonly diagnosticAgreement: ProviderAgreementAssessment;
  /** Registry-backed assessment is the only source that may advance the evidence path. */
  readonly reviewedAgreement: ReviewedProviderAgreementAssessment;
  readonly attemptSummary: ReadOnlyMarketDataAttemptSummary;
  readonly providerHealth: readonly ProviderHealthSnapshot[];
  readonly fallbackUsed: boolean;
  readonly canProceedToOnChainValidation: boolean;
  readonly reasonCodes: readonly string[];
  readonly tradingAuthorized: false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validUtcTimestamp(value: unknown): value is string {
  return typeof value === "string" &&
    UTC_PATTERN.test(value) &&
    Number.isFinite(Date.parse(value));
}

function safeReason(value: unknown, fallback: string): string {
  return typeof value === "string" && /^[A-Z0-9_]{1,64}$/.test(value)
    ? value
    : fallback;
}

function assessProviderUseDecision(
  value: unknown,
  providerId: string,
  purpose: ProviderUsePurpose,
  at: string
): { readonly authorized: boolean; readonly reasonCodes: readonly string[] } {
  if (value === undefined || value === null) {
    return { authorized: false, reasonCodes: ["PROVIDER_USE_DECISION_MISSING"] };
  }
  if (!isRecord(value) ||
      value.providerId !== providerId ||
      value.purpose !== purpose ||
      typeof value.decisionId !== "string" ||
      !SAFE_WORKER_ID.test(value.decisionId) ||
      typeof value.owner !== "string" ||
      value.owner.trim().length === 0 ||
      value.owner.length > 160 ||
      typeof value.scope !== "string" ||
      value.scope.trim().length === 0 ||
      value.scope.length > 512 ||
      !["PROCEED_DIAGNOSTIC_ONLY", "PROCEED_PRODUCTION_SCOPE", "REJECT", "DEFER"].includes(String(value.outcome)) ||
      !validUtcTimestamp(value.decidedAt) ||
      !(value.expiresAt === null || validUtcTimestamp(value.expiresAt)) ||
      !Array.isArray(value.linkedEvidenceIds) ||
      value.linkedEvidenceIds.length === 0 ||
      !value.linkedEvidenceIds.every((id) =>
        typeof id === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id)
      ) ||
      new Set(value.linkedEvidenceIds).size !== value.linkedEvidenceIds.length ||
      typeof value.evidenceManifestSha256 !== "string" ||
      !/^[a-fA-F0-9]{64}$/.test(value.evidenceManifestSha256)) {
    return { authorized: false, reasonCodes: ["PROVIDER_USE_DECISION_INVALID"] };
  }

  if (Date.parse(value.decidedAt) > Date.parse(at)) {
    return { authorized: false, reasonCodes: ["PROVIDER_USE_DECISION_NOT_YET_EFFECTIVE"] };
  }
  if (value.expiresAt !== null && Date.parse(value.expiresAt) <= Date.parse(at)) {
    return { authorized: false, reasonCodes: ["PROVIDER_USE_DECISION_EXPIRED"] };
  }
  if (value.outcome === "REJECT") {
    return { authorized: false, reasonCodes: ["PROVIDER_USE_DECISION_REJECTED"] };
  }
  if (value.outcome === "DEFER") {
    return { authorized: false, reasonCodes: ["PROVIDER_USE_DECISION_DEFERRED"] };
  }
  if (purpose === "PRODUCTION" && value.outcome !== "PROCEED_PRODUCTION_SCOPE") {
    return { authorized: false, reasonCodes: ["PROVIDER_PRODUCTION_USE_NOT_APPROVED"] };
  }

  return { authorized: true, reasonCodes: [] };
}

function classifyFailure(error: unknown, timedOut: boolean): {
  readonly errorClass: ProviderErrorClass;
  readonly retryable: boolean;
  readonly reasonCode: string;
} {
  if (timedOut) {
    return {
      errorClass: "TIMEOUT",
      retryable: true,
      reasonCode: "PROVIDER_REQUEST_TIMEOUT"
    };
  }

  const record = isRecord(error) ? error : null;
  const proposedCode = record?.code;
  const errorClass = typeof proposedCode === "string" && ERROR_CLASSES.has(proposedCode as ProviderErrorClass)
    ? proposedCode as ProviderErrorClass
    : "UNKNOWN";
  const retryable = typeof record?.retryable === "boolean"
    ? record.retryable
    : errorClass !== "AUTH" && errorClass !== "PARSE";
  return {
    errorClass,
    retryable,
    reasonCode: "PROVIDER_REQUEST_" + errorClass
  };
}

/**
 * Integrates provider attempts, health/fallback outcomes, raw agreement diagnostics,
 * and the reviewed source-lineage gate for one completed collection.
 *
 * The raw comparator is deliberately returned separately: DISAGREEMENT remains
 * visible even when a provider is unhealthy or lineage is unresolved. Only the
 * registry-backed assessment can set canProceedToOnChainValidation=true.
 */
export function assessReadOnlyMarketDataCollection(
  collection: ReadOnlyMarketDataCollection,
  policy: ReadOnlyMarketDataAssessmentPolicy
): ReadOnlyMarketDataAssessment {
  const invalidAgreement: ProviderAgreementAssessment = {
    status: "INVALID_INPUT",
    eligibleProviderIds: [],
    rejectedProviders: [],
    disagreementFields: [],
    reasonCodes: ["READ_ONLY_COLLECTION_OR_POLICY_INVALID"],
    fallbackUsed: false,
    canProceedToOnChainValidation: false,
    tradingAuthorized: false
  };
  const invalidReviewed: ReviewedProviderAgreementAssessment = {
    status: "INVALID_INPUT",
    lineage: {
      status: "INVALID_INPUT",
      candidateProviderIds: [],
      eligibleProviderIds: [],
      distinctIndependenceGroupCount: 0,
      rejectedProviders: [],
      reasonCodes: ["READ_ONLY_COLLECTION_OR_POLICY_INVALID"],
      canProceedToProviderAgreement: false,
      productionUseApproved: false,
      tradingAuthorized: false
    },
    providerAgreement: invalidAgreement,
    canProceedToOnChainValidation: false,
    productionUseApproved: false,
    reasonCodes: ["READ_ONLY_COLLECTION_OR_POLICY_INVALID"],
    tradingAuthorized: false
  };

  const invalid = (reasonCodes: readonly string[] = ["READ_ONLY_COLLECTION_OR_POLICY_INVALID"]):
    ReadOnlyMarketDataAssessment => ({
      status: "INVALID_INPUT",
      diagnosticAgreement: invalidAgreement,
      reviewedAgreement: {
        ...invalidReviewed,
        reasonCodes: [...new Set(reasonCodes)],
        lineage: { ...invalidReviewed.lineage, reasonCodes: [...new Set(reasonCodes)] },
        providerAgreement: { ...invalidAgreement, reasonCodes: [...new Set(reasonCodes)] }
      },
      attemptSummary: {
        successfulProviderIds: [],
        failedProviderIds: [],
        blockedProviderIds: [],
        reasonCodes: [...new Set(reasonCodes)]
      },
      providerHealth: [],
      fallbackUsed: false,
      canProceedToOnChainValidation: false,
      reasonCodes: [...new Set(reasonCodes)],
      tradingAuthorized: false
    });

  if (!isRecord(collection) ||
      !Array.isArray(collection.candidates) ||
      collection.candidates.length === 0 ||
      !Array.isArray(collection.observations) ||
      !Array.isArray(collection.attempts) ||
      !Array.isArray(collection.providerHealth) ||
      collection.tradingAuthorized !== false ||
      !isRecord(policy) ||
      !isRecord(policy.agreementPolicy) ||
      !isRecord(policy.lineagePolicy)) {
    return invalid();
  }

  const candidateIds = new Set<string>();
  const candidatesByProvider = new Map<string, ProviderEvidenceCandidate>();
  for (const candidate of collection.candidates as readonly unknown[]) {
    if (!isRecord(candidate) ||
        typeof candidate.providerId !== "string" ||
        !SAFE_SLUG.test(candidate.providerId) ||
        candidateIds.has(candidate.providerId) ||
        typeof candidate.independenceGroupId !== "string" ||
        !SAFE_SLUG.test(candidate.independenceGroupId) ||
        !Number.isSafeInteger(candidate.priority) ||
        (candidate.priority as number) < 0 ||
        typeof candidate.snapshot === "undefined") {
      return invalid(["READ_ONLY_COLLECTION_CANDIDATE_INVALID"]);
    }
    candidateIds.add(candidate.providerId);
    candidatesByProvider.set(candidate.providerId, candidate as unknown as ProviderEvidenceCandidate);
  }

  if (collection.providerHealth.length !== candidateIds.size ||
      collection.attempts.length !== candidateIds.size) {
    return invalid(["READ_ONLY_COLLECTION_CARDINALITY_MISMATCH"]);
  }

  const healthByProvider = new Map<string, ProviderHealthSnapshot>();
  for (const health of collection.providerHealth as readonly unknown[]) {
    if (!isRecord(health) ||
        typeof health.providerId !== "string" ||
        !candidateIds.has(health.providerId) ||
        healthByProvider.has(health.providerId)) {
      return invalid(["READ_ONLY_COLLECTION_HEALTH_SET_INVALID"]);
    }
    const candidate = candidatesByProvider.get(health.providerId)!;
    if (!isRecord(candidate.health) ||
        candidate.health.providerId !== health.providerId ||
        candidate.health.state !== health.state ||
        candidate.health.lastRequestAt !== health.lastRequestAt ||
        candidate.health.consecutiveFailures !== health.consecutiveFailures) {
      return invalid(["READ_ONLY_COLLECTION_HEALTH_SET_MISMATCH"]);
    }
    healthByProvider.set(health.providerId, health as unknown as ProviderHealthSnapshot);
  }
  if (healthByProvider.size !== candidateIds.size) {
    return invalid(["READ_ONLY_COLLECTION_HEALTH_SET_MISMATCH"]);
  }

  const observedByProvider = new Map<string, CanonicalMarketSnapshot>();
  for (const snapshot of collection.observations as readonly unknown[]) {
    if (!isRecord(snapshot) || !isRecord(snapshot.provenance)) {
      return invalid(["READ_ONLY_COLLECTION_OBSERVATION_INVALID"]);
    }
    const providerId = snapshot.provenance.providerId;
    if (typeof providerId !== "string" ||
        !SAFE_SLUG.test(providerId) ||
        observedByProvider.has(providerId) ||
        !validateCanonicalMarketSnapshot(snapshot).valid) {
      return invalid(["READ_ONLY_COLLECTION_OBSERVATION_INVALID"]);
    }
    observedByProvider.set(providerId, snapshot as unknown as CanonicalMarketSnapshot);
  }
  for (const candidate of collection.candidates) {
    const observed = observedByProvider.get(candidate.providerId);
    if (candidate.snapshot === null) {
      if (observed !== undefined) return invalid(["READ_ONLY_COLLECTION_OBSERVATION_SET_MISMATCH"]);
    } else if (observed === undefined ||
        observed.observationId !== candidate.snapshot.observationId ||
        observed.provenance.providerId !== candidate.providerId) {
      return invalid(["READ_ONLY_COLLECTION_OBSERVATION_SET_MISMATCH"]);
    }
  }
  if (observedByProvider.size !== collection.observations.length) {
    return invalid(["READ_ONLY_COLLECTION_OBSERVATION_SET_MISMATCH"]);
  }

  const successfulProviderIds: string[] = [];
  const failedProviderIds: string[] = [];
  const blockedProviderIds: string[] = [];
  const attemptReasons: string[] = [];
  const attemptedProviderIds = new Set<string>();
  for (const attempt of collection.attempts as readonly unknown[]) {
    if (!isRecord(attempt) ||
        typeof attempt.providerId !== "string" ||
        !candidateIds.has(attempt.providerId) ||
        attemptedProviderIds.has(attempt.providerId) ||
        typeof attempt.independenceGroupId !== "string" ||
        typeof attempt.priority !== "number" ||
        !Number.isSafeInteger(attempt.priority) ||
        typeof attempt.permissionStatus !== "string" ||
        typeof attempt.outcome !== "string" ||
        !["OBSERVATION_NORMALIZED", "REQUEST_FAILED", "NORMALIZATION_FAILED", "INVALID_OBSERVATION", "BLOCKED"].includes(attempt.outcome) ||
        !Array.isArray(attempt.reasonCodes) ||
        !attempt.reasonCodes.every((code) => typeof code === "string" && /^[A-Z0-9_]{1,64}$/.test(code))) {
      return invalid(["READ_ONLY_COLLECTION_ATTEMPT_INVALID"]);
    }
    const candidate = candidatesByProvider.get(attempt.providerId)!;
    if (candidate.independenceGroupId !== attempt.independenceGroupId ||
        candidate.priority !== attempt.priority) {
      return invalid(["READ_ONLY_COLLECTION_ATTEMPT_IDENTITY_MISMATCH"]);
    }
    attemptedProviderIds.add(attempt.providerId);
    if (attempt.outcome === "OBSERVATION_NORMALIZED") successfulProviderIds.push(attempt.providerId);
    if (attempt.outcome === "REQUEST_FAILED" ||
        attempt.outcome === "NORMALIZATION_FAILED" ||
        attempt.outcome === "INVALID_OBSERVATION") failedProviderIds.push(attempt.providerId);
    if (attempt.outcome === "BLOCKED") blockedProviderIds.push(attempt.providerId);
    attemptReasons.push(...attempt.reasonCodes);
  }

  if (attemptedProviderIds.size !== candidateIds.size) {
    return invalid(["READ_ONLY_COLLECTION_ATTEMPT_SET_MISMATCH"]);
  }

  const diagnosticAgreement = assessProviderAgreement(
    collection.candidates,
    policy.agreementPolicy
  );
  const lineageCandidates = collection.candidates.map((candidate) => {
    const snapshot = candidate.snapshot;
    const timestampKind =
      snapshot !== null && snapshot.sourceEventAt !== null
        ? "EVENT" as const
        : snapshot !== null && snapshot.observedAt !== null
          ? "OBSERVATION" as const
          : "NONE" as const;
    return {
      providerId: candidate.providerId,
      independenceGroupId: candidate.independenceGroupId,
      role: "POOL_METRICS" as const,
      timestampKind
    };
  });
  const reviewedAgreement = assessProviderAgreementWithReviewedLineage({
    candidates: collection.candidates,
    lineageCandidates,
    lineagePolicy: policy.lineagePolicy,
    agreementPolicy: policy.agreementPolicy
  });

  let status: ReadOnlyMarketDataAssessmentStatus;
  if (diagnosticAgreement.status === "INVALID_INPUT" || reviewedAgreement.status === "INVALID_INPUT") {
    status = "INVALID_INPUT";
  } else if (diagnosticAgreement.status === "DISAGREEMENT") {
    status = "DISAGREEMENT";
  } else if (diagnosticAgreement.status === "INSUFFICIENT_EVIDENCE" ||
             diagnosticAgreement.status === "NO_ACCEPTABLE_PROVIDER") {
    status = "INSUFFICIENT_EVIDENCE";
  } else if (reviewedAgreement.canProceedToOnChainValidation) {
    status = "READY_FOR_ON_CHAIN_VALIDATION";
  } else {
    status = "BLOCKED";
  }

  const fallbackUsed = diagnosticAgreement.fallbackUsed;
  const reasonCodes = [...new Set([
    ...attemptReasons,
    ...diagnosticAgreement.reasonCodes,
    ...reviewedAgreement.reasonCodes,
    ...(reviewedAgreement.canProceedToOnChainValidation
      ? []
      : ["REVIEWED_PROVIDER_LINEAGE_GATE_NOT_READY"])
  ])];
  return {
    status,
    diagnosticAgreement,
    reviewedAgreement,
    attemptSummary: {
      successfulProviderIds: [...new Set(successfulProviderIds)],
      failedProviderIds: [...new Set(failedProviderIds)],
      blockedProviderIds: [...new Set(blockedProviderIds)],
      reasonCodes: [...new Set(attemptReasons)]
    },
    providerHealth: collection.providerHealth.map((item) => ({ ...item })),
    fallbackUsed,
    canProceedToOnChainValidation:
      status === "READY_FOR_ON_CHAIN_VALIDATION" &&
      reviewedAgreement.canProceedToOnChainValidation,
    reasonCodes,
    tradingAuthorized: false
  };
}

export class ReadOnlyMarketDataOrchestrator {
  private readonly providers: readonly MarketDataProviderRegistration[];
  private readonly options: ReadOnlyMarketDataOrchestratorOptions;
  private readonly health = new Map<string, ProviderHealthSnapshot>();
  private readonly inFlight = new Set<string>();

  constructor(
    providers: readonly MarketDataProviderRegistration[],
    options: ReadOnlyMarketDataOrchestratorOptions
  ) {
    if (!Array.isArray(providers) || providers.length === 0) {
      throw new TypeError("At least one read-only market-data provider is required.");
    }
    if (typeof options?.now !== "function" ||
        !["DIAGNOSTIC", "PRODUCTION"].includes(String(options.usagePurpose)) ||
        (options.providerUseDecisionResolver !== undefined &&
          typeof options.providerUseDecisionResolver !== "function") ||
        !Number.isSafeInteger(options.maxHealthAgeMs) ||
        options.maxHealthAgeMs < 1 ||
        !Number.isSafeInteger(options.requestTimeoutMs) ||
        options.requestTimeoutMs < 100 ||
        options.requestTimeoutMs > 60_000 ||
        !Number.isSafeInteger(options.healthPolicy?.failureThreshold) ||
        options.healthPolicy.failureThreshold < 1 ||
        !Number.isSafeInteger(options.healthPolicy?.cooldownMs) ||
        options.healthPolicy.cooldownMs < 1 ||
        ((options.providerHealthStore === undefined) !== (options.recoveryProbeLease === undefined)) ||
        (options.providerHealthStore !== undefined &&
          (typeof options.recoveryProbeLease?.ownerId !== "string" ||
           !SAFE_WORKER_ID.test(options.recoveryProbeLease.ownerId) ||
           !Number.isSafeInteger(options.recoveryProbeLease.leaseDurationMs) ||
           options.recoveryProbeLease.leaseDurationMs < options.requestTimeoutMs + 1_000 ||
           options.recoveryProbeLease.leaseDurationMs > 300_000 ||
           typeof options.recoveryProbeLease.createLeaseToken !== "function"))) {
      throw new RangeError("Invalid provider orchestration policy.");
    }

    const providerIds = new Set<string>();
    const independenceGroups = new Set<string>();
    const priorities = new Set<number>();
    const normalizedProviders = providers.map((registration) => {
      if (registration === null ||
          typeof registration !== "object" ||
          registration.adapter === null ||
          typeof registration.adapter !== "object" ||
          typeof registration.adapter.providerId !== "string" ||
          !SAFE_SLUG.test(registration.adapter.providerId) ||
          typeof registration.adapter.fetchRaw !== "function" ||
          typeof registration.adapter.normalize !== "function" ||
          typeof registration.adapter.adapterVersion !== "string" ||
          typeof registration.adapter.sourceKind !== "string" ||
          typeof registration.independenceGroupId !== "string" ||
          !SAFE_SLUG.test(registration.independenceGroupId) ||
          !Number.isSafeInteger(registration.priority) ||
          registration.priority < 0) {
        throw new TypeError("Invalid market-data provider registration.");
      }
      if (providerIds.has(registration.adapter.providerId)) {
        throw new TypeError("Duplicate market-data provider ID.");
      }
      if (independenceGroups.has(registration.independenceGroupId)) {
        throw new TypeError("Provider aliases must not share an independent-evidence registration.");
      }
      if (priorities.has(registration.priority)) {
        throw new TypeError("Provider priorities must be unique.");
      }
      providerIds.add(registration.adapter.providerId);
      independenceGroups.add(registration.independenceGroupId);
      priorities.add(registration.priority);
      this.health.set(
        registration.adapter.providerId,
        initialProviderHealth(registration.adapter.providerId)
      );
      return {
        adapter: registration.adapter,
        independenceGroupId: registration.independenceGroupId,
        priority: registration.priority
      };
    });
    this.providers = normalizedProviders.sort((a, b) => a.priority - b.priority);
    this.options = options;
  }

  /** Last loaded health snapshot. With a shared store, collect() refreshes it before provider attempts. */
  getProviderHealth(): readonly ProviderHealthSnapshot[] {
    return this.providers.map(({ adapter }) => ({ ...this.health.get(adapter.providerId)! }));
  }

  /**
   * Attempts each configured provider once in priority order and returns all canonical observations
   * as candidates for a separate assessProviderAgreement call. A single response is never consensus.
   */
  async collect(target: ReadOnlyMarketDataTarget): Promise<ReadOnlyMarketDataCollection> {
    if (!isRecord(target) ||
        !["mainnet-beta", "devnet", "testnet"].includes(String(target.cluster)) ||
        !isSolanaPublicKey(target.baseMint) ||
        !isSolanaPublicKey(target.quoteMint) ||
        target.baseMint === target.quoteMint ||
        !(target.poolAddress === null || isSolanaPublicKey(target.poolAddress))) {
      throw new TypeError("Invalid read-only market-data target.");
    }

    const observations = new Map<string, CanonicalMarketSnapshot>();
    const attempts: ProviderOrchestrationAttempt[] = [];

    for (const registration of this.providers) {
      const providerId = registration.adapter.providerId;
      const startedAt = this.options.now();
      if (!validUtcTimestamp(startedAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");

      let useDecision: unknown = null;
      if (this.options.providerUseDecisionResolver !== undefined) {
        try {
          useDecision = await this.options.providerUseDecisionResolver(
            providerId,
            this.options.usagePurpose,
            startedAt
          );
        } catch {
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: "BLOCK_PROVIDER_USE_NOT_APPROVED",
            outcome: "BLOCKED",
            reasonCodes: ["PROVIDER_USE_DECISION_RESOLVER_FAILED"],
            latencyMs: null
          });
          continue;
        }
      }

      const useAuthorization = assessProviderUseDecision(
        useDecision,
        providerId,
        this.options.usagePurpose,
        startedAt
      );
      if (!useAuthorization.authorized) {
        attempts.push({
          providerId,
          independenceGroupId: registration.independenceGroupId,
          priority: registration.priority,
          permissionStatus: "BLOCK_PROVIDER_USE_NOT_APPROVED",
          outcome: "BLOCKED",
          reasonCodes: [...useAuthorization.reasonCodes],
          latencyMs: null
        });
        continue;
      }

      let health = this.health.get(providerId)!;
      if (this.options.providerHealthStore !== undefined) {
        try {
          const persisted = await this.options.providerHealthStore.get(providerId);
          health = persisted?.health ?? initialProviderHealth(providerId);
          this.health.set(providerId, health);
        } catch {
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: "INVALID_INPUT",
            outcome: "BLOCKED",
            reasonCodes: ["SHARED_PROVIDER_HEALTH_READ_FAILED"],
            latencyMs: null
          });
          continue;
        }
      }

      if (health.lastRequestAt !== null && Date.parse(startedAt) < Date.parse(health.lastRequestAt)) {
        attempts.push({
          providerId,
          independenceGroupId: registration.independenceGroupId,
          priority: registration.priority,
          permissionStatus: "INVALID_INPUT",
          outcome: "BLOCKED",
          reasonCodes: ["ORCHESTRATOR_CLOCK_MOVED_BACKWARDS"],
          latencyMs: null
        });
        continue;
      }

      if (this.inFlight.has(providerId)) {
        attempts.push({
          providerId,
          independenceGroupId: registration.independenceGroupId,
          priority: registration.priority,
          permissionStatus: "BLOCK_PROVIDER_ATTEMPT_IN_FLIGHT",
          outcome: "BLOCKED",
          reasonCodes: ["PROVIDER_ATTEMPT_ALREADY_IN_FLIGHT"],
          latencyMs: null
        });
        continue;
      }

      const permission = assessProviderAttemptPermission({
        health,
        nowAt: startedAt,
        maxHealthAgeMs: this.options.maxHealthAgeMs,
        recoveryProbeInFlight: this.inFlight.has(providerId)
      });
      if (!permission.canAttempt) {
        attempts.push({
          providerId,
          independenceGroupId: registration.independenceGroupId,
          priority: registration.priority,
          permissionStatus: permission.status,
          outcome: "BLOCKED",
          reasonCodes: [...permission.reasonCodes],
          latencyMs: null
        });
        continue;
      }

      let recoveryLease: RecoveryProbeLeaseIdentity | undefined;
      if (permission.requiresExclusiveProbe && this.options.providerHealthStore !== undefined) {
        try {
          const leaseConfig = this.options.recoveryProbeLease!;
          const leaseToken = leaseConfig.createLeaseToken(providerId, startedAt);
          if (!LEASE_TOKEN_PATTERN.test(leaseToken)) {
            attempts.push({
              providerId,
              independenceGroupId: registration.independenceGroupId,
              priority: registration.priority,
              permissionStatus: "INVALID_INPUT",
              outcome: "BLOCKED",
              reasonCodes: ["RECOVERY_PROBE_TOKEN_HASH_INVALID"],
              latencyMs: null
            });
            continue;
          }
          const lease = await this.options.providerHealthStore.claimRecoveryProbe({
            providerId,
            ownerId: leaseConfig.ownerId,
            leaseToken,
            leaseDurationMs: leaseConfig.leaseDurationMs
          });
          if (lease === null) {
            attempts.push({
              providerId,
              independenceGroupId: registration.independenceGroupId,
              priority: registration.priority,
              permissionStatus: "BLOCK_RECOVERY_PROBE_IN_FLIGHT",
              outcome: "BLOCKED",
              reasonCodes: ["SHARED_RECOVERY_PROBE_LEASE_NOT_AVAILABLE"],
              latencyMs: null
            });
            continue;
          }
          recoveryLease = {
            providerId: lease.providerId,
            ownerId: lease.ownerId,
            leaseToken: lease.leaseToken,
            fencingToken: lease.fencingToken
          };
        } catch {
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: "INVALID_INPUT",
            outcome: "BLOCKED",
            reasonCodes: ["SHARED_RECOVERY_PROBE_LEASE_CLAIM_FAILED"],
            latencyMs: null
          });
          continue;
        }
      }

      this.inFlight.add(providerId);
      const requestedAt = startedAt;
      const request: MarketDataRequest = { ...target, requestedAt };
      const requestId = this.options.requestId?.(providerId, requestedAt) ?? null;
      const startedMs = Date.now();
      const timeoutSignal = AbortSignal.timeout(this.options.requestTimeoutMs);

      try {
        let raw: unknown;
        try {
          raw = await registration.adapter.fetchRaw(request, timeoutSignal);
        } catch (error) {
          const failureAt = this.options.now();
          if (!validUtcTimestamp(failureAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");
          const failure = classifyFailure(error, timeoutSignal.aborted);
          const updated = await this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: failure.errorClass,
            retryable: failure.retryable,
            latencyMs: Math.max(0, Date.now() - startedMs)
          }, recoveryLease);
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: updated.updated ? "REQUEST_FAILED" : "BLOCKED",
            reasonCodes: updated.updated ? [failure.reasonCode] : [updated.reasonCode],
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          continue;
        }

        const retrievedAt = this.options.now();
        if (!validUtcTimestamp(retrievedAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");
        let normalized: unknown;
        try {
          normalized = registration.adapter.normalize(raw, { requestedAt, retrievedAt, requestId });
        } catch {
          normalized = null;
        }

        const normalizationErrors = isRecord(normalized) && Array.isArray(normalized.errors)
          ? normalized.errors
          : null;
        const normalizedObservations = isRecord(normalized) && Array.isArray(normalized.observations)
          ? normalized.observations
          : null;
        if (normalizationErrors === null || normalizedObservations === null ||
            normalizationErrors.length > 0 || normalizedObservations.length !== 1) {
          const codes = normalizationErrors === null
            ? ["ADAPTER_NORMALIZATION_RESULT_INVALID"]
            : normalizationErrors.length > 0
              ? normalizationErrors.map((code) => safeReason(code, "ADAPTER_NORMALIZATION_FAILED"))
              : ["ADAPTER_OBSERVATION_COUNT_INVALID"];
          const failureAt = this.options.now();
          if (!validUtcTimestamp(failureAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");
          const updated = await this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: "PARSE",
            retryable: false,
            latencyMs: Math.max(0, Date.now() - startedMs)
          }, recoveryLease);
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: updated.updated ? "NORMALIZATION_FAILED" : "BLOCKED",
            reasonCodes: updated.updated ? [...new Set(codes)] : [updated.reasonCode],
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          continue;
        }

        const candidate = normalizedObservations[0];
        const validation = validateCanonicalMarketSnapshot(candidate);
        if (!validation.valid || !isRecord(candidate)) {
          const failureAt = this.options.now();
          if (!validUtcTimestamp(failureAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");
          const updated = await this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: "PARSE",
            retryable: false,
            latencyMs: Math.max(0, Date.now() - startedMs)
          }, recoveryLease);
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            outcome: updated.updated ? "INVALID_OBSERVATION" : "BLOCKED",
            permissionStatus: permission.status,
            reasonCodes: updated.updated ? ["CANONICAL_OBSERVATION_INVALID"] : [updated.reasonCode],
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          continue;
        }

        const snapshot = candidate as unknown as CanonicalMarketSnapshot;
        const expectedSourceKind =
          snapshot.provenance.sourceKind === registration.adapter.sourceKind ||
          (snapshot.provenance.synthetic === true &&
           snapshot.provenance.sourceKind === "REPLAY_FIXTURE");
        if (snapshot.provenance.providerId !== providerId ||
            !expectedSourceKind ||
            snapshot.cluster !== target.cluster ||
            snapshot.baseMint !== target.baseMint ||
            snapshot.quoteMint !== target.quoteMint ||
            snapshot.poolAddress !== target.poolAddress) {
          const failureAt = this.options.now();
          if (!validUtcTimestamp(failureAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");
          const updated = await this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: "PARSE",
            retryable: false,
            latencyMs: Math.max(0, Date.now() - startedMs)
          }, recoveryLease);
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: updated.updated ? "INVALID_OBSERVATION" : "BLOCKED",
            reasonCodes: updated.updated ? ["CANONICAL_OBSERVATION_IDENTITY_MISMATCH"] : [updated.reasonCode],
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          continue;
        }

        const latencyMs = Math.max(0, Date.now() - startedMs);
        const updated = await this.updateHealth(providerId, { kind: "SUCCESS", at: retrievedAt, latencyMs }, recoveryLease);
        if (!updated.updated) {
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: "BLOCKED",
            reasonCodes: [updated.reasonCode],
            latencyMs
          });
          continue;
        }
        observations.set(providerId, snapshot);
        attempts.push({
          providerId,
          independenceGroupId: registration.independenceGroupId,
          priority: registration.priority,
          permissionStatus: permission.status,
          outcome: "OBSERVATION_NORMALIZED",
          reasonCodes: [],
          latencyMs
        });
      } finally {
        this.inFlight.delete(providerId);
      }
    }

    const candidates: ProviderEvidenceCandidate[] = this.providers.map((registration) => ({
      providerId: registration.adapter.providerId,
      independenceGroupId: registration.independenceGroupId,
      priority: registration.priority,
      health: { ...this.health.get(registration.adapter.providerId)! },
      snapshot: observations.get(registration.adapter.providerId) ?? null
    }));

    return {
      observations: this.providers
        .map((registration) => observations.get(registration.adapter.providerId))
        .filter((snapshot): snapshot is CanonicalMarketSnapshot => snapshot !== undefined),
      candidates,
      attempts,
      providerHealth: this.getProviderHealth(),
      tradingAuthorized: false
    };
  }

  private async updateHealth(
    providerId: string,
    result: ProviderResult,
    recoveryLease?: RecoveryProbeLeaseIdentity
  ): Promise<{ readonly updated: boolean; readonly reasonCode: string }> {
    const previous = this.health.get(providerId);
    if (previous === undefined) {
      return { updated: false, reasonCode: "PROVIDER_HEALTH_STATE_MISSING" };
    }
    if (previous.lastRequestAt !== null && Date.parse(result.at) < Date.parse(previous.lastRequestAt)) {
      return { updated: false, reasonCode: "ORCHESTRATOR_CLOCK_MOVED_BACKWARDS" };
    }

    if (this.options.providerHealthStore !== undefined) {
      try {
        const persisted = await this.options.providerHealthStore.recordResult({
          providerId,
          result,
          policy: this.options.healthPolicy,
          ...(recoveryLease === undefined ? {} : { recoveryLease })
        });
        this.health.set(providerId, persisted.health);
        return { updated: true, reasonCode: "" };
      } catch (error) {
        const code = isRecord(error) && typeof error.code === "string" ? error.code : "DATABASE_OPERATION_FAILED";
        if (code === "RECOVERY_LEASE_NOT_OWNED") {
          return { updated: false, reasonCode: "SHARED_RECOVERY_PROBE_LEASE_LOST" };
        }
        if (code === "PROVIDER_RESULT_OUT_OF_ORDER") {
          return { updated: false, reasonCode: "PROVIDER_HEALTH_RESULT_OUT_OF_ORDER" };
        }
        return { updated: false, reasonCode: "SHARED_PROVIDER_HEALTH_WRITE_FAILED" };
      }
    }

    try {
      this.health.set(providerId, recordProviderResult(previous, result, this.options.healthPolicy));
      return { updated: true, reasonCode: "" };
    } catch {
      return { updated: false, reasonCode: "PROVIDER_HEALTH_RESULT_INVALID" };
    }
  }
}
