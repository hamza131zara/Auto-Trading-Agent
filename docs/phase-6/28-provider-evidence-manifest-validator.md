# Phase 6.28 — Provider evidence manifest validator

## Status and scope

**Status: implementation candidate — no owner evidence has been received or approved by this change.**

Phase 6.27 established the evidence intake requirements. Phase 6.28 adds an offline validator for a versioned JSON manifest that describes the evidence artifacts. It is intended to catch malformed, incomplete or internally contradictory records before a human reviewer evaluates the underlying documents.

The validator is not an evidence-authenticity engine, legal reviewer, source-independence oracle, provider-approval mechanism, or trading control. A successful result is explicitly `STRUCTURALLY_VALID_NOT_AN_APPROVAL`. It never changes provider registry flags and always reports `approvalMutationPerformed: false` and `tradingAuthorized: false`.

## Manifest contract

The schema version is `ata.provider-evidence-manifest.v2`. A manifest has a UTC `generatedAt` and a non-empty `records` array. Each evidence record contains:

- Stable unique `evidenceId`, canonical `providerIds`, `evidenceType`, `quality`, issuer and issue timestamp.
- An artifact locator, filename, media type and SHA-256 digest.
- A scope summary including intended delivery models and covered actions.
- A review state, reviewer identity/time where applicable, and findings.
- Type-specific structured fields for feed symbology, publisher lineage, pairwise attestations, provider rights or owner decisions.

Supported evidence types: `FEED_SYMBOLOGY`, `PUBLISHER_LINEAGE`, `PAIRWISE_ATTESTATION`, `SERVICE_TERMS`, `ORDER_FORM`, `WRITTEN_PERMISSION` and `OWNER_DECISION`.

### Pyth symbology

A `FEED_SYMBOLOGY` record must identify exactly both `SOL/USD` and `USDC/USD`, each with numeric Pyth Lazer ID, 64-hex canonical feed ID, base58-shaped mint, feed state, positive publisher minimum, minimum channel and session metadata. This checks shape/completeness only. Reviewers must compare the actual values against the dated first-party Pyth response, account entitlement and the canonical feed/mint constants; the validator does not fetch Pyth or declare a feed stable or eligible.

### Publisher lineage

A `PUBLISHER_LINEAGE` record identifies one publisher and the feeds it covers. Upstream disclosure is explicitly `DISCLOSED`, `PARTIAL` or `NOT_DISCLOSED`. An undisclosed source must have an empty upstream-source list; it cannot be marked lineage-reviewed. Missing venue or dataset facts stay unknown and cannot be inferred from router count, vendor branding or price correlation.

### Pairwise attestation

A `PAIRWISE_ATTESTATION` record requires exactly two provider IDs, an attestation from each side, an overlap assessment and a conclusion of `INDEPENDENT`, `DEPENDENT` or `UNKNOWN`. A record marked `PAIRWISE_INDEPENDENCE_VERIFIED` must contain both attestations, an `INDEPENDENT` conclusion, no-known-overlap assessment and an executed/signed evidence quality. The validator only checks that these declarations are internally consistent; it does not authenticate signatures or verify the underlying assertions.

Pyth Pro and Pyth Hermes remain in the existing `pyth-network` family. This validator never modifies that registry.

### Rights records

`SERVICE_TERMS`, `ORDER_FORM` and `WRITTEN_PERMISSION` records capture the legal entity, redacted account reference, plan/terms version, effective and expiry dates, covered delivery models, permitted/prohibited actions, attribution and retention terms. Conflicting actions, expired rights and rights-cleared states based only on public/secondary material are rejected.

The validator cannot interpret contract clauses or decide whether a particular customer workflow is legally permitted. A qualified human reviewer must confirm that the exact account, plan, legal entity, delivery model, customer actions and dates are covered. Diagnostic rights and production rights remain separate.

## Artifact storage and integrity

Three locator types are supported:

- `PUBLIC_URL`: HTTPS URL without embedded credentials, query parameters or fragments.
- `RESTRICTED_EXTERNAL`: opaque restricted-store reference such as `vault://...`; the file remains outside this repository.
- `LOCAL_FILE`: relative path under an explicitly supplied artifact root. The validator resolves the root and target, rejects path traversal and symlinks, requires a regular file, and recomputes SHA-256.

External artifact digests are syntax-checked but cannot be recomputed without access to the source artifact. A structurally valid external digest is not a claim that the artifact bytes were checked. Keep contracts, account statements and sensitive publisher disclosures in a restricted store; do not commit the files or credentials.

## Usage

```sh
node scripts/validate-provider-evidence-manifest.mjs --help

node scripts/validate-provider-evidence-manifest.mjs \
  --manifest ./private-evidence/provider-evidence-manifest.json

node scripts/validate-provider-evidence-manifest.mjs \
  --manifest ./private-evidence/provider-evidence-manifest.json \
  --artifact-root ./private-evidence/artifacts
```

Keep `private-evidence/` outside Git or in an approved restricted store. The validator rejects credential-bearing property names such as API keys, access tokens, secrets, passwords, private keys, seed phrases and authorization values. Never use it as a reason to paste credentials into JSON.

The CLI exits 0 only for a structurally valid manifest, 1 for validation failures and 2 for invocation/JSON errors. A zero exit code means only that the manifest passes the implemented structural checks.

## Acceptance and safety

- [x] Add a versioned manifest validator with stable reason codes and deterministic output.
- [x] Validate Pyth feed-pair completeness and per-feed/session metadata fields.
- [x] Validate publisher disclosure state and prevent undisclosed publishers from being marked lineage-reviewed.
- [x] Validate two-sided pairwise attestations and reject unsupported independence claims.
- [x] Validate rights scope, permitted/prohibited action conflicts and expiry.
- [x] Verify local artifact digests within a bounded root and reject traversal/symlink escapes.
- [x] Reject credential-bearing manifest fields.
- [ ] Populate the manifest with actual owner-supplied source artifacts and complete human review.
- [ ] Verify real publisher lineage and legal/customer-use rights; the validator cannot do this.
- [ ] Obtain separate owner decisions before any manual diagnostic or production-use proposal.

No provider, Pyth symbols, or Solana RPC request is made. No key, account, subscription, budget or spend is introduced. Provider profiles remain unverified/unapproved; thresholds and the 10-bps tolerance are unchanged; the historical 63-bps disagreement remains unresolved. No adapter activation, wallet, signer, transaction, order or trading permission is added. Phase 6 remains ACTIVE.


## Version 2 hardening

Phase 6.29 advances this manifest schema to v2. The validator binds Pyth SOL/USD and USDC/USD values to the canonical feed IDs and mainnet mints pinned in the Pyth Pro adapter, rejects the illustrative numeric fixture IDs 101/202, and validates the adapter's channel/session enum values. Pairwise source claims are resolved against the current provider-family registry; publisher, bilateral attestation and overlap evidence must reference records present in the same manifest. Rights scope and owner decisions must be supported by linked technical, rights and independence records. See [Phase 6.29](29-canonical-evidence-binding-and-lineage-consistency.md).
