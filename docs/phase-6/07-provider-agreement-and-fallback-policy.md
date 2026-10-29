# Phase 6.7 — Provider Agreement and Fail-Closed Fallback Policy

**Status:** Provider agreement and the reserve/independent-USD comparison now have a combined fail-closed Phase 6 gate, `assessCriticalMarketDataEvidenceGate`. It allows progression only when two independent indexed providers agree, the reserve/reference comparator is `AGREED`, and all evidence is complete and non-synthetic; provider disagreement, Pyth disagreement, missing timestamps, synthetic evidence, and malformed inputs remain blocked. Live Pyth run [#2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40892770577) returned a 63-bps reserve/reference disagreement against the 10-bps run tolerance, and regression coverage pins that outcome. Production approval and trading authorization remain false.

## Purpose

A provider fallback is not permission to trust a single unverified response. This policy evaluates a prioritized list of provider attempts and returns a machine-readable evidence status. It never sends requests, selects a trading venue, starts retries, signs transactions, or creates trade intents.

## Inputs and validation

Every candidate contains:

- a unique safe provider ID;
- a safe `independenceGroupId` identifying the upstream vendor/source family (two adapter aliases to the same underlying source cannot count as independent);
- a unique integer priority, where `0` is preferred and larger values are fallback positions;
- the provider-health snapshot for that same ID;
- either a canonical observation or explicit `null` when the provider did not produce one.

The policy requires an injected UTC evaluation time and separate explicit maximum ages for market observations and the provider-health snapshot. Both freshness values are recomputed with the canonical freshness function; a caller-supplied `FRESH` label or old `HEALTHY` state is not accepted as proof. The health snapshot is structurally checked for state-consistent timestamps/counters as well. A candidate is eligible only when its canonical snapshot validates, provenance provider ID matches the candidate ID, the pool identity exists, provider health is `HEALTHY`, and recomputed freshness is `FRESH`.

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
- Observations must have the same source-observation/event instant to be compared. UTC timestamp strings are compared as parsed instants, so equivalent representations such as `...:50Z` and `...:50.000Z` are equivalent. Because no approved maximum source-time skew exists yet, different source instants return `INSUFFICIENT_EVIDENCE`; the evaluator does not guess whether observations are close enough in time.
- Price, liquidity and 24-hour volume must all be present. Their units and asset IDs must match. Decimal strings are compared numerically using string operations (so `250000`, `250000.0` and `250000.0000` are equivalent); no IEEE-754 conversion or tolerance is applied.
- Buy and sell counts must be present and equal. A missing measure/count remains missing; it is never changed to zero.
- Any comparable identity/value disagreement blocks the entire candidate set. No majority vote, implicit weighting, or automatic provider switching around a conflict exists.

These strict rules are deliberately conservative. No numeric price/liquidity/volume tolerance, source-time window, provider weighting or quorum relaxation has been owner-approved, so this implementation does not invent one.

## Independent on-chain reserve / USD price comparison

`assessIndependentReservePriceAgreement` is a pure, provider-neutral evidence evaluator. It compares the decoded on-chain quote/base reserve ratio with the cross-rate implied by separately timestamped base/USD and quote/USD reference observations, and compares an indexed USD/base price only when that indexed source has a trustworthy event timestamp. It uses integer arithmetic over canonical decimal strings; no IEEE-754 conversion or rounded intermediate cross-rate is used.

The policy has no production defaults. Callers must explicitly supply expected base/quote feed IDs, approved provider ID and independence group, source/retrieval age bounds, future-time skew, and maximum deviation in basis points, plus a maximum publication-time difference between base/USD and quote/USD reference observations. The reference provider and source family must differ from the indexed source. Missing indexed source time yields `NOT_ASSESSED`; reference feed timestamps outside the approved skew window or stale reference data yield insufficient evidence; out-of-tolerance values return `DISAGREEMENT`; synthetic evidence cannot set `comparisonEvidenceComplete: true`. `tradingAuthorized` is always false.

The Pyth Hermes adapter is prepared for official Solana SOL/USD and USDC/USD feed IDs, but no live Pyth request has been made and no production provider has been selected. Hermes requires a Pyth API key; see [Phase 6.15](15-pyth-hermes-reference-adapter.md) for the secret name, official endpoint/feed references, and manual-only workflow. Live use remains blocked until the owner reviews the current plan/terms/quota/budget and approves feed identities, source age, retrieval age, cross-feed timestamp skew, future-time skew, and deviation tolerance.

## Combined critical market-data evidence gate

`assessCriticalMarketDataEvidenceGate` combines the indexed-provider agreement assessment with `assessIndependentReservePriceAgreement`. A candidate can advance to the separate on-chain validation stage only when:
- provider agreement status is `AGREED` and `canProceedToOnChainValidation` is true (at least two distinct, healthy, fresh and non-synthetic observations);
- independent reserve/USD comparison status is `AGREED`;
- `comparisonEvidenceComplete` is true; and
- both component contracts retain `tradingAuthorized: false`.

Any provider disagreement, reserve/reference disagreement, missing indexed source timestamp, stale/unaligned data, synthetic-only agreement, incomplete evidence, or malformed/forged authorization-shaped input blocks the gate. Original component reason codes are preserved alongside gate-level blocker codes. `READY_FOR_ON_CHAIN_VALIDATION` only permits the next independent on-chain evidence stage; it is not a candidate recommendation, production approval, or trade authorization.

The live run #2 regression uses the actual observed reserve ratio, Pyth SOL/USD and USDC/USD values, missing DEX Screener event timestamp and 10-bps tolerance. It asserts `DISAGREEMENT`, `NOT_ASSESSED`, and an overall `BLOCKED` gate. Tests also cover an agreeing synthetic-free fixture and malformed authorization-shaped input.

## Safety boundary and remaining gates

`canProceedToOnChainValidation` is only an evidence-gate result. On-chain pool/mint/program validation is a separate implementation step and has not been performed by this comparator. `tradingAuthorized` is hard-coded `false` for every result. No Phase 6 code can use this assessment as trade authorization.

The first live Pyth read confirms both the reference feeds are available and fresh; however, run #2 returned a 63-bps reserve/reference disagreement and DEX Screener observation/event timestamps remain null. The combined gate rejects that evidence, even if indexed providers agree with one another. Owner-approved production policy, live fallback/degraded testing and a threshold-qualified pool remain open.

## Tests

`test/provider-agreement.test.mjs` covers agreeing sources, exact-decimal equivalence, differing values/identity, unaligned source times, unhealthy primary plus two fallbacks, a lone fallback, stale/unknown observations, missing measures, synthetic evidence, duplicate candidates, provenance mismatch, and invalid policy. The tests use deterministic synthetic fixtures and do not call a provider or Solana RPC.
