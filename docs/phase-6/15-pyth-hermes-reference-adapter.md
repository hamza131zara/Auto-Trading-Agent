# Phase 6.15 — Pyth Hermes USD reference adapter

**Status:** Adapter, deterministic tests, and a manual-only validation workflow are implemented. Code CI [run #194](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40880232949) passed 152/152 tests, typechecking, build, dependency audit, and Gitleaks. No live Pyth request has been made by CI, no production price provider has been approved, and this does not authorize trading.

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

The workflow runs the existing identity/reserve validator, fetches the two authenticated Pyth references, and calls `assessIndependentReservePriceAgreement`. It records feed IDs, publish/retrieval timestamps, confidence values, response hashes and comparison reason codes, but does not print the API key or raw provider response.

## Interpretation and unresolved gates

- `AGREED` means the on-chain reserve ratio agrees with the Pyth-implied cross-rate within the explicitly supplied tolerance **and** the indexed USD/base price also passes its comparison. The indexed price comparison remains `NOT_ASSESSED` if DEX Screener's source-event timestamp is missing.
- `REFERENCE_SOURCE_TIMES_UNALIGNED` means SOL/USD and USDC/USD prices were not published close enough together under the run's explicit skew limit.
- Stale/future data, unknown source times, feed-ID mismatch, source aliasing, or out-of-tolerance values fail closed.
- A reserve ratio is not an executable swap quote; fees, slippage, routing, transfer fees, and reserve movement are not modeled.
- The diagnostic pool has only about $578 in indexed liquidity and is not a trading candidate.

The adapter and manual workflow are plumbing, not production approval. Provider plans/terms, a source freshness decision, independent feed and deviation policy, deployed binary/source matching, real provider fallback testing, and Phase 7 token-safety review remain open. `phase6Complete`, `productionProviderApprovedByThisReport`, and `tradingAuthorized` remain false.
