# Phase 2.5 — UI Theme, Information Architecture and Responsive Design

**Status:** UX requirements locked for design handoff. Detailed visual design remains canonical Phase 4; UI implementation follows the roadmap.

## Brand assets

Use the vector assets documented in [Brand identity and logo usage](09-brand-identity-and-logo-usage.md): [dark lockup](../../assets/brand/auto-trading-agent-logo-dark.svg), [light lockup](../../assets/brand/auto-trading-agent-logo-light.svg) and [compact mark](../../assets/brand/auto-trading-agent-mark.svg). Preserve contrast and aspect ratio; detailed placement is a Phase 4 design-system decision.

## Design direction

The interface should feel like a serious, modern trader-agent control room: formal, professional, precise, calm under pressure, data-dense without clutter, and trustworthy. It should not look like a casino, gaming HUD, meme-coin landing page or neon-heavy speculative trading toy.

Use a restrained base palette (deep navy/graphite, cool slate and neutral surfaces), a complementary soft-neutral light theme, restrained semantic accents for positive/caution/error/info states, strong typography, disciplined spacing, consistent components and tabular numerals for prices, balances, percentages, fees and PnL. Prioritize legibility over decorative cards. Charts require visible labels, units, time windows and provenance. Exact palette/type/spacing tokens are Phase 4 design decisions.

## 3D visual direction — D-030

Use tasteful 3D/isometric visual treatments wherever they improve comprehension or visual hierarchy within a page frame or section. This is a selective design layer, not a rule to turn every component into a 3D object.

### Recommended placement by section
- **Public landing hero:** use the 3D market-intelligence illustration to create a strong first impression; pair it with a clear product statement and a real CTA. Avoid fake live metrics.
- **Product/agent architecture:** use isometric nodes, layered modules, or an interactive diagram to explain discovery → analysis → risk veto → constrained execution → reconciliation.
- **Market intelligence and strategy sections:** use small, restrained dimensional market or data illustrations as supporting visuals; the actual chart and numeric evidence remain flat, precise and data-faithful.
- **Security and self-hosted sections:** use a dimensional shield, isolated server stack or signer-boundary illustration to explain separation and customer control.
- **License, setup and onboarding sections:** use small layered step illustrations, 3D icons, or a simple illustrated sequence where it improves scanning.
- **Empty, loading or completion states:** optional subtle 3D illustration, with clear text and action; never obscure an error or unknown state.
- **Runtime cockpit:** use slight depth/elevation for selected summary cards and visual grouping. Keep core trading tables, axes, fills, fees, order states, risk thresholds and operational controls direct, legible and non-distorted.

### Visual and interaction rules
- Prefer a coherent isometric/soft-3D language: cool navy/graphite materials, restrained cyan/blue/teal highlights, measured shadows and glass-like surfaces used sparingly. Retain a calm formal fintech aesthetic, not a game HUD.
- Use real model data for charts and live status. Do not use 3D bars/perspective that distort comparisons, values, ordering or risk; financial charts should remain easy to read and accurately scaled.
- Do not imply that decorative graphics are live market data, a security certification, or proof of performance. Label illustrative content when necessary.
- Keep interactive 3D optional and only use it when users can inspect a meaningful object or architecture. Decorative scenes should be lightweight SVG/CSS or optimized static assets rather than demanding WebGL by default.
- Respect reduced-motion settings; avoid auto-rotating, parallax-heavy or flashing visuals. Any motion must be subtle, pausable and non-essential.
- On mobile, simplify/crop or hide decoration before shrinking core content. Maintain no horizontal overflow, touch usability, contrast and text alternatives.
- In light mode, use a dedicated contrast-safe variant or a themed contained surface; never place a dark-only asset on a light surface without checking legibility.
- Every section must remain understandable when decorative assets fail to load or are unavailable.

The initial reusable 3D-style asset is [the market-intelligence hero SVG](../../assets/brand/auto-trading-agent-3d-hero.svg). Detailed section placement and responsive compositions are Phase 4 design-system work.

## Theme requirements

- **UI-001:** Both light and dark modes at first user-facing release.
- **UI-002:** Clear theme control; system preference option where supported.
- **UI-003:** Persist explicit preference using the approved storage/account design.
- **UI-004:** Prevent avoidable flash of wrong theme during first render/hydration.
- **UI-005:** Check contrast for text, controls, focus, disabled, error and status states in both themes.
- **UI-006:** Tables, charts, dialogs, menus, forms, toasts and log panels all follow the selected theme.
- **UI-007:** Theme changes never change trading policy, runtime mode or permissions.

## Responsive requirements

- Desktop supports persistent navigation and multi-column workspace; tablet collapses/rebalances panels; mobile prioritizes health, current position, risk alerts, major decisions and emergency state.
- No global horizontal overflow on desktop/tablet/mobile. Dense tables may use intentional contained scrolling or detail views.
- Charts resize while preserving labels, units and time ranges; data may move into a detail view but cannot silently disappear from evidence records.
- Controls remain touch- and keyboard-usable; no hover-only critical actions.
- Stale data, unknown transaction state, failures and pause/kill status remain prominent at every breakpoint.
- Responsive layout cannot change authorization or backend behavior.

## Runtime information architecture

1. **Overview/Cockpit:** health, mode, data freshness, risk, position, alerts and recent decisions.
2. **Market & Discovery:** candidate evidence, liquidity, token safety, scores and rejection reasons.
3. **Agent Brain/Decision Trail:** strategy routing, evidence, rule versions, vetoes and why trade/no-trade/research-more was chosen.
4. **Positions & Execution:** orders, transactions, fills, fees, unknown states and reconciliation.
5. **Risk Center:** approved limits, exposure, drawdown, breakers, blocked entries and emergency controls.
6. **Performance & Evaluation:** live ledger distinctly separated from backtest, OOS, paper and shadow.
7. **Configuration:** validated non-secret settings, strategy versions and audit.
8. **Integrations & Health:** RPC/data/LLM availability, errors, latency and freshness.
9. **Logs, Audit & Recovery:** sanitized diagnostics, backups, updates and recovery.
10. **License, Docs & Support:** installation/license state, authorized releases, setup guide and booking.

The central portal has separate navigation for quote/invoice, verified payment, registration/MFA, approval, license/releases, docs, booking and support. Do not put commercial account records in the runtime trading database.

## Data truthfulness and critical controls

Display units, timeframe, source/calculation basis, freshness and state as relevant. Distinguish realized/unrealized, gross/net, actual/estimated, backtest/OOS/paper/shadow/live, plus PASS, WARN, FAIL, UNKNOWN, NOT_TESTED, BLOCKED and unavailable. Unknown/unmeasured/blocked checks cannot improve score or coverage. No fake live price or unlabelled sample performance.

Show current mode and order permission clearly. Risk veto and unresolved transactions are easy to find. Pause/kill controls show confirmed outcomes and do not promise liquidation. Live mode remains disabled until all separate release gates pass. Status cannot rely on color alone.

## Phase 4 handoff checklist

Produce light/dark concepts, responsive desktop/tablet/mobile examples, tokenized color/type/spacing/radius/elevation system, chart/table/form/modal/toast components, empty/loading/error/unknown states, accessible contrast review in both themes, and critical screens for stale data, provider outage, risk veto, open position, unknown transaction, paused runtime and license failure.

Phase 2 captures requirements, not final mockups. Do not skip Phase 3 security architecture or reorder the frozen roadmap.
