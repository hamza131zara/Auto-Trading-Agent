# Phase 4.3 — Core Screen and Interaction Specifications

**Status:** Screen-level design baseline; implementation and usability tests remain later work.  
**Source requirements:** Phase 2 PR-001 through PR-016, UI-001 through UI-014, and the acceptance matrix.

## 1. Runtime Overview / Cockpit

### Desktop composition
- Left navigation rail (expanded/collapsed), global header, environment/runtime-mode indicator and visible system-health summary.
- First row: runtime health, market-data freshness, current operating mode and risk/circuit-breaker status.
- Second row: open/unresolved position, wallet exposure, session/day limit status and reconciled performance summary.
- Main region: real sourced market/performance chart only when data exists; latest agent decisions/no-trade reasons; provider health and recent audited actions.
- Critical banner for BLOCKED, UNKNOWN transaction, stale critical feed, signer unavailable, paused runtime or emergency state; pin above decorative/secondary data.

### Empty, unknown and failure states
- No position: show “No open position” and the most recent reconciled state; do not leave a blank value.
- Unknown transaction: show “Execution status unknown — new entries blocked”, transaction reference, last check time and reconciliation action.
- Stale/failed feed: remove/mark any live-trust implication, show source and age, disable dependent entry actions.
- Missing numeric risk limit: “Blocked — required risk limit not configured”; never display 0 or “safe”.
- Demonstration data: persistent DEMO label and no claim it is current account data.

## 2. Markets & Discovery

- Filter row: asset/pool/route, observation window, liquidity/depth range (when configured), age, data freshness, hard-gate outcome and strategy eligibility.
- Candidate table: token/mint, pool/route, observed time, liquidity/depth and unit, volume/window, spread/impact evidence, holder/authority checks, evaluable coverage, final status and reason.
- Row opens a candidate evidence view: source, timestamp, raw/normalized value, rule version, PASS/WARN/FAIL/UNKNOWN/NOT_TESTED/BLOCKED and reason.
- Separate “not evaluated” from “failed”; unknown does not improve safety score or coverage.
- Never use an attractiveness score to override a failed security gate.

## 3. Agent Brain / Decision Trail

- Timeline from scan → evidence → rule checks → strategy proposal → risk decision → intent request → signer decision → execution outcome → reconciliation.
- Each step shows timestamp, source, rule/model/version, payload summary and reason code.
- LLM contributions are marked advisory; hard-rule veto is visually distinct.
- NO_TRADE and RESEARCH_MORE are first-class outcomes.
- Any editable prompt/model or strategy settings are versioned and cannot alter hard risk limits.

## 4. Positions & Execution

- Position summary distinguishes open, closing, partially filled, unresolved, reconciled and closed states.
- Show pair/mints, input quantity, average fill, quote/output, actual fee/priority costs, slippage/impact where calculable, and source transaction references.
- PnL labels distinguish gross/net and realized/unrealized; provisional values carry a visible status and reason.
- Transaction timeline shows intent, validation, simulation, submission, confirmation/failure/unknown and reconciliation.
- New entry is disabled while a position/order is open or unresolved.
- Exit/pause labels explain that an exit request is not a guaranteed fill at a displayed price.

## 5. Risk Center

- Display operating mode, approved limits with values/units/version/approval date, wallet exposure, per-trade/session loss budgets, drawdown/circuit breakers, fee/slippage caps, liquidity/exitability and provider/data requirements.
- Clearly distinguish configured, approved, effective, exceeded, not configured and blocked states.
- An unapproved/TBD limit appears as BLOCKED with a reason, not as an editable numeric guess.
- Pause/stop action: confirmation → backend/runtime response → persistent result banner → audit event. Never use a success toast as the only proof.
- Make “Stop new entries” distinct from “request exit”; do not imply guaranteed liquidation.

## 6. Performance & Evaluation

- Mode selector separates backtest, out-of-sample, paper, shadow and live datasets; switching the selector must not blend or silently compare unlike populations.
- Summary requires sample size/window, data coverage, gross/net performance, realized/unrealized as applicable, drawdown/tail loss, fees, trade frequency, exposure, benchmark and uncertainty/limitations.
- A chart shows exact time window, units, dataset/mode, update time and legend. Adjacent table/summary remains available to assist users who cannot read the chart.
- Demo/simulated data must be labelled as such.

## 7. Configuration and Integrations & Health

- Group by strategy (non-hard constraints), market-data/RPC providers, optional LLM, execution mode, notifications, audit and backups.
- Each field carries label, unit/format, validation rule, scope, sensitivity and last-edited version. Secret values are never re-shown after entry; display provider/key label and health, not the raw key.
- Configuration preview validates required values and summarizes the effective policy; every config change is versioned/audited.
- Provider health shows last successful call, latency where measured, freshness, quota/error state and affected capabilities.
- Changes to hard risk limits require the approved policy-change process; no LLM or UI may rewrite them autonomously.

## 8. Logs, Audit & Recovery

- Filters by time, severity, subsystem, decision/position/transaction ID, rule version and result.
- Use explicit UTC timestamp with user-local presentation where desired; show original timezone context when relevant.
- Log details include sanitized context and correlation IDs; secrets are always redacted.
- Backup state shows last successful backup, integrity result and restoration-test date. A successful backup is not proof that a restore has been tested.
- Recovery actions have prerequisites and previews; never retry an unknown transaction blindly.

## 9. Central commercial portal screens

- Public marketing: product, self-hosted operation, limitations, security boundaries, proposed pricing basis and quote request.
- Quote/invoice details: versioned scope/terms, currency, line items, taxes/fees and payment instructions; payment state is independent from license state.
- Payment review: pending, verifying, cleared/confirmed, rejected, refunded/disputed; separate reviewer and issuer audit actions as feasible.
- Registration: invitation validity, email verification, MFA, terms and owner/admin approval.
- License/downloads: entitlement details, installation binding, release notes, signatures/checksums and update/rollback guide.
- Setup center: prerequisites, numbered installation guide and customer-controlled credential/wallet instructions.
- Booking: real availability, timezone, duration, confirmation and configured Meet details; display no invented times.
- Support: sanitized diagnostics preview, disclosure warning and issue status; never request seed phrases/private keys.

## 10. Interaction states common to all screens

Each data-driven screen specifies: initial loading, successful populated state, empty state, stale data, partial failure, full failure, unavailable, unknown, not tested, blocked, permission denied, session expired and retry/recovery where safe. Use meaningful inline explanation next to the affected control/data; toast messages alone are insufficient for lasting operational state.
