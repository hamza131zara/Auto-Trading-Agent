# Roadmap Coverage Audit — DOCX/PDF v1.0 vs Repository

**Source reviewed:** Solana Autonomous DEX Trading Agent — Roadmap & Requirements Blueprint, Roadmap v1.0 dated 20 October 2026, 22 pages. The uploaded DOCX and PDF are copies of the same roadmap content.  
**Repository baseline:** main branch, docs/phase-1/, and the Markdown roadmap reference.  
**Audit date:** 28 October 2026.  
**Scope control:** This audit does not change the approved roadmap scope. It records completeness corrections and supplementary requirements so repository documents faithfully represent the canonical baseline.

## Summary

The existing repository documents cover the main product concept, autonomous discovery-to-exit loop, token security, deterministic risk governor, position lifecycle, quantitative research, signing isolation, audit records and dashboard feature set. The comparison found details that were absent, abbreviated or inconsistently named. Those are added in supplementary documents and mapped below.

The original DOCX/PDF roadmap remains the frozen source of truth. The repository Markdown roadmap is a companion summary and must retain the same phase numbering/order as the original.

## Canonical Phase 0–17 crosswalk

| Canonical phase in approved roadmap | Repository mapping | Audit outcome |
|---|---|---|
| 0. Project governance and scope freeze | README, ROADMAP-BASELINE, decision log | Covered; expand owner/change-control links as needed |
| 1. Documentation research and source verification | Phase 1 docs, SOURCES, provider matrix | Covered; add formal deliverables register and completed-source review |
| 2. Product requirements and quantitative policy | Product charter, functional requirements, trading/quant docs | Covered; add exact formulas, units, default/owner/test criteria |
| 3. Threat model, custody model and security architecture | Security/operations, threat model | Covered; expand signer transaction policy and launch controls |
| 4. UX, dashboard information architecture and design system | Dashboard pages/operator controls | Partial; add exact source-roadmap 17-page crosswalk, sign-in/MFA and integrations pages |
| 5. Repository, environments, CI/CD and engineering foundation | Technology decisions and test plan | Partial; add canonical repository layout, environment and phase dependency map |
| 6. Market-data ingestion and canonical data layer | Architecture/data sources, provider matrix, audit dictionary | Covered in principle; add detailed unit/provenance and provider workload budget |
| 7. Token safety, rug-risk and exitability engine | Token security/risk | Covered in principle; add separate security gate, rug score, confidence/completeness and exitability outputs |
| 8. Quant features, regime model and strategy research | Quant methodology | Partial; add complete indicator/formula/unit catalogue, calibration and walk-forward safeguards |
| 9. Decision brain, policy router and strategy memory | Autonomous workflow, functional requirements | Partial; add explicit module/authority matrix, model output contracts, compact rationale and model/prompt/version tracking |
| 10. Risk governor, portfolio ledger and Kelly-aware sizing | Quant methodology and trading/exit policy | Covered in principle; add exact calculator definitions and constraints |
| 11. Execution service, quote validation and isolated signer | Workflow, security doc, architecture | Partial; add transaction lifecycle, Jupiter route review requirements, signer policy checks and unknown-state handling |
| 12. Web dashboard and operator control surface | Dashboard pages | Partial; add canonical page map and high-risk action permissions |
| 13. Backtesting, paper trading and replay lab | Quant methodology, test plan | Partial; add replay cost/failure assumptions, runner comparisons and scenario manifests |
| 14. Testing, quality engineering and independent security review | Test plan, threat model | Covered in principle; add explicit critical/high remediation, penetration/independent review evidence and recovery drills |
| 15. Shadow mode and controlled paper launch | Test plan, workflow | Partial; add predeclared window/sample/multi-regime gates and paper/shadow reports |
| 16. Live canary, launch controls and staged expansion | Security/operations and release plan | Partial; add limited funds, one strategy at a time, manual unlock, rollback and staged limit changes |
| 17. Post-launch governance and controlled learning | Strategy learning and audit | Partial; add periodic performance/model reviews, dependency/key/access review, drift quarantine and rollback rules |

## Required DOC-01 to DOC-12 deliverable mapping

The source roadmap explicitly calls for twelve documents before design approval. The repository uses more than twelve files to provide traceability and separate specialist requirements.

| Source deliverable | Existing or supplemental repository coverage | Status after additions |
|---|---|---|
| DOC-01 Product Requirements Document | 01-product-charter.md, 02-functional-requirements.md, 16-autonomous-trading-workflow.md | Covered |
| DOC-02 Trading Policy and State Machine | 03-trading-and-exit-policy.md, 16-autonomous-trading-workflow.md, 20-execution-reconciliation-and-signer-contract.md | Covered |
| DOC-03 Quantitative Methods Spec | 05-quantitative-methodology.md, 18-indicators-formulas-and-units.md | Covered |
| DOC-04 Token Security and Rug Policy | 04-token-security-risk.md, 19-agent-brain-and-memory-spec.md | Covered |
| DOC-05 Data and Provider Spec | 06-architecture-and-data-sources.md, 14-provider-and-integration-matrix.md, SOURCES.md, 21-cost-and-operations-plan.md | Covered; commercial/source validation remains open |
| DOC-06 Agent Brain and Memory Spec | 16-autonomous-trading-workflow.md, 19-agent-brain-and-memory-spec.md | Covered |
| DOC-07 Wallet, Signer and Threat Model | 07-security-privacy-and-operations.md, 15-threat-model-and-risk-register.md, 20-execution-reconciliation-and-signer-contract.md | Covered |
| DOC-08 Execution and Reconciliation Spec | 16-autonomous-trading-workflow.md, 20-execution-reconciliation-and-signer-contract.md | Covered |
| DOC-09 UX and Page Spec | 12-dashboard-pages-and-operator-controls.md, 25-canonical-dashboard-page-crosswalk.md | Covered |
| DOC-10 Test and Launch Plan | 09-test-plan-and-acceptance.md, 23-shadow-canary-launch-and-post-launch-governance.md | Covered |
| DOC-11 Cost and Operations Plan | 21-cost-and-operations-plan.md | Added |
| DOC-12 Legal/Tax/Service Boundary Review | 22-legal-tax-and-service-boundary-review.md | Added; legal/tax conclusions require qualified review |

