# Phase 6.22 — Pyth independent lineage and critical evidence gate

## Status

Merged through [PR #39](https://github.com/hamza131zara/Auto-Trading-Agent/pull/39), commit `c2636b885f39f2fdfdac518f71ac144367770db6`. Post-merge CI [run #263](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41012644552) passed 245/245 tests, repository validation, typecheck/build, dependency audit (zero vulnerabilities), and Gitleaks. PR #39 also passed both CodeQL analyses and Dependency Review. No live provider calls or RPC requests were made by this change. No key was created or requested, provider activation remains disabled, spending remains USD $0, and trading authorization remains false.

## Purpose

Phase 6.21 established a reviewed provider registry and a wrapper for indexed provider agreement. Phase 6.22 extends that registry into the independent USD-price comparison path and composes both reviewed evidence paths into the final critical market-data gate.

The existing arithmetic comparator remains unchanged and available for deterministic diagnostics. A numerically agreed reserve/Pyth ratio is not enough to pass the new reviewed-lineage wrapper.

## Pyth reference lineage

`assessIndependentReservePriceAgreementWithReviewedLineage`:
- Requires base/USD and quote/USD observations to identify the exact `approvedProviderId` and `approvedIndependenceGroupId` from the comparison policy.
- Requires both reference observations to come from the same approved provider family and to carry valid publication timestamps.
- Resolves the reference source as the registry role `USD_REFERENCE` with timestamp kind `EVENT`.
- Resolves the indexed USD/base source as role `INDEXED_PRICE`; timestamp kind is derived from `indexedSourceEventAt`, then `indexedSourceObservedAt`, or `NONE`. Retrieval time cannot upgrade a missing source timestamp.
- Runs the original reserve/reference and indexed/reference arithmetic comparator for diagnostics. The outer assessment remains `BLOCKED` unless source lineage is registry-ready and the comparison is `AGREED` with complete evidence.
- Always returns `tradingAuthorized: false`.

Current result is intentionally blocked: Pyth's source lineage remains unverified and no mutually attested upstream pair exists. DEX Screener's current indexed-price profile has no source event/observation timestamp. GeckoTerminal OHLCV may supply a candle-boundary observation for price only, but its current diagnostic access remains disabled pending terms/rights review.

## Final critical market-data gate

`assessCriticalMarketDataEvidenceGateWithReviewedLineage` receives the raw provider-agreement input and independent-comparison input, then recomputes both reviewed-lineage wrappers internally. It does not trust pre-computed caller-supplied ready flags. It can return `READY_FOR_ON_CHAIN_VALIDATION` only when:
1. provider agreement passed its reviewed source-lineage gate;
2. independent reserve/Pyth comparison passed its reviewed source-lineage gate;
3. the existing provider agreement and comparison assessments satisfy the original internal consistency checks.

That result only permits the next distinct on-chain evidence stage. It does not authorize an order, transaction signature, deployment, or trade.

The Pyth manual runner does not contain the multi-provider pool-metrics agreement evidence required by the final gate. Its report therefore records the reviewed Pyth/indexed lineage result and explicitly marks the final critical gate `NOT_ASSESSED` with `PROVIDER_AGREEMENT_EVIDENCE_NOT_INCLUDED_IN_PYTH_REFERENCE_RUNNER`; it must not synthesize missing provider agreement data.

## Current source readiness

| Evidence stream | Current source | Timestamp semantics | Gate result |
|---|---|---|---|
| Pool metrics / exact pool | DEX Screener / Raydium indexed data | NONE for trusted source event time | Cannot establish source freshness |
| Indexed price | DEX Screener | NONE | Blocked when source timestamp required |
| Indexed price | GeckoTerminal exact-pool OHLCV | OBSERVATION (candle start) for price only | Disabled pending terms/rights; not pool-metric freshness |
| USD reference | Pyth Hermes SOL/USD + USDC/USD | EVENT (publish time) | Source profile remains UNVERIFIED |
| On-chain reserve state | Solana finalized RPC | SLOT | Separate identity/context gate; shared public endpoint not production-approved |

No source pair currently has mutual owner-attested upstream independence. Do not mark a source pair ready based on different vendor names or on successful arithmetic alone.

## Regression coverage

`test/phase6-reviewed-lineage-gates.test.mjs` covers:
- arithmetic agreement with unverified lineage remains blocked;
- missing DEX Screener source time stays NONE;
- GeckoTerminal candle start remains OBSERVATION and its disabled terms state blocks;
- Pyth base/quote provider-family mismatch is invalid;
- the final gate recomputes both lineage wrappers and blocks unverified inputs;
- malformed final-gate inputs cannot advance.

The Phase 6.22 wrappers are pure functions. No adapters are activated, no network I/O occurs, no environment secrets are read, and no signer/order path exists.
