# Auto-Trading-Agent

![Auto-Trading-Agent brand logo](assets/brand/auto-trading-agent-logo-light.svg)

[View the reusable 3D market-intelligence hero illustration](assets/brand/auto-trading-agent-3d-hero.svg). Use selectively in appropriate hero, architecture and product sections.

Solana-only autonomous DEX trading research and execution system.

> **Current phase:** Phase 6 — Market-Data Ingestion and Canonical Data Layer. Phases 1–5 are closed for their approved handoffs. Read-only live identity validation and the initial SOL/USDC discovery workflow have run successfully, but no pool met the current qualification filters. Discovery now covers canonical SOL/USDC and SOL/USDT in the read-only code, and the expanded implementation passed [CI run #181](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40872597792). The corrected live scan [#11](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40874763390) checked all 45 pool accounts and cross-checked all 24 CPMM candidates; none met the existing thresholds, so no pool was recommended. Live-source validation [#3](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40875718349) returned MATCH and decoded on-chain reserves, but independent price comparison remains NOT_ASSESSED and source freshness UNKNOWN. The provider-neutral exact-decimal comparator, Pyth Hermes SOL/USD + USDC/USD read-only adapter, and manual-only validation workflow passed [CI run #194](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40880232949) with 152 tests. Manual Pyth validation [#2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40892770577) retrieved fresh, aligned feeds; reserve/reference comparison returned DISAGREEMENT (63 bps vs 10 bps), and DEX Screener's price remains NOT_ASSESSED because its source timestamp is missing. The new `assessCriticalMarketDataEvidenceGate` combines indexed-provider consensus and independent Pyth reserve/USD comparison, blocking progression if either disagrees or evidence is incomplete. CI [#204](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40897449187) passed 156 tests. Next, validate fallback/degraded behavior without weakening current filters. Phase 6 remains active and trading is not authorized. Production provider selection and critical-data validation remain open. Live trading is not authorized. Do not connect a production wallet or private key.

## Start here
- [Closed Phase 5 foundation and Phase 6 handoff](docs/phase-5/06-phase-5-closeout-and-phase-6-handoff.md)
- [Active Phase 6 market-data and canonical data layer](docs/phase-6/README.md)
- [Phase 6.13 live-source validation runner and operator runbook](docs/phase-6/13-live-source-validation-runner.md)
- [Manual-only live-source validation workflow](.github/workflows/phase6-live-source-validation.yml)
- [Locked Phase 4 design handoff](docs/phase-4/08-phase-4-closeout-and-phase-5-handoff.md)
- [Clickable responsive dashboard prototype](docs/phase-4/design-previews/dashboard-prototype.html)
- [Locked Phase 4 UX and visual design](docs/phase-4/README.md)
- [Dark dashboard design preview](docs/phase-4/design-previews/dashboard-dark-concept.svg)
- [Light dashboard design preview](docs/phase-4/design-previews/dashboard-light-concept.svg)
- [Phase 3 security architecture closeout](docs/phase-3/08-phase-3-closeout-and-phase-4-handoff.md)
- [Phase 3 threat model and security architecture](docs/phase-3/README.md)
- [Phase 3 handoff from completed Phase 2](docs/phase-2/08-phase-2-completion-and-phase-3-handoff.md)
- [Phase 2 requirements and quantitative policy](docs/phase-2/README.md)
- [Brand assets and logo usage](docs/phase-2/09-brand-identity-and-logo-usage.md)
- [Phase 1 final closeout and Phase 2 handoff](docs/phase-1/31-phase-1-closeout-and-phase-2-handoff.md)
- [Phase 1 document index](docs/phase-1/README.md)
- [Document register with versions and hashes](docs/phase-1/DOCUMENT-REGISTER.md)
- [Phase 1 status and exit checklist](PHASE1-STATUS.md)
- [Official provider/source verification report](docs/phase-1/26-official-source-verification-report.md)
- [Commercial access and lifetime license](docs/phase-1/27-commercial-pricing-access-and-lifetime-license.md)
- [Payment provider eligibility assessment](docs/phase-1/28-payment-provider-eligibility-assessment.md)
- [Commercial scope amendment CR-001](docs/phase-1/29-commercial-scope-amendment.md)
- [Locked self-hosted deployment decision D-025](docs/phase-1/30-self-hosted-deployment-decision.md)
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

## Commercial model (CR-001)
- No free tier or trial.
- Proposed price: USD $12,000 one-time lifetime license; no recurring core subscription.
- Quote/invoice → verified cleared settlement → single-use registration invitation → user registration and MFA → owner/admin approval → active license/tenant.
- No online payment processor is approved yet. The initial candidate is an owner-issued invoice with manually reconciled bank settlement, subject to bank/legal confirmation.
- **Locked deployment:** self-hosted, customer-isolated licensed software (D-025). No hosted multi-tenant trading SaaS in V1. The central portal handles quote/payment/registration/admin approval, signed license activation and authorized downloads/updates only.
- Each customer runs their own isolated agent instance, provider credentials, wallet/signer, ledger and risk configuration. One open/unresolved position per running instance. No pooled funds or shared platform-level trading state.
- Proposed standard price remains USD $12,000 one-time lifetime license, with no free tier/trial and no recurring core subscription. Payment/bank eligibility and legal review remain pre-sale gates.

## Current rule
Phases 1–5 are closed for their approved handoffs; Phase 6 remains active. The Phase 6 foundation now includes canonical market-data contracts, deterministic replay, a read-only DEX Screener candidate, fail-closed provider agreement/fallback checks, an on-chain evidence checker, bounded read-only Solana RPC transport, classic SPL Token mint/account decoding, Token-2022 TLV structure and a fail-closed extension enum policy, plus a pinned-source Raydium CPMM PoolState/AMM-config decoder with PDA derivation and read-only identity integration. PR #18 merged the extension policy; [PR #19](https://github.com/hamza131zara/Auto-Trading-Agent/pull/19) carries the Raydium decoder and its synthetic tests. CI uses mocked/injected fetch only. The Raydium decoder checks a nine-account evidence set (pool/program/config/LP mint/two mints/two vaults/observation), with all assessment inputs from a common context slot; synthetic responses cannot progress to independent safety review. Token-2022 extended token accounts remain blocked pending Phase 7 review. **Phase 6 is not complete:** real-source identity validation with an owner-approved read-only RPC endpoint, current program deployment/source verification, provider/plan/terms/quota/retention/budget decisions and production fallback approval remain open. DEX Screener freshness stays UNKNOWN because source-observation time is not established. No production wallet, private key, live signing or mainnet trading is authorized. Public sales remain gated on bank/payment eligibility, explicit license terms and qualified legal/tax review.
