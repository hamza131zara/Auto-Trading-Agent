# Phase 2 Completion and Phase 3 Handoff

**Date:** 28 October 2026  
**Status:** PHASE 2 COMPLETE — requirements baseline accepted for handoff.  
**Next canonical phase:** Phase 3 — Threat Model, Custody Model and Security Architecture.  
**Canonical roadmap:** Roadmap v1.0 remains frozen; no phase was skipped or reordered.

## Completion statement

Phase 2 has produced a testable product/system requirement baseline, quantitative measurement and evaluation contract, customer portal/runtime boundaries, onboarding and booking requirements, theme/responsive UI acceptance requirements, an open-decision register, and a requirements-to-acceptance matrix.

This is completion of the **requirements/specification phase only**. It does not claim that code, tests, design mockups, payment services, calendars, providers or trading capabilities are implemented or approved.

## Required baseline now handed off

- Solana spot DEX V1 only; no leverage, borrowing or cross-chain trading.
- Self-hosted/customer-isolated runtime for every customer; central portal handles licensing/commercial records/onboarding/releases, not shared live trading.
- No free tier/trial; USD $12,000 one-time lifetime-license price is a proposal and remains subject to final written terms and legal review.
- License predicates include confirmed approved-route settlement, single-use invitation, registration/email verification, required MFA, terms acceptance and owner/admin approval.
- Bank invoice/settlement is only a candidate payment route pending written bank/legal/tax confirmation. Online card and crypto receipt remain disabled until exact-route eligibility is verified.
- A guided setup documentation center and booking from real calendar availability are required; Google Meet is preferred. No calendar URL or business availability is claimed live until configured.
- The runtime UI must support light/dark themes, responsive desktop/tablet/mobile behavior, semantic risk states, truthful actual-vs-estimated and gross-vs-net values, and auditability.
- **D-030:** Use tasteful, selective 3D/isometric visuals in appropriate page frames/sections (landing hero, architecture, security/self-hosting, guided steps and selected empty states). Keep financial charts, tables, risk values and operational controls flat, precise and data-first. Respect reduced motion, accessibility, responsive simplification and performance.
- Security/risk veto is deterministic. AI/LLM is advisory and never receives signing secrets or arbitrary signing/withdrawal authority.
- One open/unresolved position per independent running instance/portfolio. Reconcile the prior position before another entry.
- The +6% net profile and named strategy styles are hypotheses to test, not promises.
- Acceptance tests are defined in [the traceability matrix](07-requirements-traceability-and-acceptance-matrix.md); no implementation PASS is implied.

## Explicit execution exclusion and numeric TBDs

Several numerical trading limits and quantitative release thresholds remain unresolved: position sizing/exposure, per-trade and session loss, drawdown, liquidity, token concentration, spread/impact/slippage, fee caps, data staleness, sample-size/OOS windows and paper/shadow duration.

**These unresolved parameters are explicitly excluded from executable trading scope.** No live/mainnet mode may be implemented as enabled, configured as operationally ready, or used for customer execution until each required parameter receives an explicit owner-approved value with unit, rationale, date, and test. A missing required value must leave execution disabled, not invite a developer/model to choose a default.

This exclusion permits Phase 2 specification handoff; it does not indicate trading-policy approval or product launch readiness.

## Phase 3 objectives

Phase 3 must threat-model and design:
1. Customer portal/runtime trust boundaries and authenticated communication.
2. Local wallet custody, constrained signer, transaction policy and key lifecycle.
3. License signing keys, instance binding, revocation/transfer/reinstall and safe offline/grace behavior.
4. Software release-signing, checksum verification, update/rollback and supply-chain security.
5. Authentication/MFA, authorization, session security, admin and payment-fraud controls.
6. Secret management, log/diagnostic redaction, customer-data access and privacy.
7. RPC/DEX/provider threats, stale/manipulated data, quote failures and transaction uncertainty.
8. Threat scenarios, abuse cases, mitigations, residual risk, security acceptance tests and incident response.
9. Runtime controls that continue local risk enforcement during portal/provider outage, without an undocumented remote position-control/kill switch.

## Carry-forward blockers

- Legal/tax and bank/payment eligibility before public sale.
- No approved card or crypto receipt route.
- Final lifetime/update/support/refund/fair-use terms and setup-session inclusions before sale.
- Calendar account, real available slots, booking URL, timezone, session duration and cancellation policy before public booking.
- Account-specific provider selection and quota/terms verification before implementation.
- Numeric execution limits and backtest/OOS/paper/shadow gates before any executable trading enablement.
- Detailed visual wireframes/design tokens belong to Phase 4, after Phase 3 security architecture. Phase 4 should evaluate the reusable [3D hero illustration](../../assets/brand/auto-trading-agent-3d-hero.svg) and specify where the motif is appropriate; do not apply it indiscriminately to every card.

## Handoff acceptance

Phase 3 may begin from this specification package. It must not interpret Phase 2 completion as permission for live trading, payment collection or public sales. Security architecture must trace each threat/mitigation to tests and must preserve the frozen product scope and phase sequence.
