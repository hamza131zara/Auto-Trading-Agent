# Phase 6.17 — Timestamped indexed-price evidence in the manual reserve comparator

**Status:** Implemented and CI-verified in [run #229](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40934354059): 191/191 tests passed, with typecheck, build, repository validation, dependency audit and Gitleaks green. The workflow defaults to DEX Screener. GeckoTerminal API access is never initiated by CI or by default. No live GeckoTerminal request or paid-plan activation is part of this implementation.

## Purpose

Phase 6.16 added a timestamped minute-OHLCV price adapter, and the comparator already accepted explicitly approved observation timestamps. The remaining integration gap was that the manual Pyth reserve-comparison runner did not pass OHLCV evidence into that comparator. This change wires it end-to-end without changing pool thresholds, deviation tolerances, or trading scope.

## Manual workflow behavior

Use [the manual Pyth reserve-validation workflow](../../.github/workflows/phase6-pyth-reference-validation.yml) on `main`. The indexed-price source defaults to `dex-screener`. DEX Screener remains the exact-pool identity lookup source either way.

Selecting `geckoterminal` requires two additional affirmative inputs before any network request: (1) terms/use rights, attribution, storage, effective quota and budget reviewed for the exact intended use, including any plan requirements; and (2) the exact pool's OHLCV source, provider family, candle-start semantics and run freshness policy reviewed. Both inputs default to `no`. If either is not `yes`, preflight blocks before identity/RPC, Pyth, or GeckoTerminal requests. The script repeats this check. This is per-run operator confirmation, not a lasting production approval. The documented budget remains USD $0; do not select a usage model requiring spend until that plan/budget is explicitly approved.

When selected and approved, the runner requests the exact pool's one-minute OHLCV endpoint, validates pool/mint identity and payload hash, and sends the candle close to the reserve-price comparator. Candle opening time is passed as `indexedSourceObservedAt`, never as a trade event time. Source age and retrieval age are checked under explicitly supplied run policy. The runner supplies the approved provider ID and `geckoterminal-coingecko-ecosystem` source group only for this selected diagnostic; that group identifier is not proof of independent upstream data.

## Evidence semantics

- The DEX Screener report continues to document the exact pair used for pool identity.
- `indexedPriceEvidence` documents the actual comparison-price provider, group, price, timestamp kind, source/retrieval times, request ID, raw-response digest, and synthetic flag.
- GeckoTerminal pool-details data still lacks trusted current observation/event time. This change does not make its liquidity, reserve or 24-hour-volume fields fresh or complete full-snapshot provider consensus.
- Missing, stale, future, synthetic or mismatched evidence remains blocked/insufficient.
- The reserve ratio remains a ratio of decoded token reserves—not an executable swap quote. A passing comparison does not prove pool eligibility, token safety, profitability, or trade authorization.

## Tests and acceptance

Resolver tests verify DEX Screener default behavior, fail-closed gating before adapter construction, candle-start preservation as observation time, exact pool/mint propagation, and unknown-source rejection. Existing adapter/comparator tests cover candle selection, identity, freshness, explicit source approval and synthetic-evidence rejection.

Phase 6 remains active. Do not activate GeckoTerminal until current API rights, attribution, quota, storage and budget are approved. Do not relax thresholds or tolerance. `phase6Complete`, production-provider approval and `tradingAuthorized` remain false.
