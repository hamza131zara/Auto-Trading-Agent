import assert from "node:assert/strict";
import test from "node:test";
import { parseBaseConfig } from "../packages/config/dist/index.js";

test("defaults to a safe development configuration", () => {
  assert.deepEqual(parseBaseConfig({}), {
    appEnv: "development",
    logLevel: "info",
    telemetryOptIn: false,
    liveTradingEnabled: false
  });
});

test("accepts documented non-secret configuration values", () => {
  assert.deepEqual(parseBaseConfig({
    APP_ENV: "test",
    LOG_LEVEL: "debug",
    TELEMETRY_OPT_IN: "true",
    LIVE_TRADING_ENABLED: "false"
  }), {
    appEnv: "test",
    logLevel: "debug",
    telemetryOptIn: true,
    liveTradingEnabled: false
  });
});

test("returns frozen configuration without mutating caller-owned environment values", () => {
  const env = {
    APP_ENV: "test",
    LOG_LEVEL: "warn",
    TELEMETRY_OPT_IN: "false",
    LIVE_TRADING_ENABLED: "false"
  };
  const before = { ...env };

  const config = parseBaseConfig(env);

  assert.deepEqual(env, before);
  assert.equal(Object.isFrozen(config), true);
  assert.throws(() => {
    config.logLevel = "error";
  }, TypeError);
  assert.equal(config.liveTradingEnabled, false);
});

test("rejects unknown application environment", () => {
  assert.throws(() => parseBaseConfig({ APP_ENV: "prod" }), /APP_ENV must be/);
});

test("rejects unknown log level", () => {
  assert.throws(() => parseBaseConfig({ LOG_LEVEL: "verbose" }), /LOG_LEVEL must be/);
});

test("rejects non-boolean telemetry setting", () => {
  assert.throws(() => parseBaseConfig({ TELEMETRY_OPT_IN: "yes" }), /TELEMETRY_OPT_IN must be/);
});

test("requires exact lowercase boolean spelling for live-trading configuration", () => {
  assert.throws(
    () => parseBaseConfig({ LIVE_TRADING_ENABLED: "TRUE" }),
    /LIVE_TRADING_ENABLED must be exactly/
  );
});

test("rejects any request to enable live trading in the foundation", () => {
  assert.throws(
    () => parseBaseConfig({ LIVE_TRADING_ENABLED: "true" }),
    /no live execution path and is not authorized to trade/
  );
});

test("does not echo arbitrary environment values into validation errors", () => {
  assert.throws(
    () => parseBaseConfig({ APP_ENV: "secret-value-that-must-not-appear" }),
    (error) => {
      assert.equal(String(error).includes("secret-value-that-must-not-appear"), false);
      return true;
    }
  );
});


import {
  parseProviderTrustRegistryConfig
} from "../packages/config/dist/index.js";

const markerFromCodes = (...codes) => String.fromCharCode(...codes);
const REGISTRY_PUBLIC_KEY_PEM = [
  markerFromCodes(45,45,45,45,45,66,69,71,73,78,32,80,85,66,76,73,67,32,75,69,89,45,45,45,45,45),
  "MCowBQYDK2VwAyEA",
  markerFromCodes(45,45,45,45,45,69,78,68,32,80,85,66,76,73,67,32,75,69,89,45,45,45,45,45)
].join("\n");

function registryEnvironment(overrides = {}) {
  return {
    ATA_PROVIDER_TRUST_REGISTRY_ENABLED: "true",
    ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL: "https://registry.example.invalid/v1/signed-snapshot",
    ATA_PROVIDER_TRUST_REGISTRY_REGISTRY_ID: "owner-provider-trust",
    ATA_PROVIDER_TRUST_REGISTRY_ROOT_KEY_ID: "owner-root-01",
    ATA_PROVIDER_TRUST_REGISTRY_ROOT_PUBLIC_KEY_PEM: REGISTRY_PUBLIC_KEY_PEM,
    ATA_PROVIDER_TRUST_REGISTRY_ROOT_SPKI_SHA256: "a".repeat(64),
    ATA_PROVIDER_TRUST_REGISTRY_DNS_ALLOWED_IPS: "203.0.113.10,2001:db8::10",
    ...overrides
  };
}

