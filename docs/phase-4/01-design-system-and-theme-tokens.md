# Phase 4.1 — Design System and Theme Tokens

**Status:** Initial design baseline; review against actual screen mockups before implementation.  
**Brand:** Auto-Trading-Agent  
**Visual direction:** Formal professional fintech, dark navy/graphite + soft neutral light surfaces, restrained cyan/blue/teal signal accents and selective 3D.

## 1. Design principles

1. **Truth before decoration:** metrics have visible labels, units, time windows and provenance; no invented live status.
2. **Clear hierarchy:** operating mode and critical risk/execution state are more prominent than secondary performance.
3. **Quiet confidence:** restrained surfaces and accents; avoid casino/gaming visuals and excessive glow.
4. **Consistent semantics:** the same state tokens mean the same thing in both themes.
5. **Progressive density:** desktop can show detailed data; tablet and mobile prioritize the most consequential state and permit drill-in.
6. **Accessible by default:** semantic HTML, keyboard support, clear focus, sufficient contrast and no color-only status.
7. **Customer isolation:** commercial portal styling may share the brand but never implies shared trading controls or wallet custody.

## 2. Color tokens

### Brand tokens (theme-independent)

| Token | Value | Use |
|---|---|---|
| brand-600 | #2563EB | Primary action/selected control |
| brand-500 | #3B82F6 | Links and focus accent |
| cyan-500 | #22C7D8 | Highlight/brand-gradient midpoint |
| teal-400 | #47D6B0 | Decorative/positive accent where semantically appropriate |
| violet-500 | #7468F0 | Secondary chart/strategy series only |
| brand-gradient | #5577FF → #22C7D8 → #47D6B0 | Logo and selected decorative surfaces only |

### Dark theme

| Token | Value | Use |
|---|---|---|
| bg-canvas | #08111F | Page canvas |
| bg-sidebar | #0B1525 | Main navigation |
| bg-surface | #101D30 | Primary panels |
| bg-elevated | #16263D | Menus/dialogs/raised panels |
| bg-subtle | #0C192B | Table stripes/secondary region |
| border-default | #273951 | Standard divider/border |
| border-strong | #3A526E | Emphasis/active selection |
| text-primary | #F3F7FC | Primary content |
| text-secondary | #B2C0D1 | Secondary content |
| text-muted | #8293A9 | Tertiary/metadata; test contrast before use for small text |
| focus-ring | #77C9FF | Keyboard focus |
| chart-grid | #29405B | Axis/gridline |
| overlay-scrim | #030914 at 72% | Modal scrim |

### Light theme

| Token | Value | Use |
|---|---|---|
| bg-canvas | #F3F6FA | Page canvas |
| bg-sidebar | #FFFFFF | Main navigation |
| bg-surface | #FFFFFF | Primary panels |
| bg-elevated | #FFFFFF | Menus/dialogs |
| bg-subtle | #EAF0F6 | Table stripes/secondary region |
| border-default | #D5DFEA | Standard divider/border |
| border-strong | #A9B9CB | Emphasis/active selection |
| text-primary | #17263A | Primary content |
| text-secondary | #475A70 | Secondary content |
| text-muted | #61758B | Metadata; validate contrast for selected sizes |
| focus-ring | #075FC7 | Keyboard focus |
| chart-grid | #D7E1EC | Axis/gridline |
| overlay-scrim | #142338 at 42% | Modal scrim |

### Semantic states (both themes)

| State | Token direction | Required text/icon |
|---|---|---|
| PASS / healthy / reconciled | Green/teal semantic | “Healthy”, “Pass”, “Reconciled” plus icon |
| WARN / degraded | Amber | “Warning”/“Degraded” plus icon |
| FAIL / error | Red | “Failed”/specific error plus icon |
| UNKNOWN | Neutral blue/gray | “Unknown” plus context |
| NOT_TESTED | Neutral gray | “Not tested” |
| BLOCKED | Red/amber according to severity | “Blocked” and reason |
| Info / advisory | Blue | Clear explanation |

Do not reuse profit-green as the sole signal for “healthy”; PnL polarity and system health are different semantics. Add text/icon and preserve contrast.

## 3. Typography

- Primary family: system-first sans stack: Inter, ui-sans-serif, system-ui, Segoe UI, sans-serif. Avoid a required font-download dependency.
- Technical/monospace: ui-monospace, SFMono-Regular, Consolas, monospace for hashes, IDs and selected logs.
- Numeric values: tabular numerals; align currency/percentage units and avoid ambiguous abbreviations.
- Suggested desktop scale: display 32/40 px; H1 28/36; H2 22/30; H3 18/26; body 14/22; body-small 12/18; metadata minimum 12 px after contrast review.
- Avoid ultra-light weights for financial metrics and small labels.

## 4. Spacing, shape and elevation

Base spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64 px.  
Radius scale: 6 px controls, 10 px standard cards, 14 px major panels, 18 px hero/demo card.  
Border: 1 px default; 2 px for focus/critical outlined states.  
Elevation: use shallow surface separation for tables/cards; reserve larger soft shadows for modals and 3D hero surfaces. Avoid stacking multiple glow effects.

## 5. Layout tokens

- Desktop max content width: 1600 px; standard reading width: 1120 px.
- Sidebar desktop: 232 px expanded, 72 px collapsed; keep a safe collapse state for small laptop widths.
- Standard dashboard gap: 16 px; panel padding: 16–24 px; page padding: 24–32 px desktop.
- On narrow screens, nav becomes a drawer/bottom navigation according to page type, not both at once.
- Dense tables get contained scrolling or a detail view, never a wider-than-viewport page.

## 6. Component patterns

- Primary button: solid brand blue, visible hover/pressed/disabled/focus states, short action label.
- Secondary button: neutral surface/outline, not a competing primary.
- Destructive action: explicit text plus icon, clear confirmation and result state.
- Metric card: label, value, unit, time basis/provenance and optional small trend; avoid decorative trend if data is absent.
- State badge: text + icon, consistent semantic token and accessible contrast.
- Table: sticky header where justified, clear units, aligned numeric columns, row drill-in and empty/loading/error states.
- Chart: labels, units, time range, provenance, last updated and keyboard-accessible adjacent summary.
- Dialog/toast: announce state changes appropriately; toasts cannot be the only record of a critical operation.
- Risk control: configured value, unit, source/approval state and locked/TBD indication; never present a missing limit as a safe default.

## 7. Theme behavior

Persist light/dark/system preference according to the implementation-phase storage/security design. Apply the selected theme across charts, chart tooltips, tables, calendars, menus, forms, dialogs and code/log viewers. Avoid hydration flashes. Theme selection cannot alter runtime mode, permissions or trading configuration.

## 8. Token implementation handoff

Create CSS variables from these semantic tokens rather than scattering hex values across components. Validate all chosen foreground/background combinations with automated and manual contrast checks before Phase 4 sign-off. The colors above are the proposed design baseline, not completed accessibility certification.
