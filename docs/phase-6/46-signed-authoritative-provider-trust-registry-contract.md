# Phase 6.46 — Signed authoritative provider trust-registry contract

## Status and boundary

**Phase 6.46 Steps 1–7 are implemented and verified on this branch.** The trust registry remains disabled by default; no production endpoint, DNS allowlist, root key or credentials are selected.

The existing `ata.provider-use-decision.v1` Ed25519 envelope and canonical signing payload are unchanged. The registry snapshot authenticates the complete provider-decision signing-key/revocation set; it does not replace or sign individual provider-use decisions.

## Trust hierarchy

The registry cannot establish its own trust. The consumer receives all of the following through an independently controlled deployment channel:

- Stable expected `registryId`.
- Pinned `rootKeyId`.
- Ed25519 root public key in SPKI PEM form.
- Independently recorded SHA-256 fingerprint of the DER SPKI bytes.

The root key and fingerprint must not be accepted from the registry response, provider decision envelope, or an unauthenticated URL/config response. The root key must parse as Ed25519 and its computed SPKI fingerprint must match the pinned fingerprint before signature verification.

The hierarchy is:

1. **Deployment trust anchor:** owner-controlled registry identity, root key ID, Ed25519 public key and SPKI SHA-256 fingerprint.
2. **Signed registry snapshot:** root-signed, versioned, bounded complete replacement set of trusted provider-decision signing keys and revocation states.
3. **Provider-use decision:** existing owner-signed `ata.provider-use-decision.v1` envelope checked against exactly one eligible key in the authenticated snapshot.
4. **Provider request:** allowed only after snapshot authentication, freshness, rollback protection, key validity/revocation/scope, decision signature, decision scope and decision expiry all pass.

A registry signature proves only that the pinned registry root signed the snapshot. It does not prove legal evidence correctness, source independence, market data freshness or provider commercial rights.

## Exact snapshot wire contract

The wire envelope has exactly these top-level fields, matching `ProviderTrustRegistrySnapshotEnvelope` in `packages/market-data/src/provider-trust-registry.ts`:

| Field | Contract |
|---|---|
| `schemaVersion` | Exact literal `ata.provider-trust-registry-snapshot.v1` |
| `registryId` | Stable owner-assigned identifier; not a URL |
| `rootKeyId` | Exact ID of the deployment-pinned registry root |
| `algorithm` | Exact literal `Ed25519` |
| `version` | Positive JavaScript safe integer, strictly monotonic per registry and no greater than `Number.MAX_SAFE_INTEGER` |
| `issuedAt` | UTC publication timestamp covered by the signature |
| `expiresAt` | UTC expiry timestamp, strictly later than `issuedAt` and the verification time |
| `keys` | Ordered complete array of at most 64 trusted provider-decision signing-key records |
| `signature` | Canonical unpadded base64url encoding of a 64-byte Ed25519 signature |

The snapshot payload excludes only `signature`. The root signs the UTF-8 bytes of the exact domain-separated JSON returned by `getProviderTrustRegistrySigningPayload`. Its first-level property order is fixed:

1. `domain` = `ata.provider-trust-registry.snapshot.signature.v1`
2. `schemaVersion`
3. `registryId`
4. `rootKeyId`
5. `algorithm`
6. `version`
7. `issuedAt`
8. `expiresAt`
9. `keys`

Each key record is serialized in the fixed order `keyId`, `owner`, `publicKeyPem`, `notBefore`, `expiresAt`, `revokedAt`, `allowedProviderIds`, `allowedPurposes`. Array order is significant and is covered by the signature. Extra/missing fields, duplicate key IDs, malformed scope arrays and invalid version/time values are rejected by the canonical payload builder or verifier. No field may be silently omitted, normalized, or reconstructed from a second source.

The `keys` set uses the existing `TrustedProviderDecisionSigningKey` shape. It contains only public key material and policy metadata; no private signing keys. A snapshot is a **complete replacement set**, not a delta. A key omitted from a newer accepted set is no longer trusted. Explicit `revokedAt` remains valuable audit evidence, but omitted, revoked, expired or out-of-scope keys must never be retained as fallback.

## Resource and freshness limits

The contract constants in `PROVIDER_TRUST_REGISTRY_LIMITS` are normative:

