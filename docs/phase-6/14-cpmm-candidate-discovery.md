# Phase 6.14 — Read-only Raydium CPMM candidate discovery

**Status:** Discovery tooling implemented; no discovery run is claimed until the manual workflow returns a real, non-synthetic report. This step finds candidate pools only. It does not approve a token for trading or complete Phase 6.

## Why this exists

The first live identity run succeeded for pool `7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny`, but the DEX Screener page reviewed during that run showed approximately USD $86 liquidity and USD $2 in 24-hour volume. That pool is retained as identity-test evidence only; it is not a trading candidate.

This workflow requests the SOL/USDC pools indexed by DEX Screener, filters exact Wrapped SOL and canonical USDC mint pairs, and ranks by indexed liquidity. It then asks Solana's shared public mainnet RPC for the pool accounts at `finalized` commitment and retains as CPMM candidates only accounts whose on-chain owner equals:

`CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`

This owner check is important because DEX Screener's `raydium` label alone is not sufficient to distinguish CPMM from AMM v4 or CLMM. For a CPMM-owned account, the workflow also invokes the pinned PoolState decoder and checks that the decoded token0/token1 mints are exactly the canonical Wrapped SOL and USDC mints (in either orientation). A wrong layout, discriminator or mint pair is excluded from the shortlist.

## Default triage thresholds

- Minimum indexed liquidity: USD $100,000.
- Minimum indexed 24-hour volume: USD $10,000.

These are discovery filters only, not an approved trading policy. The workflow reports candidates below the thresholds as well but will only nominate a follow-up pool from the threshold-qualified CPMM subset. If nothing meets the filters, do not lower thresholds merely to force a result; review the output and decide whether the requirements or pair should change.

## Run it

1. Open **Actions → Phase 6 Raydium CPMM candidate discovery** on `main`.
2. Keep the default thresholds for the first pass.
3. Leave both acknowledgements at `no` until you have reviewed the specific read-only RPC request, DEX Screener's current API terms/quota, and the fact that workflow logs are public in this repository.
4. After approving both statements for this one-off discovery, set them to `yes` and click **Run workflow**.
5. Share the JSON report or the workflow link. Review the top CPMM candidates and their on-chain owner/context evidence before choosing one for the existing full identity runner.

The workflow is manual-only; regular CI does not call DEX Screener or Solana RPC. It uses no wallet, signer, transaction, or order-placement method. It outputs a bounded shortlist and hashes of the exact provider responses, not raw API bodies or account bytes.

## Report interpretation

- `onChainProgram: RAYDIUM_CPMM` means the candidate pool account was returned at the reported finalized RPC context, its owner and 637-byte PoolState layout decoded under the pinned decoder, and its decoded token0/token1 mints matched the canonical pair.
- `meetsLiquidityAndVolumeThresholds: true` means the one indexed response met the run's triage filters. It is not independent confirmation of liquidity or volume.
- `sourceFreshness: UNKNOWN` is deliberate. DEX Screener's pair mapping used by this project does not provide a trustworthy market-event timestamp.
- `recommendedFollowUpPoolAddress` is only the highest indexed-liquidity pool that passed these filters and the CPMM owner check. It is a candidate for further validation, not a trading recommendation.

## Next gates after discovery

1. Run the existing full identity workflow for the chosen pool and exact mint identities.
2. Capture same-slot on-chain vault balances and derive a base/quote reserve ratio using exact integer amounts and mint decimals.
3. Reconcile that ratio with indexed price data, quote-asset valuation, and an independently sourced price feed using an explicitly approved tolerance; do not infer freshness from retrieval time.
4. Verify the deployed ProgramData binary against a reproducible build from the pinned source revision.
5. Exercise a real fallback/degraded-mode case and finish provider terms, retention, budget and production-provider decisions.

Phase 7 token safety, transaction signing and live trading remain outside this discovery workflow.
