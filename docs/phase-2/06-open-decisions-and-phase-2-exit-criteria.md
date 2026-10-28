# Phase 2.6 — Open Decisions, Traceability and Exit Criteria

**Status:** CLOSED for Phase 3 requirements handoff. The decision register remains active for later design, implementation and release gates. TBD items remain visible until approved or excluded from executable scope.

## Locked decisions

| ID | Decision | Status |
|---|---|---|
| D-025 | Self-hosted, customer-isolated licensed software; no hosted multi-customer runtime in V1. | LOCKED |
| D-026 | Customer setup documentation and availability-based guided setup booking; Google Meet preferred. | LOCKED requirement; actual calendar pending |
| D-027 | Professional trader-agent UI with light/dark themes, responsive layouts, accessible status semantics and truthful data. Detailed visual design in Phase 4. | LOCKED requirement |
| D-028 | Add original vector logo assets for dark/light surfaces and a compact icon mark; use a restrained professional trader-agent visual identity. | LOCKED brand baseline |
| D-029 | Close Phase 2 requirements for handoff to Phase 3; numerical execution-affecting TBDs remain excluded from executable scope pending owner approval. | CLOSED for handoff, not trading approval |
| D-030 | Add selective 3D/isometric visual treatments to appropriate frames/sections, with accessibility, performance and data-truthfulness constraints. | OWNER-LOCKED by explicit approval on 28 October 2026; detailed placement in Phase 4 |
| CR-001 | No free tier/trial; proposed USD $12,000 one-time lifetime license, no recurring core subscription. | Commercial baseline; final terms pending |

## Open decisions

| ID | Question | Safe disposition |
|---|---|---|
| P2-O-001 | Numeric position size, drawdown, loss, fee, liquidity, slippage and concentration thresholds? | TBD; no executable default. |
| P2-O-002 | OOS sample/window, acceptable drawdown, expectancy/stability and paper/shadow gates? | TBD; no improvised release threshold. |
| P2-O-003 | Supported runtime platforms and minimum hardware? | Evaluate and test before sale. |
| P2-O-004 | Definition of lifetime, support, updates, transfers, refunds and fair use? | Written terms and qualified review before sale. |
| P2-O-005 | Bank/account/remittance eligibility and documentation for domestic/international receipts? | Written bank and counsel confirmation pending. |
| P2-O-006 | Which card processor or crypto route may serve the exact seller/product? | None approved; keep disabled. |
| P2-O-007 | Included onboarding session count/duration and additional support fees? | Must be explicit before public sale. |
| P2-O-008 | Calendar account, real availability, booking URL, reminders and cancellation rules? | Configure and test before advertising. |
| P2-O-009 | Exact palette, typography and chart library? | Direction locked; detailed design is Phase 4. |
| P2-O-010 | Telemetry, remote diagnostics and offline license grace behavior? | Security/privacy decision required. |
| P2-O-011 | Production provider selection, quota, cost and data rights? | Verify account-specific terms. |
| P2-O-012 | Seller legal entity and jurisdiction for license and any proprietary operation? | Qualified legal/tax review pending. |

## Traceability

Every requirement maps to a unique ID, design/implementation component or future phase, verifiable acceptance test, expected result, evidence artifact/version, status and owner/risk dependency. Screenshots and documents alone do not prove enforcement; security/trading behavior needs backend/runtime tests.

## Phase 2 exit checklist

- [x] Product/system boundaries recorded as the Phase 2 handoff baseline.
- [x] Requirements mapped to verifiable acceptance criteria, including unknown/failure states in [the traceability matrix](07-requirements-traceability-and-acceptance-matrix.md).
- [x] Quantitative formulas, units, net-PnL cost treatment and evaluation methodology are specified.
- [x] Execution-affecting numeric limits that remain TBD are explicitly excluded from executable scope; owner approval is still required before enabling execution.
- [x] Backtest/OOS/paper/shadow evaluation methodology and required evidence are defined; numeric release thresholds remain gated.
- [x] Portal/runtime separation, license/payment workflow and instance isolation are explicit.
- [x] Setup docs, guided booking/Meet flow and support boundary have acceptance criteria.
- [x] Theme, accessibility, responsiveness and data truthfulness requirements are ready for Phase 4.
- [x] Payment/legal/tax/crypto/provider dependencies remain visibly pending, not mislabeled approved.
- [x] Threat/custody questions are handed to Phase 3, with roadmap order preserved.

Phase 2 is closed for requirements handoff, not for production readiness. D-030 is a forward-looking Phase 4 visual-design requirement and does not reopen implementation scope or change the canonical roadmap order. Do not fabricate thresholds, availability, payment/settlement status, provider results, analytics or booking URLs. Do not activate card/crypto payment or mainnet trading from this register. See [Phase 2 completion and Phase 3 handoff](08-phase-2-completion-and-phase-3-handoff.md).
