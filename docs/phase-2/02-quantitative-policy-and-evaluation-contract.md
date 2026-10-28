# Phase 2.2 — Quantitative Policy and Evaluation Contract

**Status:** Measurement contract drafted. Numeric operating thresholds require explicit owner approval before executable use.

## Authority order

1. Mandatory token/security gates.
2. Deterministic risk governor and approved numerical limits.
3. Versioned strategy eligibility/ranking.
4. Advisory model/LLM.
5. UI explanations.

Lower-authority components cannot override higher-authority rejection. No numeric threshold may be inferred where it is marked TBD.

## Candidate evidence contract

Every candidate assessment records chain/token/pool/route identity, observed/retrieved timestamps, source provenance and freshness; liquidity/depth, pool age and trading history where reliable; relevant token program/extensions and authority state; holder concentration and exclusions; volume/trade/price/volatility/spread/impact values with units and windows; quote/exitability evidence; hard gate outcomes, reason codes, missing/unknown signals; plus rule, feature, strategy, config and model versions.

Unknown values remain unknown. They cannot be treated as zero-risk or positive evidence. Evaluated coverage counts only evaluable checks; non-evaluable/execution status is reported separately.

## PnL/accounting contract

Report entry/exit quantities and fills, gross fill-based PnL, DEX/swap fees, base transaction fees, priority fees/tips, failed-transaction costs, slippage/impact, token taxes or transfer costs where applicable, total attributable costs, realized net PnL, quote currency, percentage denominator, provenance, estimates vs actuals, reconciliation state and timestamps.

Recommended identity:

**realized_net_pnl = realized_exit_value − realized_entry_cost − attributable_execution_costs − other_direct_position_costs**

If fill/cost state is unresolved, label results provisional/unknown. A gross-margin value of exactly 0% is distinct from an omitted margin. Hosting/LLM/data costs belong in a separate unit-economics view unless the report explicitly defines a broader profit measure.

## Strategy and risk rules

- One open or unresolved position per instance/portfolio; no new entry before reconciliation.
- NO_TRADE is valid; no required trade frequency.
- The +6% net profile is a baseline hypothesis to test, not a guaranteed return or universal full-exit rule.
- Quick Compound, Trend Capture and High-Upside Runner are hypotheses, not assumed profitable.
- An exit/stop is an execution request, not a guaranteed fill at the requested price.
- Kelly sizing remains research-only until calibrated and tested; if later enabled, use conservative fractional sizing plus independent caps. A model-generated probability alone cannot size a trade.

Before an order intent, evaluate operating mode, hard gates, data freshness, unresolved orders, max position/exposure, per-trade loss budget, liquidity/impact, minimum output, quote expiry, blockhash/validity, fee/slippage caps, drawdown/session loss breakers, signer scope, provider health and pause/kill state. Any required limit marked TBD blocks execution.

## Evaluation contract

- Use time-ordered and walk-forward/out-of-sample splits; prevent look-ahead, leakage, duplicate rows and unsupported survivorship assumptions.
- Model realistic fees, failed transaction costs, spread, slippage, impact, latency and unavailable liquidity. Never assume stops always fill.
- Report sample size, test window, versioned data/config, coverage, trade frequency, exposure, gross/net performance, drawdown, tail loss, fee burden, win/loss distribution, net expectancy, regime-separated outcomes and uncertainty where meaningful.
- Test cost/latency/threshold sensitivity and adverse fills. Keep backtest, OOS, paper, shadow and live results distinct.
- Every run records dataset/version identity, strategy/rule/config versions, evaluation period and reproducibility metadata.
- Minimum sample size, OOS length, acceptable drawdown/tail loss, net expectancy, stability/calibration and paper/shadow duration are TBD until owner-approved.

## Numerical approval register

| Parameter | Status | Required reason |
|---|---|---|
| Minimum liquidity/depth | TBD | Entry and exitability |
| Max holder concentration/cluster risk | TBD | Manipulation/concentration exposure |
| Max spread/impact/slippage | TBD | Execution quality |
| Position size and wallet exposure | TBD | Capital-at-risk bound |
| Per-trade loss budget | TBD | Loss containment |
| Daily/session loss and drawdown caps | TBD | Circuit breakers |
| Fee/priority-fee caps | TBD | Cost ceiling |
| Market-data staleness by source | TBD | Avoid stale decisions |
| Strategy entry/exit thresholds | TBD | Reproducibility |
| Minimum OOS sample/window | TBD | Statistical reliability |
| Max accepted drawdown/tail loss | TBD | Release safety |
| Net expectancy and regime stability | TBD | Viability evidence |
| Paper/shadow duration and stop rules | TBD | Operational validation |
| Calibration/confidence bounds | TBD | Estimate reliability |

Each approved parameter must record value, unit, rationale, approver/date and tests. An example, UI mock, LLM answer or third-party default is not approval.

## Required tests

Unknown/blocked checks do not improve score/coverage; all direct costs and failed-transaction costs are accounted for; an unresolved order blocks a new entry; security/risk veto beats LLM ranking; zero margin differs from omitted margin; realistic cost/latency/adverse-fill sensitivity is reported; modes are not blended; and no output promises profit based on a target or simulation.

Phase 2 cannot close with executable numerical thresholds unresolved unless the owner formally excludes execution and records the system as research-only. Mainnet remains prohibited.
