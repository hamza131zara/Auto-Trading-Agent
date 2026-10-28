# Phase 5.2 — Environments and Configuration Policy

**Status:** Safe base configuration implementation starts in Phase 5; provider/database configuration is deferred until required.

## 1. Environment separation

| Environment | Purpose | Credentials | Trading capability |
|---|---|---|---|
| Local development | Unit tests, synthetic fixtures and UI prototype work | No production secrets; disposable test values only | Disabled |
| CI | Lint/typecheck/build/test/scans on each change | No production keys, wallet credentials or payment secrets | Disabled |
| Staging | Future integration and end-to-end rehearsal | Separate low-privilege staging credentials, only when needed | Disabled; no mainnet orders |
| Production/customer installation | Customer-operated self-hosted deployment | Customer-managed secrets provisioned outside repository | Not implemented/authorized by Phase 5 |

Production and staging must use separate credentials, databases, keys, log destinations and access roles. Never copy production data or secrets into development/CI. If an external provider becomes necessary, use the least-privilege key and account appropriate to its scope.

## 2. Configuration contract

- Parse environment values once at startup into a typed immutable configuration object.
- Validate enumerations, booleans, required-vs-optional values and mutually exclusive options; reject typos instead of silently defaulting.
- Safe defaults: development environment, informational log level, telemetry opt-in off, live-trading request off.
- The Phase 5 foundation rejects LIVE_TRADING_ENABLED=true: no live execution is present or authorized. A later approved phase must replace this guard with an owner-approved multi-factor release gate, not remove the safety check casually.
- Separate non-secret configuration from secret provisioning. Never store a secret value in the public configuration object or log its raw environment value.
- Do not persist API keys in frontend/browser storage, source files, issue comments or session recordings.
- Use .env.example as documentation only; real .env files are ignored. CI must not create a production .env file.

## 3. Secret handling

- Store provider and signing secrets only in the customer-approved secret backend selected by the relevant security decision.
- Redact by allowlist before logging, crash reporting or diagnostic export.
- Tests use clearly fake values and assert no secret material is emitted.
- CI secrets are prohibited for ordinary tests; privileged deployment secrets (if ever introduced) belong only to a separate release environment with approval and protected branch/tag policy.
- If a key or seed is exposed, stop use, revoke/rotate when possible, assess on-chain impact, preserve sanitized evidence and follow the Phase 3 incident runbook. Do not send the secret to support.

## 4. Data and telemetry

The initial scaffold performs no network calls, stores no customer trade history and emits no telemetry. Any later telemetry must be documented, opt-in where appropriate, minimized, revocable and separately reviewed for privacy/security.

## 5. Validation requirements

Tests must reject invalid environment names/log levels/boolean strings; defaults must be safe; requesting live mode must fail; missing optional provider values must not fabricate healthy connection status; and configuration output must never echo secrets. Additional provider-specific configuration belongs to the phase that implements each adapter.
