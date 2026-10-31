# Phase 6.46 — Signed authoritative provider trust-registry contract

## Status

**Step 1: contract and security boundary.** This change specifies the trust-registry protocol before selecting or connecting an external service. It does not add a provider, endpoint, credential, root key, signing key, network client, or runtime activation.

The existing `ata.provider-use-decision.v1` Ed25519 decision envelope and its signing payload are unchanged. A registry snapshot authenticates the trusted-key/revocation set; it does not replace or sign individual provider-use decisions.

## Threat model and trust hierarchy

The registry is not allowed to establish its own trust. The consumer must receive the registry root public key and its expected SHA-256 SPKI fingerprint through an independently controlled deployment trust channel. The root key must not be accepted from the registry response, provider decision envelope, or an unauthenticated URL/config response.

The hierarchy is:

1. **Deployment trust anchor:** owner-controlled pinned Ed25519 registry-root public key plus independently recorded SHA-256 fingerprint.
2. **Signed registry snapshot:** root-signed, versioned, bounded snapshot containing the current provider-decision signing keys and revocation state.
3. **Provider-use decision:** existing owner-signed `ata.provider-use-decision.v1` envelope verified against exactly one eligible key in the authenticated snapshot.
4. **Provider request:** only after snapshot verification, freshness, rollback protection, key scope, key status, decision scope, and decision expiry all pass.

A registry signature proves that the pinned registry root signed the snapshot. It does not prove the correctness of provider legal evidence, source independence, data freshness, or commercial rights.

## Snapshot wire contract

The versioned envelope is `ata.provider-trust-registry-snapshot.v1` and has exactly these top-level fields:

| Field | Contract |
|---|---|
| `schemaVersion` | Exact literal `ata.provider-trust-registry-snapshot.v1` |
| `registryId` | Stable owner-assigned identifier, not a URL |
| `rootKeyId` | Identifier of the deployment-pinned registry root |
| `algorithm` | Exact literal `Ed25519` |
| `version` | Positive safe integer, strictly monotonic per registry |
| `issuedAt` | UTC timestamp assigned when the complete snapshot is published |
| `expiresAt` | UTC timestamp; must be later than issuedAt and current verification time |
| `keys` | Complete current array of trusted provider-decision signing-key records |
| `signature` | Canonical unpadded base64url encoding of a 64-byte Ed25519 signature |

The signature covers a domain-separated UTF-8 canonical payload containing every field above except `signature`, in a fixed documented property order. The canonical payload includes the complete ordered key records, including `revokedAt`, validity bounds, provider allowlists and purpose allowlists. No field may be silently omitted, normalized, or reconstructed from a second source.

The snapshot is a **complete replacement set**, not a delta. Absence of a previously known key means it is no longer trusted. Revocation must be explicit in the snapshot for auditability, but the consumer must not retain omitted keys as fallback.

## Verification requirements

A future implementation must reject by default when any of these conditions holds:

- Missing deployment-pinned root key or expected fingerprint.
- Root key is not Ed25519, cannot be parsed, or its SPKI SHA-256 fingerprint differs from the independently configured fingerprint.
- Unknown schema, extra/missing fields, malformed identifiers/timestamps, duplicate key IDs, malformed key records, or invalid signature encoding.
- Invalid root signature or a snapshot signed by a different root key ID.
- Snapshot version is lower than the durable high-water mark for that registry.
- Same version is presented with a different canonical snapshot digest than the durably recorded digest.
- Snapshot is future-dated, expired, has an invalid time interval, or exceeds the configured maximum age.
- Registry response exceeds a strict byte limit, retrieval times out, is cancelled, or the loader returns an error.
- Any required key is missing, duplicated, expired, not-yet-valid, revoked, or outside provider/purpose scope.

The maximum snapshot age must be explicit and bounded to at most five minutes for the Phase 6 diagnostic path unless a separately reviewed policy changes it. Retrieval time is not a substitute for `issuedAt`.

## Rollback and durable state

The verifier must be pure and must not claim rollback resistance from process memory alone. The caller must supply a durable per-`registryId` high-water record containing the last accepted version and canonical snapshot SHA-256 digest. After a snapshot passes every cryptographic and semantic check, the caller atomically commits the new high-water record before using any keys from that snapshot.

The storage adapter must provide compare-and-swap or equivalent transactional monotonic update semantics. A missing, corrupt, stale, or unavailable high-water record denies authorization. Restoring an old database backup must not silently lower the high-water mark; production design must specify an independently protected recovery/fencing procedure. Concurrent workers must not accept an older snapshot after a newer version has been committed.

Equal-version replay is allowed only when the canonical digest exactly matches the durable digest and the snapshot remains within its validity window. A same-version different digest is a rollback/equivocation failure.

## Loader boundary

The protocol verifier accepts bytes/parsed data and explicit trust inputs; it performs no network I/O and has no provider, wallet, signer, or trading capability.

A later owner-selected loader adapter must:
- Use a fixed, owner-approved origin and endpoint path; never follow redirects to a different origin.
- Require HTTPS with normal certificate-chain and hostname verification; prohibit plaintext fallback.
- Apply a bounded timeout and cancellation signal.
- Enforce a response-body byte limit while streaming, before JSON parsing.
- Reject non-success status, unexpected content type, compressed/decoded-size overflow, malformed UTF-8/JSON, and duplicate/unknown schema fields.
- Avoid logging response bodies, authorization headers, tokens, or key material.
- Return the snapshot plus independently measured retrieval metadata; retrieval metadata is not signed evidence.
- Never cache a previously accepted snapshot as a fallback when refresh fails.

No external registry vendor or hosting service is selected by this contract. The owner must approve the provider, account, endpoint, availability model, costs, terms, retention and incident process before an adapter is implemented or used.

## Required adversarial verification

The implementation PR must include generated in-process Ed25519 fixtures only and cover:
- Valid root signature and matching fingerprint.
- Wrong root key, wrong fingerprint, invalid signature, altered payload and non-canonical signature.
- Missing/extra fields, unknown schema, duplicate IDs, malformed key records and oversized snapshots.
- Expired/future snapshots and stale retrieval age.
- Lower version, same-version digest equivocation, and durable compare-and-swap races.
- Revoked/expired/not-yet-valid provider key and provider/purpose mismatch.
- Timeout, abort, redirect, HTTP downgrade, non-success status, malformed JSON and streamed body-size overflow in loader tests.
- Registry unavailable or high-water storage unavailable: deny before any provider/RPC request.

Tests must not contain production keys, secrets, external service credentials, or live network dependencies.

## Non-goals and unchanged controls

This contract does not create keys, populate GitHub Environment secrets, select an external trust service, make a live request, enable provider access, approve commercial rights, establish independent price agreement, change discovery thresholds, or authorize trading.

Solana-only V1, USD 100,000 liquidity threshold, USD 10,000 24-hour-volume threshold, 10-bps diagnostic tolerance, and all existing Phase 6 default-deny gates remain unchanged. Phase 6 remains ACTIVE.
