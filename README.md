# Auto-Trading-Agent

Solana-only autonomous DEX trading research and execution system.

> **Current phase:** Phase 1 — Documentation and Requirements. Live trading is not authorized. Do not connect a production wallet or private key during documentation work.

## Start here
- [Phase 1 document index](docs/phase-1/README.md)
- [Document register with versions and hashes](docs/phase-1/DOCUMENT-REGISTER.md)
- [Phase 1 status and exit checklist](PHASE1-STATUS.md)
- [Autonomous trading workflow: discovery to next candidate](docs/phase-1/16-autonomous-trading-workflow.md)
- [Roadmap coverage audit vs approved DOCX/PDF](docs/phase-1/17-roadmap-coverage-audit.md)
- [Frozen Roadmap v1.0 — canonical phase map](docs/roadmap/ROADMAP-CANONICAL-PHASE-MAP.md)
- [Roadmap Markdown companion summary](docs/roadmap/Solana_Dex_Agent_Roadmap_v1.md)
- [Roadmap baseline and change-control policy](docs/roadmap/ROADMAP-BASELINE.md)
- [Decision log](docs/phase-1/10-decision-log.md)
- [Official documentation/source register](docs/phase-1/SOURCES.md)

## Frozen roadmap invariants
1. Solana spot DEX only for V1; no leverage, borrowing or cross-chain execution.
2. At most one open or unresolved position across the portfolio.
3. NO_TRADE and RESEARCH_MORE are valid outcomes.
4. Deterministic security and risk gates have final veto authority.
5. AI/LLM components are advisory; they cannot bypass policy, access signing secrets, initiate unrestricted transactions, withdraw assets or modify hard risk limits.
6. Transaction signing is isolated behind a narrowly scoped, policy-enforcing signer.
7. Candidate decisions, rejected candidates, quotes, simulations, transactions, fills, fees, exits, PnL, model versions and strategy versions are auditable.
8. Quick Compound, Trend Capture and High-Upside Runner are hypotheses to test, not presumed profitable policies. +6% net is a baseline test profile, not a universal full-exit rule.
9. Kelly-based sizing is research-only until assumptions, uncertainty and independent risk limits are validated.
10. No win-rate, return or target-attainment guarantee is made.
11. Backtesting, out-of-sample evaluation, independent security review, paper/shadow evidence, operational drills and explicit release approval precede live trading.

## Canonical phase order
Use the phase titles/order in [ROADMAP-CANONICAL-PHASE-MAP.md](docs/roadmap/ROADMAP-CANONICAL-PHASE-MAP.md): Phase 0 governance; Phase 1 source/documentation verification; Phase 2 product/quantitative requirements; Phase 3 threat/custody/security architecture; Phase 4 UX/design; Phase 5 repository/CI foundations; Phase 6 data ingestion; Phase 7 token safety; Phase 8 quant/regime research; Phase 9 decision brain/memory; Phase 10 risk/ledger/Kelly; Phase 11 execution/signer; Phase 12 dashboard; Phase 13 backtesting/replay; Phase 14 testing/independent security review; Phase 15 shadow/paper; Phase 16 live canary; Phase 17 post-launch governance.

## Current rule
The documents and plans do not enable any live transaction. Complete the applicable source-verification and approval gates before entering the next canonical phase.