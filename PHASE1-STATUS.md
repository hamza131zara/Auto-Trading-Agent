# Project Phase Status — Phase 1–6 Handoff

**Repository:** hamza131zara/Auto-Trading-Agent  
**Phase 1:** CLOSED for design handoff  
**Phase 2:** CLOSED for requirements handoff  
**Phase 3:** CLOSED for documentation/design handoff by owner direction  
**Phase 4:** CLOSED for owner-approved design handoff  
**Phase 5:** CLOSED for engineering-foundation handoff by owner confirmation on 29 October 2026  
**Active phase:** Phase 6 — Market-Data Ingestion and Canonical Data Layer  
**Phase 3 status:** Security design package handed off; unresolved signing, key, license and numeric-risk decisions remain implementation/release blockers.  
**Phase 4 status:** Design system/specifications, dark/light concepts and clickable local prototype are locked for handoff; production UI is not implemented.  
**Core documentation:** Owner-approved in conversation.  
**Roadmap comparison/source verification:** Completed and committed.  
**Commercial model:** No free tier/trial; proposed USD $12,000 one-time lifetime license; owner/admin approval required after payment and registration.  
**Deployment model:** **LOCKED — self-hosted, customer-isolated licensed software**, per owner decision D-025 on 28 October 2026.  
**Current disposition:** The latest main-push CI passed on commit `9b0a8af40a576f97a7859729e4e969dc163ca6a6` ([run 40814464474](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40814464474)); prior PR quality and Gitleaks checks passed on the recorded Phase 5 maintenance PRs. The owner confirmed branch protection, required reviews/status checks and dependency graph settings are complete; the connected GitHub integration could not independently read the classic branch-protection endpoint. Phase 6 is active with provider-neutral market-data schema/freshness/provider-health/replay work. No provider is selected, no production data credentials are required, and mainnet trading remains unauthorized. Bank/payment eligibility, qualified legal/tax review and unresolved signer/security/numeric-risk decisions remain launch gates.

## Phase 1 deliverables completed
- Product, functional, trading/exit, security, quantitative, architecture, data, audit and testing requirements.
- Autonomous discovery-to-next-candidate workflow.
- Roadmap coverage audit and canonical Phase 0–17/dashboard crosswalk.
- Formula/indicator units, agent brain/memory authority and execution/signer contract.
- Cost/operations plan and legal/tax/service-boundary review register.
- Official source-verification report and updated provider/source/cost registers.
- Commercial pricing/access/lifetime-license workflow and payment-provider eligibility assessment.
- Locked self-hosted deployment decision, license portal boundary and self-hosted runtime requirements.
- Document register with source artifact and repository hash references.

## Locked commercial/deployment model
- No free tier, no free trial and no unpaid operational access.
- Proposed standard price: USD $12,000 one-time lifetime software license; no recurring core subscription.
- Owner/admin issues the quote/invoice; settlement is verified; a single-use registration invitation is sent; the customer completes registration, email verification, required MFA and terms; owner/admin approval is mandatory before signed license activation.
- No online checkout provider is approved. Initial proposed collection is a manual invoice plus verified cleared bank settlement, subject to confirmation from the actual bank/payment institution and qualified legal/tax advice.
- **Self-hosted, customer-isolated software:** each customer runs their own instance in their own/customer-dedicated infrastructure. The central portal manages licensing, payment/registration approval and authorized downloads/updates; it does not host trading jobs or hold wallet keys.
- Each running licensed instance enforces at most one open/unresolved position in its own portfolio. No hosted multi-tenant trading SaaS, shared trading runtime, shared position lock or pooled funds in V1.
- Customer-provided infrastructure, RPC/data/LLM services, trading capital and network/DEX fees are excluded unless a quote explicitly states otherwise.

## Remaining external gates (not blockers to UX/system design)
1. Confirm payment collection eligibility with the actual bank/payment institution and qualified counsel before public sales.
2. Obtain qualified legal/tax/service-boundary advice for the actual software/license and wallet-control model before applicable launch.
3. Verify account-specific provider plans, quotas, terms and endpoint access before selecting production integrations.
4. Finalize cost-supported license terms: product lifetime, update/support scope, inclusions, customer-paid infrastructure, fair-use boundaries and refunds/disputes.
5. Define/pre-register numeric trading thresholds and backtest/shadow/paper acceptance criteria before those evaluations begin.

## Safety status
- No production trading code is authorized by this documentation status.
- No production wallet/private key is connected.
- No online payment checkout, public sale or customer account activation is enabled by these documents.
- Mainnet execution is not authorized.
- No profitability/win-rate guarantee is made.

## Current phase
**Phases 1–5 are closed for their owner-approved handoffs; Phase 6 market-data ingestion and canonical-data work is active.** Use the locked self-hosted model: design the central license portal, quote/payment/registration/approval workflow, signed license activation, customer installation guide, self-hosted runtime/dashboard, signer boundary, signed update/rollback and diagnostics/support boundary. Do not implement online payment or live trading until their respective external and security gates are passed. Phase 2 design work included requirements for license activation/instance binding, offline validation/grace behavior, signed release/update flow and rollback. These remain security-design/implementation gates as listed in Phase 3 decisions.

## Canonical source references
- [Phase 1 final closeout and Phase 2 handoff](docs/phase-1/31-phase-1-closeout-and-phase-2-handoff.md)
- [Phase 2 requirements and quantitative policy](docs/phase-2/README.md)
- [Phase 2 completion and Phase 3 handoff](docs/phase-2/08-phase-2-completion-and-phase-3-handoff.md)
- [Phase 3 security architecture closeout](docs/phase-3/08-phase-3-closeout-and-phase-4-handoff.md)
- [Phase 3 security architecture package](docs/phase-3/README.md)
- [Closed Phase 5 foundation and Phase 6 handoff](docs/phase-5/06-phase-5-closeout-and-phase-6-handoff.md)
- [Active Phase 6 market-data layer](docs/phase-6/README.md)
- [Phase 4 closeout and Phase 5 handoff](docs/phase-4/08-phase-4-closeout-and-phase-5-handoff.md)
- [Active Phase 4 UX and visual design](docs/phase-4/README.md)
- [Phase 1 document index](docs/phase-1/README.md)
- [D-025 self-hosted deployment decision](docs/phase-1/30-self-hosted-deployment-decision.md)
- [CR-001 commercial scope amendment](docs/phase-1/29-commercial-scope-amendment.md)
- [Frozen canonical phase map](docs/roadmap/ROADMAP-CANONICAL-PHASE-MAP.md)
