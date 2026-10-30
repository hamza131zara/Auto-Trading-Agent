# Phase 6.14 — Read-only Raydium CPMM candidate discovery

**Status:** Corrected live discovery run [#11](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40874763390) is complete: all 45 pool accounts were checked and all 24 CPMM candidates were cross-checked; none passed the unchanged indexed-source thresholds. Phase 6.13 live-source run [#3](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40875718349) returned `MATCH` and decoded reserves. The Pyth Hermes adapter, timestamp-aligned exact-decimal comparison policy, tests and manual-only workflow passed CI [#194](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40880232949) with 152 tests. No live Pyth request has been made; the next step is to configure the API-key secret, approve feed/source policy and run [Phase 6.15](15-pyth-hermes-reference-adapter.md). The diagnostic pool remains far below qualification thresholds and is not a trading candidate.

## Why this exists

The first manual discovery run succeeded technically but returned `NO_CPMM_CANDIDATES_FOUND`: DEX Screener's token-pair listing exposed five exact SOL/USDC Raydium pairs, which the on-chain check classified as one AMM v4 pool and four CLMM pools. That result described the five pairs exposed by that endpoint; it did **not** prove that no suitable CPMM pool exists elsewhere in Raydium's own pool index. [First discovery run](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40846125384).

The revised implementation now queries Raydium API v3's pool-by-mint endpoint for the exact canonical Wrapped SOL / USDC mint pair, sorted by indexed liquidity. Raydium's SDK points mint-pair pool searches to `/pools/info/mint`, while the current API reference documents `poolType=standard` and `poolSortField=liquidity`. The observed run reached the response parser but rejected `hasNextPage` as a non-boolean or missing field. The parser now supports both `hasNextPage` and the API's documented `nextPageId` cursor signal; it records only safe field names/types for diagnostics. When pagination cannot be established, the report is marked incomplete and no pool is recommended. The earlier run used the wrong route for that query shape and failed with a Raydium HTTP error; the corrected path now follows the pinned SDK route. We then request the returned pool accounts through the shared Solana public Mainnet RPC at `finalized` commitment, decode the pinned CPMM `PoolState`, require exact on-chain SOL/USDC mints, and require the on-chain owner to agree with Raydium API's reported program ID.

Only on-chain CPMM candidates are then cross-checked by exact pool address against DEX Screener's pair endpoint. The documented nullable `pairs` field is handled explicitly: `pairs: null` means the address is not indexed by DEX Screener, so it cannot pass the source cross-check. An omitted `pairs` field remains a malformed response. A candidate qualifies for the shortlist only when it meets the configured liquidity and 24-hour volume thresholds in **both** indexed sources. This cross-check does not replace an independent on-chain reserve calculation; the full identity workflow has a same-slot vault reserve report for that next step.

## First full live discovery result — 2026-10-29

Historical SOL/USDC-only run [#9](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40870237606) completed against live sources at finalized Solana context slot `462874226`. The report recorded `synthetic: false`, Raydium response shape `success_data`, `count: 31`, and explicit terminal pagination. All 31 returned pool accounts were checked: 14 classified as `RAYDIUM_CPMM` and 17 as `RAYDIUM_AMM_V4`. All 14 CPMM candidates were cross-checked against the exact DEX Screener pool endpoint; 8 were found and 6 were not indexed there. The scan was complete (`scanIncomplete: false`) with zero threshold-qualified candidates (`thresholdQualifiedCount: 0`) and no recommendation.

The highest-liquidity CPMM entry in this scan reported approximately $578.07 liquidity and $208.34 in 24-hour volume through Raydium; DEX Screener reported approximately $578.06 liquidity and $234.91 in 24-hour volume for that exact pool. Those observations are far below the run's $100,000 liquidity and $10,000 24-hour volume thresholds. This is a successful discovery result with **no qualifying pool**, not a provider integration failure. Do not lower thresholds just to obtain a recommendation. The next decision is to review the broadened SOL/USDC and SOL/USDT live report; do not lower the filters just to obtain a recommendation. This result still does not prove executable liquidity or authorize trading.

## Next step — bounded SOL/USDC and SOL/USDT discovery

The original full live run covered SOL/USDC only. Because that complete indexed universe had no qualifying candidate, discovery now also searches the canonical Solana USDT mint while retaining the existing SOL/USDC query. Raydium's current API v3 reference supports exact two-mint pool queries with numbered pagination; the code queries each approved quote mint separately and fails closed if pagination is unknown or the hard page cap is reached.

The allowlist is limited to these canonical mainnet mint addresses:

| Quote asset | Mint address |
|---|---|
| USDC | `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |
| USDT | `Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB` |

Mint identifiers are sourced from [Solana's mainnet stablecoin reference](https://solana.com/docs/payments/how-payments-work). This is a discovery-only allowlist, not approval to use either quote asset in production. Unknown quote mints, wrong-pair DEX Screener responses, on-chain mint mismatches, malformed responses and incomplete scans cannot qualify a candidate.

The live run is complete and cross-checked all 24 CPMM candidates; none passed the $100,000 liquidity and $10,000 24-hour volume minimums. Phase 6.13 run #3 decoded on-chain reserves for the top observed pool but left independent comparison NOT_ASSESSED and freshness UNKNOWN. The provider-neutral exact-decimal comparison contract and Pyth Hermes SOL/USD + USDC/USD adapter are implemented and tested. Next, configure the GitHub secret `PYTH_API_KEY`, approve feed/source and terms, enter run-specific freshness/time-alignment/tolerance policy values, and run the [manual Pyth validation workflow](https://github.com/hamza131zara/Auto-Trading-Agent/actions/workflows/phase6-pyth-reference-validation.yml). Do not rerun discovery or lower thresholds to force a recommendation. CI uses mocks only and never contacts live provider APIs. The top candidate, if any, remains a follow-up candidate rather than a trading recommendation.

## Latest complete broadened live run — 2026-10-29

[Workflow run #11](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40874763390) used real sources (`synthetic: false`) and finalized RPC context slot `462883564`. Raydium queries reached terminal pagination for both quote mints: 31 SOL/USDC records and 14 SOL/USDT records. All 45 pool accounts were checked, with 24 classified as CPMM and 21 as AMM v4. All 24 CPMM candidates were cross-checked against DEX Screener; 11 matching indexed pairs were found and 13 pool addresses were not indexed there. No candidate met the existing minimums of $100,000 indexed liquidity and $10,000 24-hour volume in both sources. The report state is `CPMM_FOUND_BUT_NONE_CROSS_QUALIFIED`, `scanIncomplete: false`, and `recommendedFollowUpPoolAddress: null`.

The highest-liquidity observed CPMM pool was `47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4` (SOL/USDC): Raydium reported about $578.07 liquidity and $206.12 in 24-hour volume; DEX Screener reported about $578.06 liquidity and $233.47 in 24-hour volume. These are indexed observations and are far below the unchanged qualification thresholds. This pool is suitable only as a read-only identity/reserve diagnostic, not as a trading candidate.

### Next gate — independently inspect on-chain reserves

Use the manual [Phase 6.13 live-source validation workflow](https://github.com/hamza131zara/Auto-Trading-Agent/actions/workflows/phase6-live-source-validation.yml) for the explicit SOL/USDC pool above. Suggested inputs are:

- `pool_address`: `47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4`
- `base_mint`: `So11111111111111111111111111111111111111112`
- `quote_mint`: `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v`
- `minimum_context_slot`: `462883564` (the previous discovery run's finalized slot floor)
- `max_retrieval_age_ms`: `300000`

The three workflow acknowledgement inputs default to `no`; set each to `yes` only after reviewing and approving that specific read-only RPC request, exact indexed pair, and current provider terms/quota/retention/usage budget. This diagnostic can validate pool identity, vault balances and the on-chain quote/base reserve ratio at a shared finalized slot. It does **not** make the pool eligible for trading or prove that the $100,000/$10,000 market thresholds are met.

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
- `scanIncomplete: true` or status `*_PARTIAL_SCAN` means the report must not recommend a pool; a pair query may have another page, the RPC account cap may truncate results, or the DEX Screener cross-check cap may leave CPMM candidates unevaluated. The current DEX Screener cap is 50 candidates.
- `recommendedFollowUpPoolAddress` is only the top candidate that passed both indexed thresholds, the exact pair check and the on-chain CPMM identity check in a complete scan. It is a candidate for further validation, not a trading recommendation.


## Latest repeated discovery — run #12 — 2026-10-30

[Manual workflow run #12](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41005895558) completed successfully against the pinned Raydium API v3, finalized Solana RPC and exact-address DEX Screener cross-checks. This is a complete scan, not a provider/build failure.

| Evidence | Run #12 result |
|---|---:|
| SOL/USDC Raydium API records | 31; one terminal page |
| SOL/USDT Raydium API records | 14; one terminal page |
| Returned pool accounts checked at finalized RPC | 45 |
| Accounts decoded as Raydium CPMM | 24 |
| Exact DEX Screener pool-address cross-checks | 24 |
| Scan completeness | Complete; no RPC truncation; no un-cross-checked CPMM candidates |
| Threshold-qualified candidates | 0 |
| Recommended follow-up pool | null |
| Finalized RPC context slot | 463159019 |

The report status is CPMM_FOUND_BUT_NONE_CROSS_QUALIFIED and synthetic is false. The leading diagnostic SOL/USDC pool (47hq28mcL7q5GhBg7epyGF2dnuJd4MKFt8QhT7CzYUp4) showed approximately USD 569.56 liquidity and USD 415.92 24-hour volume in Raydium; DEX Screener showed approximately USD 569.77 liquidity and USD 440.32 24-hour volume for the same exact pair. Those values are far below the unchanged USD 100,000 liquidity and USD 10,000 24-hour-volume triage thresholds.

All candidate observations retain sourceFreshness UNKNOWN because the indexed sources did not provide a trusted source-event timestamp. This successful scan does not qualify a trading pool, establish independent price agreement, or authorize lowering thresholds. The diagnostic pool remains non-tradable; recommendedFollowUpPoolAddress is null. No wallet, signer, transaction or order path was used.

## Next gates after discovery

1. Run the full identity workflow for the selected pool and exact mint identities.
2. Review the new same-slot vault balances and reserve ratio from the live identity report.
3. Reconcile the reserve ratio with independent quote-asset valuation and DEX Screener's indexed price using an approved freshness policy and numeric tolerance; don't assume a reserve ratio is an executable swap quote.
4. Verify the deployed ProgramData binary against a reproducible build from the pinned source revision.
5. Exercise a real fallback/degraded-mode case and finish provider terms, retention, budget and production-provider decisions.

Phase 7 token safety, transaction signing and live trading remain outside this discovery workflow.
