# Auto-Trading-Agent

Solana-only autonomous DEX trading research and execution system.

> **Current phase: Phase 1 — Documentation and Requirements.** Live trading is not authorized. Do not connect a production wallet or private key during this phase.

## Approved roadmap baseline

- **Solana Autonomous DEX Trading Agent — Roadmap v1.0**, dated 20 October 2026.
- The roadmap scope and phase order are frozen. Changes require explicit owner approval and a recorded decision.
- Phase 1 must produce approved requirements and source-backed integration/security decisions before UX design or application implementation.

## Non-negotiable design principles

1. Solana spot DEX only for V1.
2. At most one open position across the portfolio.
3. Deterministic security and risk gates have final veto authority.
4. AI/LLM components are advisory and cannot bypass policy, hold signing secrets, initiate unrestricted transactions, withdraw funds, or modify hard risk limits.
5. Transaction signing is isolated behind a narrowly scoped policy-enforcing signer.
6. Record candidate decisions, rejected candidates, quotes, simulations, transactions, fills, fees, exits, PnL, model versions, and strategy versions for audit.
7. Fixed-target, trend-capture, and high-upside-runner profiles are hypotheses to test, not presumed profitable policies.
8. Kelly-based sizing is research-only until assumptions, uncertainty treatment, and risk constraints are validated.
9. No win-rate, return, or target-attainment guarantee is made.
10. Backtesting, out-of-sample evaluation, operational drills, and paper trading precede any live-trading release decision.

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
9. Portfolio, Kelly research, and risk governor
10. Quotes, simulation, and execution adapter
11. Position monitoring and exit policies
12. Ledger, audit, and strategy memory
13. Dashboard and operator controls
14. Observability and incident response
15. Integration and security testing
16. Paper trading and shadow evaluation
17. Controlled mainnet readiness and staged launch

## Start here

Read `docs/phase-1/README.md`. Phase 1 is documentation-only: no live-trading code, private-key handling, production wallet connection, or automatic transactions.