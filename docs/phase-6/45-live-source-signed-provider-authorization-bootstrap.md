# Phase 6.45 — Live-source signed provider authorization bootstrap

## Status and boundary

**Implementation candidate:** the manual live-source CLI now consumes signed provider-use decisions from a protected GitHub Environment and requires explicit diagnostic authorization for the selected Solana RPC provider. Direct DEX Screener lookup additionally requires a separate decision scoped to `dex-screener`. The job remains a read-only, manually dispatched validation; this integration does not enable automatic discovery, persistent polling, production data use or trading.

No real owner signing key, trust registry, signed decision or approval has been supplied in this change. The repository does not create the trust root. With missing or malformed environment configuration, the CLI exits before calling DEX Screener or Solana RPC.

## Protected owner environment

The live-source validation job now targets the GitHub Environment:

`phase6-provider-authorization`

The repository owner must create this environment in GitHub settings, configure required deployment reviewers, and populate these environment **secrets**:

| Secret | Required value |
|---|---|
| `ATA_PROVIDER_USE_DECISIONS_JSON` | JSON array of signed `ata.provider-use-decision.v1` envelopes. Include one `DIAGNOSTIC` decision for the exact RPC provider slug (the manual workflow selects `solana-public-shared`). Include a separate `DIAGNOSTIC` decision for `dex-screener` when using direct pair lookup. |
| `ATA_PROVIDER_TRUSTED_KEYS_JSON` | JSON array of owner-controlled trusted Ed25519 SPKI public-key records, including key ID, owner, validity, revocation state, provider allowlist and purpose allowlist. Never include a private key. |
| `ATA_PROVIDER_TRUSTED_KEYS_LOADED_AT` | UTC timestamp describing when the trusted-key/revocation snapshot was actually refreshed from the owner's authoritative registry. Do not set this to the workflow start time to disguise an old registry. |
| `ATA_PROVIDER_TRUSTED_KEYS_MAX_AGE_MS` | Explicit freshness bound, integer 1–300000. The verifier rejects stale/future snapshots. |

Environment protection is an additional human approval step; it is not itself a signature. The Ed25519 signatures are verified against the separate trust-key array. The signer must sign the canonical payload produced by `getProviderUseDecisionSigningPayload`. The key record must explicitly allow the decision's provider and purpose; the decision must match the live provider, purpose, owner, time window and outcome exactly.

The owner should maintain a documented offline signing process, key custody, rotation/revocation procedure, evidence review, and environment-secret update procedure. Keep private signing keys outside GitHub Actions and outside this repository. Only public keys and signed decision envelopes are supplied to the validation job.

## Runtime behavior

- The CLI requires a valid signed `DIAGNOSTIC` decision for the configured RPC provider before any RPC request, including when the indexed target snapshot is supplied by file.
- Direct DEX Screener lookup passes the signed resolver into `ReadOnlyMarketDataOrchestrator`; its existing default-deny gate requires a distinct `dex-screener` decision before the adapter fetch.
- The trust-key JSON is reparsed on every resolver call. A missing, malformed, revoked, expired, out-of-scope, stale or future-dated key snapshot returns no decision.
- The decisions and trust-key configuration are bounded to 48 KiB each and 64 entries. No values are printed in logs or evidence reports.
- The workflow does not echo authorization secrets. The only workflow permissions remain `contents: read`.
- Missing configuration or a missing decision exits with a sanitized reason code before provider or RPC network activity.

The GitHub Environment secrets are a short-lived bootstrap for this one-shot manual workflow. The owner must refresh the trusted-key snapshot and update the corresponding `LOADED_AT` metadata before each run; a snapshot older than the configured five-minute maximum is rejected. Environment variables are fixed for the duration of a workflow job, so this is **not** a dynamic revocation transport for a persistent agent service. A long-running runtime must use an authoritative online registry loader (for example an owner-selected secret/config service) that can retrieve the current revocation state on each request. The current generic reloadable resolver is designed for that loader, but no external service or credentials are selected here.

## Verification and remaining owner actions

Tests generate ephemeral Ed25519 keys in-process only. They verify valid provider-scoped decisions, provider and purpose mismatch, missing/malformed secrets, per-resolution revocation refresh, stale snapshots and early CLI denial without network calls.

Owner actions still required before a manual run can succeed:
1. Create the protected GitHub Environment and configure required reviewers.
2. Establish the actual owner trust root and secure offline signing process.
3. Supply current, reviewed signed diagnostic decisions for `solana-public-shared` and (for direct lookup mode) `dex-screener`.
4. Supply a current trusted-key snapshot and its real refresh timestamp.
5. Continue to satisfy the existing separate manual approvals for the one-off RPC call, exact target, provider terms/quota/budget and any optional program-build hash.

This change does not authenticate the external legal/provider evidence referenced by a decision, establish source independence, create API keys, select a production RPC plan, approve provider commercial rights, deploy PostgreSQL, or authorize wallet signing/orders/trading. Frozen roadmap scope, USD 100,000 liquidity / USD 10,000 24-hour-volume thresholds and the 10-bps diagnostic tolerance are unchanged. Phase 6 remains ACTIVE.
