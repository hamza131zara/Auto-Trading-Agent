# Dashboard Pages, Controls and Indicators

This is a proposed information architecture for a private single-operator V1 dashboard. Visual design and final navigation are approved in Phase 2, after the requirements are accepted.

## 1. Overview
Purpose: show operating mode, equity, realized/unrealized PnL, drawdown, current position, system health, open alerts and milestone progress.
Components: mode badge, balance chart, net PnL cards, trade counters, active-position summary, candidate funnel, provider health and recent risk events.
Controls: Pause New Entries, Resume (with confirmation and health checks), Switch Mode where permitted, View Active Position, View Incident, Export Summary.
Rule: the UI reflects backend-confirmed status only.

## 2. Candidate Discovery
Purpose: inspect discovered tokens and screening outcomes.
Filters: time window, pool age, DEX, quote asset, liquidity, volume, transaction count, unique-wallet evidence where available, price change, volatility, holder concentration, security state, exitability, strategy profile and data freshness.
Columns: token/mint, pool, source/time, price, liquidity, volume windows, buyer/seller metrics, top-holder concentration, key security findings, sell-route availability, score components and state.
Controls: Refresh, Open Details, Watch, Ignore, Export; no direct Buy button bypasses gates.

## 3. Candidate Detail
Sections: overview chart; pool/reserves; time-stamped snapshots; buy and sell quote estimate; price impact; volume quality; holder distribution; wallet-cluster evidence; token program/extension findings; strategy compatibility; confidence/uncertainty; hard-gate result and rejection reasons.
Controls: Re-run Assessment, Add to Watchlist, Compare Strategy, View Source Evidence. Reassessment must use fresh data and record a new versioned result.

## 4. Security and Rug-Risk Center
Show every check as Pass, Fail, Unknown, Stale or Not Tested, with source, timestamp and evidence.
Metrics: mint/freeze authority, Token-2022 extensions, transfer restrictions/fees, top 1/3/5/10 holders, labeled infrastructure fraction, unknown holder fraction, deployer/creator evidence, cluster concentration, liquidity delta/withdrawal velocity, route and simulated sell output.
Controls: Refresh Evidence, Export Assessment, Open Incident. Any allowlist override is excluded from normal V1 flow and would require a separately approved policy, strong authorization, reason and audit record.

## 5. Strategy Lab / Decision Trace
Show strategy version, compatible regimes, entry/exit/invalidation rules, selected exit profile, features, forecast distribution, estimated net PnL, confidence/calibration status, risk-gate results and reason codes.
Controls: Compare Versions, Replay Candidate, Create Research Proposal. No control may deploy a changed strategy directly to live operation.

## 6. Active Position
Show actual acquired quantity, reconciled cost basis, current quote/estimate, estimated liquidation value, realized partial exits, net PnL, fee/slippage totals, security state, time in position, configured exit profile, trailing/invalidation state and route health.
Controls: Pause New Entries, Request Exit, Cancel/Replace where safely supported, Open Transaction Details. Emergency Exit is a policy-mediated request, must confirm estimated impacts, and must clearly state that a successful fill/desired price is not guaranteed.

## 7. Trade History and Ledger
Filter by date, token, strategy/version, outcome, exit reason, operating mode, data source and execution status.
Display quoted vs actual amounts, each fee, token amount, transaction signature, confirmation state, partial fills, reason for exit and net PnL.
Controls: View Trade Passport, Export CSV/JSON, Compare Forecast to Actual. Corrections must be new audit events rather than destructive edits.

## 8. Analytics and Strategy Performance
Charts/tables: cumulative equity and drawdown, daily/weekly net PnL, win/loss distribution, expectancy, profit factor, average win/loss, fee and slippage distribution, failed transactions, exit reasons, holding-time distribution, strategy and regime performance, calibrated probability buckets, target simulations and confidence intervals.
Filters: strategy/model version, exit profile, market regime, date range, paper vs live, token age and liquidity bucket.
Warning: do not mix paper and live outcomes without labeling the source.

## 9. Backtest and Experiment Lab
Configure dataset/version, strategy version, chronology, entry/exit assumptions, fees, slippage, latency, failed exits, sizing policy and metrics before running.
Controls: Create Experiment, Run Replay, Compare Runs, Lock Test Set, Export Report, Archive Experiment.
Never allow selection of a policy after viewing a holdout without recording that the holdout has been used.

## 10. Strategy Registry and Learning
List strategies and versions with status: Research, Challenger, Paper, Champion, Quarantined or Disabled.
Show sample size, performance uncertainty, regime fit, last evaluation, data version, approval chain, known failure modes and rollback target.
Controls: Propose Version, Submit for Evaluation, Promote after authorized approval, Quarantine, Roll Back. LLM output may propose but cannot promote itself.

## 11. Portfolio Goals and Calculators
Inputs: starting equity, milestone target, reserve, intended allocation cap, selected strategy/profile and simulation assumptions.
Outputs: net PnL, compounding trajectories, target-attainment distribution, drawdown distribution and sensitivity to fees/slippage/win-loss assumptions.
Controls: Save Scenario, Compare Scenarios, Export Simulation, Set Target Pause Policy. Distinguish hypothetical results from live balances. No guaranteed completion date.

## 12. Wallet and Execution Health
Show public wallet address, chain/network, SOL fee reserve, token balances, last reconciliation, signer health, allowed programs/policies, pending/unknown transactions, RPC provider status and execution error rate.
Never display secrets. No seed export or private-key reveal workflow.
Controls: Verify Read Access, Reconcile, Test Signer in non-production only, Disable New Entries. Live signer configuration is restricted and audited.

