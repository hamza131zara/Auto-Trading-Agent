# Trading and Exit Policy

## Governing principles
- V1 is Solana spot DEX only; no leverage or borrowing.
- Maximum one open position globally.
- No trade is an acceptable decision.
- Security gates precede opportunity scoring; risk controls have final veto authority.
- The system optimizes for defensible risk-adjusted net performance, not maximum trade count or a promised win rate.

## Candidate lifecycle
1. Discover and canonicalize token/pool identity.
2. Validate source completeness, timestamps and supported program behavior.
3. Run hard token/pool security gates.
4. Compute liquidity, exitability, holder, wallet-cluster, volume-quality, momentum and volatility features.
5. Classify market regime and candidate uncertainty.
6. Generate only allowed strategies and exit profiles for the current regime.
7. Estimate trade outcome distribution and net expected return, including execution cost and adverse outcomes.
8. Apply minimum-edge and confidence constraints; otherwise reject or wait.
9. Compute candidate sizing proposal; apply deterministic portfolio, token, liquidity and drawdown caps.
10. Obtain fresh buy and sell quotes, simulate where available and perform final risk/freshness checks.
11. Submit approved intent through isolated execution/signer boundary.
12. Reconcile actual fill and fees before declaring the position open.
13. Monitor position, exits, security, liquidity and system health.
14. Reconcile full/partial exit and realized PnL.
15. Record immutable post-trade evidence and update research statistics.

## Proposed exit profiles (not yet approved for live use)

### A. Quick Compound
- Initial research baseline: target +6% net of modeled/actual costs.
- Full exit at target is one benchmark policy, not a universal requirement.
- Exit on invalidation, max holding/operational timeout if defined, security escalation or risk emergency.

### B. Trend Capture
- A partial exit may occur at the initial net target.
- Remaining exposure is allowed only while predefined trend/volume/liquidity conditions remain valid.
- Define a trailing/invalidation policy with gap and execution-risk caveats.
- Compare against full exit using identical out-of-sample data and cost assumptions.

### C. High-Upside Runner
- Candidate must independently pass security, execution and risk gates.
- Keep an explicitly bounded fraction after earlier partial profit-taking; all stage percentages and triggers require backtest selection.
- Use predeclared profit stages or trailing/invalidation triggers. Multiples such as 2x, 5x or 10x price are research hypotheses, not forecasts.
- A price chart multiple does not establish realizable proceeds; exits must account for sell-side liquidity and price impact.
- Never override emergency-exit logic to pursue a larger multiple.

## Stop and emergency policies
- Distinguish position-level loss, portfolio-level drawdown and catastrophe controls.
- A stop trigger is not a guaranteed execution price, especially in illiquid pools.
- Stop new entries on stale/conflicting data, signer/execution anomaly, unknown transaction state, provider outage or breached portfolio limits.
- Emergency exit is an attempt, not a guarantee of sale; report failure and apply a documented recovery/escalation path.

## Re-entry
- Re-entry into a previously traded token is allowed only after fresh security, liquidity, strategy, cost and risk evaluation.
- Enforce configurable cooldown, maximum entries per token/window and stronger review after a loss or security alert.
- Do not interpret a prior winning trade as evidence that a repeat will win.

## Position sizing and Kelly
- Kelly is a research estimate based on an uncertain outcome distribution.
- Compare conservative fractional-Kelly variants only in backtest/shadow evaluation; no automatic production allocation is approved by this document.
- Final size is bounded by every applicable independent cap; non-positive/poorly calibrated edge means no trade.
- Treat tail losses, correlated market exposure, model uncertainty and exit liquidity as first-class inputs.

## Target milestones
- Configure owner-defined portfolio milestones; do not infer a deadline.
- Proposed default: halt new entries when a target is reached, reconcile balances and request owner review.
- A target is not a promise of achievement and may never be reached.

## Required audit record
Store candidate snapshot reference, rule/strategy/model versions, scores and inputs, estimated outcome distribution, quotes, cost breakdown, risk decision, signed intent reference, transaction signature, confirmation/fill state, actual amounts/fees, exit reason, realized net PnL, and post-trade assessment.