- Maximum raw snapshot body: **49,152 bytes (48 KiB)**, enforced while streaming and before JSON parsing.
- Maximum key records: **64**.
- Maximum snapshot age: **300,000 ms (five minutes)**.
- Maximum retrieval timeout: **5,000 ms**.

The authenticated `issuedAt` must not be in the future, `expiresAt` must be later than current verification time, and `now - issuedAt` must not exceed the configured age bound. The bound must be a positive integer no greater than 300,000 ms. Retrieval time is metadata and never substitutes for signed `issuedAt`.

## Verification and failure behavior

Fail closed on any of the following:

- Missing/malformed trust anchor, non-Ed25519 root, root-key ID mismatch or SPKI fingerprint mismatch.
- Unknown schema, extra/missing fields, malformed identifiers/timestamps, duplicate key IDs, malformed key records or invalid signature encoding.
- Invalid root signature or snapshot signed by a root key other than the independently pinned root.
- Future-issued, expired or stale snapshot.
- Snapshot body above 48 KiB or key count above 64.
- Lower snapshot version than the durable high-water mark.
- Same version with a different canonical payload SHA-256 digest (equivocation).
- Registry timeout, cancellation, redirect, HTTP downgrade, non-success response, invalid content type, malformed UTF-8/JSON or loader failure.
- Missing, corrupt or unavailable anti-rollback state.
- Any required decision key missing, duplicated, expired, not-yet-valid, revoked or outside provider/purpose scope.

Errors and logs expose stable sanitized reason codes only. Never include response bodies, authorization headers, credentials, private keys or secret-bearing URLs.

## Durable anti-rollback and concurrency

The verifier must not claim rollback resistance from process memory alone. The caller supplies a durable per-`registryId` high-water record containing the last accepted `version` and canonical unsigned-payload SHA-256 digest.

After cryptographic, schema, freshness and key-set checks pass, the caller atomically advances the high-water mark **before** exposing any keys to provider authorization. The `ProviderTrustRegistryHighWaterMarkStore.compareAndSet` contract must provide transactional compare-and-swap semantics across workers and process restarts.

- Lower version: reject as rollback.
- Same version, same digest: allow replay only while the snapshot remains within its validity window.
- Same version, different digest: reject as equivocation.
- Higher version: accept only after successful atomic compare-and-swap from the exact record previously read; a conflict must cause re-read/revalidation or denial, never acceptance based on stale state.
- Missing/corrupt/unavailable high-water state: deny.
- Backup restoration must not silently lower the mark. Production recovery needs a separately protected recovery/fencing procedure.

At Step 1, only the interface was defined; the durable adapter is implemented in Step 3 below.

## Step 3 — durable anti-rollback state and transactional CAS

The PostgreSQL implementation is in `packages/market-data/src/provider-trust-registry-postgres-store.ts`:

- Migration `infra/migrations/20261031_phase6_provider_trust_registry_high_water_marks.sql` creates one row per registry ID containing the highest accepted positive version, canonical unsigned-payload SHA-256 digest, and database timestamp.
- The database constrains registry ID format, lowercase SHA-256 digest format, positive versions, and the JavaScript safe-integer maximum.
- Reads return a validated record or `null`; malformed persisted state and database failures are distinct sanitized fail-closed errors.
- Compare-and-set is a single SQL statement. Initial state uses `INSERT ... ON CONFLICT DO NOTHING`; subsequent advances use `UPDATE ... WHERE registry_id, expected version, and expected digest all match`. A stale/concurrent writer receives `false`.
- `advanceProviderTrustRegistryHighWaterMark` revalidates snapshot shape, canonical payload digest, freshness and expiry; reads durable state; denies rollback/equivocation; permits same-version/same-digest replay only while still fresh; and returns the immutable snapshot only after a successful CAS or valid replay.
- Store outages, invalid durable rows and CAS conflicts deny. No process-local cache or stale key fallback exists.
- The migration is inventory-pinned in `infra/migrations/manifest.json`. It defines data only; no database was connected or modified and no runtime roles/permissions were provisioned by this code change.

The PostgreSQL integration tests exercise idempotent schema creation, persistence across new store instances, concurrent independent workers racing from the same expected row, same-version replay/equivocation, rollback denial, monotonic advancement, corrupted rows and database failure. The package-level unit tests additionally cover unavailable stores and CAS conflicts. The adapter is not wired to an external transport or provider request; the future loader must call the anti-rollback gate before exposing keys.



