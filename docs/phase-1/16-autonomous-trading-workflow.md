# Autonomous Trading Workflow — Discovery to Next Candidate

**Status:** Proposed Phase 1 requirement; owner approval pending.  
**Applies to:** Solana spot DEX V1.  
**Execution status:** Documentation only. This document does not authorize production trading.

## 1. Purpose

Define the closed-loop workflow for an agent that autonomously discovers potential Solana tokens, assesses and selects one eligible candidate, obtains risk approval, opens one position, manages it under a predefined exit policy, reconciles the outcome, records learning evidence, and then returns to candidate discovery.

After all future release gates have passed and the owner explicitly enables an approved live mode, the agent may make routine candidate and trade decisions without asking for confirmation on every individual trade. That autonomy is strictly bounded by preapproved policies. It does not authorize the agent to enable mainnet, change hard risk limits, add new signing permissions, withdraw funds, or modify its own production code.

## 2. End-to-end loop

```text
START / CONTINUE LOOP
        |
        v
1. Check operating mode, kill-switch, wallet/portfolio state and system health
        |
        +-- unhealthy / halted --> STOP NEW ENTRIES; alert; follow recovery policy
        |
        v
2. Refresh market sources and discover candidate Solana tokens/pools
        |
        v
3. Normalize identifiers, deduplicate and verify data freshness
        |
        v
4. Apply hard token, program, pool, authority, transfer and security gates
        |
        +-- any hard fail / critical unknown --> REJECT + RECORD REASON
        |
        v
5. Calculate market features: liquidity, exitability, holders, clusters,
   volume quality, price/volatility, momentum and market regime
        |
        v
6. Generate candidate strategies / bounded decision assessments
        |
        v
7. Estimate outcomes, uncertainty, net return distribution and exit feasibility
        |
        +-- insufficient evidence / edge / liquidity --> WAIT, WATCH or NO TRADE
        |
        v
8. Rank eligible candidates; select one candidate and one strategy/profile
        |
        v
9. Deterministic Risk Governor checks portfolio, position, loss, drawdown,
   liquidity, fees, slippage, freshness, strategy and system constraints
        |
        +-- rejected --> RECORD; evaluate next candidate
        |
        v
10. Get fresh buy quote AND realistic sell/exit quote; simulate where supported
        |
        +-- route / price impact / simulation / freshness fails --> REJECT
        |
        v
11. Recheck one-position invariant and all risk rules immediately before signing
        |
        v
12. Submit typed trade intent to execution service; isolated signer validates
    transaction against allowlisted programs, amounts, slippage and policy
        |
        +-- not submitted / failure / unknown status --> reconcile; halt new entries
        |
        v
13. Wait for confirmed and reconciled fill; calculate actual cost basis and fees
        |
        +-- no valid fill --> close/resolve lifecycle; do not invent a position
        |
        v
14. Monitor the open position: price, executable sell quote, liquidity,
    security events, wallet activity, regime, stop/invalidation and target state
        |
        v
15. Execute configured exit policy: full TP, partial TP + runner, trailing /
    invalidation exit, risk stop, security exit or emergency exit attempt
        |
        v
16. Confirm/reconcile each partial or full exit; retain any unsold balance
    as an open position and continue monitoring/recovery
        |
        v
17. When the position is fully closed, reconcile actual net PnL, fees,
    transactions, exit reason, forecast error and risk events
        |
        v
18. Persist audit record; update strategy statistics and research memory
    asynchronously; never rewrite hard rules automatically
        |
        v
19. Check portfolio milestone, drawdown and operator pause/stop policy
        |
        +-- target reached / pause requested / risk halt --> stop new entries; report
        |
        v
20. Apply per-token cooldown/re-entry rules, refresh data, and return to step 1
    to search/select the next eligible token
```

The loop repeats only while the operating mode allows it and all system/risk controls remain healthy. The agent does not have to trade on every cycle.

## 3. Mode-dependent autonomy

### Research / Backtest
- Use recorded historical data and fixed evaluation protocols.
- Do not sign or submit transactions.
- Label every fill and result as simulated and preserve cost/fill assumptions.

### Paper / Shadow
- Discover and rank tokens using live or recorded data; obtain quotes where possible.
- Generate trade intents and simulate outcomes, but never sign or broadcast an asset-moving transaction.
- Record both accepted and rejected candidates.
- Clearly separate quoted, simulated and actual values.

