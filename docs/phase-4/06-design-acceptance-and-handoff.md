# Phase 4.6 — Design Acceptance and Implementation Handoff

**Status:** Active design checklist. Requirements below describe evidence needed to close Phase 4; no code implementation or usability-test pass is claimed.

## 1. Design deliverables required

- [ ] Tokenized light/dark design system with semantic color, type, spacing, radius, border, elevation and focus tokens.
- [ ] Public website page hierarchy and main conversion flow (quote/request license), with visible limitations/risk wording.
- [ ] Separate commercial portal IA and core screens (invoice/payment, registration/MFA, license/downloads, docs/booking/support).
- [ ] Self-hosted runtime IA and critical screen designs (cockpit, market discovery, decision trail, positions/execution, risk, evaluation, configuration, health, audit/recovery).
- [ ] Desktop, tablet and mobile compositions for critical screens.
- [ ] States for loading, empty, stale, partial failure, full error, unknown, not tested, blocked, permission denied, paused and license/session failure.
- [ ] Reusable components for navigation, metric summary, state indicator, table, chart, filter, form, confirmation, modal, toast and status banner.
- [ ] D-030 3D/illustration placement review for hero, architecture, security/self-hosting and onboarding sections, including mobile/fallback behavior.
- [ ] Accessibility and reduced-motion review for both themes.
- [ ] Requirement traceability from Phase 2 PR/UI IDs to screens/components and planned tests.
- [ ] Explicit handoff notes for unresolved security and numerical gates.

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
