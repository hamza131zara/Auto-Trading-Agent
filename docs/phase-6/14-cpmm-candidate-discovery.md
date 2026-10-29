# Phase 6.14 — Read-only Raydium CPMM candidate discovery

**Status:** The first broader-discovery run failed before RPC because the Raydium pool-list request used an incompatible endpoint/query combination. The request now follows the pinned SDK's `/pools/info/list-v2` route. The next run then surfaced a second integration mismatch: the SDK's `PoolsApiReturn` is the page object (`count`, `hasNextPage`, `data: Pool[]`), while our parser required an extra `{ success, data: page }` envelope. The parser now validates and accepts the SDK page shape directly and also handles an explicit envelope when present; a new manual run is required before claiming a discovery result. This step finds candidate pools only. It does not approve a token for trading or complete Phase 6.

## Why this exists

The first manual discovery run succeeded technically but returned `NO_CPMM_CANDIDATES_FOUND`: DEX Screener's token-pair listing exposed five exact SOL/USDC Raydium pairs, which the on-chain check classified as one AMM v4 pool and four CLMM pools. That result described the five pairs exposed by that endpoint; it did **not** prove that no suitable CPMM pool exists elsewhere in Raydium's own pool index. [First discovery run](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40846125384).

The revised implementation now queries Raydium API v3's pool-by-mint endpoint for the exact canonical Wrapped SOL / USDC mint pair, sorted by indexed liquidity. Raydium's SDK uses the `/pools/info/list-v2` route with the `Standard` pool-type filter and `sortField=liquidity`; its `PoolsApiReturn` type is the `{ count, hasNextPage, data: Pool[] }` page itself, which is the expected response shape. The earlier run used the wrong route for that query shape and failed with a Raydium HTTP error; the corrected path now follows the pinned SDK route. We then request the returned pool accounts through the shared Solana public Mainnet RPC at `finalized` commitment, decode the pinned CPMM `PoolState`, require exact on-chain SOL/USDC mints, and require the on-chain owner to agree with Raydium API's reported program ID.

Only on-chain CPMM candidates are then cross-checked by exact pool address against DEX Screener's pair endpoint. A candidate qualifies for the shortlist only when it meets the configured liquidity and 24-hour volume thresholds in **both** indexed sources. This cross-check does not replace an independent on-chain reserve calculation; the full identity workflow has a same-slot vault reserve report for that next step.

## Default triage thresholds

- Minimum indexed liquidity: USD $100,000.
- Minimum indexed 24-hour volume: USD $10,000.

These are discovery filters only, not an approved trading policy. A missing metric is not treated as zero or as a pass. Source freshness remains `UNKNOWN` because these lookups do not provide a validated source-event timestamp for the freshness policy.

## Run it

1. Open **Actions → Phase 6 Raydium CPMM candidate discovery** on `main`.
2. Keep the default thresholds for the first pass.
3. Review and approve the three acknowledgements separately: (a) one read-only RPC account lookup, (b) Raydium API usage/policy and public workflow-log visibility, and (c) DEX Screener terms/quota/usage budget and public workflow-log visibility. Leave each choice at `no` unless you have reviewed and accepted the corresponding statement.
4. After approving all three statements for this one-off run, set them to `yes` and click **Run workflow**.
5. Share the JSON report or workflow link. Review the top verified CPMM candidates and their source agreement before choosing one for the existing full identity workflow.

The workflow is manual-only; regular CI does not call Raydium, DEX Screener or Solana RPC. It uses no wallet, signer, transaction, or order-placement method. It outputs a bounded shortlist and response hashes, not raw provider bodies or raw account bytes.

## Report interpretation

- `onChainProgram: RAYDIUM_CPMM` means the account owner matched the pinned CPMM program, the account was decoded with the pinned 637-byte PoolState layout/discriminator, and decoded token mints matched the canonical SOL/USDC pair.
- `RAYDIUM_API_PROGRAM_ID_MISMATCH` means Raydium's indexed program ID disagreed with the actual account owner. Such a pool is excluded.
- `meetsLiquidityAndVolumeThresholds: true` means both Raydium API and DEX Screener reported metrics at or above the run's thresholds for the same exact pool. The metrics are still indexed observations, not independently verified dollar value.
- `dexScreenerPairFound: true` means the exact candidate pool address and token mints were found through DEX Screener's pair endpoint.
- `sourceFreshness: UNKNOWN` is deliberate. Retrieval time is not substituted for market-event time.
- `scanIncomplete: true` or status `*_PARTIAL_SCAN` means the report must not recommend a pool; the API reported another page or the account cap prevented a complete scan.
- `recommendedFollowUpPoolAddress` is only the top candidate that passed both indexed thresholds, the exact pair check and the on-chain CPMM identity check in a complete scan. It is a candidate for further validation, not a trading recommendation.

## Next gates after discovery

1. Run the full identity workflow for the selected pool and exact mint identities.
2. Review the new same-slot vault balances and reserve ratio from the live identity report.
3. Reconcile the reserve ratio with independent quote-asset valuation and DEX Screener's indexed price using an approved freshness policy and numeric tolerance; don't assume a reserve ratio is an executable swap quote.
4. Verify the deployed ProgramData binary against a reproducible build from the pinned source revision.
5. Exercise a real fallback/degraded-mode case and finish provider terms, retention, budget and production-provider decisions.

Phase 7 token safety, transaction signing and live trading remain outside this discovery workflow.
