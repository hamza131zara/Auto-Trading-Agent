# Phase 6.7 — Provider Agreement and Fail-Closed Fallback Policy

**Status:** The read-only provider orchestration is integrated and the fixture-tested GeckoTerminal adapter candidate has passed CI [#219](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40923071801) with 179/179 tests, typecheck, build, dependency audit and Gitleaks. The new adapter is disabled by default and is not registered in the live runner. Official docs describe beta status, one-minute caching and an approximate 10-calls/minute limit, while a support article says 30/minute; the adapter conservatively enforces a seven-second process-local request interval. API use rights/attribution, current quota, commercial/distribution suitability, and current-observation timestamp remain open. Pyth still returns a 63-bps reserve/reference DISAGREEMENT; production approval and trading authorization remain false.

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

## Phase 6.16 — GeckoTerminal candidate adapter

The provider review in [Phase 6.16](16-geckoterminal-provider-review-and-adapter.md) records the official schema, terms, rate-limit discrepancy and timestamp limitations. A fixture-tested exact-pool adapter is available as @ata/market-data/providers/geckoterminal, with a seven-second process-local request pacing guard, fixed API version, size/timeout bounds, identity verification, raw-payload digest and synthetic provenance. It is not registered in the live runner. The public documentation and a support article conflict on rate limit (approximately 10 vs 30 calls/minute), so the stricter figure is assumed. Because the schema's pool-creation time is not a current snapshot time, source freshness remains UNKNOWN and the adapter cannot satisfy the agreement/evidence gate yet. No API terms approval, paid plan, or live call is assumed.

## Read-only provider orchestration

ReadOnlyMarketDataOrchestrator wires assessProviderAttemptPermission into the MarketDataAdapter contract. It validates unique provider IDs, independent source-family IDs and priorities; attempts providers in priority order; makes at most one request per provider per collection; preserves sanitized failure codes; validates each normalized observation against the exact requested pool and mints; updates provider health; and continues to registered fallbacks after a primary failure. The result returns every canonical observation and ProviderEvidenceCandidate for a separate agreement assessment. It never silently selects one provider as truth and never sets trade authorization. The Phase 6.13 live identity diagnostic is wired through this path with the single currently approved DEX Screener provider, for source inspection only. That is not independent consensus, candidate qualification, or live multi-provider fallback verification. Health and single-flight state are process-local; a multi-worker deployment needs durable health and a shared atomic lease.

## Provider-attempt and recovery-probe gate

`assessProviderAttemptPermission` is a deterministic, side-effect-free decision gate for one provider attempt. `UNKNOWN` permits an initial request; fresh `HEALTHY` permits a request; fresh `DEGRADED` permits a retry below the circuit-open threshold; stale health permits a health recheck; `UNAVAILABLE` blocks until operator correction; and `CIRCUIT_OPEN` blocks until `circuitOpenUntil`. After cooldown, the function returns `ALLOW_RECOVERY_PROBE` with `requiresExclusiveProbe: true`. The orchestrator must atomically claim and serialize that probe and pass `recoveryProbeInFlight: true` to block competing probes; this pure library function cannot provide a distributed lock itself.

`recordProviderResult` validates the previous health snapshot and rejects a result timestamp older than `lastRequestAt`, preventing out-of-order provider responses from restoring a healthier state after a newer failure. Equal timestamps are accepted because timestamps can be millisecond-granular; callers should serialize state updates for a single provider.

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

The Pyth Hermes adapter has completed a first live diagnostic; it fetched both feeds but the low-liquidity pool returned a 63-bps reserve/reference disagreement against a 10-bps run tolerance, and DEX Screener's source timestamp remains missing. No production provider has been selected. Hermes requires a Pyth API key; see [Phase 6.15](15-pyth-hermes-reference-adapter.md) for the secret name, official endpoint/feed references, and manual-only workflow. Live use remains blocked until the owner reviews the current plan/terms/quota/budget and approves feed identities, source age, retrieval age, cross-feed timestamp skew, future-time skew, and deviation tolerance.

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

`test/provider-orchestrator.test.mjs` covers agreeing observations, primary timeout with two fallback confirmations, lone-fallback insufficiency, value disagreement, normalization/identity failures, cooldown and recovery, and simultaneous single-flight requests. `test/provider-agreement.test.mjs` covers provider agreement and independent evidence blockers. `test/market-data.test.mjs` covers circuit-open cooldown boundaries, authentication failure blocking, stale-health recheck, malformed health, and out-of-order provider results. It also covers `assessCriticalMarketDataEvidenceGate`: a complete non-synthetic indexed-provider agreement plus an agreeing independent price comparison may proceed only to on-chain validation; the recorded live Pyth disagreement (63 bps), missing DEX Screener source timestamp, incomplete evidence, and malformed authorization-shaped input block that gate. CI [#213](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40907483897) passed 169/169 tests, typecheck, build, dependency audit, and Gitleaks. Orchestrator tests use injected stub adapters; normal CI makes no live provider or Solana RPC calls.


## Provider legal and timestamp screening — 2026-10-30

A documentation-only review of timestamped provider candidates was completed without creating credentials, activating adapters, spending funds, or making external provider requests.

| Candidate | Timestamp/market evidence | Current licensing/operational decision |
|---|---|---|
| Birdeye Price + OHLCV V3 Pair | Price endpoint documents a per-token update time; OHLCV V3 Pair is exact-pair scoped and supports second-level intervals. | Blocked pending written permission for the customer-facing/multi-customer product. Published Terms of Service restrict personal own use and prohibit third-party redistribution/access without written consent. No key, adapter activation, or spend. |
| GeckoTerminal / CoinGecko | Exact-pool OHLCV candle start can be retained as a price-only observation timestamp; pool-details timestamp remains unknown. | Potential future price-only evidence on an eligible paid commercial plan with attribution. Raw data/API redistribution is not included in standard commercial rights; custom license may be needed. Keep current adapter disabled until exact distribution/retention rights are cleared. |
| Pyth Hermes | Oracle publication timestamps for SOL/USD and USDC/USD. | Existing adapter only. Prior live diagnostic comparison disagreed by 63 bps against 10 bps; keep that result and tolerance unchanged. Provider terms, key/usage and source policy remain owner decisions. |

Official references reviewed on 2026-10-30: [Birdeye Price](https://docs.birdeye.so/reference/get-defi-price), [Birdeye OHLCV V3 Pair](https://docs.birdeye.so/reference/get-defi-v3-ohlcv-pair), [Birdeye pricing](https://docs.birdeye.so/docs/pricing), [Birdeye Terms](https://birdeye.so/data-api/terms-of-service), [GeckoTerminal API](https://api.geckoterminal.com/docs/index.html), [CoinGecko licensing update](https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses), and [Pyth Hermes](https://docs.pyth.network/api-reference/pyth-core/hermes).

Vendor branding is not proof of upstream independence. Before any candidate can enter the live registry, verify the exact upstream source family, timestamp/observation semantics, endpoint and schema version, plan entitlement, rate limits, terms, attribution, retention, customer redistribution rights, budget, health/fallback behavior and deterministic fixtures. No provider is promoted by this screening.


## Phase 6.21 — Reviewed provider source registry

The source registry and reviewed-lineage wrapper are specified in [Phase 6.21](21-provider-source-lineage-registry.md). Provider ID/group/timestamp claims are checked against the registry and actual canonical observation. CoinGecko and GeckoTerminal share one upstream family. All provider profiles remain unverified for pairwise independence, all production approvals remain false, and timestamp-missing pool metrics remain UNKNOWN. The wrapper must be used before an agreement assessment can advance an operational candidate; the lower-level comparator alone is not a provider approval. No provider was activated or called by this change.


## Phase 6.22 — Pyth and final critical gate integration

The reserve/Pyth comparator is now wrapped by `assessIndependentReservePriceAgreementWithReviewedLineage`, which checks Pyth provider/family identity, publication timestamps, indexed source role and actual source timestamp kind against the Phase 6.21 registry. The final evidence path must call `assessCriticalMarketDataEvidenceGateWithReviewedLineage`, which recomputes both provider-agreement and independent-price lineage assessments internally. A diagnostic arithmetic `AGREED` result is insufficient while upstream pairwise attestations, source freshness or provider rights are unresolved. See [Phase 6.22](22-pyth-independent-lineage-and-critical-gate.md).


## Phase 6.23 — Orchestrated health, fallback and disagreement assessment

The read-only provider orchestrator now has a composed assessment boundary in its own module. It validates that candidate snapshots, normalized observations, provider health and attempts refer to the same registrations, then returns raw agreement diagnostics separately from the Phase 6.21 reviewed-lineage assessment. A raw AGREED result does not grant progression. Only the reviewed result can allow the next independent on-chain evidence stage.

The deterministic integration suite covers rate-limit and timeout fallback, fallback disagreement, stale/missing source timestamps, circuit opening/cooldown, recovery probe disagreement, and non-retryable authentication lockout. The orchestrator remains process-local; a distributed health store and shared recovery-probe lease remain requirements before multi-process production deployment. See Phase 6.23 (23-provider-resilience-integration.md).


## Phase 6.23 — Resilience integration and fallback disagreement

The read-only orchestrator's completed collection now enters `assessReadOnlyMarketDataCollection`, which validates candidate/observation/health/attempt consistency and keeps raw agreement diagnostics distinct from registry-backed source-lineage readiness. A raw agreement result cannot advance the evidence path unless the reviewed wrapper also passes. Deterministic integration tests exercise rate-limit fallback, fallback disagreement, stale/missing source time, circuit cooldown, recovery-probe disagreement and authentication lockout. Health and the recovery-probe lock remain process-local; shared persistence and a distributed lease are required for multi-process production deployment. See [Phase 6.23](23-provider-resilience-integration.md).
