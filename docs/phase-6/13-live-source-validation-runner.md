# Phase 6.13 — Explicit Live-Source Validation Runner

**Status:** End-to-end runner and manual-only workflow implemented; first real-source identity validation completed with `MATCH` on 2026-10-29. [Run #2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40840569303) returned `synthetic: false` at finalized context slot `462809432`. This was one read-only identity check, not production-provider approval or full market-data validation. The workflow uses Solana's shared public Mainnet RPC and DEX Screener for the explicitly named indexed pair. The public RPC is not a production provider selection and has no production SLA. Phase 6 remains active.

## Purpose

The Phase 6.9–6.12 engineering tests are synthetic and mocked. The runner now supports an end-to-end path: it requests the exact pool address supplied by the operator from the existing DEX Screener pair adapter, validates the returned base/quote mints and response provenance, then runs the pinned Raydium CPMM decoder using read-only Solana mainnet RPC. It performs only the adapter's HTTPS GET and Solana getMultipleAccounts reads; it cannot sign, create transactions, submit orders, or enable live trading. The DEX Screener adapter never selects an arbitrary 'best pair' for you.

A successful MATCH means the pool, program, mint, vault, LP-mint, AMM-config and observation identities were internally consistent at the reported finalized context slot under the pinned decoder and explicit account-program policy. It is **not** proof of provider honesty, token safety, source-price freshness, production provider approval, or Phase 6 completion.

## Inputs and safeguards

The command requires all of the following. Values are supplied locally and must never be committed to the repository. The manual GitHub Actions workflow supplies the official shared endpoint `https://api.mainnet.solana.com` and provider label `solana-public-shared`; this endpoint is rate-limited and is for one-off validation only, not production.

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

The optional target file supplied with --target must be one valid ata.market-data.v1 JSON snapshot from the reviewed indexed API. It must describe Solana mainnet-beta, include the exact pool address and base/quote mint addresses, be marked provenance.synthetic: false, use provenance.sourceKind: INDEXED_API, include the source request ID and SHA-256 response digest, and use a provider ID different from the RPC provider. Replay fixtures and incomplete-provenance snapshots are rejected before an RPC request. Alternatively, pass --pool-address, --base-mint, and --quote-mint; the runner fetches that exact pair through the existing DEX Screener adapter, then applies the same provenance/identity requirements. Injected/mock fetch responses are marked synthetic and cannot pass the live target gate.

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

node scripts/validate-raydium-live-source.mjs --pool-address "<reviewed-pair-address>" --base-mint "<exact-base-mint>" --quote-mint "<exact-quote-mint>" --output .\local-evidence\raydium-live-report.json

# Alternative: reuse a saved canonical snapshot instead of fetching DEX Screener in this invocation.
node scripts/validate-raydium-live-source.mjs --target .\local-evidence\raydium-target.json --output .\local-evidence\raydium-live-report.json
~~~

The example slot and retrieval-age values are command examples only; choose values for the actual run and record the rationale. Avoid committing the target or report by adding the local evidence folder to the local/global Git ignore configuration first. The report output path must not already exist; the script uses exclusive creation to avoid overwriting an existing artifact. The RPC endpoint is not recorded in the report.

The process exits with code **0** only for a non-synthetic MATCH that passes the identity gate; **1** means the identity evidence did not pass; **2** means configuration, transport, or execution stopped safely. Diagnostic output exposes only stable error codes, not the endpoint or account bytes. DEX Screener's current mapping has no trustworthy source-event timestamp, so a successful account-identity check still does not satisfy market-data freshness.

## First real-source run — 2026-10-29

The first manually triggered live run completed successfully: [GitHub Actions run #2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40840569303). The report is printed in that run's log; no binary artifact was produced.

| Evidence field | Observed value |
|---|---|
| Target provider | `dex-screener` (`INDEXED_API`) |
| Target pool | `7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny` |
| Base / quote mints | Wrapped SOL `So11111111111111111111111111111111111111112` / USDC `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| Target request ID | `live-dexscreener-mvt9nqvr` |
| Target raw-response SHA-256 | `b476ddf829a8ffe6a6ef7c7f3dec12c94cc89fc86d6cc742f52746a160e64adb` |
| RPC provider / commitment | `solana-public-shared` / `finalized` |
| RPC context slot | `462809432` |
| RPC request ID | `live-raydium-mvt9nr78-identity` |
| RPC raw-response SHA-256 | `ff582c0424f54e911e22920a90fd4ccfb9c93982b91d917355a19c4b69213d1f` |
| Decoder | `raydium-cp-swap-pool-state` version `0.1.0`; pinned PoolState 637 bytes / AmmConfig 236 bytes |
| Result | `MATCH`; zero mismatch fields; `identityGatePassed: true`; RPC source `synthetic: false` |

The decoded pool records `canonicalPoolPdaMatches: true`, `statusFlags: 0`, and swap/deposit/withdraw flags enabled. The reported identity result was internally consistent at the finalized context slot.

**Limitations and follow-up:** `observedAt` and `sourceEventAt` were both null in the DEX Screener target. The run therefore provides no evidence of source-price freshness. The reviewed pair page showed very low liquidity (about USD $86) and roughly USD $2 in 24-hour volume at the time of that screenshot; do not treat this as a production trading candidate. The runner checks the CPMM program account is executable and loader-owned, but it does not dump/hash the deployed ProgramData binary and compare it with a reproducible build of the pinned source. That compatibility gate remains open. No independent price/reserve reconciliation or live provider fallback test was included in this run.

The report correctly retained `phase6Complete: false`, `productionProviderApprovedByThisReport: false`, and `tradingAuthorized: false`. The first two operator acknowledgements and the terms/budget acknowledgement applied only to this one-off run; they do not constitute blanket production authorization.

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

## Run from GitHub Actions (manual-only)

A dedicated workflow is registered as `.github/workflows/phase6-live-source-validation.yml`. It is separate from CI and never runs automatically on pushes or pull requests. To start one one-off validation:

1. Open the repository's **Actions** tab and select **Phase 6 read-only live-source validation**.
2. Click **Run workflow** on the `main` branch.
3. Enter the exact pair address plus the base and quote mint addresses as they appear in the reviewed DEX Screener pair response. The on-chain decoder will reject a pool that is not owned by the pinned Raydium CPMM program.
4. Supply the explicit finalized context-slot floor and RPC evidence max age for this run.
5. Change all three acknowledgements from `no` to `yes` only after approving this read-only check, reviewing the specific indexed target/source independence, and checking current API terms/rate limits/retention and your one-off usage budget.
6. Start the workflow and review the JSON report in the run logs. The RPC endpoint and raw account bytes are not logged.

The workflow requires no API key for the current DEX Screener pair GET or the Solana public RPC endpoint. Public RPC is shared and rate-limited; Solana advises using a private RPC provider for production infrastructure. This workflow does not select or approve a production RPC provider. If any approval is not confirmed, the provider network step does not execute.

The workflow is manual-only so routine CI stays deterministic and does not depend on external APIs. The first real-source run is recorded above; future runs require a separate, justified operator decision. A report from this workflow is identity evidence only and must never be interpreted as production provider approval or trading authorization.
