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
