# Phase 6.23 — Provider disagreement, health, fallback and recovery integration

## Status

Implemented on branch phase6-provider-resilience-integration; awaiting CI and review. The work is an offline orchestration/assessment composition with deterministic adapter stubs. No live provider or RPC calls were made, no credentials were created, no adapter was activated, spend remains USD $0, and trading remains unauthorized.

## Purpose

The read-only orchestrator already maintained per-provider health, serialized in-process requests, continued after retryable failures, opened circuits after repeated retryable failures, allowed a single cooldown recovery probe, and collected all successful observations rather than silently choosing the primary.

Phase 6.23 adds a single assessment boundary for the completed collection. It returns raw provider-agreement diagnostics separately from the reviewed-lineage result and derives all operational progression only from the reviewed result.

## New composition

The exported assessReadOnlyMarketDataCollection function accepts one completed ReadOnlyMarketDataCollection plus explicit agreement and lineage policies.

It validates:
- candidate, observation, health and attempt cardinality;
- one-to-one provider identity between candidate snapshots and normalized observations;
- health records match the candidate health state and request time;
- one attempt per registered provider, with matching group and priority;
- sanitized reason-code shape.

It then computes the raw diagnostic agreement and a separate reviewed source-lineage agreement. Timestamp kind is derived from each candidate's actual sourceEventAt, observedAt or neither. The role is POOL_METRICS. Retrieval time cannot be upgraded to event/observation time.

The diagnostic agreement remains visible for investigation, including DISAGREEMENT and INSUFFICIENT_EVIDENCE outcomes. It never grants progression. Only a READY reviewed-lineage assessment can set canProceedToOnChainValidation true. tradingAuthorized remains literal false.

## Failure and recovery behavior

| Scenario | Required behavior |
|---|---|
| Primary timeout or network failure | Record sanitized failure; continue to configured fallbacks. |
| Rate limit | Record RATE_LIMIT; retry only while health policy permits; continue fallback collection. |
| Repeated retryable failures | Transition DEGRADED to CIRCUIT_OPEN at configured threshold; block requests before cooldown expiry. |
| Non-retryable AUTH/PARSE | Mark UNAVAILABLE; stop retrying automatically until operator correction. |
| Stale or missing source time | Reject from provider agreement even when retrieval and provider health are recent. |
| Fallback disagreement | Preserve all eligible providers and disagreement fields; do not select the primary or a majority response. |
| Recovery after cooldown | Permit one serialized recovery probe; success resets health, but its observation still must pass all agreement, freshness and lineage gates. |
| Recovery still disagrees | Report DISAGREEMENT; the recovered primary does not override fallback evidence. |

The orchestrator is process-local. Multi-process deployments still require shared health persistence and a distributed lease/atomic probe claim; this phase does not claim to solve that deployment concern.

## Deterministic regression coverage

test/phase6-provider-resilience.test.mjs exercises:
- healthy arithmetic agreement remains diagnostic-only while current registry profiles are unverified;
- rate-limited primary with two fallbacks that disagree;
- recent retrieval with stale source-event time;
- missing event and observation timestamps;
- two rate limits opening the primary circuit, cooldown blocking, and a recovery probe whose price disagrees with the fallbacks;
- non-retryable authentication failure staying unavailable while independent fallbacks continue.

Existing provider-orchestrator tests remain in place for timeout handling, primary/fallback consensus, normalization failure, invalid identity, one-flight requests, circuit cooldown and recovery.

## Explicit limitations and remaining owner gates

The source registry still marks all provider lineages UNVERIFIED. GeckoTerminal remains disabled pending terms/rights review. DEX Screener and Raydium indexed pool-metric timestamps remain unavailable in the current profiles. Consequently, the reviewed result is expected to remain BLOCKED even if the raw diagnostic comparator reports AGREED.

The in-process orchestrator does not provide cross-process health persistence or a distributed recovery lease. The composition does not activate providers, set a production provider, approve commercial rights, relax liquidity/volume thresholds, alter the 10-bps diagnostic tolerance, authorize transactions, or complete Phase 6.
