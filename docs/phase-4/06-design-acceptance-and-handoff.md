# Phase 4.6 — Design Acceptance and Implementation Handoff

**Status:** Locked design handoff checklist by owner direction. This records authored design deliverables and the verification work that remains for implementation; it does not claim production UI or automated accessibility tests are complete.

## 1. Design deliverables required

- [x] Proposed tokenized light/dark design system with semantic color, type, spacing, radius, border, elevation and focus tokens documented.
- [x] Public website page hierarchy and main conversion flow (quote/request license), with visible limitations/risk wording documented.
- [x] Separate commercial portal IA and core screen requirements (invoice/payment, registration/MFA, license/downloads, docs/booking/support) documented.
- [x] Self-hosted runtime IA and critical screen specifications (cockpit, market discovery, decision trail, positions/execution, risk, evaluation, configuration, health, audit/recovery) documented.
- [x] Responsive requirements and static dashboard concepts for desktop/tablet/mobile documented; browser/device validation remains open.
- [x] Required loading, empty, stale, partial failure, error, unknown, not tested, blocked, permission denied, paused and license/session failure states specified.
- [x] Reusable component patterns for navigation, metric summary, state indicator, table, chart, filter, form, confirmation, modal, toast and status banner specified.
- [x] D-030 selective 3D/illustration placement rules and mobile/fallback constraints documented.
- [x] Accessibility/reduced-motion requirements documented for both themes; automated/manual contrast and assistive-technology verification remain Phase 12/QA work.
- [x] Requirement traceability from Phase 2 PR/UI IDs to screens/components and planned tests documented.
- [x] Explicit handoff notes for unresolved security and numerical gates recorded.

## 2. Design quality acceptance

- Operating mode and order permission are visible without navigating deep into settings.
- Unknown transaction state and risk blockers are prominent; a second position cannot be implied while current state is unresolved.
- All demo data/wireframe performance is visibly illustrative.
- Realized/unrealized, gross/net, actual/estimated and provisional/final are not collapsed into one metric.
- Numeric inputs have units and validation; unset required limits remain blocked.
- Light/dark themes cover every common component, including charts, tables, tooltips, modal, calendar and logs.
- At target widths, no global horizontal overflow, clipped warning, hidden required control or unreadable critical state.
- 3D illustrations help explain a concept but never distort charts or mimic actionable controls without keyboard/touch behavior.
- Primary actions have a loading/pending/result state; high-impact actions require confirmation and auditable feedback.
- Portal pages do not mix customer commercial records with the self-hosted runtime's trading ledger.

## 3. Traceability checklist

| Source | Design destination | Planned verification |
|---|---|---|
| PR-001–PR-005 | Discovery and decision trail | Evidence freshness/reason/status; no-trade is valid |
| PR-006–PR-010 | Positions/execution and risk center | Unknown state, reconciliation and pause behavior |
| PR-011–PR-014 | Agent brain, signer and integrations | Advisory LLM, hard veto, secret-safe state |
| PR-015–PR-016 | Portal, license and operational UX | Verified-payment lifecycle and customer isolation |
| UI-001–UI-014 | Design tokens, responsive system, critical banners | Theme/accessibility/responsive acceptance |
| D-026 | Setup center and booking | Real availability/timezone/confirmed meeting only |
| D-028 | Header, app/sidebar, favicons | Correct theme lockup and legibility |
| D-030 | Hero, architecture/security/setup and selected empty states | Decorative/non-distorting/reduced-motion acceptance |

## 4. Handoff contract to Phase 5

Every screen handoff should identify page purpose, user role, data model/fields, action/permission, responsive rules, theme tokens, all state variants, empty/error/unknown copy, accessibility behavior and test IDs. Development must not infer API readiness from a mockup or enable unapproved actions simply because the control exists in design.

When a backend capability is not implemented, show a feature flag or Not Configured/Blocked state; don't fake live values. Phase 5 repository/CI foundation remains the next canonical phase after this design package is owner-reviewed and locked.

## 5. External and security blockers

Phase 4 cannot resolve or waive production key-backend decisions, signer allowlist review, numeric trading thresholds, legal/tax/payment eligibility or account-specific provider verification. The visual design must keep controls disabled and explanations clear while those decisions are open.
