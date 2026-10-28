# Phase 2.5 — UI Theme, Information Architecture and Responsive Design

**Status:** UX requirements locked for design handoff. Detailed visual design remains canonical Phase 4; UI implementation follows the roadmap.

## Brand assets

Use the vector assets documented in [Brand identity and logo usage](09-brand-identity-and-logo-usage.md): [dark lockup](../../assets/brand/auto-trading-agent-logo-dark.svg), [light lockup](../../assets/brand/auto-trading-agent-logo-light.svg) and [compact mark](../../assets/brand/auto-trading-agent-mark.svg). Preserve contrast and aspect ratio; detailed placement is a Phase 4 design-system decision.

## Design direction

The interface should feel like a serious, modern trader-agent control room: formal, professional, precise, calm under pressure, data-dense without clutter, and trustworthy. It should not look like a casino, gaming HUD, meme-coin landing page or neon-heavy speculative trading toy.

Use a restrained base palette (deep navy/graphite, cool slate and neutral surfaces), a complementary soft-neutral light theme, restrained semantic accents for positive/caution/error/info states, strong typography, disciplined spacing, consistent components and tabular numerals for prices, balances, percentages, fees and PnL. Prioritize legibility over decorative cards. Charts require visible labels, units, time windows and provenance. Exact palette/type/spacing tokens are Phase 4 design decisions.

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
