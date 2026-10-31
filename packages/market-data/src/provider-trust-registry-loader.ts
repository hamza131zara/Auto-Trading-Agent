/**
 * Phase 6.46 Step 4 — owner-configured, transport-independent trust-registry
 * load orchestration.
 *
 * This loader does not select a vendor, endpoint path, proxy or trust root.
 * The caller supplies the owner-approved HTTPS origin, concrete transport,
 * root authenticator and durable anti-rollback store. No snapshot keys are
 * returned before the high-water mark gate commits successfully.
 */
import {
  PROVIDER_TRUST_REGISTRY_LIMITS,
  ProviderTrustRegistryError
} from "./provider-trust-registry.js";
import type {
  AuthenticatedProviderTrustSnapshot,
  ProviderTrustRegistry,
  ProviderTrustRegistryTransportResponse
} from "./provider-trust-registry.js";

type ProviderTrustRegistryLoadInput =
  Parameters<ProviderTrustRegistry["loadCurrentSnapshot"]>[0];
import {
  advanceProviderTrustRegistryHighWaterMark
} from "./provider-trust-registry-postgres-store.js";

const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_ORIGIN_LENGTH = 512;

interface RegistryTransportResponseRecord extends Record<string, unknown> {
  status: unknown;
  contentType: unknown;
  finalOrigin: unknown;
  redirected: unknown;
  bytes: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length &&
    actual.every((key, index) => key === required[index]);
}

function isValidUtcTimestamp(value: unknown): value is string {
  if (typeof value !== "string" || !UTC_TIMESTAMP.test(value)) return false;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return false;
  const fraction = /\.(\d{1,3})Z$/.exec(value)?.[1] ?? "";
  const normalized = value.replace(/(?:\.\d{1,3})?Z$/, "." + fraction.padEnd(3, "0") + "Z");
  return new Date(timestamp).toISOString() === normalized;
}

/** Canonical origin only: no userinfo, path, query, fragment, or non-HTTPS scheme. */
function validateExpectedOrigin(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_ORIGIN_LENGTH) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:" ||
        parsed.origin !== value ||
        parsed.username !== "" ||
        parsed.password !== "" ||
        parsed.pathname !== "/" ||
        parsed.search !== "" ||
        parsed.hash !== "") {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    return parsed.origin;
  } catch (error) {
    if (error instanceof ProviderTrustRegistryError) throw error;
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
}

function validateContentType(value: unknown): value is string {
  if (typeof value !== "string" || value.length > 256) return false;
  const segments = value.split(";");
  if (segments[0]?.trim().toLowerCase() !== "application/json") return false;
  for (const parameter of segments.slice(1)) {
    const match = /^\s*charset\s*=\s*(?:"([^"]+)"|([^;\s]+))\s*$/i.exec(parameter);
    if (match === null) return false;
    const charset = (match[1] ?? match[2] ?? "").toLowerCase();
    if (charset !== "utf-8" && charset !== "utf8") return false;
  }
  return true;
}

function validateTransportResponse(
  value: unknown,
  expectedOrigin: string
): ProviderTrustRegistryTransportResponse {
  if (!isRecord(value) ||
      !hasExactKeys(value, ["status", "contentType", "finalOrigin", "redirected", "bytes"]) ||
      value.status !== 200 ||
      !validateContentType(value.contentType) ||
      value.finalOrigin !== expectedOrigin ||
      value.redirected !== false ||
      !(value.bytes instanceof Uint8Array)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
  if (value.bytes.byteLength > PROVIDER_TRUST_REGISTRY_LIMITS.maxSnapshotBytes) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_RESPONSE_TOO_LARGE");
  }
  return value as unknown as ProviderTrustRegistryTransportResponse;
}

function copyBytes(bytes: Uint8Array): Uint8Array {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy;
}

/**
 * Execute exactly one bounded transport read, authenticate its bytes, then
 * advance durable anti-rollback state before returning a trusted snapshot.
 */
