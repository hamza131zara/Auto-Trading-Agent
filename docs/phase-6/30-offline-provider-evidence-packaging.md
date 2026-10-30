# Phase 6.30 — Offline provider-evidence manifest packaging

## Status and scope

**Status: implementation candidate — no owner evidence has been received, authenticated, or approved by this step.**

Phase 6.29 hardened the v2 manifest validator. Phase 6.30 adds a local-only packager so an owner can prepare a manifest draft, place supplied source files in a restricted directory, and compute local artifact digests reproducibly before the human review process.

The packager reads no provider endpoint, Pyth symbols endpoint, Solana RPC endpoint, wallet, signer, account, or credential. It does not copy or embed artifact bytes. It adds SHA-256 metadata for LOCAL_FILE artifacts, checks any digest already supplied against the observed bytes, and runs the Phase 6.29 v2 validator before writing the final manifest.

## CLI

Keep the draft, artifact directory, and output manifest outside the Git working tree, preferably on an encrypted disk or approved restricted store. The input and output are metadata files; original agreements, account statements, publisher disclosures, and other sensitive material remain in the restricted artifact directory.

```sh
node scripts/package-provider-evidence-manifest.mjs --help

node scripts/package-provider-evidence-manifest.mjs \
  --input /secure/ata-evidence/manifest-draft.json \
  --artifact-root /secure/ata-evidence/artifacts \
  --output /secure/ata-evidence/provider-evidence-manifest.json

node scripts/validate-provider-evidence-manifest.mjs \
  --manifest /secure/ata-evidence/provider-evidence-manifest.json \
  --artifact-root /secure/ata-evidence/artifacts
```

For a LOCAL_FILE record, the draft uses a relative, slash-separated locator under the artifact root. The file name and media type must be supplied. The SHA-256 field may be omitted; when present, it must match the actual file bytes. PUBLIC_URL and RESTRICTED_EXTERNAL digests are preserved as owner-supplied values and are not recomputed by this local tool.

## Safety and bounded behavior

- The CLI refuses input, artifact-root, and output paths inside the Git working tree. It rejects a symlinked input, artifact root, output parent, or artifact path; rejects traversal and non-regular artifacts; and refuses to overwrite an existing output.
- The output is created with owner-only file permissions (0600 where the host filesystem supports POSIX permissions). The output parent directory must already exist.
- Local artifacts are limited to 50 MiB each and 200 MiB combined. A file that changes during hashing is rejected.
- The manifest is checked for credential-bearing property names before packaging. Do not supply API keys, access tokens, private keys, seed phrases, wallet files, environment files, or other credentials. This is not a content scanner for the artifact files.
- The packager emits only the manifest metadata and digests. It does not copy source files, upload data, contact providers, create subscriptions, incur spend, or mutate provider approvals.

A successful package reports STRUCTURALLY_VALID_NOT_AN_APPROVAL, approvalMutationPerformed=false, and tradingAuthorized=false. The human reviewer must still inspect the original documents, authenticate issuers/signatures through the appropriate process, assess publisher/venue overlap, interpret contractual rights, and record any owner decision separately.

## Acceptance

- [x] Add a deterministic offline packager for v2 manifest drafts and LOCAL_FILE artifacts.
- [x] Compute SHA-256 locally and reject a supplied digest that disagrees with the file bytes.
- [x] Reject credential-bearing metadata keys, symlinks, traversal, output overwrite, and repository-local evidence paths.
- [x] Bound local artifact reads to 50 MiB per file and 200 MiB combined.
- [x] Run the canonical v2 validator before emitting the final manifest.
- [ ] Receive actual owner-supplied Pyth symbology, publisher lineage, pairwise attestations, and provider-rights artifacts; perform human review.

No real owner evidence or provider permissions are included. Provider profiles remain UNVERIFIED/UNAPPROVED, spend remains USD $0, existing liquidity/volume thresholds and the 10-bps diagnostic tolerance remain unchanged, and the historical 63-bps disagreement remains unresolved. Provider activation, production approval, wallet/signing, transactions, orders, and trading remain unauthorized. Phase 6 remains ACTIVE.