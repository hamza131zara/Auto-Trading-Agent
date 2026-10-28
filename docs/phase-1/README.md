# Phase 1 — Documentation and Requirements

**Status:** The original repository documentation set was reviewed and approved by the owner. The supplemental comparison documents below have been added to close gaps found against the frozen Roadmap v1.0. Provider-specific decisions, numeric thresholds and legal/tax applicability remain research questions until evidence and owner decisions are recorded.  
**Mode:** Documentation only. No production trading code, wallet connection, private-key handling or live execution is authorized during Phase 1.

## Objective
Translate the frozen roadmap into explicit, testable and source-backed requirements before UX design or implementation.

## Existing approved core documents
1. 01-product-charter.md — goals, scope, actors, operating modes and non-goals.
2. 02-functional-requirements.md — use cases, operator workflows and controls.
3. 03-trading-and-exit-policy.md — candidate lifecycle, one-position rule, exit profiles and re-entry policy.
4. 04-token-security-risk.md — token, pool, holder, wallet-cluster and exitability risk.
5. 05-quantitative-methodology.md — PnL, expectancy, outcome labels, calibration, Kelly research and compounding.
6. 06-architecture-and-data-sources.md — services, trust boundaries and integration candidates.
7. 07-security-privacy-and-operations.md — authentication, authorization, signer isolation, secrets and incident response.
8. 08-data-dictionary-and-audit.md — state entities, event records and strategy/model versions.
9. 09-test-plan-and-acceptance.md — quality strategy and stage gates.
10. 10-decision-log.md — confirmed decisions, open decisions and approvals.
11. 11-requirements-traceability.md — requirement-to-test traceability.
12. 12-dashboard-pages-and-operator-controls.md — existing dashboard inventory, UI controls, filters and indicators.
13. 13-tooling-and-technology-decisions.md — candidate stack and selection criteria.
14. 14-provider-and-integration-matrix.md — provider responsibilities, data ownership and fail-closed behavior.
15. 15-threat-model-and-risk-register.md — assets, trust boundaries, threats, mitigations and incident workflow.
16. 16-autonomous-trading-workflow.md — closed-loop discovery, selection, risk approval, execution, profit/exit, reconciliation and next-token cycle.
17. SOURCES.md — official documentation register and revalidation notes.

## Supplementary documents added after roadmap comparison
18. 17-roadmap-coverage-audit.md — source-to-repository coverage and DOC-01 through DOC-12 mapping.
19. 18-indicators-formulas-and-units.md — quantitative formulas, indicators, units and implementation cautions.
20. 19-agent-brain-and-memory-spec.md — complete decision-module authority matrix, typed Choice/Score/proposition outputs and memory policy.
21. 20-execution-reconciliation-and-signer-contract.md — order state machine, trade intent, signer checks and unknown transaction recovery.
22. 21-cost-and-operations-plan.md — DOC-11 provider usage, operating budgets, run-rate calculators and incident ownership.
23. 22-legal-tax-and-service-boundary-review.md — DOC-12 jurisdiction/service classification, tax questions and review gate; this is not legal clearance.
24. 23-shadow-canary-launch-and-post-launch-governance.md — canonical modes, shadow/paper criteria, live canary and post-launch governance.
25. 24-canonical-phase-map-and-repository-structure.md — frozen Phase 0–17 order, operating modes, package layout and engineering foundation.
26. 25-canonical-dashboard-page-crosswalk.md — canonical 17-page roadmap map mapped to existing UI concepts.

## Canonical roadmap references
- [Frozen roadmap baseline](../roadmap/ROADMAP-BASELINE.md)
- [Canonical phase map](../roadmap/ROADMAP-CANONICAL-PHASE-MAP.md)
- [Roadmap Markdown companion](../roadmap/Solana_Dex_Agent_Roadmap_v1.md)
- [Roadmap coverage audit](17-roadmap-coverage-audit.md)

## Approval and evidence process
- Existing core documents remain owner-approved as previously recorded.
- The supplemental files are additive coverage corrections. Review them as an amendment set; they do not change roadmap scope or phase sequence.
- Mark remaining policy items as Proposed, Needs research, Accepted or Rejected, and record evidence/rationale in 10-decision-log.md.
- Provider/API version, rates, quotas, contract terms and legal/tax classification must be checked against authoritative sources before relying on them.
- Numeric trading thresholds and performance gates must be predeclared before the evaluation run; do not tune them after inspecting holdout results.
- No design/build phase begins until the remaining Phase 1 exit items and exact phase gate in the frozen roadmap are satisfied.

## Non-negotiable constraints
- Solana spot DEX only for V1; no leverage or borrowing.
- Maximum one open position globally across the trading portfolio.
- NO_TRADE is a valid and often correct outcome.
- Deterministic security and risk gates have final veto authority.
- LLM/agent components cannot access signing secrets, withdraw assets, bypass risk rules or alter hard limits.
- Fixed-target, trend-capture and high-upside runner strategies are hypotheses to test, not assumed profitable policies.
- Kelly sizing remains research-only until assumptions, uncertainty, tail-loss and exposure constraints are tested.
- No claim or guarantee of win rate, return or target attainment.
- Backtests, out-of-sample tests, paper/shadow trading, independent security review, incident drills and explicit release approval precede live trading.

## Phase 1 remaining exit work
1. Revalidate selected providers, exact API/SDK versions, rate limits, prices, product terms and failure behavior.
2. Choose and document measurable hard token-security, data-freshness, quote-age, liquidity, price-impact and risk thresholds.
3. Finalize signer/custody design and the complete authentication/authorization policy.
4. Resolve owner decisions about target milestone behavior, operating-mode transitions, approved strategies and budget ceilings.
5. Pre-register quantitative and paper/shadow evaluation gates.
6. Obtain qualified review of the applicable legal/tax/service boundary before relevant live use or any public/third-party service.
7. Record remaining decisions and evidence. Phase 1 exit does not automatically authorize mainnet trading; later gates still apply.