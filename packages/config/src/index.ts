export type AppEnvironment = "development" | "test" | "staging" | "production";
export type LogLevel = "debug" | "info" | "warn" | "error";

export interface BaseConfig {
  readonly appEnv: AppEnvironment;
  readonly logLevel: LogLevel;
  readonly telemetryOptIn: boolean;
  readonly liveTradingEnabled: false;
}

const environments = new Set<AppEnvironment>(["development", "test", "staging", "production"]);
const logLevels = new Set<LogLevel>(["debug", "info", "warn", "error"]);

function parseBoolean(name: string, raw: string | undefined, fallback: boolean): boolean {
  if (raw === undefined) return fallback;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new Error(`${name} must be exactly "true" or "false".`);
}

/**
 * Parse only non-secret foundation settings.
 * No provider credentials, wallet values or execution configuration are accepted here.
 */
export function parseBaseConfig(env: Record<string, string | undefined>): BaseConfig {
  const appEnv = env.APP_ENV ?? "development";
  if (!environments.has(appEnv as AppEnvironment)) {
    throw new Error("APP_ENV must be development, test, staging, or production.");
  }

  const logLevel = env.LOG_LEVEL ?? "info";
  if (!logLevels.has(logLevel as LogLevel)) {
    throw new Error("LOG_LEVEL must be debug, info, warn, or error.");
  }

  const telemetryOptIn = parseBoolean("TELEMETRY_OPT_IN", env.TELEMETRY_OPT_IN, false);
  const liveTradingRequested = parseBoolean("LIVE_TRADING_ENABLED", env.LIVE_TRADING_ENABLED, false);
  if (liveTradingRequested) {
    throw new Error("LIVE_TRADING_ENABLED=true is blocked: this foundation has no live execution path and is not authorized to trade.");
  }

  return Object.freeze({
    appEnv: appEnv as AppEnvironment,
    logLevel: logLevel as LogLevel,
    telemetryOptIn,
    liveTradingEnabled: false
  });
}


export interface DisabledProviderTrustRegistryConfig {
  readonly enabled: false;
}

export interface EnabledProviderTrustRegistryConfig {
  readonly enabled: true;
  /** Full owner-pinned HTTPS URL, including its fixed path and optional static query. */
  readonly endpointUrl: string;
  readonly expectedOrigin: string;
  readonly endpointHostname: string;
  readonly registryId: string;
  readonly rootKeyId: string;
  /** Public SPKI PEM only. Private-key PEM is never accepted. */
  readonly rootPublicKeyPem: string;
  readonly expectedSpkiSha256: string;
  /** Exact IP addresses the owner permits the endpoint hostname to resolve to. */
  readonly dnsAllowedAddresses: readonly string[];
}

export type ProviderTrustRegistryConfig =
  | DisabledProviderTrustRegistryConfig
  | EnabledProviderTrustRegistryConfig;

const TRUST_REGISTRY_ENV_KEYS = [
  "ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL",
  "ATA_PROVIDER_TRUST_REGISTRY_REGISTRY_ID",
  "ATA_PROVIDER_TRUST_REGISTRY_ROOT_KEY_ID",
  "ATA_PROVIDER_TRUST_REGISTRY_ROOT_PUBLIC_KEY_PEM",
  "ATA_PROVIDER_TRUST_REGISTRY_ROOT_SPKI_SHA256",
  "ATA_PROVIDER_TRUST_REGISTRY_DNS_ALLOWED_IPS"
] as const;

const SAFE_REGISTRY_ID = /^[a-z0-9][a-z0-9._-]{0,62}$/;
const SAFE_ROOT_KEY_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const SHA256_HEX = /^[a-fA-F0-9]{64}$/;
const MAX_REGISTRY_ENDPOINT_LENGTH = 2_048;
const MAX_ROOT_PUBLIC_KEY_PEM_LENGTH = 4_096;
const MAX_DNS_ALLOWLIST_ENTRIES = 16;

function suppliedValue(env: Record<string, string | undefined>, name: string): string {
  const value = env[name];
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error("Provider trust-registry configuration is incomplete.");
  }
  return value.trim();
}

function canonicalIpv4(value: string): string | null {
  const parts = value.split(".");
  if (parts.length !== 4) return null;
  const octets: number[] = [];
  for (const part of parts) {
    if (!/^(0|[1-9][0-9]{0,2})$/.test(part)) return null;
    const octet = Number(part);
    if (octet > 255) return null;
    octets.push(octet);
  }
  return octets.join(".");
}

function canonicalIpv6(value: string): string | null {
  if (!value.includes(":") || value.includes("%") || value.startsWith("[") || value.endsWith("]")) {
    return null;
  }
  try {
    const host = new URL("https://[" + value + "]/").hostname;
    if (!host.startsWith("[") || !host.endsWith("]")) return null;
    return host.slice(1, -1);
  } catch {
    return null;
  }
}

function canonicalIpAddress(value: string): string | null {
  return canonicalIpv4(value) ?? canonicalIpv6(value);
}

/**
 * Parse the optional online trust-registry bootstrap. Disabled is the default.
 * When enabled, every trust input is mandatory and validated before a runtime
 * can construct a transport or attempt a registry read.
 */
