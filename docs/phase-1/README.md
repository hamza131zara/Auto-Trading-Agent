# Phase 1 — Documentation and Requirements

**Status:** Phase 1 CLOSED for design handoff on 28 October 2026. Core documentation, roadmap comparison/source verification, commercial requirements (CR-001), self-hosted deployment (D-025), guided onboarding requirement (D-026) and UI direction requirement (D-027) are recorded. Phase 2 — Product Requirements and Quantitative Policy — is COMPLETE; Phase 3 is closed for documentation/design handoff; Phase 4 UX and Visual Design is now ACTIVE. See the [Phase 3 closeout](../phase-3/08-phase-3-closeout-and-phase-4-handoff.md) and [Phase 4 design package](../phase-4/README.md). Account-specific payment/bank eligibility, legal/tax review and provider-plan verification remain pre-sale/live-launch gates, not claims of current clearance.

**Mode:** Documentation only. No production trading code, wallet connection, private-key handling, automated payment checkout, or live execution is authorized during Phase 1.

## Frozen roadmap and source alignment
- [Canonical Roadmap v1.0 phase map](../roadmap/ROADMAP-CANONICAL-PHASE-MAP.md)
- [Frozen roadmap baseline and change control](../roadmap/ROADMAP-BASELINE.md)
- [Markdown companion aligned to the frozen phase order](../roadmap/Solana_Dex_Agent_Roadmap_v1.md)
- [Source-to-repository coverage audit](17-roadmap-coverage-audit.md)
- [Document register and file/hash identities](DOCUMENT-REGISTER.md)

The original owner-approved DOCX/PDF remains the frozen baseline. Commercial scope CR-001 is a separate addendum; it does not reorder or overwrite the canonical Phase 0–17 roadmap.

## Core requirements package

1. [01 Product Charter](01-product-charter.md) — purpose, scope, actors, modes, success metrics and commercial addendum.
2. [02 Functional Requirements](02-functional-requirements.md) — core operating requirements, autonomous loop, paid access, registration approval and tenant isolation.
3. [03 Trading and Exit Policy](03-trading-and-exit-policy.md) — candidate lifecycle, position cap, Quick Compound, Trend Capture, High-Upside Runner and re-entry.
4. [04 Token Security and Rug-Risk](04-token-security-risk.md) — token program/extensions, authorities, holder concentration, wallet-cluster evidence, liquidity and exitability gates.
5. [05 Quantitative Methodology](05-quantitative-methodology.md) — net PnL, expected return, outcome labels, calibration, Kelly research and compounding.
6. [06 Architecture and Data Sources](06-architecture-and-data-sources.md) — logical services, trust boundaries and integration candidates.
7. [07 Security, Privacy and Operations](07-security-privacy-and-operations.md) — auth, secrets, signing isolation, incident response and fail-safe behavior.
8. [08 Data Dictionary and Audit](08-data-dictionary-and-audit.md) — token/trade state, provenance, audit events and commercial/payment/tenant records.
9. [09 Test Plan and Acceptance](09-test-plan-and-acceptance.md) — unit/integration/security/recovery/quantitative and commercial entitlement tests.
10. [10 Decision Log](10-decision-log.md) — accepted baseline, owner-requested decisions, open choices and scope-change record.
11. [11 Requirements Traceability](11-requirements-traceability.md) — requirements-to-test mapping.
12. [12 Dashboard Pages and Operator Controls](12-dashboard-pages-and-operator-controls.md) — filters, controls, security actions, pricing/quote and admin workflows.
13. [13 Technology Decision Candidates](13-tooling-and-technology-decisions.md) — technologies and selection criteria.
14. [14 Provider and Integration Matrix](14-provider-and-integration-matrix.md) — data ownership, providers, limits, source findings and open verification.
15. [15 Threat Model and Risk Register](15-threat-model-and-risk-register.md) — system, signer, payment, fraud and tenant-isolation risks.
16. [16 Autonomous Trading Workflow](16-autonomous-trading-workflow.md) — closed-loop discovery, selection, risk approval, execution, exit, reconciliation and next candidate.
17. [SOURCES Source Register](SOURCES.md) — official docs and review links.

## Roadmap coverage and technical supplements

