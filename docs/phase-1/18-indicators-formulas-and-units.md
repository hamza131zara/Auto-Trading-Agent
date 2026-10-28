# Indicators, Formulas and Units Catalogue

**Status:** Requirements supplement. Final numeric thresholds and model acceptance limits remain owner-approved decisions.  
**Rule:** Every value must have a unit, timeframe, source/provenance, timestamp/freshness, calculation version and stated uncertainty. No indicator alone authorizes a trade.

## 1. Financial calculations

### Net realized PnL
Net PnL = actual exit proceeds - reconciled entry cost - attributable realized fees/costs not already included in those amounts.

Do not double-count costs. Record costs by category and preserve raw token/base-unit quantities. Convert to USD using a timestamped valuation source and retain native quote-token values.

### Net ROI
Net ROI (%) = net PnL / defined total entry cost × 100.

The denominator, fee treatment and valuation timestamp must be explicit. Show native units and USD equivalents where meaningful.

### Win rate
Win rate = profitable completed trades / completed trades × 100%.

Report sample size, interval, confidence interval, break-even convention, and separate results by strategy, version, exit profile and regime. Incomplete/unknown outcomes are not silently counted as wins or losses.

### Expectancy
Report both absolute-dollar expectancy and normalized expectancy:
Expectancy = arithmetic mean of realized net PnL per eligible completed trade.
If normalized to risk, define the risk unit before testing. Do not substitute gross return, predicted return or win rate.

### Profit factor
Profit factor = gross positive realized PnL / absolute gross negative realized PnL.
If there are no gross losses, report it as undefined/no-loss sample rather than interpreting infinity as proof of a durable edge.

### Drawdown
Drawdown(t) = (equity peak through t - equity(t)) / equity peak through t.
Define whether equity includes unrealized marks, how deposits/withdrawals are excluded, valuation source, intratrade vs realized-only view and behavior during valuation gaps.

### Position/liquidity ratio
Notional-liquidity ratio = intended trade notional / declared relevant liquidity or route depth.
This is a screening warning only. It does not replace executable buy/sell quotes, price-impact checks or simulation. Define the pool/route and whether liquidity means TVL, one-sided depth or estimated depth at a price-impact threshold.

### Holder concentration and HHI
Top-K share = sum of balances for the selected top K addresses / defined eligible supply.
HHI = sum of squared holder-share fractions.
Document whether shares are fractions or percentages, supply denominator, snapshot slot, address coverage, LP/burn/treasury/exchange labels and cluster-adjusted view. Always retain raw top-holder metrics and disclose unknown-label coverage.

## 2. Outcome estimation

### Expected net return
For discrete outcome scenarios:
Expected net return = sum(probability_i × net_return_i).
The distribution should consider at least take-profit-first, stop/invalidation-first, neither within the evaluation horizon, emergency/tail loss, failed/partial exit and timeout where applicable. Include fees, price impact and uncertain fills.

Only accept a trade when a conservative estimate satisfies a predeclared minimum edge and uncertainty criteria. If probabilities are not calibrated, data is insufficient, or likely returns are dominated by costs/tail risk, abstain.

### TP-before-stop probability
Define a time-stamped decision point, executable entry assumption, exact target/stop rules and horizon. Labels should distinguish target-first, stop/invalidation-first, neither within horizon and unobservable/data-invalid. Features must only use information available at the decision time.

### Probability calibration
Track calibration by model/version, regime, token-age/liquidity buckets and predicted-probability bins. Use Brier score, log loss and reliability diagrams when appropriate, plus sample sizes/confidence intervals. A raw score is not a win probability.

## 3. Kelly and portfolio calculations

Research objective:
f* = argmax_f sum(p_i × log(1 + f × R_i)),
where p_i and R_i represent estimated probabilities and portfolio returns for declared outcomes. The feasible set must exclude allocations that violate risk/exposure/liquidity limits or permit non-positive modeled wealth.

