# Phase 4.4 — Responsive, Accessibility and Motion Specification

**Status:** Proposed breakpoints/acceptance baseline for design review; test against final components before sign-off.

## 1. Responsive layout targets

| Target | Width guideline | Layout |
|---|---:|---|
| Small mobile | 320–479 px | Single column; compact header; persistent critical state; bottom navigation or More menu; content-first |
| Large mobile | 480–767 px | Single column with optional two-column small metric pairs; charts simplify with complete textual summary |
| Tablet | 768–1023 px | Collapsible drawer/sidebar; 1–2-column grid; secondary panels move below primary risk/position information |
| Small desktop | 1024–1279 px | Collapsed sidebar by default if needed; dense tables remain contained; limited multi-column layout |
| Desktop | 1280–1599 px | Expanded or collapsible sidebar; 2–3 column workspace where it improves scanning |
| Wide desktop | 1600 px and above | Constrained content width or multi-column workspace; avoid excessively stretched tables and paragraphs |

Breakpoints are design targets, not assumed framework defaults. Phase 5 implementation must validate actual viewports and browser zoom.

## 2. Critical-state priority

At all widths, keep these reachable without searching the entire page:
1. Runtime mode and whether new orders are enabled.
2. Critical agent/provider health and market-data freshness.
3. Open or unknown position/order state.
4. Active risk veto, circuit breaker or paused status.
5. Emergency “stop new entries” action where implemented and permitted.

A narrow screen may collapse secondary charts, columns and decorative 3D elements, but must not hide, distort or reorder evidence in a way that changes its meaning. Do not use a tiny fixed-width desktop grid on mobile.

## 3. Touch and keyboard

- All actions available by hover also have a keyboard/touch equivalent.
- Visible focus ring remains distinguishable in light and dark themes and across charts, dialogs, menus and tables.
- Use semantic buttons/links, labels, headings, table headers and dialog semantics.
- Support full keyboard access for sidebar navigation, tabs, filters, tables, theme switch, confirmation dialogs, search and charts' adjacent data summary.
- Avoid keyboard traps; dialog focus enters and returns appropriately.
- Target touch controls at approximately 44 × 44 CSS px when practical, with spacing for destructive or high-impact actions.
- Do not depend on color, icon shape, vibration or sound alone for a status or confirmation.
- Keep zoom and text scaling available; avoid fixed-height containers that cut off controls or warnings.

## 4. Contrast and visual status

- Validate contrast for text, secondary text, button labels, badges, focus rings, chart axes, selected rows, disabled inputs and modal scrims in both themes.
- State always includes text/icon, e.g. “Blocked — limit not configured”, not just an amber/red badge.
- Distinguish performance semantics (profit/loss) from system health semantics.
- Provide data tables or a clear textual equivalent for charts where users need exact values.
- Respect error/status announcements with accessible live regions where appropriate, without reading every fast-updating tick as an interruptive alert.
- No animated visual can be the only evidence that a trade, payment or configuration action completed.

## 5. Motion and 3D

- Respect prefers-reduced-motion; disable or reduce parallax, floating, pulsing, scroll-triggered transforms and animated chart transitions as appropriate.
- No auto-rotating 3D model is required. Use static isometric SVG/CSS by default; add interactive 3D only when the user gains meaningful inspectable information.
- Motion is short, subtle and non-essential; never flash to draw attention to financial risk.
- On mobile or low-power contexts, hide/crop decorative 3D art before reducing information density.
- Decorative hero imagery must not cover a status banner, action button, data labels or legal/disclaimer content.
- Avoid WebGL or heavy 3D dependencies just to display static illustration.

## 6. Accessibility and responsive acceptance tests

- Switch dark/light/system modes at each target width; all primary text and interactive controls remain legible.
- Keyboard-only walkthrough completes all core navigation, filters, settings, dialogs and support booking.
- Screen-reader names/roles/value reflect current state and dynamic action outcome.
- Mobile view has no page-level horizontal overflow; a dense table may scroll inside its own labelled region.
- At 200% zoom, core state, emergency action and page navigation remain usable.
- Reduced-motion preference suppresses non-essential motion.
- Unknown/blocked/stale/failed states retain full textual explanation at every breakpoint.
- Chart values are not communicated by color alone and have a textual/table equivalent.
