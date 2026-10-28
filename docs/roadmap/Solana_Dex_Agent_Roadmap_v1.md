# Solana Autonomous DEX Trading Agent — Roadmap v1.0

**Baseline date:** 20 October 2026  
**Repository:** hamza131zara/Auto-Trading-Agent  
**Status:** Frozen by owner; amendments require explicit approval.  
**Scope:** Documentation, design, secure engineering, test evidence, paper trading, then controlled launch. This roadmap does not promise profitability or a particular win rate.

## Product objective
Create an auditable, risk-governed Solana spot-DEX agent with automatic token discovery, token/pool security screening, market and regime analysis, strategy choice, execution-aware expected-return estimates, constrained position sizing, isolated transaction signing, configurable exit profiles, a persistent trade ledger, and controlled statistical learning.

## Non-negotiable invariants
1. Solana spot DEX only for V1; no leverage, borrowing or cross-chain execution.
2. One open position globally across the trading portfolio.
3. NO_TRADE and RESEARCH_MORE are valid outcomes.
4. Deterministic security and risk gates have final veto authority over all AI/LLM output.
5. The LLM never receives signing secrets, cannot withdraw funds, cannot sign arbitrary transactions, and cannot modify hard risk limits or production policy.
6. Signer is isolated and revalidates every typed trade intent against policy.
7. Record candidates, rejected decisions, features, model/strategy versions, quotes, simulation outcomes, transactions, fills, fees, exits and reconciled PnL.
8. Fixed-target, trend-capture and high-upside runner profiles are competing research hypotheses, not assumptions of profit.
9. Kelly sizing remains research-only until out-of-sample evaluation, uncertainty controls, tail-loss assumptions and independent hard caps are validated.
10. No win-rate, profit or target-attainment guarantee.
11. Historical backtesting, chronological out-of-sample evaluation, paper trading, resilience drills and explicit owner release approval precede mainnet operation.
12. Any roadmap scope or phase change requires explicit owner approval and a dated decision-log entry.

## Phase 0 — Governance and scope freeze
**Deliverables:** frozen roadmap, product boundaries, decision log, risk principles and repository working agreement.  
**Exit gate:** owner confirms frozen baseline and change-control process.

## Phase 1 — Documentation and requirements approval
**Deliverables:** product charter; functional requirements; user journeys; dashboard/page inventory; candidate lifecycle; exit policies; security/rug-risk rules; quantitative formulas; provider/API source register; threat model; trust boundaries; signer controls; data dictionary; audit events; strategy/model learning policy; test plan; requirements traceability; incident runbooks; measurable research and release gates.  
**Activities:** examine official source documentation; validate SDK/API versions, terms, rate limits, fees, data freshness and failure behavior; classify decisions as accepted, proposed or unresolved.  
**Exit gate:** explicit owner approval of requirements, security model, data-provider candidates, quantitative methodology and acceptance criteria. No design/build before approval.

## Phase 2 — UX and system design
**Deliverables:** approved wireframes and design system; page navigation; dashboard interaction states; architecture diagrams; context/container/trust-boundary diagrams; state machines; sequence diagrams; database ERD/schema draft; API contracts; signer intent contract; deployment design; threat-model review; test strategy.  
**Exit gate:** design and security boundaries reviewed and approved.

## Phase 3 — Repository foundations and secure engineering baseline
**Deliverables:** repository structure, dependency/version policy, environment templates without secrets, CI quality gates, test harness, migration strategy, secret scanning, dependency scanning, container/build provenance, structured logging and contribution rules.  
**Exit gate:** reproducible build/test pipeline and secure defaults; no trading capability.

## Phase 4 — Data ingestion and normalization
**Deliverables:** provider adapters, schemas, timestamps/provenance, freshness checks, retries/backoff, quota handling, deduplication, provider health, fallback and disagreement policies.  
**Exit gate:** contract and failure-mode tests; stale/conflicting critical data blocks new entries.

## Phase 5 — Token and pool security intelligence
**Deliverables:** token program and Token-2022 extension inspection, authority checks, pool verification, holder concentration, labelled/unknown holder handling, deployer and wallet-cluster evidence, liquidity behavior, transfer restrictions and exitability checks.  
**Exit gate:** hard gates are deterministic and cannot be bypassed by score/model output; security tests pass.

## Phase 6 — Market features and regime detection
**Deliverables:** versioned feature pipeline for price/volume changes, momentum, volatility, liquidity trend, order-flow proxies, holder changes, wallet behavior and relative strength; regime classifier; data-leakage controls.  
**Exit gate:** features reproduce from historical snapshots and use only information available at the decision time.

## Phase 7 — Decision brain and strategy registry
**Deliverables:** typed decision contracts inspired by bounded Choice/Score/yes-no assessments; strategy registry; confidence/abstention behavior; eligibility and rejection reason codes; strategy/version audit.  
**Exit gate:** no model action bypasses the Risk Governor; NO_TRADE/RESEARCH_MORE work end-to-end.

## Phase 8 — Backtesting and quantitative research
**Deliverables:** chronological replay, cost model, realistic execution assumptions, exit-policy comparison, probability calibration, strategy metrics, walk-forward experiments, holdout protection, uncertainty intervals and overfitting controls.  
**Exit gate:** reproducible evidence report; no strategy is promoted based solely on in-sample returns.

