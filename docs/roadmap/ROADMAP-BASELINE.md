# Frozen Roadmap Baseline

- **Title:** Solana Autonomous DEX Trading Agent — Roadmap v1.0
- **Date:** 20 October 2026
- **Status:** Frozen baseline, approved by owner in conversation on 28 October 2026.
- **Original files:** See downloadable DOCX/PDF roadmap supplied in conversation. Repository copies may be added as binary assets through a file-upload-capable workflow.

## Change control
Do not change the frozen roadmap scope, phase order or non-negotiable architecture principles without the owner's explicit approval. A proposed amendment must include:
1. Change request and reason.
2. Scope/phase dependencies affected.
3. Security, financial and operational implications.
4. Testing and acceptance changes.
5. Explicit owner approval and dated decision-log entry.

## Execution order
Governance and scope freeze → Documentation and requirements approval → UX/system design → repository foundations → data ingestion → security intelligence → features/regime detection → decision and strategy registry → backtesting/quantitative research → portfolio/risk → quote/simulation/execution adapter → position monitoring/exits → ledger/memory → dashboard/operator controls → observability/incident response → integration/security testing → paper trading/shadow evaluation → controlled mainnet readiness/staged launch.

## Invariants
Solana-only V1; one open position portfolio-wide; deterministic security/risk veto; LLM cannot access signing secrets or bypass controls; isolated policy-enforcing signer; auditable decisions and actual execution reconciliation; no guaranteed profitability; out-of-sample testing and paper trading before mainnet consideration.