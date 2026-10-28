# Phase 1 Final Closeout and Phase 2 Handoff

**Date:** 28 October 2026  
**Status:** Phase 1 CLOSED for design handoff.  
**Next active phase:** Phase 2 — Product Requirements and Quantitative Policy.

## Closeout

Phase 1 source/document research, roadmap comparison, requirements supplements, commercial-model definition, and deployment direction are complete for design handoff. This is a documentation milestone, not evidence of implementation, provider approval, legal clearance, or trading performance.

The canonical Roadmap v1.0 order remains frozen. Phase 2 defines product requirements and quantitative policy. Phase 3 covers threat/custody/security architecture. Phase 4 covers detailed UX visual design and design system. Do not skip or reorder these phases.

## Locked baseline

- **D-025:** V1 is self-hosted, customer-isolated licensed software. No hosted multi-customer trading runtime or pooled customer funds.
- **CR-001:** No free tier/trial; proposed USD $12,000 one-time lifetime license, no recurring core subscription. Final lifetime/update/support/refund/fair-use terms remain pre-sale work.
- Payment must be verified and settled before a registration invitation. Registration, email verification, required MFA, terms acceptance and owner/admin approval precede signed license activation.
- The central portal handles commercial records, licensing, authorized downloads/updates and onboarding. It must never hold customer seed phrases/private keys or have arbitrary signing authority.
- Each customer controls a separate runtime, database, credentials, wallet/signer, risk configuration, ledger and audit history. At most one open/unresolved position is allowed per running instance/portfolio.
- Crypto acceptance and online card checkout remain unapproved/disabled pending written legal, tax, bank and provider clearance.
- No profitability, win-rate, target-attainment or guaranteed-loss-prevention claims.
- Phase 1 does not authorize production wallet connection, live signing or mainnet trading.

## Customer onboarding requirement — D-026

Provide a customer-facing setup documentation center and an availability-based guided setup booking flow. Google Calendar appointment scheduling with Google Meet is the preferred path. Customers choose from actual available time slots; the system shows the timezone, confirms the booking, shares meeting details and preparation instructions, supports rescheduling/cancellation where configured, and records a post-session checklist.

The actual booking URL, business availability, meeting duration, included session count and fees for additional help must be configured/defined before public sale. Do not advertise a placeholder booking URL or imply unlimited lifetime human support.

## UI direction requirement — D-027

The future UI must look like a formal, professional trader-agent control room: attractive, data-dense but clear, responsive, accessible and trustworthy—not neon-heavy or gamified. Require both dark and light modes, responsive desktop/tablet/mobile layouts, readable financial numerals, semantic status messaging, and visible health/mode/risk/position/data freshness/decision evidence/execution reconciliation/audit state. Color alone must never communicate risk/status.

Phase 2 records testable UI requirements; detailed wireframes and design tokens remain in Phase 4, and production UI implementation remains in its canonical roadmap phase.

## Remaining gates

1. Obtain written bank/payment institution and qualified legal/tax confirmation for the actual seller, license, service and remittance model before public sales.
2. No online processor or crypto route is approved. Invoice plus verified bank settlement is only the initial candidate process, subject to confirmation.
3. Finalize lifetime license, updates/support, installation, infrastructure exclusions, refunds/disputes and taxes in written terms.
4. Verify account-specific provider terms/quotas/data rights.
5. Approve numeric risk limits and backtest/paper/shadow gates before using them in evaluations. Mainnet remains prohibited until all later roadmap gates pass.

## Phase 2 entry

Phase 2 is authorized to produce a testable requirements baseline, quantitative policy register, portal/runtime boundaries, onboarding/booking requirements, UI theme/responsiveness acceptance criteria, traceability, and an unresolved-decision register. TBD trading thresholds remain blockers until owner-approved or explicitly excluded from executable scope.

A phase closeout is not proof of implementation, test success, provider approval, legal clearance or profitability.
