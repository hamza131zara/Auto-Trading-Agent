# Phase 6.46 — Authenticated provider trust-registry contract

## Scope of this step

This change defines the provider-neutral trust-registry boundary only. It does not select a registry vendor, URL, cloud service, credential, key-management product, or operational trust root. It does not enable provider access or trading.

## Security model

The signed provider-use decision verifier already consumes a trusted-key list and a refresh timestamp. That is sufficient for a protected one-shot GitHub Environment bootstrap, but it does not by itself prove that a fetched registry snapshot is authentic, current, or newer than a previously accepted snapshot.

A future registry adapter must satisfy all of these requirements before its keys can reach the existing decision verifier:

1. **Independent trust anchor:** registry identity and snapshot verification key are pinned through owner-controlled configuration outside the registry response. The registry cannot introduce or rotate its own trust anchor through an unauthenticated response.
2. **Authenticated payload:** the exact snapshot bytes are authenticated before parsed keys are used. Unknown algorithms and key identifiers fail closed.
3. **Anti-rollback:** snapshots carry a monotonic unsigned 64-bit sequence. The last accepted sequence must be persisted durably; equal/lower sequence values are rejected according to the eventual registry protocol.
4. **Freshness:** authenticated issue time must not be in the future and must fall within the owner-approved maximum age (hard cap: five minutes).
5. **Resource bounds:** at most 48 KiB and 64 keys; transport timeout at most five seconds. Reject oversized data before parsing.
6. **Transport:** HTTPS only outside tests. Redirects are rejected unless an owner-pinned origin policy explicitly permits the destination.
7. **No stale fallback:** timeout, authentication failure, malformed payload, unavailable registry, rollback, or missing durable sequence state denies authorization. Cached keys are not a fallback.
8. **Sanitized failures:** logs and errors expose stable reason codes only; never response bodies, credentials, private keys, or secret-bearing URLs.

## Implemented contract

packages/market-data/src/provider-trust-registry.ts defines untrusted byte transport, independent snapshot authenticator, authenticated snapshot shape, owner-supplied registry state and anti-rollback sequence, bounded policy constants, and sanitized failure codes.

No concrete adapter is implemented in this step. The authenticator is an injected boundary and does not claim that a registry response is trustworthy by itself.

## Required adversarial verification before adapter selection

- missing/incorrect independent trust anchor;
- registry identity mismatch;
- invalid signature and unknown signing algorithm/key ID;
- altered payload after signature;
- malformed/duplicate key records;
- oversized response and key-count overflow;
- timeout, network failure, redirect and non-HTTPS origin;
- stale/future timestamps;
- lower/equal sequence and sequence overflow;
- unavailable durable anti-rollback state;
- revocation taking effect on the next authorization resolution;
- proof that every failure prevents provider network access.

## Remaining owner decisions

The owner must separately select and provision the registry service, establish the trust anchor and signing custody, approve the durable anti-rollback storage location, define rotation/recovery procedures, and configure access credentials if required. No private key or secret is requested or committed by this change.

The existing Ed25519 provider-use decision envelope and canonical signing payload are unchanged. The live-source workflow remains read-only and manually dispatched. No RPC/DEX live validation is initiated here. Frozen liquidity, volume and diagnostic tolerance thresholds remain unchanged. Phase 6 remains ACTIVE.
