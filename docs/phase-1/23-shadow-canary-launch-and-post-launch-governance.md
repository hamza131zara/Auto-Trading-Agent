# Shadow, Canary, Launch and Post-Launch Governance

This supplements the existing test plan. The original roadmap's phases 13–17 remain the canonical order: Backtesting/Paper/Replay → Independent Testing/Security Review → Shadow/Paper Launch → Live Canary/Staged Expansion → Post-launch Governance.

## 1. Canonical operating modes
- **Observe:** data collection and dashboard visibility; no trade execution.
- **Backtest:** historical event replay; all fills are simulated.
- **Paper:** run trade decisions with timestamped simulated quotes/fills; no asset-moving transaction.
- **Shadow:** run the live data and decision pipeline while transaction submission is disabled; compare quoted/forecast outcomes with later data.
- **Live Canary:** explicitly authorized, lowest approved capital and one approved strategy/profile at a time.
- **Live:** only after controlled canary evidence and explicit approval; risk limits remain in force.
- **Halted:** new trade intents stop; existing position handling follows a separate approved recovery/exit policy.

The current functional requirements use some synonyms (Research, Simulation, Paper/Shadow, Restricted Pilot). The canonical names above must be used in the design state machine and documented as a crosswalk, not treated as additional capabilities. Any enablement of Live/Live Canary requires step-up authentication/MFA and a versioned preapproved risk policy.

## 2. Backtesting, paper and replay requirements
Before shadow launch:
- Store reproducible run manifest: dataset version, decision-time cutoff, feature/strategy/model versions, parameters, fees, price impact, priority fees, quote age, latency, failure assumptions and random seed where applicable.
- Simulate fee and price impact, execution delays, stale quotes, failed swaps, partial fills, liquidity withdrawals, unavailable exits and emergency-tail scenarios.
- Compare fixed +6% net full exit, partial-profit/trailing Trend Capture and High-Upside Runner on identical out-of-sample windows.
- Compare no-Kelly, conservative fractional-Kelly variants and simple fixed-risk sizing.
- Include bootstrap/Monte Carlo target-reaching and drawdown uncertainty with the modeled ruin/large-loss rate.
- Lock metrics and the selection protocol before evaluating the final holdout; disclose any holdout reused for tuning.
- Do not promote based on in-sample PnL alone.

## 3. Independent security/quality review gate
Before any live-capable signer is used:
- Every hard rule has positive and negative automated tests.
- One-position, idempotency, no-blind-retry, no-secret-exposure and risk-cap invariants pass.
- Authentication/MFA, authorization, session expiry/revocation, API abuse, CSRF/XSS/SQL injection where applicable, prompt injection, malicious metadata, dependency/supply-chain and signer-bypass tests are recorded.
- RPC/provider outage, quota exhaustion, DB failure/restore, queue backlog, clock skew, process restart/replay and unknown transaction states are exercised.
- Independent review of signer, Risk Governor, threat model and deployment is complete.
- No unresolved critical/high security finding remains; remediation evidence is attached.
- Stop-trading, emergency-position handling and recovery drills pass.
- A release evidence pack identifies code, config, strategy/model versions and approvers.

## 4. Shadow mode gate
Run the live discovery and decision trace but disable transaction broadcast/signing.
Measure and report:
- data freshness and missing/unknown critical-field rates;
- provider disagreement and stream/RPC lag;
- p50/p95 latency from observation to decision/quote;
- candidate discovery/rejection distribution and false security clears/rejections where labels can be established;
- exitability failures, quote availability, estimated vs later realized quote movement;
- predicted probability calibration, expected-net-return error and market-regime coverage;
- simulated cost/slippage errors, alerts, crashes and state-recovery behavior.

The owner and evaluator must define a minimum observation window, sample size, multiple-regime coverage and numeric thresholds before starting the run. No universal trade count alone proves safety or profitability.

Deliverables: shadow report, data-quality report, decision/rejection audit, strategy/model calibration report, security false-negative review, incident summary and a version-locked proposed live configuration.

