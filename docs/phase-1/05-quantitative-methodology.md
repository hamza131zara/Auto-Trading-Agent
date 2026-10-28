# Quantitative Methodology

## Financial accounting
Use integer base units for on-chain quantities and explicit decimal/currency handling for reporting. Store raw inputs and derived values with timestamps and source references.

Realized trade net PnL must reconcile actual entry cost, actual exit proceeds, swap/aggregator fees, network and priority fees, token transfer fees, and other attributable costs. Do not infer realized PnL from chart price movement alone.

Report both:
- Token price return from entry to exit.
- Portfolio/position net PnL after actual costs.

## Outcome labels
For each candidate and strategy version, define the observation time, entry assumptions and evaluation horizon before looking at the result. Suggested labels:
- TAKE_PROFIT_FIRST
- STOP_OR_INVALIDATION_FIRST
- NEITHER_WITHIN_HORIZON
- UNOBSERVABLE_OR_DATA_INVALID

Use executable quotes and realistic cost assumptions where historical data permits; mark simulated fills as simulated. Prevent look-ahead leakage by using only features available at decision time.

## Minimum metrics
- Win rate: winning completed trades / completed trades; define treatment of break-even and unresolved trades.
- Net expectancy: mean net PnL per trade under a specified denominator.
- Profit factor: gross positive realized PnL / absolute gross negative realized PnL.
- Maximum drawdown: largest peak-to-trough decline in the equity curve.
- Average win/loss, median return, return distribution and tail-loss quantiles.
- Fee and slippage distributions, quote-to-fill error, transaction failure rate and exit failure rate.
- Calibration metrics and reliability diagrams for predicted probabilities.
- Strategy/regime results, sample size and confidence intervals.
- Target-attainment probability under explicit assumptions and simulated paths.

## Expected value
A simplified binary formula is not sufficient for all DEX outcomes. Use a distribution with take-profit, stop/invalidation, timeout, emergency exit, failed exit and other adverse outcomes. Expected net result must incorporate realistic execution costs and uncertain fills.

## Kelly research
Research an empirical log-growth formulation over a return distribution rather than automatically applying a binary-bet shortcut. For candidate allocation fraction f and outcome returns R_i, the research objective can be expressed as maximize the sum of p_i times log(1 + f R_i), subject to feasibility and ruin constraints.

Key caveats:
- p_i and R_i are estimated and may be miscalibrated.
- Large negative tail outcomes can dominate the result.
- Trade outcomes may be dependent and regime-sensitive.
- DEX positions can be impossible to exit at modeled prices.
- The position fraction is not a substitute for a portfolio risk budget.

Compare conservative fractional-Kelly variants only in backtesting/shadow mode. Independent hard caps on exposure, liquidity, drawdown and loss budget always dominate the Kelly proposal. A poorly calibrated or non-positive edge yields NO TRADE.

## Compounding trajectory
Use actual sequence simulations or Monte Carlo/bootstrap methods built from defensible out-of-sample return distributions. Include fees, variable win/loss magnitudes, correlations/regimes, strategy-selection uncertainty, missed fills, partial exits, severe-loss scenarios and stop/kill-switch behavior. Show assumptions and uncertainty bands. Do not extrapolate a fixed +6% per-trade sequence as a forecast.

## Exit policy comparison
Compare fixed +6% net full exit, staged partial exits, trailing exits and runner profiles on identical data partitions and cost models. Measure net expectancy, drawdown, tail loss, holding-time distribution and target attainment, not only peak return or win rate.

## Overfitting controls
Use chronological train/validation/test splits, rolling walk-forward evaluation and untouched holdout periods. Track number of strategies tried and selected to help identify multiple-testing/selection bias. Lock evaluation criteria before ranking candidates.
