# Phase 4.7 — Design Decisions and Open Questions

**Status:** Initial design decision register.

## Baseline decisions

| ID | Decision | Status |
|---|---|---|
| D-025 | V1 remains self-hosted and customer-isolated. | Locked |
| D-027 | Professional trader-agent UI, light/dark theme, responsive layouts and truthful state semantics. | Locked design direction |
| D-028 | Initial vector logo system includes dark/light wordmarks and compact mark. | Locked asset baseline |
| D-030 | Selective 3D/isometric visual layer for relevant sections; financial truth remains flat and accurate. | Owner-locked |
| D-031 | Phase 3 is closed for documentation/design handoff at owner direction; unresolved security choices remain blockers for dependent implementation/release. | Locked handoff status |

## Open design decisions

| ID | Question | Current direction |
|---|---|---|
| P4-D-001 | Which exact logo lockup, size and clear space applies at each breakpoint? | Verify dark/light lockups and compact mark on actual screens; preserve aspect ratio. |
| P4-D-002 | Which chart library and accessibility strategy will be adopted in Phase 5+? | Compare supported responsiveness, accessibility, bundle cost, theme support and real-data labels before selecting. |
| P4-D-003 | Should mobile runtime nav use a bottom bar or drawer? | Prototype both if needed; prioritize critical state and accessible reach, not decoration. |
| P4-D-004 | Which public landing hero crop, section sequence and 3D asset variants are selected? | Use existing 3D hero as baseline; test text/CTA legibility and mobile crop. |
| P4-D-005 | Which authentication/account UX is supported by the selected identity system? | Avoid over-designing flows that contradict the eventual Phase 3 implementation decision. |
| P4-D-006 | Which metrics are available at first runtime release? | Design data-availability states; do not draw unsupported values as real fields. |
| P4-D-007 | Which exact breakpoint/layout is approved after device/browser validation? | The initial values in the responsive spec are design targets, not framework commitments. |
| P4-D-008 | Should the design be materialized in Figma before Phase 5 implementation? | Recommended if the project owner wants editable collaborative mockups; this repository package remains a reviewable baseline regardless. |

## Rules for resolving

Record owner/date, evidence, related requirement, changed file/asset, planned validation and implementation impact. Do not introduce a new page, payment method, live action, market metric or security claim without a traceable requirement and explicit approval.
