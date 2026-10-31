# Phase 6.42 — PostgreSQL adapter lifecycle verification

## Scope

This milestone adds an integration-level check for the production `PostgresPgPoolAdapter` shutdown contract. It extends the existing disposable PostgreSQL TLS workflow and does not change the frozen roadmap or authorize a production deployment.

## Required behavior under test

- Calling `close()` immediately transitions the adapter into its closing state.
- New `connect()` calls are rejected with the stable `POOL_CLOSING` code once shutdown begins.
- A client already checked out before shutdown remains usable/owned by its caller; shutdown waits for its release rather than forcibly terminating in-flight work.
- Repeated `close()` calls return the same drain promise.
- The drain resolves after the checked-out client is released and the underlying pool ends.

The test uses only the workflow's disposable PostgreSQL TLS fixture, the pinned production adapter, and synthetic credentials/certificates. It does not use production endpoints, certificates, credentials, or data.

## Verification

The test is part of `test/postgres-tls-policy.pg.integration.test.mjs`, which is run by `.github/workflows/phase6-postgres-integration.yml` after building the workspace. The dedicated workflow must pass before this milestone is considered verified.

## Security and authorization boundary

This is test-only lifecycle verification. It does not deploy or connect to a hosted database, activate a market-data provider, access or sign with a wallet, place orders, or authorize trading.

Status: **IMPLEMENTED — CI VERIFICATION PENDING**.
