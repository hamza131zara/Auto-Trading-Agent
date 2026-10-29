# Phase 6.5 — Acceptance Criteria and Open Decisions

**Status:** Active; first provider-neutral data-contract slice under implementation. No production adapter or market-data vendor is approved.

## Acceptance checklist

- [ ] Canonical Solana market-observation schema is versioned, strictly validated and preserves explicit units/nulls/provenance.
- [ ] Solana public-key encoding, non-negative decimal strings, counts, slots, units and UTC timestamps have passing positive/negative tests.
- [ ] Freshness assessment is deterministic under an injected clock and returns distinct FRESH, STALE, UNKNOWN and INVALID states.
- [ ] Provider health is distinct from freshness/data quality and has tested success, retryable failure, threshold/circuit-open, auth/config failure and recovery paths.
- [ ] Synthetic fixtures cover fresh, stale, missing timestamp, future clock, malformed ID/unit and provider failure cases.
- [ ] Replay tests run without external network access, production credentials or non-deterministic clocks.
- [ ] A concrete provider adapter is not approved until official documentation, plan/quota, terms and fallback/disagreement behavior are reviewed.
- [ ] Production use stays disabled until selected adapters are tested against the chosen plan and critical fields have independent validation paths.

## Open decisions

| ID | Decision | Default / gate |
|---|---|---|
| P6-O-001 | Primary and fallback RPC provider | Unselected; official current docs, quota, latency, failover and account terms required |
| P6-O-002 | Indexed discovery provider(s) | Shortlist only; decide fields, licensing, freshness, quota and replacement strategy |
| P6-O-003 | Source-specific freshness bounds | Must be evidence-based and approved before a freshness state is used as a trading gate |
| P6-O-004 | Canonical USD valuation semantics | Store explicit source units; no implicit conversions or inference without a reviewed FX/quote rule |
| P6-O-005 | Historical retention/raw-payload policy | Minimize retained data; define redaction, cost, provenance and reproducibility need |
| P6-O-006 | Provider disagreement tolerances | No silent preference; critical conflicts remain inconsistent/unknown until independently resolved |
| P6-O-007 | Stream reconnect/replay and rate-limit policy | Provider-specific and fixture-tested before streaming adapter approval |

## Phase exit rule

Close Phase 6 only when acceptance items above are tested, selected adapters and fallback behavior are documented, failure/degraded modes are proven safe, and replay is deterministic. Phase 7 token safety and all trade execution remain out of scope.