### Restricted Live Mode (future, explicitly gated)
- Routine candidate selection and trade execution may run automatically only after owner-approved release gates, policy configuration and signer enablement.
- One open position globally; no overlapping token positions or untracked duplicate entry orders.
- Enforce preapproved caps on position size, fees, slippage/price impact, daily drawdown, losses, transaction failures, per-token re-entry and total trading budget.
- Any hard rule failure, stale/contradictory critical data or unsafe system state blocks new entries.
- The owner retains control over enabling/disabling live mode, changing hard limits, changing signer permissions, withdrawing funds and approving a new production strategy/model version.

## 4. Candidate discovery and selection details

1. Discover from configured sources and/or verified on-chain pool events.
2. Canonicalize mint and pool identifiers; deduplicate overlapping provider listings.
3. Confirm supported token program and pool/DEX integration.
4. Reject or quarantine stale, incomplete, contradictory or unsupported high-risk evidence under the documented policy.
5. Evaluate token authorities/extensions, transfer restrictions, pool state, liquidity and potential exit route.
6. Calculate holder concentration at multiple ranks and report known/unknown address-label coverage.
7. Evaluate connected-wallet/deployer evidence with explicit uncertainty; do not represent probabilistic clustering as proven common ownership.
8. Measure liquidity trajectory, withdrawal velocity, volume quality, unique-wallet evidence where available, buy/sell imbalance, volatility and momentum.
9. Classify market regime and list eligible strategy/profile combinations.
10. Estimate outcome distribution (TP first, stop/invalidation first, neither within horizon, emergency/tail outcome), net costs, exitability and model uncertainty.
11. Apply minimum-evidence and minimum-edge criteria defined before evaluation.
12. Rank only candidates that pass every hard gate. Scores never compensate for a hard failure.
13. Choose the highest-ranked eligible candidate under the approved deterministic tie-break rule, or return NO_TRADE when none qualifies.
14. Record the top alternatives and rejection reasons to audit selection bias.

## 5. Trade-intent contract

Every proposed trade must include at least:
- unique intent ID and idempotency key;
- chain, mint, pool, DEX/program and side;
- strategy/version and exit-profile/version;
- observation and quote timestamps with freshness requirements;
- proposed size in exact units and native/USD valuation inputs;
- maximum slippage/price impact and fee budget;
- estimated buy output and estimated sell/exit proceeds;
- expected net outcome distribution, uncertainty and source feature-snapshot ID;
- all hard-gate outcomes and Risk Governor decision;
- expiry/deadline and policy version.

The execution service and signer revalidate the intent. Model-generated free text is never an execution payload.

## 6. Buy and position creation rules

- Check the global one-position invariant under a concurrency-safe lock/state transition.
- Require current, compatible buy and sell route/quote information according to approved policy.
- Simulate where supported; reject if the payload or outputs violate limits.
- Perform final fresh security/risk checks immediately before signing.
- Submit through the isolated signer; never pass seed/private key material to the decision agent.
- Track submitted, pending, confirmed, failed and unknown states distinctly.
- Query/reconcile chain state before any retry after an unknown submission; do not blindly resubmit.
- Create the position from confirmed actual token amounts and actual costs, not from an estimate.

## 7. Position monitoring and profit-taking

The configured exit profile is selected before entry and versioned with the position.

### Quick Compound
Use +6% net as an initial research benchmark. Test full exit versus alternate targets; it is not a universal command to sell every token at +6%.

### Trend Capture
May realize a partial profit at a prevalidated target and hold the remaining bounded quantity only while predefined trend, volume, liquidity and exitability conditions remain valid.

### High-Upside Runner
May retain a bounded remainder for staged targets/trailing exit after earlier partial sales. Price multiples such as 2x, 5x or 10x are test scenarios, not forecasts. Position sizing and maximum residual exposure must be preapproved.

### Exit priority
1. Security / token-transfer emergency or severe liquidity/exitability event.
2. Portfolio/system hard halt and risk policy action.
3. Stop/invalidation/trailing condition.
4. Configured target/partial-profit condition.
5. Normal monitoring.

Exact ordering among emergency and portfolio recovery actions must be validated in design; the system must never promise a sell will execute at a requested price. If an exit fails or only partially fills, keep the residual as an open position, alert, reconcile and follow the recovery procedure. Do not start another position while any exposure remains open or unresolved.