## Loader boundary

The protocol remains separated from transport. Step 4 adds `AuthenticatedProviderTrustRegistry` in `packages/market-data/src/provider-trust-registry-loader.ts`. It orchestrates one injected transport read, the existing Ed25519 authenticator, and the durable high-water mark gate. It requires an explicit canonical HTTPS origin from the owner and validates response status, content type, final origin, redirect metadata and byte length before authenticating. It creates a bounded cancellation signal, sanitizes transport errors and does not return keys until the high-water mark operation succeeds.

The concrete transport implementation is `NodeHttpsProviderTrustRegistryTransport` in `packages/market-data/src/provider-trust-registry-https-transport.ts`. It remains inert until an application constructs it with an owner-approved endpoint and lookup policy, then injects it into the loader. It:

- Requires one canonical absolute HTTPS endpoint URL at construction and requires its origin to exactly match the separately supplied loader origin on every read. The endpoint has no userinfo or fragment; its path and query are fixed at construction.
- Uses Node's direct `node:https` client with a dedicated non-keepalive agent, not the global Fetch dispatcher or a proxy agent. It does not consult ambient proxy configuration.
- Requires an explicit owner-supplied DNS lookup callback. There is no fallback to Node's ambient lookup. The supplied callback must enforce the deployment's approved hostname-to-address policy; TLS SNI and certificate hostname verification continue to use the configured endpoint hostname.
- Enables normal certificate-chain verification (`rejectUnauthorized: true`), hostname verification, and a TLS 1.2 minimum. It does not install a custom CA, disable verification, retry another host, or follow redirects. A 3xx is returned to the loader as a non-success status and is rejected there.
- Sends only a GET with `Accept: application/json` and `Accept-Encoding: identity`. Any non-identity content encoding is rejected, so streamed received bytes are also decoded bytes and compression expansion cannot bypass the 48 KiB limit.
- Counts streamed body bytes before concatenating them, checks a valid Content-Length early when supplied, and destroys the response/request on overflow. It applies the caller's AbortSignal and a socket inactivity timeout bounded by the five-second protocol maximum; the loader independently enforces its overall request timeout.
- Returns observed status, content type, configured final origin, redirect=false (Node does not follow redirects), and the bounded exact bytes. The loader independently validates that metadata, authenticates the bytes and advances the durable high-water mark before returning keys.

The owner must still provision the exact endpoint URL, approved origin, DNS/IP lookup policy, trust-anchor public key/fingerprint and a registry publication process through a separately controlled deployment channel. No vendor, live URL, credentials, private key, production root key, resolver implementation or endpoint is selected in this step. The optional request-function injection exists only as a unit-test seam and is not needed by production callers. No live network request is made by the test suite.

## Step 4 — authenticated loader orchestration

The transport-independent implementation is in `packages/market-data/src/provider-trust-registry-loader.ts` and is exported from the market-data package.

- Requires a caller-supplied canonical HTTPS origin. Rejects HTTP, non-canonical origins, userinfo, paths, query strings and fragments. No default origin or endpoint path exists.
- Sends the origin, 5-second maximum timeout, 48 KiB response bound, `redirect: "error"`, `application/json` requirement and an abort signal to the injected transport.
- Bounds the request with a local timeout and aborts the signal on expiry. Transport exceptions are mapped to a stable sanitized unavailable code.
- Requires a response with exactly the status, content-type, final-origin, redirect and byte fields. Accepts only HTTP 200, JSON with optional UTF-8 charset, the exact expected origin, no redirect, and a bounded `Uint8Array`.
- Copies response bytes before handing them to the authenticator, then uses the actual retrieval timestamp for authentication and freshness.
- Passes the authenticated snapshot to `advanceProviderTrustRegistryHighWaterMark`; only the immutable value returned by that gate is exposed to the caller.
- Authentication failure prevents any high-water store read; a storage outage or CAS conflict prevents snapshot/key return. There is no stale-key fallback or process-local trust cache.

