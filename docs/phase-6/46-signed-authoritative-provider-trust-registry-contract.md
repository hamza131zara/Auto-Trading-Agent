# Phase 6.46 — Signed authoritative provider trust-registry contract

## Status and boundary

**Step 1: protocol contract and security boundary.** This defines a provider-neutral, root-authenticated trust-registry protocol. It does not select or connect an external service, add credentials or production keys, activate providers, or authorize trading.

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

A durable store interface is defined, but no storage implementation is selected or provisioned in this step.

## Loader boundary

The protocol is separated from transport. The authenticator consumes exact snapshot bytes and an independently provided trust anchor; the transport returns untrusted bytes only. A future owner-selected adapter must:

- Use one fixed owner-approved HTTPS origin and endpoint path; configure redirects as `error` and do not follow redirects to another origin.
- Preserve normal certificate-chain and hostname validation; no plaintext fallback.
- Apply cancellation and a timeout no greater than five seconds.
- Enforce the 48 KiB decoded body limit while streaming, before JSON parsing (including compressed response expansion).
- Require the expected JSON content type and reject non-success status, malformed UTF-8/JSON, duplicate/unknown fields and schema drift.
- Authenticate the exact received envelope bytes with the independently pinned root key.
- Return retrieval metadata separately; it is not signature-covered evidence.
- Never use cached keys as fallback when refresh fails.

No registry vendor, hosting service, origin, account, endpoint, credential, key-management product or availability/cost model is selected here. The owner must approve those items before an adapter is implemented or used.

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
