# Phase 6.5 — Acceptance Criteria and Open Decisions

**Status:** Active; the provider-neutral contract and read-only DEX Screener candidate adapter are fixture-tested, and PR CI/security gates passed on 29 October 2026. No production market-data vendor is approved.

## Acceptance checklist

- [x] Canonical Solana market-observation schema is versioned, strictly validated and preserves explicit units/nulls/provenance in `@ata/market-data`.
- [x] Solana public-key encoding, non-negative decimal strings, counts, slots, units and UTC timestamps have positive/negative tests.
- [x] Freshness assessment is deterministic under an injected clock and returns distinct FRESH, STALE, UNKNOWN and INVALID states.
- [x] Provider health is distinct from freshness/data quality and has tested success, retryable failure, threshold/circuit-open, auth/config failure and recovery paths.
- [x] Synthetic fixtures cover fresh, stale retrieval, stale source event, missing timestamp, future source time and invalid address; unit tests cover malformed decimal/unit and provider failure/recovery paths.
- [x] Replay tests run without external network access, production credentials or non-deterministic clocks.
- [x] The DEX Screener candidate's mocked-fetch tests pass in CI for exact identity matching, unit/decimal normalization, fetch/body timeout classification, rate-limit handling, and sanitized failures. Quality CI passed at [run 40818498807](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40818498807); Dependency Review passed at [run 40818499007](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40818499007), and the included Gitleaks scan passed in the quality CI run. These are synthetic/mock tests; CI makes no live DEX Screener API call.
- [x] Provider disagreement/fallback evidence gate implemented with deterministic tests for exact identity/value matching, unavailable primary, single-fallback insufficiency, freshness recheck, missing measures, synthetic fixtures and fail-closed conflict handling. See [Phase 6.7](07-provider-agreement-and-fallback-policy.md); CI evidence will be recorded after this branch passes.
- [ ] Implement and test an independent on-chain validator for pool/mint/program identity. The comparator is not on-chain verification.
- [ ] Production approval of the DEX Screener candidate requires a fresh official schema/terms/quota review, account/budget decision where applicable, and documented on-chain validation/fallback/disagreement behavior.
- [ ] Production use stays disabled until selected adapters are tested against the chosen plan and critical fields have independent validation paths.

## Open decisions

| ID | Decision | Default / gate |
|---|---|---|
| P6-O-001 | Primary and fallback RPC provider | Unselected; official current docs, quota, latency, failover and account terms required |
| P6-O-002 | Indexed discovery provider(s) | DEX Screener has a fixture-tested read-only candidate adapter only; production selection still requires official schema/terms/quota review, budget, freshness semantics, and replacement/fallback plan |
| P6-O-003 | Source-specific freshness bounds | Must be evidence-based and approved before a freshness state is used as a trading gate |
| P6-O-004 | Canonical USD valuation semantics | Store explicit source units; no implicit conversions or inference without a reviewed FX/quote rule |
| P6-O-005 | Historical retention/raw-payload policy | Minimize retained data; define redaction, cost, provenance and reproducibility need |
| P6-O-006 | Provider disagreement tolerances | No silent preference; critical conflicts remain inconsistent/unknown until independently resolved |
| P6-O-007 | Stream reconnect/replay and rate-limit policy | Provider-specific and fixture-tested before streaming adapter approval |

## Phase exit rule

Close Phase 6 only when acceptance items above are tested, selected adapters and fallback behavior are documented, failure/degraded modes are proven safe, and replay is deterministic. Phase 7 token safety and all trade execution remain out of scope.
