# Phase 6.13 — Explicit Live-Source Validation Runner

**Status:** Runner implemented; real-source validation is **NOT RUN** until an owner-approved RPC endpoint, an independently sourced target snapshot, current provider terms/quota/budget review, and explicit operator acknowledgements are supplied. This document does not select a production provider or close Phase 6.

## Purpose

The Phase 6.9–6.12 engineering tests are synthetic and mocked. This runner provides a controlled, repeatable way to execute the integrated pinned Raydium CPMM decoder against a real Solana mainnet RPC source after the owner has reviewed the endpoint and selected an independent indexed source. It performs only getMultipleAccounts reads; it cannot sign, create transactions, submit orders, or enable live trading.

A successful MATCH means the pool, program, mint, vault, LP-mint, AMM-config and observation identities were internally consistent at the reported finalized context slot under the pinned decoder and explicit account-program policy. It is **not** proof of provider honesty, token safety, source-price freshness, production provider approval, or Phase 6 completion.

## Inputs and safeguards

The command requires all of the following. Values are supplied locally and must never be committed to the repository.

| Environment variable | Required value / meaning |
|---|---|
| ATA_LIVE_SOURCE_APPROVAL | Exact acknowledgement: APPROVED_READ_ONLY_MAINNET_RPC |
| ATA_LIVE_TARGET_SOURCE_APPROVAL | Exact acknowledgement: INDEPENDENT_INDEXED_SOURCE_REVIEWED |
| ATA_LIVE_PROVIDER_TERMS_APPROVAL | Exact acknowledgement: TERMS_QUOTA_AND_BUDGET_REVIEWED |
| ATA_SOLANA_RPC_URL | Owner-approved HTTPS RPC endpoint. Kept out of logs/reports; URL user-info and fragments are rejected. |
| ATA_SOLANA_RPC_PROVIDER_ID | Safe provider slug; must differ from the indexed target provider ID. |
| ATA_LIVE_MIN_CONTEXT_SLOT | Explicit positive finalized-slot floor selected for this validation run. |
| ATA_LIVE_MAX_RETRIEVAL_AGE_MS | Explicit maximum age for the RPC identity evidence, from 1 to 300000 ms. |

The acknowledgements record the operator's approval to make this specific read-only request, review the indexed target's provenance/independence, and review the provider's current plan terms, quota, retention policy and budget. They do not replace the owner decision log or constitute general production approval. Do not run the command until these approvals are true.

## Target snapshot

The target file supplied with --target must be one valid ata.market-data.v1 JSON snapshot from the reviewed indexed API. It must describe Solana mainnet-beta, include the exact pool address and base/quote mint addresses, be marked provenance.synthetic: false, use provenance.sourceKind: INDEXED_API, include the source request ID and SHA-256 response digest, and use a provider ID different from the RPC provider. Replay fixtures and incomplete-provenance snapshots are rejected before an RPC request.

The snapshot should be saved as an untracked local file, for example ./local-evidence/raydium-target.json. Do not fabricate source metadata or label a synthetic sample as real. The indexed source timestamp may remain unknown; this runner validates account identity, not market-observation freshness. Where a target snapshot explicitly claims a DEX program address, that address must match the pinned Raydium CPMM candidate.

## Run

1. Confirm the selected endpoint is read-only and mainnet-only, review its current provider terms/quota/retention and usage cost, choose a run-specific slot floor and retrieval-age limit, and document these choices in the Phase 6 decision/evidence register.
2. Create the reviewed target snapshot locally.
3. Install the locked dependencies and build the workspace.
4. Set the seven environment variables in the local shell without printing the RPC URL or adding it to source control.
5. Run the command below. It performs a discovery read and then one complete nine-account read at a shared context slot.

~~~powershell
npm ci
npm run build

New-Item -ItemType Directory -Force .\local-evidence | Out-Null

# Set these only after the approvals above are complete.
$env:ATA_LIVE_SOURCE_APPROVAL = "APPROVED_READ_ONLY_MAINNET_RPC"
$env:ATA_LIVE_TARGET_SOURCE_APPROVAL = "INDEPENDENT_INDEXED_SOURCE_REVIEWED"
$env:ATA_LIVE_PROVIDER_TERMS_APPROVAL = "TERMS_QUOTA_AND_BUDGET_REVIEWED"
$env:ATA_SOLANA_RPC_URL = Read-Host "Paste the owner-approved HTTPS RPC endpoint locally"
$env:ATA_SOLANA_RPC_PROVIDER_ID = "your-approved-rpc-provider"
$env:ATA_LIVE_MIN_CONTEXT_SLOT = "1"
$env:ATA_LIVE_MAX_RETRIEVAL_AGE_MS = "30000"

node scripts/validate-raydium-live-source.mjs --target .\local-evidence\raydium-target.json --output .\local-evidence\raydium-live-report.json
~~~

The example slot and retrieval-age values are command examples only; choose values for the actual run and record the rationale. Avoid committing the target or report by adding the local evidence folder to the local/global Git ignore configuration first. The report output path must not already exist; the script uses exclusive creation to avoid overwriting an existing artifact. The RPC endpoint is not recorded in the report.

The process exits with code **0** only for a non-synthetic MATCH that passes the identity gate; **1** means the identity evidence did not pass; **2** means configuration, transport, or execution stopped safely. Diagnostic output exposes only stable error codes, not the endpoint or account bytes.

## Evidence report

The JSON report retains the target provider/request/hash, RPC provider/commitment/time/context slot/request ID/raw-response hash, decoder ID/version, decoded public account identities, outcome reason codes and acknowledgements. It intentionally excludes the endpoint URL and raw base64 account payloads. Store the report outside the repository unless and until the owner decides where a redacted audit artifact belongs.

A successful report still records phase6Complete: false, productionProviderApprovedByThisReport: false and tradingAuthorized: false. It is one required piece of evidence, not the whole Phase 6 exit gate.

## Acceptance criteria for the live run

- [ ] Owner-approved mainnet RPC endpoint and account plan are recorded; current terms/quota/retention and usage budget are reviewed.
- [ ] Target snapshot is captured from a different, reviewed indexed provider with preserved request ID and source-response digest.
- [ ] The real run returns MATCH with synthetic: false, commitment: finalized, and one shared reported context slot for the nine-account identity bundle.
- [ ] Deployed program/source compatibility is independently verified against the pinned decoder version.
- [ ] The report is reviewed and linked in the Phase 6 evidence register without exposing credentials.
- [ ] Independent critical market-data checks and selected-provider fallback/degraded-mode tests are completed.

A non-match, unavailable account, unresolved Token-2022 extension, insufficient context slot, unknown provenance, or transport failure leaves the gate open. Do not relax the decoder or allowlist just to obtain a match. Phase 7 token safety, transaction signing and live trading remain outside this runner.
