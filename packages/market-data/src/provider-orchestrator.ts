import {
  assessProviderAttemptPermission,
  initialProviderHealth,
  isSolanaPublicKey,
  recordProviderResult,
  validateCanonicalMarketSnapshot
} from "./index.js";
import type {
  CanonicalMarketSnapshot,
  MarketDataAdapter,
  MarketDataRequest,
  ProviderAttemptPermissionStatus,
  ProviderErrorClass,
  ProviderEvidenceCandidate,
  ProviderHealthPolicy,
  ProviderHealthSnapshot,
  ProviderResult,
  SolanaCluster
} from "./index.js";

const SAFE_SLUG = /^[a-z0-9][a-z0-9._-]{0,62}$/;
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

export interface ReadOnlyMarketDataOrchestratorOptions {
  readonly now: () => string;
  readonly healthPolicy: ProviderHealthPolicy;
  readonly maxHealthAgeMs: number;
  readonly requestTimeoutMs: number;
  readonly requestId?: (providerId: string, requestedAt: string) => string | null;
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
  readonly permissionStatus: ProviderAttemptPermissionStatus | "BLOCK_PROVIDER_ATTEMPT_IN_FLIGHT";
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
        !Number.isSafeInteger(options.maxHealthAgeMs) ||
        options.maxHealthAgeMs < 1 ||
        !Number.isSafeInteger(options.requestTimeoutMs) ||
        options.requestTimeoutMs < 100 ||
        options.requestTimeoutMs > 60_000 ||
        !Number.isSafeInteger(options.healthPolicy?.failureThreshold) ||
        options.healthPolicy.failureThreshold < 1 ||
        !Number.isSafeInteger(options.healthPolicy?.cooldownMs) ||
        options.healthPolicy.cooldownMs < 1) {
      throw new RangeError("Invalid provider orchestration policy.");
    }

    const providerIds = new Set<string>();
    const independenceGroups = new Set<string>();
    const priorities = new Set<number>();
    const normalizedProviders = providers.map((registration) => {
      if (!isRecord(registration) ||
          !isRecord(registration.adapter) ||
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

  /** Current process-local health; multi-process deployments must persist health and a shared lease. */
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
      const health = this.health.get(providerId)!;

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
          const updated = this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: failure.errorClass,
            retryable: failure.retryable,
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: updated ? "REQUEST_FAILED" : "BLOCKED",
            reasonCodes: updated ? [failure.reasonCode] : ["ORCHESTRATOR_CLOCK_MOVED_BACKWARDS"],
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
          const updated = this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: "PARSE",
            retryable: false,
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: updated ? "NORMALIZATION_FAILED" : "BLOCKED",
            reasonCodes: updated ? [...new Set(codes)] : ["ORCHESTRATOR_CLOCK_MOVED_BACKWARDS"],
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          continue;
        }

        const candidate = normalizedObservations[0];
        const validation = validateCanonicalMarketSnapshot(candidate);
        if (!validation.valid || !isRecord(candidate)) {
          const failureAt = this.options.now();
          if (!validUtcTimestamp(failureAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");
          const updated = this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: "PARSE",
            retryable: false,
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            outcome: updated ? "INVALID_OBSERVATION" : "BLOCKED",
            permissionStatus: permission.status,
            reasonCodes: updated ? ["CANONICAL_OBSERVATION_INVALID"] : ["ORCHESTRATOR_CLOCK_MOVED_BACKWARDS"],
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          continue;
        }

        const snapshot = candidate as unknown as CanonicalMarketSnapshot;
        if (snapshot.provenance.providerId !== providerId ||
            snapshot.provenance.sourceKind !== registration.adapter.sourceKind ||
            snapshot.cluster !== target.cluster ||
            snapshot.baseMint !== target.baseMint ||
            snapshot.quoteMint !== target.quoteMint ||
            snapshot.poolAddress !== target.poolAddress) {
          const failureAt = this.options.now();
          if (!validUtcTimestamp(failureAt)) throw new TypeError("Injected clock returned an invalid UTC timestamp.");
          const updated = this.updateHealth(providerId, {
            kind: "FAILURE",
            at: failureAt,
            errorClass: "PARSE",
            retryable: false,
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: updated ? "INVALID_OBSERVATION" : "BLOCKED",
            reasonCodes: updated ? ["CANONICAL_OBSERVATION_IDENTITY_MISMATCH"] : ["ORCHESTRATOR_CLOCK_MOVED_BACKWARDS"],
            latencyMs: Math.max(0, Date.now() - startedMs)
          });
          continue;
        }

        const latencyMs = Math.max(0, Date.now() - startedMs);
        const updated = this.updateHealth(providerId, { kind: "SUCCESS", at: retrievedAt, latencyMs });
        if (!updated) {
          attempts.push({
            providerId,
            independenceGroupId: registration.independenceGroupId,
            priority: registration.priority,
            permissionStatus: permission.status,
            outcome: "BLOCKED",
            reasonCodes: ["ORCHESTRATOR_CLOCK_MOVED_BACKWARDS"],
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

  private updateHealth(providerId: string, result: ProviderResult): boolean {
    const previous = this.health.get(providerId);
    if (previous === undefined) return false;
    if (previous.lastRequestAt !== null && Date.parse(result.at) < Date.parse(previous.lastRequestAt)) return false;
    this.health.set(providerId, recordProviderResult(previous, result, this.options.healthPolicy));
    return true;
  }
}