The loader is intentionally not a concrete HTTP implementation. The injected transport must use a fixed owner-approved endpoint path, preserve certificate-chain and hostname verification, reject redirects, avoid ambient proxy/DNS/host discovery behavior, enforce the 48 KiB decoded-body limit while streaming (including compressed expansion), and report truthful response metadata. The actual TLS/HTTP behavior must be independently tested when the owner selects an endpoint and adapter. This step does not make a live network request.

## Step 5 — owner-configured direct HTTPS transport

The reusable adapter is exported as `NodeHttpsProviderTrustRegistryTransport` and from the package subpath `@ata/market-data/provider-trust-registry-https-transport`. Its constructor requires:

- `endpointUrl`: one canonical absolute HTTPS URL including the owner-selected fixed path and optional static query. It rejects HTTP, userinfo, fragments, non-canonical URLs and overlong input.
- `lookup`: a mandatory owner-supplied Node DNS lookup function. This allows deployment configuration to enforce the approved hostname-to-address policy explicitly; the adapter never falls back to ambient Node lookup.

For each loader request, the adapter requires a canonical matching `expectedOrigin`, redirect mode `error`, JSON accept type, a valid AbortSignal, a timeout no greater than 5,000 ms and a response bound no greater than 49,152 bytes. The request uses the fixed configured URL and makes one GET. It does not read a host, path, credential, redirect target or retry destination from response data.

TLS uses a dedicated HTTPS Agent with certificate-chain and hostname verification enabled, explicit SNI for the configured hostname and a TLS 1.2 minimum. There is no proxy agent, ambient fetch dispatcher, custom CA override or insecure TLS switch. The owner-provided lookup callback is a security-sensitive deployment dependency and must enforce the approved address policy; the adapter cannot infer or approve that policy on the owner's behalf.

The adapter requests identity encoding and rejects any non-identity Content-Encoding rather than decompressing untrusted content. It validates Content-Length when present and independently counts every streamed body chunk before buffering; a body above the configured maximum is destroyed immediately with `TRUST_REGISTRY_RESPONSE_TOO_LARGE`. Transport failures are mapped to sanitized stable errors. The loader preserves the transport's size/metadata failure codes and still performs its own response validation, Ed25519 authentication and durable anti-rollback gate.

Adversarial tests in `test/provider-trust-registry-https-transport.test.mjs` use an in-process injected request seam and local byte streams only. They cover fixed-origin enforcement, required DNS lookup injection, TLS request options, no redirect following, JSON/content-encoding handling, exact 48 KiB acceptance, streamed overflow and Content-Length rejection, cancellation/timeout and sanitized socket failures. They do not contact an external endpoint.

This completes the generic transport implementation only. It does not mean a production registry endpoint, DNS resolver policy, root key, provider vendor or registry hosting service has been approved or configured. Production use remains unavailable until those owner-controlled values are separately provisioned and reviewed.

## Step 6 — real local HTTPS/TLS verification

The production transport is now exercised without its injected request-function test seam by `test/provider-trust-registry-https-transport.tls.integration.test.mjs`. The test starts actual Node HTTPS servers bound only to `127.0.0.1`, uses the adapter's default `node:https` requester and an explicit test-only lookup callback, and never contacts an external or production endpoint.

The existing disposable certificate-fixture script additionally creates a rogue CA and a separate leaf certificate with the correct `pg-tls.test` DNS SAN but a chain that is not trusted. The dedicated PostgreSQL TLS CI job sets `NODE_EXTRA_CA_CERTS` to the disposable trusted root before Node starts, then runs this transport suite alongside the existing PostgreSQL TLS handshake tests. The fixture directory and private test keys are removed by the job's existing always-run cleanup step.

The real-handshake matrix verifies:

- A leaf signed by the trusted disposable CA and matching the URL hostname completes the TLS handshake and returns the exact response bytes.
- A CA-trusted leaf presented through a different URL hostname is rejected before the HTTP handler runs; hostname verification is not bypassed by the owner-supplied loopback lookup.
- A leaf with a matching DNS SAN but signed by the rogue CA is rejected before the HTTP handler runs.
- A 302 response is returned as non-success metadata; the adapter does not resolve or contact the redirect target.
- A server that accepts the connection but stalls without response bytes is stopped by the request inactivity timeout.
- An AbortSignal cancels an in-flight TLS request and returns only the sanitized `TRUST_REGISTRY_UNAVAILABLE` reason.

