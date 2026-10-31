# Phase 6.37 — PostgreSQL client TLS policy preflight

## Objective

Define a driver-neutral, offline contract for the PostgreSQL client's TLS security posture before a production driver is selected. The policy requires TLS rather than opportunistic encryption, server certificate-chain validation, server endpoint-name validation against the requested endpoint, a reviewed trust anchor, no plaintext fallback, no invalid-certificate/hostname overrides, and a TLS 1.2-or-newer protocol floor.

This step does not choose a driver, construct a TLS context, read certificate files, resolve DNS, open a socket, inspect a live certificate, connect to PostgreSQL, set runtime environment variables or approve deployment.

## Security basis

PostgreSQL distinguishes encryption from server identity verification. Its libpq `verify-full` mode requires TLS, validates the server certificate chain against a trusted root, and also checks that the requested server hostname matches the certificate identity. `verify-ca` validates the chain but does not provide the hostname check; `require` alone is not a substitute for endpoint identity verification in the production policy.

Official references:
- PostgreSQL 18 libpq SSL support: https://www.postgresql.org/docs/current/libpq-ssl.html
- PostgreSQL connection `sslmode` semantics: https://www.postgresql.org/docs/current/libpq-connect.html
- IETF RFC 8996 (BCP 195), which deprecates TLS 1.0 and TLS 1.1: https://www.rfc-editor.org/rfc/rfc8996

The policy floor is TLS 1.2. TLS 1.3 is accepted when supported by the selected server and driver. Protocol negotiation is not forced to TLS 1.3 by this driver-neutral contract.

## Offline contract

The package export `@ata/market-data/postgres-client-tls-policy` exposes `assessPostgresClientTlsPolicy(input)`. It requires explicit declarations for:

- TLS mode, certificate-chain validation, hostname validation and the requested-endpoint name source.
- Plaintext fallback and invalid-certificate/invalid-hostname override flags.
- Minimum TLS version.
- Reviewed trust-anchor source and safe evidence references for trust and server identity.
- Driver adapter review state and its evidence reference.
- Certificate-expiry monitoring, rotation runbook and alert lead time.
- Isolated handshake-test evidence for trusted certificate acceptance, untrusted CA rejection, hostname mismatch rejection, expired certificate rejection, plaintext endpoint rejection and rejection below the TLS version floor.

Reference values are restricted to evidence identifiers. File paths, URLs, hostnames, private keys, CA bytes, DSNs and credentials are not inputs to the policy evaluator. Extra and missing fields are rejected.

## Result semantics

- `TLS_TRANSPORT_POLICY_BLOCKED_REVIEW_REQUIRED`: TLS is not strictly required, chain/hostname checks are disabled, plaintext fallback or insecure override is allowed, or TLS 1.0/1.1 is selected.
- `TLS_CERTIFICATE_TRUST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED`: a reviewed trust anchor, server identity reference, expiry monitor or rotation runbook is missing/unverified.
- `TLS_HANDSHAKE_TEST_EVIDENCE_INCOMPLETE_REVIEW_REQUIRED`: one or more of the selected driver's positive/negative handshake tests are not evidenced.
- `TLS_DRIVER_ADAPTER_UNREVIEWED_REVIEW_REQUIRED`: the production driver is not selected/reviewed and mapped to this contract.
- `TECHNICAL_TLS_POLICY_CHECKS_PASSED_REVIEW_REQUIRED`: all declarations are internally consistent. This is not proof that the driver applies them or that a live handshake succeeded.

Every result is immutable and permanently leaves production TLS approval, database deployment approval, provider activation and trading authorization false. A supplied `VERIFIED` state is an assertion, not authenticated evidence.

## Required work after driver selection

The owner must select and pin an actual driver and version. The adapter review must map the exact driver's options and defaults to: TLS required, CA-chain verification, endpoint-name verification against the connection's requested endpoint, TLS 1.2 minimum, and no insecure fallback or override. Review the driver's certificate parsing, trust-store semantics, hostname matching, TLS version bounds and connection-pool behavior.

In an isolated test environment, exercise a valid trusted certificate, an untrusted chain, a hostname mismatch, an expired certificate, a plaintext-only endpoint and a server limited below TLS 1.2. Confirm the actual driver fails closed in all negative cases. Review certificate ownership, expiry monitoring, CA rotation overlap and the incident/rollback route. Inspect the effective runtime configuration separately; this offline evaluator cannot inspect it.

## Acceptance and safety boundary

- [x] Add an offline, driver-neutral PostgreSQL TLS policy evaluator.
- [x] Require strict TLS, certificate-chain validation and requested-endpoint hostname validation.
- [x] Block plaintext downgrade, invalid certificate/hostname overrides and TLS 1.0/1.1.
- [x] Require trust-anchor/server-identity references and certificate expiry/rotation evidence.
- [x] Require a driver-specific handshake evidence matrix and an explicit driver adapter review state.
- [x] Reject missing, extra, malformed, path/URL-like and unsafe values.
- [x] Return immutable review-required assessments; production TLS, deployment, provider and trading approvals remain false.
- [ ] Select/pin the production PostgreSQL driver and independently review its effective TLS configuration/defaults.
- [ ] Run the handshake negative-test matrix with the selected driver and approved isolated test certificates.
- [ ] Verify the target CA and endpoint identity evidence, certificate expiry monitoring and rotation runbook with the owner/database operator.

The evaluator is offline and driver-neutral. It does not call a provider or RPC endpoint, make a PostgreSQL connection, access certificate files or secret stores, incur spend, create credentials or mutate deployment configuration. Phase 6 remains ACTIVE.
