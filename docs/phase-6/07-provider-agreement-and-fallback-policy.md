# Phase 6.7 — Provider Agreement and Fail-Closed Fallback Policy

**Status:** Implemented as a deterministic, fixture-tested evidence gate. It is not production provider approval and does not authorize trading.

## Purpose

A provider fallback is not permission to trust a single unverified response. This policy evaluates a prioritized list of provider attempts and returns a machine-readable evidence status. It never sends requests, selects a trading venue, starts retries, signs transactions, or creates trade intents.

## Inputs and validation

Every candidate contains:

- a unique safe provider ID;
- a unique integer priority, where `0` is preferred and larger values are fallback positions;
- the provider-health snapshot for that same ID;
- either a canonical observation or explicit `null` when the provider did not produce one.

The policy requires an injected UTC evaluation time and an explicit maximum age. Freshness is recomputed with the canonical freshness function; a caller-supplied `FRESH` label is not accepted as proof. A candidate is eligible only when its canonical snapshot validates, provenance provider ID matches the candidate ID, the pool identity exists, provider health is `HEALTHY`, and recomputed freshness is `FRESH`.

Synthetic observations are rejected by default. Tests may pass `allowSyntheticFixtures: true` to exercise the comparison algorithm, but an agreement made with any synthetic observation cannot advance to on-chain validation. Unknown, stale, invalid, missing-timestamp and unhealthy observations remain rejected with stable reason codes.

## Outcomes

| Status | Meaning | Action |
|---|---|---|
| `AGREED` | At least two eligible, distinct providers agree on identity, aligned source time, measures and counts | May advance to independent on-chain validation only when all evidence is non-synthetic |
| `DISAGREEMENT` | Provider identity or comparable values conflict | Block the candidate; do not silently prefer primary or fallback |
| `INSUFFICIENT_EVIDENCE` | Fewer than two eligible providers, source times cannot be aligned, or required measures/counts are missing | Block progression; keep data unknown/incomplete |
| `NO_ACCEPTABLE_PROVIDER` | No provider passes validation, health, synthetic-evidence and freshness gates | Block; do not promote stale or unhealthy data |
| `INVALID_INPUT` | Invalid policy/candidate metadata, duplicate provider/priority, mismatched health identity or mismatched provenance identity | Block and correct the orchestration input |

A fallback is marked as used when no priority-`0` candidate is eligible but one or more fallback candidates are eligible. A lone fallback is still insufficient evidence. Two agreeing fallbacks can produce `AGREED` when the primary is unavailable, but this is only evidence assessment—not a provider selection. If an eligible primary conflicts with an eligible fallback, the result is `DISAGREEMENT`; priority never overrides contradictory evidence.

## Comparability rules

- Chain, cluster, base mint, quote mint and pool address must match exactly.
- Observations must have the same source-observation/event timestamp to be compared. Because no approved maximum source-time skew exists yet, different source timestamps return `INSUFFICIENT_EVIDENCE`; the evaluator does not guess whether the observations are close enough in time.
- Price, liquidity and 24-hour volume must all be present. Their units and asset IDs must match. Decimal strings are compared numerically using string operations (so `250000`, `250000.0` and `250000.0000` are equivalent); no IEEE-754 conversion or tolerance is applied.
- Buy and sell counts must be present and equal. A missing measure/count remains missing; it is never changed to zero.
- Any comparable identity/value disagreement blocks the entire candidate set. No majority vote, implicit weighting, or automatic provider switching around a conflict exists.

These strict rules are deliberately conservative. No numeric price/liquidity/volume tolerance, source-time window, provider weighting or quorum relaxation has been owner-approved, so this implementation does not invent one.

## Safety boundary and remaining gates

`canProceedToOnChainValidation` is only an evidence-gate result. On-chain pool/mint/program validation is a separate implementation step and has not been performed by this comparator. `tradingAuthorized` is hard-coded `false` for every result. No Phase 6 code can use this assessment as trade authorization.

The DEX Screener candidate currently leaves source observation/event times null, so its recomputed freshness remains `UNKNOWN` and it is ineligible here. A primary plus independent, timestamped source (or sources) must be selected only after the official schema/terms/quota, budget and customer-distribution gates are resolved. Provider disagreement tolerances and fallback policy changes require a dated owner-approved decision.

## Tests

`test/provider-agreement.test.mjs` covers agreeing sources, exact-decimal equivalence, differing values/identity, unaligned source times, unhealthy primary plus two fallbacks, a lone fallback, stale/unknown observations, missing measures, synthetic evidence, duplicate candidates, provenance mismatch, and invalid policy. The tests use deterministic synthetic fixtures and do not call a provider or Solana RPC.
