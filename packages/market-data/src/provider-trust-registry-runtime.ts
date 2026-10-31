/**
 * Phase 6.46 Step 7 — owner-configured trust-registry authorization bootstrap.
 *
 * This module composes validated configuration, a pinned DNS lookup policy,
 * direct HTTPS transport, Ed25519 root authentication, PostgreSQL high-water
 * state and the provider-use decision verifier. Construction is inert: it does
 * not make a network or database request. Each matching decision attempt loads
 * a fresh authoritative snapshot and fails closed on every error.
 */
import { lookup as systemLookup } from "node:dns";
import { isIP } from "node:net";
import {
  PROVIDER_TRUST_REGISTRY_LIMITS,
  ProviderTrustRegistryError
} from "./provider-trust-registry.js";
import type { ProviderTrustRegistryTrustAnchor } from "./provider-trust-registry.js";
import type { PostgresQueryClient } from "./provider-health-store.js";
import type {
  ProviderUseDecision,
  ProviderUseDecisionResolver,
  ProviderUsePurpose
} from "./provider-orchestrator.js";
import {
  Ed25519ProviderTrustSnapshotAuthenticator,
  validateProviderTrustRegistryTrustAnchor
} from "./provider-trust-registry-authenticator.js";
import {
  AuthenticatedProviderTrustRegistry
} from "./provider-trust-registry-loader.js";
import {
  NodeHttpsProviderTrustRegistryTransport
} from "./provider-trust-registry-https-transport.js";
import {
  PostgresProviderTrustRegistryHighWaterMarkStore
} from "./provider-trust-registry-postgres-store.js";
import {
  verifySignedProviderUseDecision
} from "./provider-use-decision-verifier.js";

const SAFE_REGISTRY_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_ROOT_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_HEX = /^[a-f0-9]{64}$/;
const SAFE_PROVIDER_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const UTC_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MAX_DECISION_ENVELOPES = 64;
const MAX_DECISION_ENVELOPES_BYTES = 48 * 1024;

export interface DisabledProviderTrustRegistryBootstrapConfig {
  readonly enabled: false;
}

export interface EnabledProviderTrustRegistryBootstrapConfig {
  readonly enabled: true;
  readonly endpointUrl: string;
  readonly expectedOrigin: string;
  readonly endpointHostname: string;
  readonly registryId: string;
  readonly rootKeyId: string;
  readonly rootPublicKeyPem: string;
  readonly expectedSpkiSha256: string;
  readonly dnsAllowedAddresses: readonly string[];
}

/** Structurally compatible with parseProviderTrustRegistryConfig from @ata/config. */
export type ProviderTrustRegistryBootstrapConfig =
  | DisabledProviderTrustRegistryBootstrapConfig
  | EnabledProviderTrustRegistryBootstrapConfig;

export interface ProviderTrustRegistryAuthorizationRuntime {
  readonly enabled: boolean;
  /** Synchronous and asynchronous resolvers are both accepted by the orchestrator. */
  readonly resolveProviderUseDecision: ProviderUseDecisionResolver;
}

interface LookupAddress {
  readonly address: string;
  readonly family: number;
}

interface LookupOptions {
  readonly all?: boolean;
  readonly family?: number;
}

type LookupCallback = (
  error: Error | null,
  address: string | LookupAddress[],
  family?: number
) => void;

type PinnedLookupFunction = (
  hostname: string,
  options: number | LookupOptions,
  callback: LookupCallback
) => void;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const actual = Object.keys(value).sort();
  const required = [...expected].sort();
  return actual.length === required.length &&
    actual.every((key, index) => key === required[index]);
}

function canonicalIpAddress(address: string): string | null {
  const family = isIP(address);
  if (family === 4) {
    const parts = address.split(".");
    if (parts.length !== 4) return null;
    const octets = parts.map((part) => Number(part));
    if (octets.some((octet, index) =>
      !/^(0|[1-9][0-9]{0,2})$/.test(parts[index]!) || octet > 255
    )) return null;
    return octets.join(".");
  }
  if (family === 6) {
    try {
      const hostname = new URL("https://[" + address + "]/").hostname;
      return hostname.startsWith("[") && hostname.endsWith("]")
        ? hostname.slice(1, -1)
        : null;
    } catch {
      return null;
    }
  }
  return null;
}

function policyError(): Error {
  return Object.assign(new Error("PROVIDER_TRUST_REGISTRY_DNS_POLICY_REJECTED"), {
    code: "EAI_AGAIN"
  });
}

/**
 * Create a lookup callback that only resolves one configured hostname and
 * accepts the result only when every returned address is in the owner's exact
 * IP allowlist. It supports both Node lookup callback forms.
 */
