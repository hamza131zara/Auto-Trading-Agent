# Project Phase Status — Phase 1–5 Handoff

**Repository:** hamza131zara/Auto-Trading-Agent  
**Phase 1:** CLOSED for design handoff  
**Phase 2:** CLOSED for requirements handoff
**Phase 3:** CLOSED for documentation/design handoff by owner direction
**Phase 4:** CLOSED for owner-approved design handoff
**Active phase:** Phase 5 — Repository, Environments, CI/CD and Engineering Foundation  
**Phase 3 status:** Security design package handed off; unresolved signing, key, license and numeric-risk decisions remain implementation/release blockers.
**Phase 4 status:** Design system/specifications, dark/light concepts and clickable local prototype are locked for handoff; production UI is not implemented.
**Core documentation:** Owner-approved in conversation.  
**Roadmap comparison/source verification:** Completed and committed.  
**Commercial model:** No free tier/trial; proposed USD $12,000 one-time lifetime license; owner/admin approval required after payment and registration.  
**Deployment model:** **LOCKED — self-hosted, customer-isolated licensed software**, per owner decision D-025 on 28 October 2026.  
**Current disposition:** Phases 1–4 are closed for their approved handoffs; Phase 5 repository/environment/CI foundation is active. Main push CI has passed for install, repository validation, typecheck, build/tests, npm audit and Gitleaks. Bank/payment eligibility, qualified legal/tax review, provider verification and unresolved signer/security/risk decisions remain implementation or launch gates.

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
**Phases 1–4 are closed for their owner-approved handoffs; Phase 5 repository/environment/CI work is active.** Use the locked self-hosted model: design the central license portal, quote/payment/registration/approval workflow, signed license activation, customer installation guide, self-hosted runtime/dashboard, signer boundary, signed update/rollback and diagnostics/support boundary. Do not implement online payment or live trading until their respective external and security gates are passed. Phase 2 design work included requirements for license activation/instance binding, offline validation/grace behavior, signed release/update flow and rollback. These remain security-design/implementation gates as listed in Phase 3 decisions.

## Canonical source references
- [Phase 1 final closeout and Phase 2 handoff](docs/phase-1/31-phase-1-closeout-and-phase-2-handoff.md)
- [Phase 2 requirements and quantitative policy](docs/phase-2/README.md)
- [Phase 2 completion and Phase 3 handoff](docs/phase-2/08-phase-2-completion-and-phase-3-handoff.md)
- [Phase 3 security architecture closeout](docs/phase-3/08-phase-3-closeout-and-phase-4-handoff.md)
- [Phase 3 security architecture package](docs/phase-3/README.md)
- [Active Phase 5 repository and CI foundation](docs/phase-5/README.md)
- [Phase 4 closeout and Phase 5 handoff](docs/phase-4/08-phase-4-closeout-and-phase-5-handoff.md)
- [Active Phase 4 UX and visual design](docs/phase-4/README.md)
- [Phase 1 document index](docs/phase-1/README.md)
- [D-025 self-hosted deployment decision](docs/phase-1/30-self-hosted-deployment-decision.md)
- [CR-001 commercial scope amendment](docs/phase-1/29-commercial-scope-amendment.md)
- [Frozen canonical phase map](docs/roadmap/ROADMAP-CANONICAL-PHASE-MAP.md)