export class AuthenticatedProviderTrustRegistry implements ProviderTrustRegistry {
  async loadCurrentSnapshot(input: ProviderTrustRegistryLoadInput): Promise<AuthenticatedProviderTrustSnapshot> {
    if (!isRecord(input) ||
        !isValidUtcTimestamp(input.now) ||
        !isRecord(input.trustAnchor) ||
        !isRecord(input.state) ||
        input.state.expectedRegistryId !== input.trustAnchor.registryId ||
        !Number.isSafeInteger(input.state.maxSnapshotAgeMs) ||
        input.state.maxSnapshotAgeMs < 1 ||
        input.state.maxSnapshotAgeMs > PROVIDER_TRUST_REGISTRY_LIMITS.maxAgeMs ||
        !isRecord(input.state.highWaterMarkStore) ||
        typeof input.state.highWaterMarkStore.read !== "function" ||
        typeof input.state.highWaterMarkStore.compareAndSet !== "function" ||
        !isRecord(input.transport) ||
        typeof input.transport.readSnapshot !== "function" ||
        !isRecord(input.authenticator) ||
        typeof input.authenticator.authenticate !== "function") {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
    }

    const expectedOrigin = validateExpectedOrigin(input.expectedOrigin);
    const timeoutMs = input.requestTimeoutMs ??
      PROVIDER_TRUST_REGISTRY_LIMITS.maxRequestTimeoutMs;
    if (!Number.isSafeInteger(timeoutMs) ||
        timeoutMs < 1 ||
        timeoutMs > PROVIDER_TRUST_REGISTRY_LIMITS.maxRequestTimeoutMs) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
    }

    const controller = new AbortController();
    let timeoutHandle: ReturnType<typeof setTimeout> | undefined;
    let timedOut = false;
    const timeout = new Promise<never>((_resolve, reject) => {
      timeoutHandle = setTimeout(() => {
        timedOut = true;
        controller.abort();
        reject(new ProviderTrustRegistryError("TRUST_REGISTRY_UNAVAILABLE"));
      }, timeoutMs);
    });

    let rawResponse: unknown;
    try {
      const request = Object.freeze({
        expectedOrigin,
        timeoutMs,
        maxResponseBytes: PROVIDER_TRUST_REGISTRY_LIMITS.maxSnapshotBytes,
        redirect: "error" as const,
        acceptContentType: "application/json" as const,
        signal: controller.signal
      });
      rawResponse = await Promise.race([
        Promise.resolve().then(() => input.transport.readSnapshot(request)),
        timeout
      ]);
    } catch (error) {
      if (timedOut) {
        throw new ProviderTrustRegistryError("TRUST_REGISTRY_UNAVAILABLE");
      }
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_UNAVAILABLE");
    } finally {
      if (timeoutHandle !== undefined) clearTimeout(timeoutHandle);
    }

    const response = validateTransportResponse(rawResponse, expectedOrigin);
    const snapshotBytes = copyBytes(response.bytes);
    let retrievedAt: string;
    try {
      retrievedAt = input.clock === undefined
        ? new Date().toISOString()
        : input.clock();
    } catch {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_UNAVAILABLE");
    }
    if (!isValidUtcTimestamp(retrievedAt) ||
        Date.parse(retrievedAt) < Date.parse(input.now)) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
    }

    let authenticated: AuthenticatedProviderTrustSnapshot;
    try {
      authenticated = await input.authenticator.authenticate({
        snapshotBytes,
        trustAnchor: input.trustAnchor,
        now: retrievedAt,
        retrievedAt,
        maxSnapshotAgeMs: input.state.maxSnapshotAgeMs
      });
    } catch (error) {
      if (error instanceof ProviderTrustRegistryError) throw error;
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_AUTHENTICATION_FAILED");
    }

    return advanceProviderTrustRegistryHighWaterMark({
      snapshot: authenticated,
      now: retrievedAt,
      maxSnapshotAgeMs: input.state.maxSnapshotAgeMs,
      store: input.state.highWaterMarkStore
    });
  }
}
