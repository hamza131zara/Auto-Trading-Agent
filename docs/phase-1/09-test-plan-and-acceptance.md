# Test Plan and Acceptance Gates

## Test layers
1. Unit tests: arithmetic, token/amount parsing, net PnL, fee aggregation, risk policy, state transitions and idempotency.
2. Contract/schema tests: provider adapters, response versions, missing/null fields, rate limits and malformed data.
3. Property-based tests: financial invariants, monotonic risk limits, amount boundaries and state-machine transitions.
4. Integration tests: database transactions, queues, RPC/provider failover, quote/simulation/execution interfaces and signer policy.
5. Replay/backtest tests: chronological data replay, no look-ahead, fees/slippage, partial exits, failed exits and stop/kill-switch behavior.
6. Security tests: authentication/authorization, session/CSRF protections where applicable, secrets scanning, dependency and container scanning, API abuse and signer policy bypass attempts.
7. Resilience tests: provider outage, stale/disagreeing sources, database loss/restore, process restart, duplicate events, stuck/unknown transactions and queue backlog.
8. Paper/shadow validation: live market observations, quotes and simulated decisions with no signing or asset-moving transactions.
9. Restricted pilot validation: only after explicit approval and all exit gates pass.

## Required invariant tests
- Failed/unknown security gate cannot reach signer.
- No more than one open position portfolio-wide, including restart and race conditions.
- Stale/conflicting critical data blocks new entries.
- A score or LLM answer cannot override deterministic rejection.
- No secret appears in logs, prompts, frontend assets or repository history.
- A submitted transaction is not treated as filled until reconciled.
- Idempotent retry does not create an unintended duplicate trade.
- Risk and portfolio caps cannot be exceeded by Kelly/model output.
- Milestone target triggers the configured pause/notification behavior.
- Emergency and daily loss controls block new entries.
- Financial PnL reconciles to chain-confirmed amounts and attributable fees within defined tolerances.

## Quantitative evaluation
- Use chronological train/validation/test windows and walk-forward evaluation.
- Lock metrics and comparison criteria before evaluating variants.
- Report sample size, confidence intervals, calibration, net expectancy, profit factor, drawdown, tail losses and costs.
- Include unsuccessful candidates and realistic entry/exit assumptions where data allows.
- Run sensitivity analysis for slippage, fees, latency, missing data, liquidity loss and model miscalibration.
- Reject results dominated by a small number of extreme winners or unreasonable fill assumptions.

## Phase gates
### Documentation exit
Owner accepts scope, policies, risk model, provider choices, security model, data model and acceptance criteria.
### Design exit
Approved UX, architecture, trust boundaries, schemas, threat model, operational workflows and test strategy.
### Build exit
CI passes; required automated tests pass; no known critical/high unresolved security issues; reproducible build and migrations verified.
### Paper-trading exit
Pre-agreed observation window/sample requirements and thresholds are met for data reliability, execution estimates, calibrated predictions, net expectancy and drawdown; no unresolved critical incidents.
### Mainnet readiness
Explicit owner approval, limited capital, isolated signer, independent kill switch, alerting, backup/restore drill, tested recovery, audit review and a rollback/disable plan.

No numerical performance gate should be invented after viewing results. Set evaluation criteria before the relevant test period.