export function createOwnerPinnedProviderTrustRegistryLookup(input: {
  readonly endpointHostname: string;
  readonly allowedAddresses: readonly string[];
}): PinnedLookupFunction {
  if (typeof input !== "object" ||
      input === null ||
      typeof input.endpointHostname !== "string" ||
      input.endpointHostname.length === 0 ||
      !Array.isArray(input.allowedAddresses) ||
      input.allowedAddresses.length < 1 ||
      input.allowedAddresses.length > 16) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }

  const endpointHostname = input.endpointHostname.toLowerCase();
  const allowed = new Set<string>();
  for (const address of input.allowedAddresses) {
    if (typeof address !== "string") {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    const canonical = canonicalIpAddress(address);
    if (canonical === null ||
        canonical !== address.toLowerCase() ||
        allowed.has(canonical)) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
    }
    allowed.add(canonical);
  }

  return (hostname, options, callback) => {
    if (typeof callback !== "function" ||
        typeof hostname !== "string" ||
        hostname.toLowerCase() !== endpointHostname) {
      if (typeof callback === "function") callback(policyError(), "", 0);
      return;
    }

    const all = typeof options === "object" && options !== null && options.all === true;
    const family = typeof options === "number"
      ? options
      : (typeof options === "object" && options !== null && options.family !== undefined
        ? options.family
        : 0);
    if (family !== 0 && family !== 4 && family !== 6) {
      callback(policyError(), "", 0);
      return;
    }

    const lookupOptions = family === 0
      ? { all: true as const, verbatim: true as const }
      : { all: true as const, verbatim: true as const, family: family as 4 | 6 };

    systemLookup(hostname, lookupOptions, (error, records) => {
      if (error !== null) {
        callback(policyError(), "", 0);
        return;
      }

      if (!Array.isArray(records) || records.length === 0) {
        callback(policyError(), "", 0);
        return;
      }

      const normalized: LookupAddress[] = [];
      for (const record of records) {
        if (typeof record.address !== "string" ||
            (record.family !== 4 && record.family !== 6) ||
            isIP(record.address) !== record.family) {
          callback(policyError(), "", 0);
          return;
        }
        const address = canonicalIpAddress(record.address);
        if (address === null || !allowed.has(address)) {
          // Reject the whole result rather than silently selecting an allowed subset.
          callback(policyError(), "", 0);
          return;
        }
        normalized.push({ address: record.address, family: record.family });
      }

      if (all) {
        callback(null, normalized);
      } else {
        const first = normalized[0]!;
        callback(null, first.address, first.family);
      }
    });
  };
}

function validateBootstrapConfig(
  value: ProviderTrustRegistryBootstrapConfig
): EnabledProviderTrustRegistryBootstrapConfig {
  if (!isRecord(value) ||
      value.enabled !== true ||
      !hasExactKeys(value, [
        "enabled",
        "endpointUrl",
        "expectedOrigin",
        "endpointHostname",
        "registryId",
        "rootKeyId",
        "rootPublicKeyPem",
        "expectedSpkiSha256",
        "dnsAllowedAddresses"
      ]) ||
      typeof value.endpointUrl !== "string" ||
      typeof value.expectedOrigin !== "string" ||
      typeof value.endpointHostname !== "string" ||
      typeof value.registryId !== "string" ||
      !SAFE_REGISTRY_ID.test(value.registryId) ||
      typeof value.rootKeyId !== "string" ||
      !SAFE_ROOT_KEY_ID.test(value.rootKeyId) ||
      typeof value.rootPublicKeyPem !== "string" ||
      typeof value.expectedSpkiSha256 !== "string" ||
      !SHA256_HEX.test(value.expectedSpkiSha256) ||
      !Array.isArray(value.dnsAllowedAddresses)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(value.endpointUrl);
  } catch {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }
  if (endpoint.protocol !== "https:" ||
      endpoint.href !== value.endpointUrl ||
      endpoint.username !== "" ||
      endpoint.password !== "" ||
      endpoint.hash !== "" ||
      endpoint.hostname !== value.endpointHostname ||
      endpoint.origin !== value.expectedOrigin ||
      canonicalIpAddress(endpoint.hostname.replace(/^\[|\]$/g, "")) !== null) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_TRANSPORT_RESPONSE_INVALID");
  }

  // Reuse the lookup constructor's strict validation for the DNS/IP allowlist.
  createOwnerPinnedProviderTrustRegistryLookup({
    endpointHostname: value.endpointHostname,
    allowedAddresses: value.dnsAllowedAddresses as string[]
  });

  return value as unknown as EnabledProviderTrustRegistryBootstrapConfig;
}