All certificates, keys, HTTP listeners and DNS mappings are disposable test fixtures. The test does not add a CA to production configuration, does not weaken certificate verification, and does not select a registry endpoint or resolver policy. Production DNS/origin/trust-anchor provisioning remains an owner decision. This test step verifies the generic transport's TLS behavior; it does not activate the trust registry or any provider.

## Step 7 — disabled-by-default startup and authorization wiring

The optional startup configuration boundary is implemented in \`packages/config/src/index.ts\` as \`parseProviderTrustRegistryConfig\`. Its default result is \`{ enabled: false }\`. When disabled, it rejects leftover registry values rather than silently ignoring a partially provisioned configuration. Enabling requires every owner-controlled value:

| Environment variable | Purpose |
|---|---|
| \`ATA_PROVIDER_TRUST_REGISTRY_ENABLED\` | Exact \`true\` or \`false\`; defaults to disabled |
| \`ATA_PROVIDER_TRUST_REGISTRY_ENDPOINT_URL\` | One canonical HTTPS URL with the fixed owner-selected path and optional static query; IP-literal endpoints are rejected |
| \`ATA_PROVIDER_TRUST_REGISTRY_REGISTRY_ID\` | Stable registry identity, not a URL |
| \`ATA_PROVIDER_TRUST_REGISTRY_ROOT_KEY_ID\` | Independently pinned Ed25519 root-key identifier |
| \`ATA_PROVIDER_TRUST_REGISTRY_ROOT_PUBLIC_KEY_PEM\` | Ed25519 SPKI public-key PEM only; private-key PEM is rejected |
| \`ATA_PROVIDER_TRUST_REGISTRY_ROOT_SPKI_SHA256\` | Independently provisioned 64-character SPKI SHA-256 fingerprint |
| \`ATA_PROVIDER_TRUST_REGISTRY_DNS_ALLOWED_IPS\` | Comma-separated exact canonical IPv4/IPv6 addresses the endpoint hostname is allowed to resolve to |

The parser enforces HTTPS, canonical URL form, no URL userinfo or fragment, bounded values, a DNS hostname rather than an IP-literal endpoint, canonical IP syntax, unique allowlist members and exact boolean spelling. It freezes the result and does not mutate the caller's environment. The example environment file contains only \`ATA_PROVIDER_TRUST_REGISTRY_ENABLED=false\`; no endpoint, IP address, registry identity or root key is preselected.

The startup composition is exported as \`createProviderTrustRegistryAuthorizationRuntime\` from \`@ata/market-data\` and the \`@ata/market-data/provider-trust-registry-runtime\` package subpath. It accepts the parsed config, owner-supplied signed provider-use decision envelopes, and the query client of the application-managed PostgreSQL pool. It:

- Returns a permanently default-deny resolver when disabled, without requiring a database client or constructing a network transport.
- When enabled, revalidates the exact config shape, builds the independently pinned trust anchor, checks Ed25519 key type and computes/compares the SPKI fingerprint **before** any DNS lookup, HTTPS request or SQL query.
- Creates a hostname-specific DNS lookup callback that resolves only the configured endpoint hostname and rejects the complete DNS answer if any returned IP is outside the exact owner allowlist. It handles both Node single-address and multi-address lookup callback modes; it does not use a proxy or response-selected host.
- Composes the direct HTTPS adapter, Ed25519 snapshot authenticator, authenticated loader and PostgreSQL high-water-mark CAS store. Constructing the runtime does not read the network or database.
- Clones and bounds the signed decision envelope set. No matching or ambiguous provider/purpose decision is denied before a registry request.
- Provides an asynchronous provider-use decision resolver. The orchestrator now awaits sync or async resolvers before invoking any provider adapter. For exactly one matching decision, the resolver fetches a **fresh** snapshot, authenticates it, advances durable anti-rollback state, then verifies the signed decision against the authenticated key set and the requesting provider, purpose and time.
- Returns no decision for missing/malformed configuration, DNS policy mismatch, TLS/HTTP error, signature failure, freshness error, rollback/equivocation, PostgreSQL outage/CAS conflict, or invalid/ambiguous decision. There is no cache or stale-key fallback. A failed authorization reaches the existing \`BLOCK_PROVIDER_USE_NOT_APPROVED\` gate before provider I/O.

The startup factory does not select a provider vendor, secret service, registry URL, DNS answer, production root key or decision. Those values must come through the owner's independent deployment channel. The DNS allowlist is a sensitive security policy input and requires owner review; this implementation validates and enforces the exact list, but does not choose it.

**Service boundary:** \`services/agent\` remains scaffold-only. This step provides a typed startup composition API and connects its asynchronous resolver to the orchestrator, but it does not create or launch an agent process, open a production database connection, automatically poll the registry or start market-data collection. A future customer-local service entrypoint must parse its environment, pass its already-managed PostgreSQL query client and owner-reviewed signed decisions to the factory, and inject the returned resolver into \`ReadOnlyMarketDataOrchestrator\`. If the feature remains disabled or any required owner value is absent, provider use stays default-deny.

Verification includes disabled/partial configuration, canonical endpoint and DNS allowlist rejection, pinned-root mismatch before DB access, lazy bootstrap with no eager I/O, ambiguous decision denial, async resolver gating in the orchestrator, and an end-to-end local HTTPS test that obtains a root-signed snapshot, persists the initial high-water mark, and returns only a correctly signed diagnostic decision. All TLS fixtures and keys are disposable CI artifacts; no production endpoint or owner key is used.

This step does not activate the trust registry on \`main\`, make a live external request, approve data-provider rights, alter freshness or discovery thresholds, or authorize production provider use, wallet signing, orders, spending or trading. Frozen Solana-only V1 scope and the existing default-deny gates remain unchanged.

## Step 2 — root snapshot authenticator

The transport-free implementation is in `packages/market-data/src/provider-trust-registry-authenticator.ts` and is exported from the market-data package.

- Rejects an empty or over-48-KiB body before decoding or parsing.
- Decodes UTF-8 in fatal mode and uses a bounded JSON parser that rejects duplicate member names at every object depth, including escape-equivalent names.
- Requires the independently supplied anchor to contain exactly the registry ID, root key ID, SPKI public-key PEM and SHA-256 fingerprint; checks registry/root identity against the signed snapshot.
- Parses the root as Ed25519, fingerprints the SPKI DER bytes against the independently provisioned SHA-256 value, and rejects a wrong key type or fingerprint.
- Reconstructs the documented domain-separated canonical payload, accepts only the canonical unpadded 64-byte Ed25519 signature encoding, and verifies the signature with the pinned root.
- Enforces strict UTC calendar timestamps, rejects future-issued, expired and stale snapshots, and refuses an age bound above five minutes.
- Parses every delegated provider-decision public key and requires Ed25519 before returning the complete key set.
- Returns the SHA-256 digest of the canonical unsigned payload and a deeply frozen snapshot/key set.

The authenticator performs no network request and does not implement durable anti-rollback storage. A cryptographically authentic snapshot is not yet usable as a production provider authorization until the later high-water-mark/CAS and owner-approved transport/loader steps are complete.

## Required adversarial verification for the implementation step

Use generated in-process Ed25519 fixtures only; no production keys, external credentials or live network dependencies:

- Valid signature and matching root SPKI fingerprint.
- Wrong root key, root key ID, fingerprint or algorithm; invalid signature; altered payload; non-canonical signature.
- Missing/extra fields, unknown schema, duplicate key IDs, malformed records and oversized body/key set.
- Expired/future/stale snapshots and safe-integer version overflow.
- Lower version, same-version digest equivocation, identical-version replay and compare-and-swap races.
- Revoked/expired/not-yet-valid provider decision key and provider/purpose mismatch.
- Timeout, abort, redirect, HTTP downgrade, non-success status, malformed JSON and streaming body-size overflow.
- Registry or durable high-water store unavailable: deny before any provider/RPC request.

## Non-goals and unchanged controls

This step does not generate keys, populate GitHub Environment secrets, choose a trust service, make a live request, activate providers, approve commercial rights, establish independent price agreement, alter discovery thresholds or authorize wallet signing, orders or trading.

Solana-only V1, the USD 100,000 liquidity threshold, USD 10,000 24-hour-volume threshold, 10-bps diagnostic tolerance and all existing Phase 6 default-deny gates remain unchanged. Phase 6 remains ACTIVE.