- Use only out-of-sample evidence and sensitivity/bootstrap analysis.
- Apply probability/return-estimate shrinkage and conservative fractional-Kelly variants during backtest/shadow research only.
- Independent exposure, drawdown, position and liquidity caps override any Kelly proposal.
- Correlation, regime change, model uncertainty, catastrophic tail outcomes and inability to exit must be represented.
- Non-positive or unreliable edge means NO_TRADE.
- A win rate alone is not a sufficient Kelly input.

### Compounding path
Equity at t+1 = Equity at t × (1 + realized portfolio return at t), after separately accounting for deposits/withdrawals and costs.
Use actual sequential outcomes for historical replay. For simulation, disclose bootstrap/Monte Carlo assumptions, sample window, resampling method, regime dependence, cost model and uncertainty intervals. Never assume all trades deliver +6%.

### Goal-reaching probability
Estimate from simulated paths based on out-of-sample or otherwise justified return distributions, fees, sizing/risk rules, tail events, time horizon if specified, pauses and ruin/drawdown behavior. Report probability plus uncertainty/sensitivity; no guarantee or completion-date claim.

## 4. Execution-cost calculation

Track separately:
- swap/DEX/aggregator/platform fees;
- Solana base and priority fees, including fees from failed transactions where incurred;
- token transfer fees and other token mechanics;
- entry and exit slippage/price impact;
- quote-to-submit latency and route changes;
- failed/partial exits and residual balances;
- attributable provider/compute costs where calculating cost per opportunity or round trip.

Total round-trip execution cost = actual entry costs + actual exit costs + attributable realized execution costs.
Do not count price impact twice if it is already reflected in actual proceeds. Preserve estimated vs quoted vs simulated vs actual values.

## 5. Market indicators and suggested units

| Category | Candidate indicators | Required unit/metadata |
|---|---|---|
| Price/trend | 1m/5m/15m/1h returns, EMA relationships, RSI, ATR, trend slope, relative strength vs SOL | Percentage/price units, calculation version, candle source and timeframe |
| Volume/flow | Volume acceleration, volume z-score, buy/sell counts and imbalance, unique buyers/sellers, repeat-wallet share, trade-size distribution | USD or quote token, count/ratio, observation window and provider |
| Liquidity/pool | Current liquidity, reserve balance, liquidity change/velocity, pool age, depth at intended size | USD/native units, percentage, seconds/minutes, exact pool/route |
| Holder/wallet | Top-1/3/5/10 shares, HHI, creator share, connected-wallet cluster evidence, synchronized distribution | Fraction or percentage with universe, snapshot slot and label confidence |
| Token/program | Mint/freeze authority, Token-2022 extensions, transfer fees/hooks, permanent delegate, pause/nontransferability | Boolean/enum plus parsed state, provenance and freshness |
| Execution | Buy/sell quote, min-out, feeBps, estimated impact, slippageBps, quote age, transaction latency | Native token, USD equivalent, basis points; quote is not a guaranteed fill |
| Predictive model | TP-before-stop probability, net return distribution, calibration, expected net return, uncertainty/data completeness | Probability 0–1, return fraction, model/feature version |
| Risk/portfolio | Exposure, position risk budget, daily/max drawdown, consecutive losses, emergency events | USD and equity fraction; reset window/timezone/valuation definition |
| System health | RPC/stream lag, provider errors, p50/p95 latency, queue age, signer failures, DB lag | Milliseconds/seconds/counts/ratios; thresholds set after baseline measurement |

## 6. Implementation acceptance rules
- Exact arithmetic and base-unit parsing tests; do not use floating-point token amounts for transaction construction.
- Reject NaN, infinity, impossible balances, negative amounts and invalid denominators.
- Property tests for fee allocation, ROI, drawdown, HHI, Kelly feasibility and portfolio invariants.
- Independent reconciliation tests compare ledger values with confirmed on-chain transactions/balance changes.
- Every displayed metric carries its data freshness and estimated/quoted/simulated/actual label.
- Metric definitions are versioned; changes require a migration note and updated tests.