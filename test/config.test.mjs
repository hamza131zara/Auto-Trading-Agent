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

test("rejects unknown application environment", () => {
  assert.throws(() => parseBaseConfig({ APP_ENV: "prod" }), /APP_ENV must be/);
});

test("rejects unknown log level", () => {
  assert.throws(() => parseBaseConfig({ LOG_LEVEL: "verbose" }), /LOG_LEVEL must be/);
});

test("rejects non-boolean telemetry setting", () => {
  assert.throws(() => parseBaseConfig({ TELEMETRY_OPT_IN: "yes" }), /TELEMETRY_OPT_IN must be/);
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
