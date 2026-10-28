# Phase 2 — Product Requirements and Quantitative Policy

**Status:** COMPLETE for requirements handoff. Open-decision register remains active for future implementation/release gates.  
**Started:** 28 October 2026.  
**Phase 1:** Closed for design handoff; see [Phase 1 closeout](../phase-1/31-phase-1-closeout-and-phase-2-handoff.md).  
**Sequence:** Frozen Roadmap v1.0 remains unchanged.

## Purpose

Turn the approved product/commercial baseline into testable product requirements and a measurable quantitative policy. This phase documents rules and acceptance criteria; it does not implement production trading or authorize live execution.

## Documents

1. [Product requirements and system boundaries](01-product-requirements-and-system-boundaries.md)
2. [Quantitative policy and evaluation contract](02-quantitative-policy-and-evaluation-contract.md)
3. [Customer portal, license lifecycle and self-hosted runtime](03-customer-portal-and-runtime-requirements.md)
4. [Installation, onboarding, booking and support](04-installation-onboarding-and-support.md)
5. [UI theme, information architecture and responsive design](05-ui-theme-and-responsive-design-requirements.md)
6. [Open decisions and Phase 2 exit criteria](06-open-decisions-and-phase-2-exit-criteria.md)
7. [Requirements traceability and acceptance matrix](07-requirements-traceability-and-acceptance-matrix.md)
8. [Phase 2 completion and Phase 3 handoff](08-phase-2-completion-and-phase-3-handoff.md)
9. [Brand identity and logo usage](09-brand-identity-and-logo-usage.md)

## Invariants

- Solana spot DEX only; no leverage, borrowing or cross-chain V1.
- One open or unresolved position per independent running agent/portfolio.
- Deterministic security/risk gates have final veto; AI/LLM is advisory.
- No signer secret in an LLM, licensing portal, support form or meeting.
- No profit, win-rate, exit-price or target-attainment guarantee.
- Self-hosted/customer-isolated deployment under D-025; the portal is not a shared trading runtime.
- No free tier/trial; USD $12,000 one-time lifetime license is the proposed commercial baseline, not permission to sell.
- Bank invoice/settlement remains a candidate pending legal/bank confirmation. Online card and crypto payments are not approved/enabled.
- Setup documentation and bookable guided onboarding are required. Real calendar availability and Meet links must be configured before booking is advertised.
- Both light/dark themes, accessibility, responsive layouts and truthful data/status rendering are required. Detailed visual design remains Phase 4.
- **D-030 is explicitly owner-locked (28 October 2026):** use selective 3D/isometric visuals where they improve comprehension (hero, architecture, security/self-hosting and setup sections). Financial charts and risk controls must remain data-faithful and undistorted. See [3D visual guidance](05-ui-theme-and-responsive-design-requirements.md) and the [reusable hero asset](../../assets/brand/auto-trading-agent-3d-hero.svg).

## Phase 2 disposition

Phase 2 requirements are complete for handoff. Phase 3 has been closed for documentation/design handoff, and Phase 4 design is locked for handoff; Phase 5 engineering foundation is now active. All requirements have planned acceptance IDs. Numerical trading limits and quantitative release thresholds that remain TBD are explicitly excluded from executable scope and must be owner-approved before any live-capable release. No implementation tests are claimed as run by these documents. See [Phase 3 closeout](../phase-3/08-phase-3-closeout-and-phase-4-handoff.md), [Phase 4 closeout](../phase-4/08-phase-4-closeout-and-phase-5-handoff.md) and [the active Phase 5 package](../phase-5/README.md).

## Phase 2 workflow

1. Refine product/system requirements and trust boundaries.
2. Define quantitative measurements, accounting formulas, units and evaluation method.
3. Track unresolved numeric, commercial and provider choices without inventing defaults.
4. Map each requirement to verifiable acceptance evidence.
5. Hand the approved baseline to Phase 3 security/custody architecture.

## Non-goals

No production order placement, live-wallet connection, public checkout, active crypto payment, automatic license activation from unverified payment notices, or final UI implementation is authorized by Phase 2.
