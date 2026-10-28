# Frozen Roadmap Baseline

- **Title:** Solana Autonomous DEX Trading Agent — Roadmap v1.0
- **Date:** 20 October 2026
- **Status:** Frozen baseline, approved by owner in conversation on 28 October 2026.
- **Canonical source:** the owner's 22-page DOCX/PDF roadmap supplied in the conversation.
- **Repository phase map:** [ROADMAP-CANONICAL-PHASE-MAP.md](ROADMAP-CANONICAL-PHASE-MAP.md).
- **Companion full text summary:** [Solana_Dex_Agent_Roadmap_v1.md](Solana_Dex_Agent_Roadmap_v1.md).

## Change control
Do not change the frozen roadmap scope, phase order or non-negotiable architecture principles without the owner's explicit approval. A proposed amendment must include:
1. Change request and reason.
2. Scope/phase dependencies affected.
3. Security, financial and operational implications.
4. Testing and acceptance changes.
5. Explicit owner approval and dated decision-log entry.

The phase-map/summary updates correct repository cross-references to match the frozen source; they do not alter the approved roadmap.

## Canonical execution order
0. Project governance and scope freeze.
1. Documentation research and source verification.
2. Product requirements and quantitative policy.
3. Threat model, custody model and security architecture.
4. UX, dashboard information architecture and design system.
5. Repository, environments, CI/CD and engineering foundation.
6. Market-data ingestion and canonical data layer.
7. Token safety, rug-risk and exitability engine.
8. Quant features, regime model and strategy research.
9. Decision brain, policy router and strategy memory.
10. Risk governor, portfolio ledger and Kelly-aware sizing.
11. Execution service, quote validation and isolated signer.
12. Web dashboard and operator control surface.
13. Backtesting, paper trading and replay lab.
14. Testing, quality engineering and independent security review.
15. Shadow mode and controlled paper launch.
16. Live canary, launch controls and staged expansion.
17. Post-launch governance and controlled learning.

## Invariants
Solana-only V1; one open position portfolio-wide; deterministic security/risk veto; LLM cannot access signing secrets or bypass controls; isolated policy-enforcing signer; auditable decisions and actual execution reconciliation; no guaranteed profitability; out-of-sample testing and paper/shadow evidence before mainnet consideration.

## Subsequent commercial requirement (separate amendment)
The owner later requested a no-free-tier/no-trial, one-time lifetime-license model with a proposed USD $12,000 standard price, quote/invoice → verified payment → invitation → registration → owner/admin approval. This is documented as a separate addendum, not as an edit to the frozen source baseline:
- [Commercial scope amendment CR-001](../phase-1/29-commercial-scope-amendment.md)
- [Commercial access requirements](../phase-1/27-commercial-pricing-access-and-lifetime-license.md)
- [Payment provider eligibility assessment](../phase-1/28-payment-provider-eligibility-assessment.md)

It does not change the canonical phase order. The proposed per-customer position cap and hosted multi-tenant design must be confirmed before Phase 2 design; online payment-provider eligibility and legal/bank approval remain launch gates.