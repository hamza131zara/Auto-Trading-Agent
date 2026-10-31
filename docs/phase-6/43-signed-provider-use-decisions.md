# Phase 6.43 — Signed owner provider-use decisions

## Status and boundary

**Implementation candidate:** an Ed25519 verification primitive and a default-deny resolver are implemented on the review branch. The primitive is not yet wired to the live workflow's trusted bootstrap. No real owner public key, private key, signed decision, provider permission, or production approval has been supplied or configured.

This step closes a software-verification gap in the PR #75 runtime gate: a decision record's shape and a SHA-256 manifest reference are not proof of owner authorization. It does not resolve the commercial-rights or source-lineage evidence questions in Phase 6.27–6.29.

## Verification contract

A signed envelope uses schema `ata.provider-use-decision.v1` and the Ed25519 algorithm. The signature covers a fixed-order UTF-8 JSON payload with the domain `ata.provider-use-decision.signature.v1`, schema version, key ID, algorithm and the complete provider-use decision:

- Provider ID and purpose (`DIAGNOSTIC` or `PRODUCTION`).
- Decision ID, owner, outcome and explicit scope.
- Decision and finite expiry timestamps.
- Linked evidence IDs and the evidence-manifest SHA-256 reference.

The module exports `getProviderUseDecisionSigningPayload` so an approved offline signer can produce the exact payload. Signatures use unpadded base64url encoding of the 64-byte Ed25519 signature.

## Trust-root requirements

Trusted keys are passed separately by the caller from an owner-controlled, reviewed configuration source. A key embedded in the decision envelope or evidence manifest is never trusted. The registry entry must contain:

- Unique key ID and exact owner identity.
- SPKI `PUBLIC KEY` PEM (Ed25519 only); private-key PEM is rejected.
- Explicit `notBefore`, expiry and optional revocation time.
- Allowed provider IDs and allowed purposes.

The key must be active at the injected verification time and must explicitly allow the requested provider and purpose. The decision owner must exactly match the trusted key owner. Production requires both a `PRODUCTION` purpose and `PROCEED_PRODUCTION_SCOPE`; diagnostic use requires `DIAGNOSTIC` and `PROCEED_DIAGNOSTIC_ONLY`. Decisions must have finite expiry. Ambiguous matching records or duplicate key IDs fail closed.

## Resolver and integration boundary

`createSignedProviderUseDecisionResolver` snapshots JSON-compatible decision envelopes and trusted-key configuration, then returns a `ProviderUseDecisionResolver`. It returns a decision only when exactly one envelope matches the requested provider/purpose and the signature, key status, owner, scope, time window and outcome all verify. Any missing or ambiguous record, invalid trust configuration, expired/revoked key, scope mismatch, or cryptographic error returns `undefined`. The existing orchestrator therefore preserves its default-deny behavior.

The live-source runner is intentionally not wired to this resolver yet. No trusted owner public key registry or signed owner decision has been delivered and reviewed. Until a separate trusted bootstrap supplies those items, live provider use remains blocked.

## What this does not prove

A valid signature proves that the holder of a configured trusted private key signed the decision payload. It does **not** prove that the referenced evidence artifacts are authentic, that a provider granted a legal right, that upstream sources are independent, that the manifest digest matches a particular file, or that the owner's key custody/revocation process is sound. Those remain separate evidence-review and operational controls. The signature is not a trading authorization.

## Verification

The new tests use ephemeral Ed25519 key pairs generated in the test process and cover valid signatures, payload tampering, unknown/duplicate keys, key validity and revocation, provider/purpose scope, finite decision expiry, production-scope outcomes, ambiguous records, resolver default-deny behavior and malformed envelopes. No persistent key material is generated or committed.

No network/provider/RPC request, secret retrieval, production database connection, wallet operation, transaction signing or order path is added. Frozen roadmap scope, liquidity/volume thresholds and the 10-bps diagnostic tolerance are unchanged. Phase 6 remains ACTIVE.