## 8. Fully closed position and next-token transition

A position is not considered closed merely because the agent submitted a sell request. It is closed only after:
- transaction state is confirmed/reconciled;
- actual token balance is reconciled, including dust/rounding policy;
- partial fills and residual balances are accounted for;
- actual proceeds and fees are posted to the ledger;
- the position state is transitioned atomically to Closed.

Then:
1. Calculate net PnL and compare it with predicted outcomes.
2. Persist the Trade Passport and all decision/transaction evidence.
3. Update statistics for the exact strategy/model version and market regime.
4. Flag anomalies and apply cooldown/quarantine rules if required.
5. Check target milestones, daily/peak-to-trough drawdown, error circuit breakers and operator pause requests.
6. If target-pause is enabled and a goal is hit, stop new entries and notify the owner.
7. Otherwise return to discovery and search for the next eligible token.

## 9. Exceptions and fail-safe behavior

| Condition | Required behavior |
|---|---|
| No candidate passes | NO_TRADE; wait until the next event/poll interval; log coverage and rejection reasons |
| Critical data stale or providers disagree | Block entries; refresh/fallback through validated sources; alert if unresolved |
| Token/security gate fails | Reject candidate; no model override |
| One position already open | Block all new entries; continue monitoring existing position |
| Risk service unavailable | Block new entries |
| Quote or sell route unavailable | Reject entry or apply documented open-position recovery; never assume exitability |
| Transaction submission status unknown | Reconcile before retry; pause new entries to avoid duplicate exposure |
| Partial exit or residual token balance | Keep position open and monitor/recover; do not advance to a new token |
| LLM timeout, malformed answer or low confidence | Abstain; use deterministic fallback only if explicitly specified, otherwise NO_TRADE |
| Strategy/model degradation | Quarantine or pause according to preapproved statistical rules; do not self-edit production rules |
| Portfolio goal reached | Reconcile equity, stop entries when configured and notify |
| Daily loss/drawdown or failure circuit breaker reached | Stop new entries and invoke documented recovery policy |
| Kill switch activated | Stop new entries immediately; handle existing positions according to the separately approved position-recovery/exit policy |

## 10. Required counters and audit records

Track:
- discovered, deduplicated, screened, rejected and eligible candidates;
- rejection counts by gate/reason and data provider;
- strategy and profile choice counts;
- trade proposals, risk approvals/rejections and quote/simulation failures;
- submitted, confirmed, failed and unknown transactions;
- open positions, partial exits, full exits and residual-balance events;
- net PnL, costs, slippage, hold time, exit reason, drawdown and milestone transitions;
- predicted-versus-realized outcome, model calibration and strategy/regime results;
- pause/kill-switch events, provider outages and signer validation failures.

Each event must include a correlation ID, event time, relevant snapshot IDs, policy/strategy/model versions, result and reason codes. All financial results must be labeled estimated, quoted, simulated or actual.

## 11. Acceptance criteria for this workflow

- An end-to-end deterministic replay can trace every candidate from discovery to rejection/closure.
- No candidate can reach execution without every required hard gate passing.
- A high score/upside assessment cannot override a security or Risk Governor rejection.
- Global one-position invariant survives concurrent discovery events, retries and process restart.
- No next-token entry occurs until the existing position is fully reconciled and closed.
- Unknown transaction state blocks blind retries and overlapping entries.
- TP, stop, trailing, partial-fill and emergency paths are simulated and auditable.
- Target reached, operator pause and kill-switch states prevent prohibited new entries.
- LLM failure/abstention cannot cause an automatic buy.
- Paper mode can exercise the entire loop without signing/broadcasting transactions.
- Live automation remains disabled unless all later release gates pass and owner enablement is explicitly recorded.


## Commercial tenant isolation addendum — CR-001
For the owner-requested paid customer model, the autonomous discovery-to-next-candidate cycle runs within a tenant-isolated portfolio. The proposed cap is one open/unresolved position per customer workspace, not one position shared by all customers on the platform. Every scan, selected candidate, quote, wallet/signer policy, position monitor, ledger and post-trade learning record must carry tenant context and pass server-side authorization. No customer can read another customer's data or funds; no tenant queue or failed trade can alter another tenant's state. This changes the single-operator baseline and must be explicitly confirmed before design.