## 5. Paper trading gate
- Exercise the full candidate-to-reconciliation lifecycle without signing or broadcasting an asset-moving transaction.
- Stamp every fill as hypothetical and record fill model/uncertainty.
- Keep paper, shadow and live datasets/results clearly separated.
- Include hard cases: no trade, failed entry, position exit partial fill, no sell route, price gap, liquidity collapse, target reached, kill switch, unknown transaction and restart.
- Require predeclared economic and reliability criteria; assess confidence intervals, tail losses, drawdown, provider/quote quality and calibration across regimes.
- If criteria do not pass, remain in research/paper mode and revise only through versioned experiments.

## 6. Live canary and staged expansion
Only after all preceding gates pass and the owner explicitly approves:
- Use a dedicated low-balance trading wallet with only approved capital and a defined SOL fee reserve.
- Enable one strategy/profile at a time; keep unvalidated runner functionality disabled until separately approved.
- Apply the smallest approved position/daily-loss limits and monitor each trade with owner alerts/review.
- Reconcile balances and the ledger after every position close.
- Pause new entries on hard loss/drawdown breach, stale data, provider disagreement, stream lag, signing failure, unexpected transaction fields, monitoring failure or ledger mismatch.
- Rollback/recovery: stop entries, verify pending/unknown transactions, attempt safe exits if feasible, preserve evidence, reconcile chain state, investigate, restore prior approved configuration and require manual unlock.
- Increase risk limits only after a separately reviewed report covers realized results, tail risks, slippage, liquidity capacity, security misses and operational reliability.

The launch must be reversible and the kill switch must reliably stop new intents. An attempt to exit an existing position is not guaranteed to fill or achieve a target price.

## 7. Post-launch governance
- Monitor model calibration, regime shift, PnL, drawdown, execution cost, security false negatives, provider health, latency and failure rates.
- Run scheduled post-mortems for wins, ordinary losses, large losses, skipped candidates and emergency exits.
- Quarantine strategies only under predeclared/statistically defensible deterioration rules; validate a challenger before promotion.
- Version data, features, models, prompts, rules, thresholds, code and configs; keep rollback to the last approved version.
- Periodically review dependencies, permissions, keys, backups, provider bills, incidents, applicable legal/tax questions and restore/incident drills.
- Publish periodic internal performance and model cards; no unqualified profit claims.

## Required evidence for every stage transition
A stage checklist with requirement IDs, test/report links, known limitations, exact software/config/strategy/model versions, open risks, rollback plan, approver and date. A phase is not complete merely because code exists or a dashboard renders.

## 8. Commercial software launch gate (CR-001 / D-025)
A paid software sale is separate from permission to start mainnet trading. Before publicly selling the self-hosted product:
- The self-hosted/customer-isolated deployment and per-running-instance position rule are recorded as approved under D-025.
- Lifetime license terms, included services/quotas, support/update scope, refund and dispute terms, privacy notice, and no-trial/one-time payment wording are reviewed.
- The chosen bank/processor has confirmed the actual seller country, business model and self-hosted crypto-trading software; no checkout is enabled before written product/category approval.
- The legal/tax/service-boundary review is complete for the actual operator, customer countries and signing/custody model.
- Payment verification, invite registration, MFA, admin approval, entitlement, suspension/refund/chargeback and audit workflows pass tests.
- Central portal customer/license record isolation, signed-license integrity, release artifact signature checks, customer installation security and diagnostic redaction tests pass with no known critical/high finding.
- A lifetime service-cost model supports the one-time price under base and stress scenarios.
- No free trial, free-tier operational account or unpaid access override exists.

A paid commercial license does not bypass the trading-engine's separate backtest, security, shadow/paper, live-canary and release approval gates.


The central licensing portal must not become a hosted trading backend. Its role is commercial entitlement, registration approval and signed software release access. Every customer runtime maintains its own safety controls and local ledger.