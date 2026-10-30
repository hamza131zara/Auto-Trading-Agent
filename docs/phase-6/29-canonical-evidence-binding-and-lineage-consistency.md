# Phase 6.29 — Canonical evidence binding and lineage-consistency validation

## Status and scope

**Status: implementation candidate — no owner evidence has been received, authenticated or approved by this step.**

Phase 6.28 introduced an offline manifest validator. Phase 6.29 hardens the contract so internally consistent declarations cannot contradict the repository's canonical Pyth feed identities or provider source-family registry.

The manifest contract is now `ata.provider-evidence-manifest.v2`. There is no automatic v1-to-v2 migration; no real owner manifest has been accepted, and any earlier v1 manifest must be re-reviewed and upgraded manually.

## 1. Exact Pyth identity binding

A Pyth `FEED_SYMBOLOGY` record must contain both `SOL/USD` and `USDC/USD`. The validator compares each row against the canonical values pinned by the Pyth Pro adapter:

| Feed | Canonical feed ID | Required mainnet mint |
|---|---|---|
| `SOL/USD` | `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | Wrapped SOL |
| `USDC/USD` | `eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` | USDC |

Regression tests assert that the validator's feed IDs and mints match the adapter exports. Wrong feed/mint pairs, duplicate numeric Lazer IDs, malformed values and the known illustrative test IDs `101`/`202` are rejected.

The validator limits `min_channel` to the exact channel enum supported by the Pyth Pro adapter, checks known Pyth market-session names and restricts feed/session lifecycle states to the adapter's allowed values. The actual production numeric `pyth_lazer_id`, publisher minimums and selected channel remain owner-supplied; test IDs are synthetic only.

## 2. Provider-family consistency

Pairwise review resolves both provider IDs against the source-family map and verifies that map against the canonical provider registry in tests.

Unknown providers cannot be attested through this workflow. Two aliases in the same registered upstream family cannot be declared independent. In particular:

- `pyth-pro` and `pyth-hermes` both resolve to `pyth-network`.
- `geckoterminal` and `coingecko-api` both resolve to `geckoterminal-coingecko-ecosystem`.

A record marked `PAIRWISE_INDEPENDENCE_VERIFIED` still requires two distinct known families, an attestation from each provider, an `INDEPENDENT` conclusion, `NO_KNOWN_OVERLAP` and executed/signed evidence quality. This remains a structural check: signatures and underlying publisher/venue assertions are not authenticated by the validator.

## 3. Cross-record provenance references

Each publisher upstream-source item must refer to one or more evidence IDs present in the same manifest. Each provider-side pairwise attestation must link its evidence IDs, and the overlap analysis must link its supporting artifacts. Self-references and dangling IDs fail closed.

Evidence IDs refer to records, not copied documents. Artifact digest, issuer, quality, scope and review status remain visible in each referenced record. Sensitive original documents stay in an owner-controlled restricted store.

## 4. Rights scope and owner decisions

A rights record must cover every delivery model and data action claimed by its evidence scope. Display-only rights cannot support a claim for customer API access, export, redistribution or resale.

A `PROCEED_DIAGNOSTIC_ONLY` owner decision must link technically reviewed Pyth feed metadata and a rights record cleared for diagnostic use. A `PROCEED_PRODUCTION_SCOPE` decision must link technically reviewed feed metadata, production-scope rights and a verified pairwise independence record.

Issue/review/decision timestamps cannot be later than the manifest generation time; expired owner decisions fail validation. These checks do not make decisions legally valid or operationally active.

## 5. Tests and acceptance

New tests cover canonical feed/mint equality with the adapter, synthetic/duplicate Lazer IDs, provider-family map parity, same-family and unknown-provider pairwise claims, missing cross-record evidence, rights scope overclaims and malformed nested input. Existing credential-field, local artifact digest, symlink/path traversal, expiry and review-state tests remain.

- [x] Upgrade the evidence manifest to v2; earlier v1 manifests require manual review and upgrade.
- [x] Pin exact Pyth canonical feed IDs and mints to adapter exports.
- [x] Reject same-family and unknown-provider independence claims.
- [x] Require publisher, bilateral attestation and overlap evidence references to resolve.
- [x] Ensure rights scopes do not exceed linked permissions.
- [x] Require owner decisions to link technical, rights and independence evidence appropriate to their scope.
- [ ] Receive and validate actual owner-supplied Pyth symbology and publisher inventory.
- [ ] Receive and review provider permissions and bilateral upstream evidence.

No Pyth symbols, provider API or Solana RPC request is made. No credentials, subscription, budget or spend is introduced. Provider profiles remain UNVERIFIED/UNAPPROVED. Existing discovery thresholds, the 10-bps diagnostic tolerance and historical 63-bps disagreement remain unchanged. Trading remains unauthorized. Phase 6 remains ACTIVE.
