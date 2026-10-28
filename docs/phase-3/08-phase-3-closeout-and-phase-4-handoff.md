# Phase 3 Closeout and Phase 4 Handoff

**Date:** 28 October 2026  
**Status:** PHASE 3 CLOSED FOR DOCUMENTATION/DESIGN HANDOFF BY OWNER DIRECTION.  
**Next canonical phase:** Phase 4 — UX and Visual Design.  
**Roadmap:** Frozen Roadmap v1.0; no phase was skipped or reordered.

## 1. Closeout meaning

Phase 3 has produced an initial security-architecture package: threat model and trust boundaries, customer custody and signing architecture, license/admin/release security, secrets/audit/privacy/incident response, a planned security verification matrix, security references, and an explicit architecture-decision register.

Per owner instruction, Phase 3 is now closed as a **design handoff milestone** so Phase 4 can progress. This does not mean every architecture question is resolved, the security design is fully approved, controls are implemented, tests passed, or an independent audit occurred. The open-decision register remains binding for implementation and release gates.

## 2. Baseline handed to Phase 4

- Self-hosted, customer-isolated V1; the central portal is not a shared trading runtime and never holds customer wallet signing secrets.
- AI/LLM output is advisory; deterministic controls and the future signer boundary have final veto.
- A typed, bounded transaction intent and independent signer validation are required; blind signing of arbitrary serialized transactions is not an approved design.
- Unknown transaction state blocks a new entry until reconciliation; one open/unresolved position per running instance/portfolio.
- Signed license entitlements, protected release signing, least-privilege administration, secret-safe logs, customer-reviewed diagnostics and incident playbooks are required design targets.
- D-030 is owner-locked: use selective 3D/isometric visuals where they aid comprehension, but keep trading evidence and risk controls precise, accessible and undistorted.
- Phase 4 may define visual representation and interaction. It must not imply a signer/provider decision is approved merely because the UI contains a related control or illustration.

## 3. Security decisions that remain blockers

The following are **not resolved by closing Phase 3 for handoff**:
- Production key custody/signing backend and host/process isolation.
- Exact DEX program/instruction allowlist and transaction policy.
- Execution-affecting numeric limits, data-staleness bounds and risk thresholds.
- License-signing/release-signing key custody and offline/grace/revocation behavior.
- Identity provider, MFA/recovery implementation and privileged role separation.
- Actual bank settlement verification, seller/payment eligibility and legal/tax review.
- Telemetry/retention, egress allowlists, audit-retention policy, backup/restore authorization and incident support coverage.

The detailed list remains in [Security Architecture Decisions and Open Questions](07-security-architecture-decisions.md). Any capability depending on an unresolved high-risk decision remains disabled or unshipped until the decision has a documented owner approval, rationale, and verification plan. In particular, **no production signer, customer live trading, mainnet execution, public sales or payment activation is authorized by this closeout**.

## 4. Design-phase boundaries

Phase 4 can complete the design system, user journeys, information architecture, responsive screen compositions, visual states and handoff specifications. It may use fictional/demo data only when clearly identified as illustrative. It must not expose live controls as available when server/runtime policy is not approved.

The Phase 4 deliverables should include:
- Formal professional trader-agent visual identity with light and dark modes.
- Desktop, tablet and mobile compositions, with risk and execution truth visible in each.
- Selective 3D/isometric composition for suitable marketing/architecture/security/onboarding frames.
- Runtime dashboard designs separated from the central commercial portal.
- Tokenized design values, typography, spacing, components, charts/table rules and accessibility constraints.
- Screen state variants for stale data, unknown transaction, blocked risk, provider outage, paused runtime, license failure and empty/loading/error.
- Traceability from design components to Phase 2 requirements and later implementation tests.

## 5. Phase 4 handoff acceptance

Phase 4 may start from the Phase 2 requirement baseline, this Phase 3 security design handoff, and the explicitly retained security-decision blockers. The owner may lock this handoff for planning; security-sensitive implementation and live release still require the open decisions and verification criteria to be satisfied.
