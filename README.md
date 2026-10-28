# Auto-Trading-Agent

Solana-only autonomous DEX trading research and execution system.

> **Current phase: Phase 1 — Documentation and Requirements.** Live trading is not authorized. Do not connect a production wallet or private key during this phase.

## Start here
- [Phase 1 document index](docs/phase-1/README.md)\n- [Autonomous trading workflow: discovery to next candidate](docs/phase-1/16-autonomous-trading-workflow.md)
- [Phase 1 status and approval gate](PHASE1-STATUS.md)
- [Frozen Roadmap v1.0 — full Markdown baseline](docs/roadmap/Solana_Dex_Agent_Roadmap_v1.md)
- [Roadmap baseline and change-control policy](docs/roadmap/ROADMAP-BASELINE.md)
- [Decision log](docs/phase-1/10-decision-log.md)
- [Official documentation/source register](docs/phase-1/SOURCES.md)

## Approved roadmap baseline
- **Solana Autonomous DEX Trading Agent — Roadmap v1.0**, dated 20 October 2026.
- Roadmap scope and phase order are frozen. Changes require explicit owner approval and a dated decision-log entry.
- Phase 1 must be approved before UX design or application implementation.

## Non-negotiable principles
1. Solana spot DEX only for V1; no leverage or borrowing.
2. At most one open position across the portfolio.
3. NO_TRADE and RESEARCH_MORE are valid outcomes.
4. Deterministic security and risk gates have final veto authority.
5. AI/LLM components are advisory; they cannot bypass policy, hold signing secrets, initiate unrestricted transactions, withdraw funds or modify hard risk limits.
6. Transaction signing is isolated behind a narrowly scoped policy-enforcing signer.
7. Candidate decisions, rejected candidates, quotes, simulations, transactions, fills, fees, exits, PnL, model versions and strategy versions are auditable.
8. Quick-compound, trend-capture and high-upside-runner profiles are hypotheses to test, not presumed profitable policies.
9. Kelly-based sizing is research-only until assumptions, uncertainty treatment and risk constraints are validated.
10. No win-rate, return or target-attainment guarantee is made.
11. Backtesting, out-of-sample evaluation, operational drills and paper trading precede any live-trading release decision.

## Phase sequence
0. Governance and scope freeze  
1. Documentation and requirements approval  
2. UX and system design  
3. Repository foundations and secure engineering baseline  
4. Data ingestion and normalization  
5. Token and pool security intelligence  
6. Market features and regime detection  
7. Decision brain and strategy registry  
8. Backtesting and quantitative research  
9. Portfolio, Kelly research and risk governor  
10. Quotes, simulation and execution adapter  
11. Position monitoring and exit policies  
12. Ledger, audit and strategy memory  
13. Dashboard and operator controls  
14. Observability and incident response  
15. Integration and security testing  
16. Paper trading and shadow evaluation  
17. Controlled mainnet readiness and staged launch

## Current rule
Phase 1 is documentation-only. No live-trading code, production wallet connection, private-key handling or automatic transactions are authorized until the relevant release gates are passed and the owner explicitly approves the next phase.