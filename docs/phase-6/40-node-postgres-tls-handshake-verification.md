# Phase 6.40 — node-postgres TLS handshake verification experiment

## Purpose and decision status

Exercise the transient test-only \`pg@8.23.1\` client against disposable PostgreSQL 18.6 servers with short-lived CI-generated certificate fixtures. This is a test experiment only; the owner has not selected the production driver, production database, CA, endpoint identity, certificate lifecycle or runtime policy.

No production code, app dependency, committed lockfile, production DSN, certificate, credential, wallet, provider key or hosted database is introduced. Private test keys are generated at runtime, mounted only into disposable local containers and removed by the workflow cleanup step.

## Test topology

The workflow creates a temporary private root CA and a separate rogue root CA. It issues one valid server certificate for the DNS name \`pg-tls.test\` and a second certificate signed by the trusted CA whose validity interval expired in 2020. A third TLS server uses the valid certificate but is restricted to TLS 1.2. A fourth PostgreSQL instance has TLS disabled.

All PostgreSQL ports are published on loopback only. The client runs on the same GitHub Actions runner and uses an explicit \`ssl\` config object with \`rejectUnauthorized: true\`, the generated CA, \`servername: pg-tls.test\` and \`minVersion: TLSv1.2\`. It does not pass \`sslmode\`, \`sslrootcert\`, \`sslcert\` or \`sslkey\` in a connection string; the test uses individual host/port/database fields to ensure the driver does not replace the explicit TLS object during URL parsing.

## Actual assertions

1. The exact installed driver version is \`pg@8.23.1\`.
2. A valid chain for the requested \`pg-tls.test\` endpoint is accepted; PostgreSQL \`pg_stat_ssl\` confirms an encrypted session and negotiated TLS 1.2 or 1.3.
3. A certificate chain signed by the rogue CA is rejected.
4. A valid certificate presented for an alternate DNS alias not present in its SAN is rejected for hostname mismatch.
5. A CA-signed but expired certificate is rejected.
6. A TLS-required client rejects the PostgreSQL endpoint with server-side TLS disabled; it must not fall back to plaintext.
7. A client explicitly configured for a TLS 1.3 minimum rejects a server that supports only TLS 1.2, proving the driver's TLS minimum option affects negotiation. The regular positive case separately proves that the policy floor TLS 1.2 succeeds against a TLS 1.2+ server.

The tests do not implement mutual TLS/client-certificate authentication and do not test production CA rotation, hosted-provider trust stores, DNS/SNI infrastructure or production certificate monitoring.

## Implementation notes

- The node-postgres SSL guide states that the \`ssl\` config object is passed to Node's TLS socket and warns that \`sslmode\`, \`sslrootcert\`, \`sslcert\` or \`sslkey\` URL parameters replace the explicit \`ssl\` object: https://node-postgres.com/features/ssl
- Node TLS uses the supplied CA list for certificate-chain trust and endpoint identity checks as part of TLS peer verification: https://nodejs.org/api/tls.html
- PostgreSQL 18 documents strict \`verify-full\` behavior as requiring TLS, validating the certificate chain and matching the requested hostname: https://www.postgresql.org/docs/18/libpq-ssl.html

## Acceptance and safety boundary

- [x] Add CI-generated disposable CA, rogue CA, valid, expired and TLS-version-restricted server fixtures.
- [x] Require the exact test-only \`pg@8.23.1\` package version at runtime.
- [x] Test trusted CA acceptance and confirm the resulting PostgreSQL session is encrypted.
- [x] Test untrusted CA, hostname mismatch, expired certificate, TLS-disabled endpoint and protocol-version rejection.
- [x] Keep all listeners loopback-only and clean up containers and temporary certificates after the job.
- [ ] Select/pin the production PostgreSQL driver and approve the actual production CA, hostname/SNI and certificate-rotation sources.
- [ ] Repeat the matrix with the owner-selected production driver and target environment's real certificate chain and endpoint identity.
- [ ] Verify certificate expiry monitoring/rotation, effective runtime configuration, production database deployment and separate operational approvals.

A passing CI run proves only that the exact test-only package and generated test certificates behave as asserted against the disposable PostgreSQL 18.6 fixtures. It does not constitute production driver selection, TLS approval, deployment approval, provider activation or trading authorization. Phase 6 remains ACTIVE.
