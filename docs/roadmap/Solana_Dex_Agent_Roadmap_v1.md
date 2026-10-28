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

## Canonical Phase 0–17 sequence (aligned to the frozen source roadmap)

This Markdown file is a condensed companion to the owner-approved 22-page DOCX/PDF roadmap dated 20 October 2026. The canonical source remains the baseline. The following phase order corrects an earlier summary that had grouped/re-numbered some work; this is a documentation alignment, not a scope change.

### Phase 0 — Project governance and scope freeze
Confirm V1 boundaries, owner/release authority, decision log, issue/branch/versioning workflow and risk ownership. Exit: owner and boundaries recorded; live disabled by default.

### Phase 1 — Documentation research and source verification
Verify current official Solana, Jupiter V2, Helius, Birdeye, DEX Screener, Raydium, security and quantitative sources. Record source fields, units, cadence, latency, limits, cost, terms, failures and fallback. Exit: dependencies are source-checked; no code is based on stale/unverified endpoints.

### Phase 2 — Product requirements and quantitative policy
Define use cases, full state machine, all terms/formulas/defaults/owners/tests/versions, exit profiles, target behavior and independent risk limits. Exit: all trade-affecting decisions have unambiguous rules and tests.

### Phase 3 — Threat model, custody model and security architecture
Model prompt injection, compromised sessions/providers, malicious metadata, replay/duplicate orders, key exposure and supply-chain risks. Define MFA, least privilege, signer allowlists, spend/fee/slippage caps and incident/key-rotation procedures. Exit: no model/request/data source can cause unrestricted signing.

### Phase 4 — UX, dashboard information architecture and design system
Create task flows, wireframes, responsive system, accessible components, high-risk action states and explicit Live-mode confirmation. Exit: every page/action has permissions, validation, errors/loading states and accessibility behavior.

### Phase 5 — Repository, environments, CI/CD and engineering foundation
Create TypeScript monorepo foundations, pinned dependencies, protected review, environment separation, CI, secret/SBOM/dependency/container scans, config validation and rollback/runbooks. Exit: clean checkout reproduces tests and development/CI cannot access live credentials.

### Phase 6 — Market-data ingestion and canonical data layer
Implement provider adapters, canonical schemas/provenance/freshness, rate-limit and retry handling, disagreement checks, health metrics and replayable snapshots. Exit: identical fixtures normalize deterministically; critical stale/conflicting data blocks entries.

### Phase 7 — Token safety, rug-risk and exitability engine
Inspect mint/program/Token-2022 behavior, authorities, transfer rules, pool and liquidity state, holder concentration/HHI, wallet/deployer evidence, volume quality and sell-side exitability. Keep hard gate, rug-risk score, confidence/completeness and exitability separate. Exit: all hard rules have pass/fail tests; unknown critical evidence rejects/researches.

### Phase 8 — Quant features, regime model and strategy research
Build versioned returns, EMA/RSI/ATR, volatility, volume acceleration/z-score, relative strength, trade imbalance and liquidity features. Validate regimes and baseline strategies; estimate TP-before-stop/outcome distributions; calibrate and use walk-forward/out-of-sample tests. Exit: no promotion on in-sample PnL alone.

### Phase 9 — Decision brain, policy router and strategy memory
Parse state, check eligibility, estimate outcomes, choose from approved profiles, score separate dimensions, run focused risk propositions and pass the proposal to the Risk Governor. Persist evidence, compact rationale, versions and strategy memory. Exit: replayable decisions; malformed/uncertain model output abstains; optimizer cannot edit live hard rules.

### Phase 10 — Risk governor, portfolio ledger and Kelly-aware sizing
Reconcile balances and actual fills; calculate exact PnL/fees; enforce position, loss, drawdown, exposure, slippage, consecutive-error and health limits. Research Kelly only after validated distributions, using conservative fractional sizing and independent caps. Exit: invariant/property tests prove model output cannot exceed hard caps.

