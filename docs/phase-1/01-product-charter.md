# Product Charter

## Purpose
Build a research-first, auditable Solana spot-DEX trading system that discovers candidates, checks token/pool risk, evaluates strategies, sizes positions within strict limits, executes through a constrained signer, manages exits, and learns from reconciled outcomes. The product is not represented as a guaranteed-profit system.

## Product objectives
- Make token selection and trade decisions traceable to dated market data and versioned rules.
- Prefer capital preservation and expected net performance over trading frequency.
- Support multiple validated exit profiles: quick-compound, trend-capture and high-upside runner.
- Track candidate, trade, execution, risk and model outcomes, including rejected/skipped candidates.
- Evaluate every new strategy or model through research, out-of-sample testing and paper trading before promotion.

## V1 scope
- Solana mainnet spot tokens/pools only, with test/dev environments for development and simulation.
- At most one open position portfolio-wide.
- One operator/admin role initially; authenticated private dashboard.
- Market discovery, token/pool validation, holder concentration and wallet-cluster indicators where data is reliable, liquidity and exitability analysis, market-regime features, strategy selection, risk governor, execution adapter, position monitor, ledger/audit, reports and kill switches.
- Fixed-target, trend-capture and high-upside-runner exit profiles as competing policies to test.
- Statistical strategy registry and controlled champion/challenger promotion.
- Optional LLM/structured decision layer for bounded classification, ranking, research summaries and post-mortems; no signing authority.
- Kelly-based sizing only as a research module until explicitly validated.

## Non-goals for V1
- No new wallet product or custody service for public customers.
- No multi-tenant custody, cross-chain execution, leverage, borrowing, perpetuals, lending, market-making, arbitrage, MEV extraction, or unrestricted copy trading.
- No promise that any trade wins, a strategy is profitable, a token is safe, or a milestone will be reached.
- No automatic self-modification of production code, hard risk limits, permissions, or signer policy.

## Actors
- Owner/operator: configures bounded policy, reviews reports, pauses system and approves releases.
- Discovery/data services: provide on-chain and market observations.
- Decision services: calculate features, estimates and candidate rankings.
- Risk governor: enforces non-bypassable limits.
- Execution/signer boundary: validates approved intents, signs only permitted transactions and reconciles results.
- Research evaluator: backtests, tests calibration/drift and proposes versioned changes.

## Operating modes
1. **Research:** historical datasets and offline analysis only.
2. **Simulation/backtest:** replay data with explicit fill/fee/slippage assumptions.
3. **Paper/shadow:** live observations and quotes, no asset-moving transaction.
4. **Mainnet restricted pilot:** only after all release gates; very limited capital and explicit owner enablement.
5. **Halted:** no new entries; exits and recovery follow separately defined operational policy.

## Success measures
Success is judged by data quality, safety-gate coverage, execution reliability, cost-model error, calibrated outcome estimates, out-of-sample net expectancy, drawdown, audit completeness, reproducibility and controlled operation—not win rate alone.

## Requirement status
All statements are proposed until accepted in the Phase 1 decision log.