# Phase 6.15 — Pyth Hermes USD reference adapter

**Status:** Adapter, deterministic tests, and a manual-only validation workflow are implemented. CI [run #194](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40880232949) passed 152/152 tests, typechecking, build, dependency audit, and Gitleaks. First manual live validation [run #2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40892770577) fetched both non-synthetic Pyth feeds successfully, but reserve/reference comparison returned `DISAGREEMENT` (63 bps against a 10-bps run tolerance); DEX Screener's indexed-price comparison remains `NOT_ASSESSED` because source timestamps are missing. No production provider has been approved, and trading is not authorized.

## Official API and feed contract

This integration is based on Pyth's current official documentation:

- [Pyth Core upgrade and Hermes authentication](https://docs.pyth.network/pro/pyth-core-upgrade) — after the August 26, 2026 upgrade, Hermes requests require a Pyth API key sent in an `Authorization: Bearer` header.
- [Sponsored Solana feeds](https://docs.pyth.network/pro/sponsored-feeds) — lists currently sponsored Solana mainnet feeds and their feed IDs.
- [Pyth REST API guide](https://docs.pyth.network/pro/api/rest) — documents `/hermes/v2/updates/price/latest` and the parsed price response.

The adapter is intentionally limited to these canonical mainnet asset mappings:

| Feed | Feed ID | Solana mint represented |
|---|---|---|
| SOL/USD | `ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d` | Wrapped SOL, `So11111111111111111111111111111111111111112` |
| USDC/USD | `eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a` | USDC, `EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v` |

A single GET requests those exact feed IDs from `https://pyth.dourolabs.app/hermes/v2/updates/price/latest` with `parsed=true`. The adapter verifies that both requested feed IDs are present exactly once and that the feed-to-mint mapping is unchanged. It converts Pyth's integer `price` and `expo` using exact decimal string operations, retains the confidence value, converts `publish_time` to a UTC timestamp, records retrieval time/request digest, and caps response size. It never requests update transactions, submits data on-chain, reads a wallet, signs, or places orders.

Failures use sanitized stable codes; response bodies, the Pyth API key, and the Authorization header are not emitted. Injected fetch implementations are marked synthetic and cannot count as operational evidence. CI exercises mocks only.

## Manual-only live validation

Workflow: [Phase 6 Pyth reference validation](https://github.com/hamza131zara/Auto-Trading-Agent/actions/workflows/phase6-pyth-reference-validation.yml)

Before a manual run:

1. Obtain a Pyth API key through Pyth Terminal after reviewing the current plan, usage limits, terms, and budget. Add it to **GitHub repository Settings → Secrets and variables → Actions** as the secret `PYTH_API_KEY`. Never paste the key into chat, source files, workflow inputs, or logs.
2. Review the SOL/USD and USDC/USD feed IDs and confirm that Pyth is an acceptable independent reference source for this diagnostic.
3. Approve explicit policy values for maximum source age, retrieval age, SOL/USD↔USDC/USD publication-time skew, future timestamp skew, and comparison tolerance (basis points). These inputs deliberately have no defaults. A manually entered value applies to that one diagnostic run; it is not a lasting production-provider decision.
4. Review and confirm each separate read-only RPC, indexed-pair, provider-terms/budget, Pyth-provider, and comparison-policy acknowledgement.

The workflow runs the existing identity/reserve validator, fetches the two authenticated Pyth references, and calls `assessIndependentReservePriceAgreement`. The `indexed_price_source` input defaults to `dex-screener`; DEX Screener remains the exact-pool identity lookup source. Choosing `geckoterminal` additionally requires two separate approvals for current use rights/attribution/storage/quota/budget and exact-source/provider-family/candle-freshness review; both default to `no`. The workflow and script block before any network call when either approval is missing. CI [run #229](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40934354059) passed 191/191 tests and all quality/security checks. If explicitly approved, only timestamped OHLCV candle price enters the comparator, with candle-start time retained as an observation timestamp, not a trade event. This does not make GeckoTerminal pool-details liquidity, reserve, or 24-hour-volume fields fresh. See [Phase 6.17](17-timestamped-indexed-price-comparison-runner.md). The runner records feed IDs, publish/retrieval timestamps, confidence values, response hashes and comparison reason codes, but does not print the API key or raw provider response.

## First manual live validation — run #2 — 2026-10-29

[GitHub Actions run #2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40892770577) completed both the read-only Solana identity/reserve request and authenticated Pyth Hermes request. This is an execution success, **not** a successful price-agreement result.

| Evidence | Observed result |
|---|---|
| Identity | `MATCH`; non-synthetic; finalized Solana RPC context slot `462916346` |
| On-chain SOL reserve | `2.882061767 SOL` |
| On-chain USDC reserve | `290.061396 USDC` |
| Reserve ratio | `100.643712539836069377 USDC/SOL` |
| Pyth SOL/USD | `101.25522465 USD`; confidence `0.0440556` |
| Pyth USDC/USD | `0.99975109 USD`; confidence `0.00005294` |
| Pyth publication time | Both feeds: `2026-10-29T14:34:18Z` |
| Pyth retrieval time | `2026-10-29T14:34:18.750Z` |
| Reference-feed timestamp skew | `0 ms`; run policy allowed `10000 ms` |
| Indexed DEX Screener SOL price | `100.64 USD`; liquidity `$580.12`; 24-hour volume `$272.64` |
| Indexed-source freshness | `UNKNOWN`; DEX Screener source/event timestamps are absent |
| Comparison result | `DISAGREEMENT`; reserve/reference deviation `63 bps`; run tolerance `10 bps` |
| Indexed-price comparison | `NOT_ASSESSED`; reason `INDEXED_SOURCE_TIMESTAMP_MISSING` |
| Overall evidence | `comparisonEvidenceComplete: false`; `phase6Complete: false`; `productionProviderApprovedByThisReport: false`; `tradingAuthorized: false` |

The disagreement is consistent with rejecting this low-liquidity diagnostic pool: its indexed liquidity is only about $580 and its indexed 24-hour volume about $273, far below the discovery minimums ($100,000 and $10,000). The reserve ratio is not an executable swap quote, and DEX Screener's price cannot be accepted as a timestamp-validated independent observation from this report. **Do not lower the tolerance to force a pass.** Investigate discrepancies on a future pool that actually meets the existing discovery thresholds and has verified on-chain identity.

This run confirms that secret/environment binding, explicit approvals, the live RPC path, Pyth authentication, feed-ID matching, timestamp/confidence extraction, and comparison execution work end-to-end. It does not prove Pyth or the public RPC is an approved production provider; deployed-binary/source matching, provider fallback, and token-safety gates remain open.

## Interpretation and unresolved gates

- `AGREED` means the on-chain reserve ratio agrees with the Pyth-implied cross-rate within the explicitly supplied tolerance **and** the indexed USD/base price also passes its comparison. The indexed price comparison remains `NOT_ASSESSED` if DEX Screener's source-event timestamp is missing.
- `REFERENCE_SOURCE_TIMES_UNALIGNED` means SOL/USD and USDC/USD prices were not published close enough together under the run's explicit skew limit.
- Stale/future data, unknown source times, feed-ID mismatch, source aliasing, or out-of-tolerance values fail closed.
- A reserve ratio is not an executable swap quote; fees, slippage, routing, transfer fees, and reserve movement are not modeled.
- The diagnostic pool has only about $578 in indexed liquidity and is not a trading candidate.

The adapter and manual workflow are plumbing, not production approval. Provider plans/terms, a source freshness decision, independent feed and deviation policy, deployed binary/source matching, real provider fallback testing, and Phase 7 token-safety review remain open. `phase6Complete`, `productionProviderApprovedByThisReport`, and `tradingAuthorized` remain false.