### Phase 11 — Execution service, quote validation and isolated signer
Begin quote-only; evaluate current Jupiter Swap V2 order/execute vs build/submit routes. Validate min-out, mint/program/instructions, spend, fees, slippage, impact, freshness and expiry. Use idempotent states and reconcile unknown status before retry. Exit: no duplicate spend; unknown instructions rejected; fills/fees reconcile to chain.

### Phase 12 — Web dashboard and operator control surface
Implement the canonical 17-page map, backend-enforced permissions, ledger-based values, stale/estimated labels, decision replay, Trade Passport and MFA for sensitive changes. Exit: cosmetic UI state cannot change policy; actions are authorized and audited server-side.

### Phase 13 — Backtesting, paper trading and replay lab
Replay decision-time snapshots; model fees, impact, priority fees, delays, failed swaps, stale quotes, liquidity withdrawals and no-exit states. Compare fixed +6%, partial/trailing and runner exits; compare non-Kelly/fractional-Kelly/fixed sizing. Exit: reproducible, out-of-sample evidence with disclosed assumptions/limitations.

### Phase 14 — Testing, quality engineering and independent security review
Run unit/property/integration/E2E/security/adversarial/load/chaos and recovery tests; independently review signer, Risk Governor and deployment. Exit: no unresolved critical/high findings; hard rules and incident drills pass.

### Phase 15 — Shadow mode and controlled paper launch
Run live analysis with transaction submission disabled; record timestamped paper quotes/fills and measure data freshness, latency, disagreement, calibration, missed opportunities and exitability. Pre-register sample/window/multi-regime gates. Exit: thresholds pass and a version-locked canary proposal is approved.

### Phase 16 — Live canary, launch controls and staged expansion
Use a dedicated low-balance wallet and SOL fee reserve; enable one approved strategy/profile at a time; monitor every trade; stop entries on risk/data/signer/monitoring anomalies; test rollback/manual unlock. Exit: reversible canary, kill switch and reconciliation proven, expansion approved separately.

### Phase 17 — Post-launch governance and controlled learning
Monitor calibration, regime shift, PnL/drawdown, execution costs, security misses, API health and latency. Run post-mortems, quarantine strategies under predeclared deterioration rules, validate challengers and version/rollback all live changes. Exit: every change is measured, traceable, approved and rollbackable.

## Canonical dashboard page map

The owner-supplied roadmap names these seventeen pages. Related views may share components/routes in the design, but every page capability, permission and workflow must remain available. See [canonical dashboard crosswalk](../phase-1/25-canonical-dashboard-page-crosswalk.md).

1. Sign-in & Security.
2. Overview.
3. Live Scanner.
4. Token / Pool Detail.
5. Decision Center.
6. Current Position.
7. Trade History / Passport.
8. Strategies & Models.
9. Brain & Memory.
10. Backtesting Lab.
11. Portfolio & Goals.
12. Risk Settings.
13. Wallet & Signer.
14. Data Sources & Health.
15. Alerts & Incidents.
16. Audit & Reports.
17. Settings & Integrations.

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

## Separate commercial scope overlay — CR-001 (requested after the frozen baseline)
The owner subsequently requested a no-free-tier/no-trial, USD $12,000 proposed one-time lifetime license, quote/invoice → verified payment → registration invitation → user registration → owner/admin approval workflow. This is a later scope addendum, not a rewrite of the original source roadmap.

- No recurring core subscription; no unpaid operational access.
- No online payment provider is approved for this product yet. Initial proposed collection is an owner-issued invoice and manually verified cleared bank settlement, subject to bank/legal approval.
- Paid hosted customer access requires tenant isolation. The proposed design is one open/unresolved position per customer workspace, not one shared position globally; confirm before Phase 2 design.
- See [CR-001 commercial amendment](../phase-1/29-commercial-scope-amendment.md), [commercial access requirements](../phase-1/27-commercial-pricing-access-and-lifetime-license.md), and [payment provider assessment](../phase-1/28-payment-provider-eligibility-assessment.md).
- The original roadmap phase order and trading safety gates remain unchanged.