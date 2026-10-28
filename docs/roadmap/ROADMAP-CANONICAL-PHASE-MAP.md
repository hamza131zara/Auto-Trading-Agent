# Canonical Roadmap Phase Map — Roadmap v1.0

**Canonical source:** Solana Autonomous DEX Trading Agent — Roadmap & Requirements Blueprint, v1.0, dated 20 October 2026 (22-page DOCX/PDF supplied by the owner).  
**Status:** Frozen. This file normalizes references in the repository; it does not amend scope or phases.

## Exact phase order

| Phase | Canonical title | Main output |
|---:|---|---|
| 0 | Project governance & scope freeze | Charter, V1 boundaries, decision/approval workflow, risk ownership |
| 1 | Documentation research & source verification | Official source review, API/SDK decisions, source/provider/cost matrix, data dictionary, risk and regulatory register |
| 2 | Product requirements & quantitative policy | PRD, trading/state policy, exit policy, formulas/units, acceptance test catalogue |
| 3 | Threat model, custody model & security architecture | Threat model, signer/custody design, auth/MFA, security mapped to tests, incident/key runbooks |
| 4 | UX, dashboard information architecture & design system | User flows, wireframes, design system, clickable prototype and UX sign-off |
| 5 | Repository, environments, CI/CD & engineering foundation | Monorepo, clean build/test, environment separation, CI/security scanning, rollback/runbook |
| 6 | Market-data ingestion & canonical data layer | Adapters, schemas, provenance/freshness, provider health, deterministic replay fixtures |
| 7 | Token safety, rug-risk & exitability engine | Hard security rules, risk features, token/pool snapshots and validation report |
| 8 | Quant features, regime model & strategy research | Feature catalogue, strategy registry, baseline backtest, labels, model card/validation |
| 9 | Decision brain, policy router & strategy memory | Typed decisions, evidence trace, memory schema, versioning, champion/challenger policy |
| 10 | Risk governor, portfolio ledger & Kelly-aware sizing | Reconciled ledger, risk service, tested calculators, Kelly simulator, portfolio report |
| 11 | Execution service, quote validation & isolated signer | Execution adapter, signer policy, order state machine, reconciliation worker and failure suite |
| 12 | Web dashboard & operator control surface | Responsive, permissioned dashboard; page matrix, integration/accessibility tests, handbook |
| 13 | Backtesting, paper trading & replay lab | Reproducible comparisons, target/compounding calculator, scenario and limitation reports |
| 14 | Testing, quality engineering & independent security review | Automated suites, remediation tracker, independent review and signed evidence pack |
| 15 | Shadow mode & controlled paper launch | Shadow/paper reports, predeclared-gate decision, version-locked proposed live config |
| 16 | Live canary, launch controls & staged expansion | Small-risk canary, launch/rollback runbook, canary report, approved expansion steps |
| 17 | Post-launch governance & controlled learning | Periodic performance/model reviews, incident/remediation history and approved promotion process |

## Important phase-order rule

The previously abbreviated repository summary had grouped or renumbered some work. Future planning, issue labels and phase-gate references must use this canonical sequence. In particular, Phase 2 is product requirements/quantitative policy, Phase 3 is threat/custody/security architecture, Phase 4 is UX design, Phase 12 is the dashboard, Phase 13 is backtesting/replay, Phase 14 is independent testing/security review, Phase 15 is shadow/paper, Phase 16 is live canary, and Phase 17 is post-launch governance.

## Frozen product invariants
- Solana spot DEX only for V1; no cross-chain, leverage, borrowing, derivatives, arbitrary program calls or agent-controlled withdrawals.
- One open position globally; candidate scanning may be concurrent.
- The product is a private web dashboard + backend agent + dedicated trading wallet, not a new public wallet product.
- Quick Compound, Trend Capture, High-Upside Runner and No Trade are the four primary policy outcomes; Research More is a non-trading outcome.
- +6% net is a testable baseline profile, not a universal full-exit rule.
- Security/risk rules are deterministic; AI proposes/ranks; Risk Governor has final veto; signer never accepts unrestricted model instructions.
- No win-rate/profit/target-attainment guarantee.
- Backtesting, out-of-sample validation, paper/shadow evidence, independent security review and explicit owner approval precede mainnet canary.

## Operating modes
Observe → Backtest → Paper → Shadow → Live Canary → Live; Halted is the no-new-entry state. Live transitions require explicit owner unlock, MFA/re-authentication and a preapproved versioned risk policy.

## Companion documents
- [Phase 1 requirements index](../phase-1/README.md)
- [Phase 1 roadmap coverage audit](../phase-1/17-roadmap-coverage-audit.md)
- [Canonical dashboard page crosswalk](../phase-1/25-canonical-dashboard-page-crosswalk.md)
- [Phase 1 canonical phase map and repository structure](../phase-1/24-canonical-phase-map-and-repository-structure.md)

## Change control
Do not change roadmap scope, phase order or non-negotiable architecture principles without explicit owner approval and a dated decision-log entry. A proposal must explain dependencies, security/financial/operational effects, testing changes and rollback implications.