function cloneDecisionEnvelopes(value: unknown): readonly unknown[] {
  if (!Array.isArray(value) || value.length > MAX_DECISION_ENVELOPES) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }
  try {
    const serialized = JSON.stringify(value);
    if (typeof serialized !== "string" ||
        new TextEncoder().encode(serialized).byteLength > MAX_DECISION_ENVELOPES_BYTES) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_RESPONSE_TOO_LARGE");
    }
    const cloned = JSON.parse(serialized) as unknown;
    if (!Array.isArray(cloned)) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
    }
    return Object.freeze(cloned);
  } catch (error) {
    if (error instanceof ProviderTrustRegistryError) throw error;
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }
}

/**
 * Startup composition boundary. When disabled, it returns a permanent
 * default-deny resolver without validating a database client or constructing
 * any network component. When enabled, it validates the pinned Ed25519 root
 * before constructing the transport/store/loader. It does not read the network
 * or database until a matching provider decision is actually resolved.
 */
export async function createProviderTrustRegistryAuthorizationRuntime(input: {
  readonly config: ProviderTrustRegistryBootstrapConfig;
  readonly envelopes: readonly unknown[];
  readonly queryClient?: Pick<PostgresQueryClient, "query">;
}): Promise<ProviderTrustRegistryAuthorizationRuntime> {
  if (!isRecord(input) || !isRecord(input.config)) {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
  }
  if (input.config.enabled === false) {
    if (!hasExactKeys(input.config, ["enabled"])) {
      throw new ProviderTrustRegistryError("TRUST_REGISTRY_SNAPSHOT_INVALID");
    }
    return Object.freeze({
      enabled: false,
      resolveProviderUseDecision: () => undefined
    });
  }

  const config = validateBootstrapConfig(input.config);
  if (!isRecord(input.queryClient) || typeof input.queryClient.query !== "function") {
    throw new ProviderTrustRegistryError("TRUST_REGISTRY_HIGH_WATER_MARK_UNAVAILABLE");
  }

  const envelopes = cloneDecisionEnvelopes(input.envelopes);
  const trustAnchor: ProviderTrustRegistryTrustAnchor = Object.freeze({
    registryId: config.registryId,
    rootKeyId: config.rootKeyId,
    rootPublicKeyPem: config.rootPublicKeyPem,
    expectedSpkiSha256: config.expectedSpkiSha256
  });

  // Cryptographic key-type and independent SPKI fingerprint checks are startup gates.
  // No DNS, HTTPS or SQL operation occurs before this completes.
  await validateProviderTrustRegistryTrustAnchor(trustAnchor);

  const lookup = createOwnerPinnedProviderTrustRegistryLookup({
    endpointHostname: config.endpointHostname,
    allowedAddresses: config.dnsAllowedAddresses
  });
  const transport = new NodeHttpsProviderTrustRegistryTransport({
    endpointUrl: config.endpointUrl,
    lookup
  });
  const authenticator = new Ed25519ProviderTrustSnapshotAuthenticator();
  const highWaterMarkStore = new PostgresProviderTrustRegistryHighWaterMarkStore(
    input.queryClient as Pick<PostgresQueryClient, "query">
  );
  const registry = new AuthenticatedProviderTrustRegistry();

  const resolver: ProviderUseDecisionResolver = async (providerId, purpose, at) => {
    if (typeof providerId !== "string" ||
        !SAFE_PROVIDER_ID.test(providerId) ||
        (purpose !== "DIAGNOSTIC" && purpose !== "PRODUCTION") ||
        typeof at !== "string" ||
        !UTC_TIMESTAMP.test(at) ||
        !Number.isFinite(Date.parse(at))) {
      return undefined;
    }

    const matching = envelopes.filter((candidate) =>
      isRecord(candidate) &&
      isRecord(candidate.decision) &&
      candidate.decision.providerId === providerId &&
      candidate.decision.purpose === purpose
    );
    if (matching.length !== 1) return undefined;

    try {
      const snapshot = await registry.loadCurrentSnapshot({
        now: at,
        expectedOrigin: config.expectedOrigin,
        requestTimeoutMs: PROVIDER_TRUST_REGISTRY_LIMITS.maxRequestTimeoutMs,
        trustAnchor,
        state: {
          expectedRegistryId: config.registryId,
          maxSnapshotAgeMs: PROVIDER_TRUST_REGISTRY_LIMITS.maxAgeMs,
          highWaterMarkStore
        },
        transport,
        authenticator
      });

      const verification = verifySignedProviderUseDecision({
        envelope: matching[0],
        trustedKeys: snapshot.keys,
        providerId,
        purpose,
        at
      });
      return verification.authorized
        ? verification.decision as ProviderUseDecision | null
        : undefined;
    } catch {
      // Registry, TLS, DNS, authentication, freshness, rollback and DB errors all deny.
      return undefined;
    }
  };

  return Object.freeze({
    enabled: true,
    resolveProviderUseDecision: resolver
  });
}
