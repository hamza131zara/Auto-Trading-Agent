# Phase 4 — UX and Visual Design

**Status:** ACTIVE — visual system and core-screen design in progress.  
**Started:** 28 October 2026.  
**Previous phase:** Phase 3 closed for documentation/design handoff at owner direction.  
**Frozen roadmap:** Roadmap v1.0 remains unchanged. Phase 5 repository/CI foundations follows Phase 4.

## Purpose

Turn the locked Phase 2 requirements, Phase 3 trust/security boundaries, brand assets and owner-approved visual direction into a consistent design system and usable screen-level specifications. Phase 4 is design work; it does not implement trading, select unresolved security providers or authorize live execution.

## Design documents

1. [Design system and theme tokens](01-design-system-and-theme-tokens.md)
2. [Information architecture and navigation](02-information-architecture-and-navigation.md)
3. [Core screens and interaction specifications](03-core-screen-specifications.md)
4. [Responsive behavior, accessibility and motion](04-responsive-accessibility-and-motion.md)
5. [3D visual placement and brand asset map](05-3d-visual-placement-and-asset-map.md)
6. [Design acceptance and implementation handoff](06-design-acceptance-and-handoff.md)
7. [Design decisions and unresolved choices](07-design-decisions-and-open-questions.md)

## Existing design assets

- [Dark logo](../../assets/brand/auto-trading-agent-logo-dark.svg)
- [Light logo](../../assets/brand/auto-trading-agent-logo-light.svg)
- [Compact brand mark](../../assets/brand/auto-trading-agent-mark.svg)
- [3D market-intelligence hero illustration](../../assets/brand/auto-trading-agent-3d-hero.svg)

## Design invariants

- The interface is a professional trader-agent control room: calm, accurate, analytical and trustworthy.
- Both light and dark themes are first-release requirements.
- Desktop, tablet and mobile compositions must keep core health, risk, position and execution state discoverable.
- The central licensing/customer portal is a different product surface from the customer self-hosted runtime.
- Selective 3D/isometric visuals are used where they help explain concepts; never distort financial evidence or disguise illustrative metrics as live data.
- Unknown, stale, blocked, failed and not-tested values remain distinct; color is never the only status indicator.
- No design can imply that live trading, payments, signer integrations or booking slots are enabled before their gates pass.
- All wireframe numbers and market charts in design samples are illustrative DEMO content, not trading performance.

## Deliverables

- Tokenized palette, typography, spacing, sizing, elevation and state semantics.
- Public marketing and commercial portal page hierarchy.
- Customer runtime navigation and core dashboard screen patterns.
- Desktop/tablet/mobile behavior plus empty/loading/error/unknown/blocked states.
- Light/dark mockups, brand/3D placement guide and accessibility requirements.
- Traceability from design components to Phase 2 requirements and later implementation tests.

## Phase 4 exit rule

Phase 4 may close when the design tokens, site/portal/runtime information architecture, critical screens, state variants, responsive layouts, theme contrast, 3D placement, accessibility review and implementation handoff are reviewed. Phase 5 remains the next canonical phase; frontend implementation is not started by these design documents.