export function parseProviderTrustRegistryConfig(
  env: Record<string, string | undefined>
): ProviderTrustRegistryConfig {
  const enabledRaw = env.ATA_PROVIDER_TRUST_REGISTRY_ENABLED;
  if (enabledRaw !== undefined && enabledRaw !== "true" && enabledRaw !== "false") {
    throw new Error("ATA_PROVIDER_TRUST_REGISTRY_ENABLED must be exactly \"true\" or \"false\".");
  }

  const enabled = enabledRaw === "true";
  if (!enabled) {
    const strayConfiguration = TRUST_REGISTRY_ENV_KEYS.some((name) =>
      typeof env[name] === "string" && env[name]!.trim().length > 0
    );
    if (strayConfiguration) {
      throw new Error("Provider trust-registry values are present while the feature is disabled.");
    }
    return Object.freeze({ enabled: false });
  }

  const endpointUrl = suppliedValue(env, "ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL");
  if (endpointUrl.length > MAX_REGISTRY_ENDPOINT_LENGTH) {
    throw new Error("Provider trust-registry endpoint configuration is invalid.");
  }

  let endpoint: URL;
  try {
    endpoint = new URL(endpointUrl);
  } catch {
    throw new Error("Provider trust-registry endpoint configuration is invalid.");
  }
  const endpointHost = endpoint.hostname.startsWith("[")
    ? endpoint.hostname.slice(1, -1)
    : endpoint.hostname;
  if (endpoint.protocol !== "https:" ||
      endpoint.href !== endpointUrl ||
      endpoint.username !== "" ||
      endpoint.password !== "" ||
      endpoint.hash !== "" ||
      endpoint.hostname.length === 0 ||
      canonicalIpAddress(endpointHost) !== null) {
    throw new Error("Provider trust-registry endpoint must be a canonical HTTPS URL with a DNS hostname.");
  }

  const registryId = suppliedValue(env, "ATA_PROVIDER_TRUST_REGISTRY_REGISTRY_ID");
  if (!SAFE_REGISTRY_ID.test(registryId)) {
    throw new Error("Provider trust-registry identity configuration is invalid.");
  }

  const rootKeyId = suppliedValue(env, "ATA_PROVIDER_TRUST_REGISTRY_ROOT_KEY_ID");
  if (!SAFE_ROOT_KEY_ID.test(rootKeyId)) {
    throw new Error("Provider trust-registry identity configuration is invalid.");
  }

  const rootPublicKeyPem = suppliedValue(env, "ATA_PROVIDER_TRUST_REGISTRY_ROOT_PUBLIC_KEY_PEM");
  const begin = "-----BEGIN PUBLIC KEY-----";
  const end = "-----END PUBLIC KEY-----";
  if (rootPublicKeyPem.length > MAX_ROOT_PUBLIC_KEY_PEM_LENGTH ||
      !rootPublicKeyPem.startsWith(begin) ||
      rootPublicKeyPem.indexOf(begin, begin.length) !== -1 ||
      rootPublicKeyPem.indexOf(end) <= begin.length ||
      rootPublicKeyPem.indexOf(end) !== rootPublicKeyPem.lastIndexOf(end) ||
      rootPublicKeyPem.slice(rootPublicKeyPem.indexOf(end) + end.length).trim().length !== 0 ||
      rootPublicKeyPem.includes("PRIVATE KEY")) {
    throw new Error("Provider trust-registry public root-key configuration is invalid.");
  }

  const expectedSpkiSha256 = suppliedValue(env, "ATA_PROVIDER_TRUST_REGISTRY_ROOT_SPKI_SHA256");
  if (!SHA256_HEX.test(expectedSpkiSha256)) {
    throw new Error("Provider trust-registry root fingerprint configuration is invalid.");
  }

  const rawAddresses = suppliedValue(env, "ATA_PROVIDER_TRUST_REGISTRY_DNS_ALLOWED_IPS");
  if (rawAddresses.length > 1_024) {
    throw new Error("Provider trust-registry DNS allowlist configuration is invalid.");
  }
  const dnsAllowedAddresses = rawAddresses.split(",").map((entry) => {
    const raw = entry.trim();
    const canonical = canonicalIpAddress(raw);
    if (raw.length === 0 || canonical === null || raw.toLowerCase() !== canonical) {
      throw new Error("Provider trust-registry DNS allowlist must contain canonical IP addresses.");
    }
    return canonical;
  });
  if (dnsAllowedAddresses.length < 1 ||
      dnsAllowedAddresses.length > MAX_DNS_ALLOWLIST_ENTRIES ||
      new Set(dnsAllowedAddresses).size !== dnsAllowedAddresses.length) {
    throw new Error("Provider trust-registry DNS allowlist configuration is invalid.");
  }

  return Object.freeze({
    enabled: true,
    endpointUrl,
    expectedOrigin: endpoint.origin,
    endpointHostname: endpoint.hostname,
    registryId,
    rootKeyId,
    rootPublicKeyPem,
    expectedSpkiSha256: expectedSpkiSha256.toLowerCase(),
    dnsAllowedAddresses: Object.freeze(dnsAllowedAddresses)
  });
}