18. [17 Roadmap Coverage Audit](17-roadmap-coverage-audit.md) — canonical phase/DOC-01 to DOC-12 crosswalk.
19. [18 Indicators, Formulas and Units](18-indicators-formulas-and-units.md) — financial formulas, indicator units, costs, Kelly and target calculations.
20. [19 Agent Brain and Memory](19-agent-brain-and-memory-spec.md) — module authority, Choice/Score/proposition outputs, memory and promotion controls.
21. [20 Execution, Reconciliation and Signer Contract](20-execution-reconciliation-and-signer-contract.md) — transaction states, intent contract, signer checks and unknown-state recovery.
22. [21 Cost and Operations Plan](21-cost-and-operations-plan.md) — provider/LLM/hosting cost models, service budgets and lifetime-license economics.
23. [22 Legal, Tax and Service Boundary Review](22-legal-tax-and-service-boundary-review.md) — questions requiring qualified legal/tax review; not legal clearance.
24. [23 Shadow, Canary and Post-Launch Governance](23-shadow-canary-launch-and-post-launch-governance.md) — operating modes and release gates.
25. [24 Canonical Phase Map and Repository Structure](24-canonical-phase-map-and-repository-structure.md) — exact phase sequence, package structure and commercial amendment reference.
26. [25 Canonical Dashboard Page Crosswalk](25-canonical-dashboard-page-crosswalk.md) — 17-page source roadmap mapping and permissions.
27. [26 Official Source Verification Report](26-official-source-verification-report.md) — dated official source pass, provider limits/prices, payment-provider findings and source caveats.
28. [27 Commercial Pricing, Access and Lifetime License](27-commercial-pricing-access-and-lifetime-license.md) — no-free-trial policy, proposed USD $12,000 lifetime license, quote/payment/registration/admin approval workflow.
29. [28 Payment Provider Eligibility Assessment](28-payment-provider-eligibility-assessment.md) — Stripe/Paddle/Lemon Squeezy policy review and proposed invoice/settlement path.
30. [29 Commercial Scope Amendment CR-001](29-commercial-scope-amendment.md) — paid license and activation flow, now aligned to self-hosted distribution.
31. [30 Self-Hosted Deployment Decision D-025](30-self-hosted-deployment-decision.md) — locked self-hosted architecture and central license-portal boundary.
32. [31 Phase 1 Final Closeout and Phase 2 Handoff](31-phase-1-closeout-and-phase-2-handoff.md) — Phase 1 closeout, onboarding requirement D-026, UI direction D-027 and entry gates.

## Commercial access rules now documented

- No customer free tier, free trial, trial extension or unpaid operational access.
- Proposed standard price is USD $12,000 as a one-time lifetime license, not a recurring subscription.
- Quote/invoice → verified cleared payment → single-use registration invitation → user registration/email verification/MFA/terms → owner/admin approval → license/tenant activation.
- Public marketing pages do not provide access to the agent or protected services.
- **No online payment gateway has been approved.** Initial proposed collection is an owner-issued invoice and manually verified cleared bank settlement, subject to bank and qualified legal approval.
- The selected self-hosted model isolates each customer's runtime and data. Each licensed running instance enforces one open/unresolved position in its own portfolio; there is no shared trading runtime or platform-level position lock.
- No payment or account approval authorizes live trading. Trading release gates remain separate.

## Phase 3 continuation
Phase 1 and Phase 2 are closed for handoff; Phase 3 security architecture is active. The 3D visual direction D-030 is owner-locked, while detailed placement remains in Phase 4. See the [Phase 3 security architecture package](../phase-3/README.md).

## Phase 1 completion and handoff conditions

Phase 1 is closed for design handoff. D-025 locks the deployment direction to self-hosted, customer-isolated licensed software; D-026 requires setup documentation and availability-based guided onboarding; D-027 requires a professional responsive UI with light and dark modes. Phase 2 has defined testable product/quantitative requirements, planned acceptance IDs and its Phase 3 handoff. Detailed threat/custody architecture and visual design remain in their later canonical phases. Payment/bank/legal review remains a prerequisite for public sales; separate trading release gates remain mandatory.

Before public sales, separately complete:
1. Bank/payment institution and qualified legal/tax confirmation for the real service model and seller jurisdiction.
2. Explicit lifetime-license terms: service lifetime, updates, support, included API/data/compute usage, fair-use limits, exclusions and refund/dispute obligations.
3. Account-specific provider plan/terms/quotas and source freshness verification.
4. A documented service cost model supporting the one-time price.
5. Tenant isolation, payment/registration/entitlement tests and the public-sale release checklist.

Before live trading, additionally pass all backtest, out-of-sample, independent security, paper/shadow, signer and staged-canary gates.

## Non-negotiable safety constraints

- Solana spot DEX only for V1; no leverage or borrowing.
- AI cannot access signing secrets, withdraw funds, bypass deterministic security/risk controls or change hard limits.
- Every customer workspace is isolated; no pooled customer funds.
- Reconcile the current position fully before opening the next one in its portfolio scope.
- No claim or guarantee of win rate, return or target attainment.
- The frozen roadmap's canonical phase order cannot be changed without explicit owner approval and a dated record.

## Locked deployment decision
[D-025 — Self-Hosted Deployment Decision](30-self-hosted-deployment-decision.md) is the approved design baseline for V1. No hosted multi-tenant trading SaaS in V1. The central portal handles commercial licensing, onboarding and authorized downloads only. See the [Phase 2 requirements package](../phase-2/README.md) for the active handoff.