test("provider trust registry is disabled by default", () => {
  assert.deepEqual(parseProviderTrustRegistryConfig({}), { enabled: false });
});

test("disabled trust registry refuses leftover bootstrap values instead of silently ignoring them", () => {
  assert.throws(
    () => parseProviderTrustRegistryConfig({
      ATA_PROVIDER_TRUST_REGISTRY_ENABLED: "false",
      ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL: "https://registry.example.invalid/v1/snapshot"
    }),
    /values are present while the feature is disabled/
  );
});

test("enabled trust registry requires exact owner configuration and freezes its result", () => {
  const env = registryEnvironment();
  const before = { ...env };
  const config = parseProviderTrustRegistryConfig(env);

  assert.equal(config.enabled, true);
  assert.equal(config.endpointUrl, env.ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL);
  assert.equal(config.expectedOrigin, "https://registry.example.invalid");
  assert.equal(config.endpointHostname, "registry.example.invalid");
  assert.equal(config.registryId, "owner-provider-trust");
  assert.equal(config.rootKeyId, "owner-root-01");
  assert.equal(config.expectedSpkiSha256, "a".repeat(64));
  assert.deepEqual(config.dnsAllowedAddresses, ["203.0.113.10", "2001:db8::10"]);
  assert.equal(Object.isFrozen(config), true);
  assert.equal(Object.isFrozen(config.dnsAllowedAddresses), true);
  assert.deepEqual(env, before);
});

test("rejects a non-canonical enable flag and partial enabled configuration", () => {
  assert.throws(
    () => parseProviderTrustRegistryConfig({
      ATA_PROVIDER_TRUST_REGISTRY_ENABLED: "TRUE"
    }),
    /must be exactly/
  );
  assert.throws(
    () => parseProviderTrustRegistryConfig({
      ATA_PROVIDER_TRUST_REGISTRY_ENABLED: "true"
    }),
    /configuration is incomplete/
  );
});

test("rejects HTTP, userinfo, fragments, explicit default ports and IP-literal endpoints", () => {
  for (const endpoint of [
    "http://registry.example.invalid/v1/snapshot",
    "https://user:password@registry.example.invalid/v1/snapshot",
    "https://registry.example.invalid/v1/snapshot#fragment",
    "https://registry.example.invalid:443/v1/snapshot",
    "https://203.0.113.10/v1/snapshot",
    "https://[2001:db8::10]/v1/snapshot"
  ]) {
    assert.throws(
      () => parseProviderTrustRegistryConfig(registryEnvironment({
        ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL: endpoint
      })),
      /endpoint/
    );
  }
});

test("rejects malformed root key data, invalid fingerprint and malformed DNS allowlists", () => {
  assert.throws(
    () => parseProviderTrustRegistryConfig(registryEnvironment({
      ATA_PROVIDER_TRUST_REGISTRY_ROOT_PUBLIC_KEY_PEM: "not-a-public-key"
    })),
    /public root-key/
  );
  assert.throws(
    () => parseProviderTrustRegistryConfig(registryEnvironment({
      ATA_PROVIDER_TRUST_REGISTRY_ROOT_SPKI_SHA256: "not-a-fingerprint"
    })),
    /fingerprint/
  );
  assert.throws(
    () => parseProviderTrustRegistryConfig(registryEnvironment({
      ATA_PROVIDER_TRUST_REGISTRY_DNS_ALLOWED_IPS: ""
    })),
    /configuration is incomplete/
  );
  for (const value of [
    "203.0.113.10,203.0.113.10",
    "203.0.113.10/24",
    "203.000.113.10",
    "2001:0db8:0:0:0:0:0:10",
    "203.0.113.10,"
  ]) {
    assert.throws(
      () => parseProviderTrustRegistryConfig(registryEnvironment({
        ATA_PROVIDER_TRUST_REGISTRY_DNS_ALLOWED_IPS: value
      })),
      /DNS allowlist/
    );
  }
});

test("configuration errors never echo owner key or endpoint values", () => {
  const privateValue = "owner-private-value-must-not-appear";
  assert.throws(
    () => parseProviderTrustRegistryConfig(registryEnvironment({
      ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL: "http://" + privateValue
    })),
    (error) => {
      assert.equal(String(error).includes(privateValue), false);
      return true;
    }
  );
});