## 13. Data Provider Health
Show provider, service/endpoint family, status, latency, quota/rate-limit state, freshness, recent errors, disagreement status and fallback source.
Controls: Recheck, Disable Provider, View Error, Change Configuration if authorized. Provider changes are versioned and tested.

## 14. Alerts and Incident Center
Group by severity: informational, warning, high and critical. Show event timeline, impacted services/positions, action already taken, recommended runbook and acknowledgement state.
Controls: Acknowledge, Open Runbook, Export Incident, Pause New Entries, Request Recovery Action. Do not expose emergency controls to unauthenticated users.

## 15. Audit and Decision History
Search by correlation ID, candidate/token, trade, operator, policy version, model version and time.
Show evidence references, exact decision inputs, policy result, signer intent and transaction reconciliation.
Controls: Filter, Export, Verify Integrity. Audit history cannot be edited from the dashboard.

## 16. Risk Policies and Settings
Show approved config version, one-position cap, allowed operating modes, liquidity/price-impact limits, maximum exposure, loss and drawdown rules, stale-data limits, transaction retry constraints, target behavior and approved strategies.
Controls: Propose Change, Compare Config, Submit for Review, Roll Back, Pause New Entries. High-risk changes require re-authentication, policy validation, reason and audit entry.

## 17. Documentation and Operations
Links to approved roadmap, requirements, source register, incident runbooks, release evidence, provider contracts and decision log.
Controls: View Approved Version, Export Documentation, View Release Gate.

## Global indicators and formulas
- Net realized PnL = actual exit proceeds minus reconciled entry cost and attributable actual costs.
- Portfolio return = equity change divided by starting equity, with deposits/withdrawals accounted for separately.
- Drawdown = current equity relative to the historical equity peak.
- Top-N holder concentration = sum of holder shares for the selected rank set, with address classification documented.
- HHI = sum of squared holder-share fractions for the declared holder universe.
- Price impact and exitability use executable quotes/route depth when available, not only chart data.
- Volume acceleration, EMA/RSI/MACD, rolling volatility, VWAP where reliable, buy/sell imbalance and relative strength are candidate features to validate, not standalone buy commands.
- All derived indicators must show timeframe, source, calculation/version and data-freshness status.

## Universal control rules
- Risk/security gates are backend-enforced.
- No model output executes a transaction directly.
- Buttons show pending/success/failure based on server response.
- Dangerous actions require confirmation and are auditable.
- Unknown/stale critical state disables new entry actions.


## Commercial/public pages and admin controls (supplement to canonical 17 dashboard pages)
These workflows sit outside the 17 authenticated operator dashboard pages; they do not remove or rename the canonical pages.

### Public marketing and pricing
- **Pages:** Product overview, pricing/license terms, security/risk disclosure, privacy/terms, quote request and quote-request confirmation.
- **Actions:** Request a Quote, View License Terms, Contact Sales. No Sign Up for free, Start Trial, demo tenant or operational agent access.
- **Pricing content:** proposed USD $12,000 one-time lifetime license; no recurring core subscription. Final included features, updates/support, usage/fair-use limits, exclusions, refund terms and product-lifetime meaning must be visible before quote acceptance.
- **Filters/fields:** minimum quote-request contact/entity/country/use-case information; avoid collecting unnecessary sensitive data.
- **Success state:** request received, not account created and not product access granted.

### Payment/quote status
- **Page:** secure quote/invoice status reached using authenticated context or non-guessable, scoped token with no sensitive data leakage.
- **States:** Quote Draft/Issued/Expired; Payment Pending/Verified/Failed/Disputed/Refunded; Registration Invite Pending/Issued.
- **Actions:** View invoice, download receipt when available, view payment instructions, contact billing. No status page can mark payment verified from client input.
- **Admin controls:** Issue Quote, Revise Quote (new version), Cancel Quote, Record Settlement Evidence, Mark Payment Verified, Flag Mismatch, Issue/Resend/Revoke Invitation, Initiate Refund workflow.
- **Required controls:** amount/currency validation, idempotency, approval log, evidence reference and reason code.

### Registration and access approval
- **Pages:** single-use invite registration, email verification, required MFA enrollment, terms acceptance, registration-pending state, approval/rejection status.
- **Actions:** Complete Registration, Verify Email, Enroll/Verify MFA, Accept Terms, Submit for Review, Contact Admin.
- **No access:** before payment verification, completion and admin approval all protected app routes remain inaccessible.
- **Admin console:** review paid registrations, view quote/settlement/license linkage and eligibility check status, Approve, Reject with reason, Request Additional Information, Suspend or Revoke License. Admin action requires role authorization and audit event.
- **No bypass:** Owner/admin can resolve an exception only through a documented, permitted, audited refund/compliance workflow; no silent unpaid access.

### Workspace provision
- **Admin/automation action:** Create Tenant Workspace after all entitlement conditions pass; attach tenant-specific policy, wallet/signer reference and data namespace.
- **Verification:** cross-tenant access denied, one-time license linked to exact entity, one position cap scope confirmed, audit records separated.
- **No shared wallet:** UI must not suggest that platform/customer funds are pooled; never display private keys.

### Commercial UI acceptance
All public pages may be viewed without purchase, but protected agent functionality is never free. There is no customer trial or free tier.