## Phase 9 — Portfolio, Kelly research and Risk Governor
**Deliverables:** exact PnL/fee accounting, equity ledger, exposure limits, position budget, drawdown controls, circuit breakers, target milestones, conservative Kelly research and independent caps.  
**Exit gate:** invariant/property tests demonstrate no sizing or model output exceeds hard limits. Kelly remains disabled for live allocation until approved.

## Phase 10 — Quotes, simulation and execution adapter
**Deliverables:** execution-route abstraction; buy and sell quote estimates; transaction simulation where supported; slippage/price-impact limits; transaction parsing/allowlists; idempotent order lifecycle; signer policy contract; reconciliation.  
**Exit gate:** tests for malformed/opaque transactions, stale quotes, failed/unknown status, duplicate requests, fee mismatches and signer-policy bypass all pass.

## Phase 11 — Position monitoring and exit policies
**Deliverables:** Quick Compound (+6% net as an initial benchmark); Trend Capture; High-Upside Runner; partial-exit accounting; trailing/invalidation policy; timeout policy where justified; emergency-exit attempt and recovery handling.  
**Exit gate:** partial fills, route loss, security escalation, stop gaps and process restart are tested in simulation. Exit success/price cannot be guaranteed.

## Phase 12 — Ledger, audit and strategy memory
**Deliverables:** canonical ledger; append-only/tamper-evident events; candidate and trade passports; prediction-versus-actual post-mortems; model/strategy version lineage; controlled champion/challenger lifecycle.  
**Exit gate:** full decision-to-chain reconciliation and backup/restore evidence.

## Phase 13 — Dashboard and operator controls
**Deliverables:** overview; candidates; candidate detail; security center; strategy/decision trace; active position; trade history; analytics; backtest lab; strategy registry; portfolio goals; wallet/execution health; provider health; alerts/incidents; audit history; risk settings; documentation/runbooks.  
**Exit gate:** authenticated, authorized, accessible UI with backend-enforced controls and complete audit trail.

## Phase 14 — Observability and incident response
**Deliverables:** metrics, logs, traces, alerts, service health and data freshness; kill switch; token/liquidity emergency runbooks; signer/API credential compromise response; transaction unknown-state recovery; database restore.  
**Exit gate:** incident drills complete with recorded evidence and owner review.

## Phase 15 — Integration and security testing
**Deliverables:** unit, contract, integration, property, replay, authorization, signer-bypass, dependency, secret, container, resilience and recovery tests; independent review of critical controls.  
**Exit gate:** agreed severity threshold met, no unresolved critical/high findings, all required invariants pass.

## Phase 16 — Paper trading and shadow evaluation
**Deliverables:** continuous live-data observation without asset-moving transactions; simulated decisions/quotes; candidate rejection tracking; forecast calibration; execution-cost and latency comparison; drift monitoring; performance and failure report.  
**Exit gate:** pre-registered sample/window and performance gates satisfied; owner approves any next step. No production trading key is used in paper mode.

## Phase 17 — Controlled mainnet readiness and staged launch
**Deliverables:** explicit signed-off release checklist, minimal allocation, isolated signer, allowed program/policy restrictions, alerting, independent kill switch, recovery/rollback plan, owner monitoring and post-launch review.  
**Exit gate:** explicit owner authorization, tested security controls, accepted operational risk and documented rollback. Ramp exposure only from reviewed evidence.

## Dashboard inventory
1. Overview.
2. Candidate Discovery.
3. Candidate Detail.
4. Security and Rug-Risk Center.
5. Strategy Lab / Decision Trace.
6. Active Position.
7. Trade History and Ledger.
8. Analytics and Strategy Performance.
9. Backtest and Experiment Lab.
10. Strategy Registry and Learning.
11. Portfolio Goals and Calculators.
12. Wallet and Execution Health.
13. Data Provider Health.
14. Alerts and Incident Center.
15. Audit and Decision History.
16. Risk Policies and Settings.
17. Documentation and Operations.

## Core metrics and calculators
Net realized PnL; portfolio return with deposits/withdrawals separated; expectancy; win rate with stated denominator; profit factor; maximum drawdown; average win/loss; probability calibration; exitability and sell impact; top-N holder concentration; HHI; rolling volatility; momentum/relative strength; volume/liquidity changes; quote-to-fill error; fees/slippage; transaction success/reconciliation; target-attainment simulation and uncertainty bands.

## Core system components
Discovery adapters; normalizer; token/pool security engine; feature and regime engine; outcome model; bounded decision interface; strategy registry; deterministic Risk Governor; fractional-Kelly research module; quote/simulation/execution adapter; signer boundary; position monitor; ledger and audit store; memory/research optimizer; dashboard; observability/incident control.

## Candidate technologies and integrations
- TypeScript/Node.js for initial application/core; official Solana Kit and generated program clients evaluated for Solana integration.
- Python for quantitative research and ML experiments.
- PostgreSQL for canonical ledger/state.
- Evaluate Solana RPC plus Helius; DEX Screener and Birdeye for indexed discovery/analytics; current Jupiter Swap V2 for execution routing; Raydium direct integration only if justified.
- Docker and CI/security scanning; OpenTelemetry-compatible observability; KMS/HSM/MPC or narrow isolated signer selected only after threat-model review.
- No premature microservices, Kubernetes, Kafka or complex ML without measured need.

## Review rules
The detailed specifications under docs/phase-1/ refine this roadmap. If a specification appears to conflict with a frozen invariant, stop and record the conflict for owner decision rather than silently changing the roadmap.