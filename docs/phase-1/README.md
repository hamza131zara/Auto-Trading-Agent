# Phase 1 — Documentation and Requirements

**Status:** Draft in progress — owner approval pending.  
**Mode:** Documentation only. No production trading code, wallet connection, or private-key handling is authorized in this phase.

## Objective
Translate the frozen roadmap into explicit, testable and source-backed requirements before UX design or implementation.

## Documents in this workstream
1. 01-product-charter.md — goals, scope, actors, operating modes and non-goals.
2. 02-functional-requirements.md — use cases, operator workflows and controls.
3. 03-trading-and-exit-policy.md — candidate lifecycle, one-position rule, exit profiles and re-entry policy.
4. 04-token-security-risk.md — token, pool, holder, wallet-cluster and exitability risk.
5. 05-quantitative-methodology.md — net PnL, expectancy, outcome labels, calibration, Kelly research and compounding simulation.
6. 06-architecture-and-data-sources.md — services, trust boundaries and integration candidates.
7. 07-security-privacy-and-operations.md — authentication, authorization, signer isolation, secrets and incident response.
8. 08-data-dictionary-and-audit.md — state entities, event records and strategy/model versions.
9. 09-test-plan-and-acceptance.md — quality strategy and stage gates.
10. 10-decision-log.md — confirmed decisions, open decisions and explicit approvals.
11. 11-requirements-traceability.md — requirement-to-test traceability.
12. 12-dashboard-pages-and-operator-controls.md — page inventory, UI controls, filters, indicators and calculators.
13. 13-tooling-and-technology-decisions.md — candidate stack and selection criteria.
14. 14-provider-and-integration-matrix.md — provider responsibilities, data ownership and fail-closed behavior.
15. 15-threat-model-and-risk-register.md — assets, trust boundaries, threats, mitigations and incident workflow.
16. SOURCES.md — official documentation register and revalidation notes.

## Approval workflow
- Mark each requirement as Proposed, Needs research, Accepted, or Rejected.
- Cite a primary/official source for provider capabilities, API behavior, and security-sensitive technical claims.
- Record rationale and owner approval for material decisions.
- Do not silently change the frozen roadmap. Any scope/phase change requires explicit owner approval and a log entry.
- No UI design/build phase begins until the owner explicitly approves the Phase 1 package.

## Mandatory constraints
- Solana spot DEX only for V1; no leverage or borrowing.
- Maximum one open position globally across the trading portfolio.
- NO_TRADE is a valid and often correct outcome.
- Deterministic security and risk gates have final veto authority.
- LLM/agent components cannot access signing secrets, withdraw assets, bypass risk rules, or alter hard limits.
- Fixed-target, trend-capture and high-upside runner strategies are hypotheses to test, not assumed profitable policies.
- Kelly sizing remains research-only until assumptions, uncertainty, tail-loss and exposure constraints are tested.
- No claim or guarantee of win rate, return, or target attainment.
- Backtests, out-of-sample tests, paper trading, incident drills and explicit release approval precede live trading.

## Phase 1 exit gate
The owner explicitly approves functional requirements, trading/exit rules, security and signer model, quantitative methodology, data/provider choices, and test/launch gates. Until then, all items remain drafts.