## Material discrepancies closed by the supplement

1. **Phase order:** the abbreviated repository phase list did not match the canonical numbered sequence. The canonical sequence is preserved and cross-referenced in docs/roadmap/ROADMAP-CANONICAL-PHASE-MAP.md.
2. **Mode taxonomy:** the source uses Observe, Backtest, Paper, Shadow, Live Canary, Live and Halted. The new documentation defines these as canonical names and maps existing synonyms.
3. **Dashboard map:** the source includes Sign-in & Security and Settings & Integrations as explicit pages; the repository page inventory used different route names. The added crosswalk preserves all source capabilities and maps them to existing page concepts.
4. **Formula catalogue:** the source calls for explicit definitions of Net PnL, Net ROI, win rate, expectancy, profit factor, drawdown, position/liquidity ratio, holder concentration, expected net return, Kelly, compounding, goal-reaching probability and execution-cost calculations. These are consolidated with units and cautions.
5. **Brain boundaries:** the new authority matrix specifies which modules may discover, score, propose, veto, sign, reconcile or only learn asynchronously.
6. **Transaction safety:** the added execution specification makes lifecycle states, idempotency, signer allowlists, fresh quotes, chain reconciliation and unknown transaction recovery explicit.
7. **Cost/operations and legal review:** new DOC-11 and DOC-12 documents cover operating budgets, provider cost assumptions and legal/tax/service boundary questions.

## Not claimed complete by this audit

- Current provider plans, rates, quotas, SDK/API behavior and terms still require verification against official docs for the selected plan/version.
- Numeric trading thresholds and research pass/fail values are not invented here; they must be selected and recorded before the corresponding test period.
- Legal/tax applicability is not determined by this document; seek qualified advice for the actual operator, entity, service model and jurisdictions.
- No security certification, positive expectancy, win rate or target-attainment guarantee is claimed.
- Adding the missing documentation does not authorize design or production implementation automatically. Phase approvals remain governed by the frozen roadmap and owner decisions.

## Change-control statement
No change to scope, chain, one-position rule, safety architecture or phase order is proposed. Phase name/order corrections make the repository companion match the canonical roadmap; they are not a roadmap revision.

## Commercial access amendment coverage — CR-001 (28 October 2026)

The owner subsequently requested no free tier/trial, a proposed USD $12,000 one-time lifetime license, quote/invoice-first payment, registration invitation after settlement, and mandatory owner/admin approval before operational access. This is a separate commercial addendum and does not change the frozen Phase 0–17 sequence.

| Commercial requirement | Repository coverage | Status |
|---|---|---|
| Pricing, lifetime service definition, inclusions/exclusions, fair-use limits, no recurring core fee | 27-commercial-pricing-access-and-lifetime-license.md; 21-cost-and-operations-plan.md | Documented; final contract/legal review required |
| Quote/payment/invitation/registration/admin approval lifecycle | FR-14/15 in 02-functional-requirements.md; commercial access spec | Documented; payment settlement path requires bank confirmation |
| Payment processor and seller-country eligibility | 28-payment-provider-eligibility-assessment.md; SOURCES.md; 26-official-source-verification-report.md | First public policy pass complete; no processor approved |
| Admin controls, MFA, audit and tenant isolation | 12-dashboard-pages-and-operator-controls.md; 08-data-dictionary-and-audit.md; 15-threat-model-and-risk-register.md | Documented; test implementation belongs to later phases |
| One-open-position scope for multi-customer service | 29-commercial-scope-amendment.md; FR-06/16-autonomous-trading-workflow.md addenda | Proposed per-customer workspace; owner confirmation required before design |
| Public sales gate | 23-shadow-canary-launch-and-post-launch-governance.md; 22-legal-tax-and-service-boundary-review.md | Documented; no public sales until bank/provider/legal gate |

**Commercial deployment resolution (D-025):** The owner has locked self-hosted, customer-isolated licensed software for V1. The central portal handles quotes/invoices, verified payment records, registration/admin approval, signed license activation and authorized software downloads/updates only. Each customer runs an independent agent instance and controls their infrastructure/provider credentials/wallet/signer. One open/unresolved position is allowed per running licensed instance; no shared hosted trading runtime, platform-level position lock or pooled funds. See [30-self-hosted-deployment-decision.md](30-self-hosted-deployment-decision.md). This is a commercial scope addendum and does not change the frozen roadmap phase order.