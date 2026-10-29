# Document Register — Auto-Trading-Agent

Canonical source artifacts, phase documents, design assets and engineering foundation files. Git blob hashes and byte sizes refer to the tracked main-branch file state before this register refresh.


**Register version:** 3.5  
**Last refreshed:** 29 October 2026  
**Repository:** `hamza131zara/Auto-Trading-Agent`  
**Branch:** `main`  
**Source snapshot before this register refresh:** `daee1721d3b94e6a52c5c0271976e0092d5dee70`  
**Canonical product baseline:** *Solana Autonomous DEX Trading Agent — Roadmap v1.0*, dated 20 October 2026.  
**Locked commercial deployment decision:** D-025 — self-hosted, customer-isolated, approved by owner on 28 October 2026.

## Status definitions
- **Owner-approved core:** the owner said the existing repository documentation had been read and approved.
- **Supplemental:** material added from roadmap comparison, source verification or the commercial requirement.
- **Locked decision:** explicitly selected by the owner; changes require an owner-approved, dated change request.
- **Open verification:** depends on account-specific plan/terms, bank/payment eligibility, numeric policy choices or qualified legal/tax review.
- **Frozen roadmap:** canonical source phase order is not changed by CR-001 or D-025.

## Canonical source files supplied by owner

| Source artifact | SHA-256 of exact uploaded file | Status |
|---|---|---|
| `Solana_Dex_Agent_Roadmap_v1(1).docx` | `0693db897929b8d9aa80fcb4acce6ee8752df0f7c6f3c88893f525b4f9aa9df7` | Frozen baseline source |
| `Solana_Dex_Agent_Roadmap_v1(1).pdf` | `108c8a5ca56e38810c604765ff90f5b412af155696651a1143f240369528437c` | Frozen baseline source |

The DOCX/PDF remain separately supplied artifacts; they are not committed as binary assets. The Markdown roadmap is a companion, not a replacement for the frozen source.

## Root entry points

| Path | Coverage/status | Git blob SHA | Bytes |
|---|---|---|---:|
| `PHASE1-STATUS.md` | Phases 1–4 handoffs closed; Phase 5 PR CI evidence and owner-side gates documented | `e170708e88e8ea674498b6d0f7037ed14f6d7845` | 7490 |
| `README.md` | Project overview, frozen roadmap, Phase 6 integration state and guarded live-source validation runner; provider/live-data gates remain open | `367ede91c4c5876900053a04dc027ee059ec92f0` | 7963 |
| `SECURITY.md` | Project-specific supported-branch and responsible vulnerability-reporting policy | `7c80c6cc4717412380050f53e5bf095d64f03e6b` | 2688 |

## Phase 1 documents

Git blob SHA values below were refreshed from the main branch immediately before this register update, using the source snapshot commit above. They are Git object hashes, not SHA-256 digests of plain file contents. The register itself is excluded to avoid a self-referential hash.

| Repository path | Coverage/status | Git blob SHA | Bytes |
|---|---|---|---:|
| `docs/phase-1/01-product-charter.md` | Product charter / DOC-01 | `87ca28af50b072e7daa39c6aea112589e9624c7b` | 6744 |
| `docs/phase-1/02-functional-requirements.md` | Requirements / commercial access | `6a3a3531e5f9e70ad3034718dece3f13f39f92e7` | 18002 |
| `docs/phase-1/03-trading-and-exit-policy.md` | Trading policy / DOC-02 | `d13967eb61efc5008e5fb98cf8ec72a7968835f2` | 6857 |
| `docs/phase-1/04-token-security-risk.md` | Token security / DOC-04 | `7cc450bf743c4d793796e745c65cf38aaf93f699` | 3905 |
| `docs/phase-1/05-quantitative-methodology.md` | Quant methods / DOC-03 | `2c1e0f35fb65701743dfad981109d8724236d733` | 4022 |
| `docs/phase-1/06-architecture-and-data-sources.md` | Architecture/data | `401308daeefac63368cf0f73b13d3b7bf2b9987a` | 5855 |
| `docs/phase-1/07-security-privacy-and-operations.md` | Security operations / DOC-07 | `d1f33edd49e23f8cdaa225095cbbd276c3ab01c0` | 3832 |
| `docs/phase-1/08-data-dictionary-and-audit.md` | Data/audit/license entities | `d974ceb740fd424b414b573ae9f5b37c35513efe` | 7757 |
| `docs/phase-1/09-test-plan-and-acceptance.md` | Testing / DOC-10 | `af860ec980f34edcc0b5a6df28952aef3d7cd815` | 7661 |
| `docs/phase-1/10-decision-log.md` | Decision log incl. D-025–D-034 and Phase 4/5 handoffs | `a0a65f846b78111228f9b44def5430ca58662cac` | 18807 |
| `docs/phase-1/11-requirements-traceability.md` | Requirements traceability | `8e6d47527829cf34f6ac4e7ab20e5bd82a127abc` | 5656 |
| `docs/phase-1/12-dashboard-pages-and-operator-controls.md` | Dashboard / commercial portal UX | `f7647db7451d1eef25a717869c1a6d847a275a62` | 13141 |
| `docs/phase-1/13-tooling-and-technology-decisions.md` | Technology candidates | `9c19e976ab985e32f41dd20ec4c6a96d136ed654` | 5607 |
| `docs/phase-1/14-provider-and-integration-matrix.md` | Provider matrix | `fee394995c498d6289294ff188afb1ded2e78b9d` | 8280 |
| `docs/phase-1/15-threat-model-and-risk-register.md` | Threat model | `20a363a026e5d40801b47904a16e9bfaee2d7a38` | 7818 |
| `docs/phase-1/16-autonomous-trading-workflow.md` | Autonomous trading workflow | `0ba26fb2cda89036142eef39454abef0dad035f7` | 15945 |
| `docs/phase-1/17-roadmap-coverage-audit.md` | Coverage audit | `ec10ddad3771acc6e827b673b565570f461fa256` | 11723 |
| `docs/phase-1/18-indicators-formulas-and-units.md` | Formulas and units | `e2d3b265a511279cc5428693997696cff1c17b35` | 8727 |
| `docs/phase-1/19-agent-brain-and-memory-spec.md` | Agent brain/memory | `69f76d34508204887aae0a4bcc159db9073e07e5` | 6893 |
| `docs/phase-1/20-execution-reconciliation-and-signer-contract.md` | Execution/signer contract | `6b4899439ab7e54b54599a94949fd0ec20a8b150` | 5714 |
| `docs/phase-1/21-cost-and-operations-plan.md` | Cost/operations/lifetime economics | `69fafcc51e04a07574bc03ea8584a984880bf534` | 10311 |
| `docs/phase-1/22-legal-tax-and-service-boundary-review.md` | Legal/tax review register | `bc65542c5aa94026cbc31443b663fc1ec0e8e10a` | 7968 |
| `docs/phase-1/23-shadow-canary-launch-and-post-launch-governance.md` | Launch/governance gates | `7376880fb447667482add14ca23f591d902f312a` | 9194 |
| `docs/phase-1/24-canonical-phase-map-and-repository-structure.md` | Canonical phase/package map | `86a54b80c47218e1983794e1561d7c876b81151c` | 7718 |
| `docs/phase-1/25-canonical-dashboard-page-crosswalk.md` | Dashboard crosswalk | `3601e5145dd8d67350c31ef9a85cf49d4125893d` | 6520 |
| `docs/phase-1/26-official-source-verification-report.md` | Official source verification | `0de1cf9f7042d04fa20a8a5c2f8f1393c71d4589` | 20348 |
| `docs/phase-1/27-commercial-pricing-access-and-lifetime-license.md` | Commercial access/lifetime license | `feded68dc526434125b34f9767d551c703762e68` | 13526 |
| `docs/phase-1/28-payment-provider-eligibility-assessment.md` | Payment eligibility | `3f92b149a2be73c70310a092eb325cb09f77d14d` | 6563 |
| `docs/phase-1/29-commercial-scope-amendment.md` | CR-001 | `c1830fd68a7ce55aa41807fc0ea7a6ba4c85fcb8` | 8404 |
| `docs/phase-1/30-self-hosted-deployment-decision.md` | D-025 locked deployment | `126e4eef541677056909be4ad92d62735287d8f2` | 8485 |
| `docs/phase-1/31-phase-1-closeout-and-phase-2-handoff.md` | Final closeout, D-026/D-027 and Phase 2 handoff | `38dfc598c0a5eb02c551dccfbb70d864e15f888c` | 4632 |
| `docs/phase-1/README.md` | Phase 1 index and Phase 2–5 handoff links | `826a199e260e25ae0eabffffb254aec3a9522c12` | 10422 |
| `docs/phase-1/SOURCES.md` | Official source register | `95dd96929939ff766225fa0cf5eabefb82d842ca` | 9465 |

## Roadmap companion documents

| Repository path | Git blob SHA | Bytes |
|---|---|---:|
| `docs/roadmap/ROADMAP-BASELINE.md` | `39d4d629ec03100c77a22dcb15227773cc3157a3` | 3419 |
| `docs/roadmap/ROADMAP-CANONICAL-PHASE-MAP.md` | `aea4de6392fdae9127c440735f25ebc99995e151` | 5899 |
| `docs/roadmap/Solana_Dex_Agent_Roadmap_v1.md` | `de3aabc01f1ffcb97dc480ad1c86ce8c2431bdd7` | 13174 |

## Locked deployment and commercial baseline
- D-025: self-hosted, customer-isolated licensed software. No hosted multi-tenant trading SaaS in V1.
- D-026: guided onboarding documentation and real-availability booking flow with Google Meet preferred; calendar/configuration and support terms remain pending.
- D-027: professional trader-agent UI with light/dark modes, responsive layouts and truthful status/evidence semantics; detailed design remains Phase 4.
- D-030: selective 3D/isometric visuals are explicitly owner-locked for appropriate sections; Phase 4 determines exact placement and composition.
- D-031: Phase 3 is closed for documentation/design handoff at owner direction; unresolved security decisions remain implementation/release blockers. Phase 4 is active.
- Central portal: quotes/invoices, verified settlement records, registration/MFA, owner/admin approval, signed license issuance, authorized software release/download and support/licensing administration only.
- Customer runtime: runs in the customer's own or customer-dedicated environment and owns local configuration, provider credentials, wallet/signer boundary, ledger, risk policy and strategy memory.
- Position rule: one open or unresolved position per running licensed instance/portfolio. No shared global position lock or pooled funds.
- Commercial: no free tier/trial; proposed USD $12,000 one-time lifetime license; no recurring core subscription; verified payment before invitation; admin approval before activation.
- Payment provider is not approved. Bank/payment eligibility and qualified legal/tax review remain public-sales gates.
- Customer pays infrastructure, provider/API/LLM, trading capital and network/DEX costs unless explicitly included in a signed quote.

## Phase 2 documents

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `docs/phase-2/README.md` | Phase 2 complete; Phase 4 handoff locked; Phase 5 active | `74f6864a4a3c9d571b9af706a1e2dfccd4682c52` | 4337 |
| `docs/phase-2/01-product-requirements-and-system-boundaries.md` | Functional/non-functional requirements and system boundaries | `a74efb7f0e2a065d489c56e121edc4a5fe94a8a2` | 4894 |
| `docs/phase-2/02-quantitative-policy-and-evaluation-contract.md` | PnL, safety, evaluation and threshold register | `7984c4672717df664a2b48453b4fd560918fe905` | 5784 |
| `docs/phase-2/03-customer-portal-and-runtime-requirements.md` | Portal/runtime split and payment constraints | `2e8fbdee6916347fef06aea1f4bfc2b373ebc851` | 4098 |
| `docs/phase-2/04-installation-onboarding-and-support.md` | Setup guides, calendar booking and support boundaries | `dc0cbb1a0d3a29ede4b2e60bb9584ee247300372` | 4371 |
| `docs/phase-2/05-ui-theme-and-responsive-design-requirements.md` | Light/dark, responsive UI and selective 3D visual requirements | `15e0b67711203ff9eb08cb19533e4555d9e400c1` | 8561 |
| `docs/phase-2/06-open-decisions-and-phase-2-exit-criteria.md` | Closed Phase 2 checklist; D-030 owner-locked | `2a5d8b6fe092d730465d3721d1f77e4db815fa1c` | 5145 |
| `docs/phase-2/07-requirements-traceability-and-acceptance-matrix.md` | Product/quantitative/security/portal acceptance mapping | `46e6685f5ac54b3910912fbc4c9f3b030c7d6527` | 9022 |
| `docs/phase-2/08-phase-2-completion-and-phase-3-handoff.md` | Phase 2 closeout, Phase 3 handoff and current phase links | `a8564ff7530ac21634e07198eda7138f14552d59` | 6256 |
| `docs/phase-2/09-brand-identity-and-logo-usage.md` | Logo, 3D hero identity and usage guidance | `b576b91323ea547815befa69ce571672dee62c24` | 3057 |


## Phase 3 documents

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `docs/phase-3/README.md` | Phase 3 closed for documentation/design handoff; Phase 4 closed; Phase 5 active | `526926f917b713528e6ccdae66830f7306070695` | 4682 |
| `docs/phase-3/01-threat-model-and-trust-boundaries.md` | Assets, adversaries, trust boundaries and threat register | `f56f73ea94ca7464fc7b9fa176d161b41c0587e6` | 11689 |
| `docs/phase-3/02-custody-and-transaction-signing-architecture.md` | Customer custody, signer policy and transaction validation design | `2f0c128293d932d96f1070dfb919d6268641671f` | 7917 |
| `docs/phase-3/03-license-portal-admin-and-release-security.md` | Portal identity, license entitlement and release integrity | `3a8023ceba2f4c9bf5b3f946403db4fa7d77db5b` | 7016 |
| `docs/phase-3/04-secrets-audit-privacy-and-incident-response.md` | Secret handling, audit, privacy and incident playbooks | `9a874e888d78735848fb692078087db7117f63e2` | 7513 |
| `docs/phase-3/05-security-verification-and-phase-3-exit-criteria.md` | Security test plan; verification checklist remains open | `a653ba211510961a669887cec2cb0b3159dd6c59` | 7556 |
| `docs/phase-3/06-security-reference-register.md` | Official security standards and product references | `1a0d467aec1d9134f67c6c9c30a0fd7d482119b9` | 3686 |
| `docs/phase-3/07-security-architecture-decisions.md` | Carry-forward security decisions and release gates | `d35848c9c1797fef33848b58f1f153e9cbe7aef2` | 6508 |
| `docs/phase-3/08-phase-3-closeout-and-phase-4-handoff.md` | Owner-directed Phase 3 design handoff; residual security blockers retained | `b1c434a55145c391891ce3ed76d167473089790d` | 4710 |

## Phase 4 documents

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `docs/phase-4/README.md` | Phase 4 closed for handoff; includes responsive prototype and Phase 5 links | `71d04ca9801b313bfaceaddb099ea359f3ff1b06` | 4321 |
| `docs/phase-4/01-design-system-and-theme-tokens.md` | Proposed light/dark design tokens and component patterns | `7548476708b19bc01a9eecd541a2b89c587800c9` | 6993 |
| `docs/phase-4/02-information-architecture-and-navigation.md` | Public site, portal and runtime navigation separation | `962e2a91d92dc264303266a4b906e2c279112e4e` | 5557 |
| `docs/phase-4/03-core-screen-specifications.md` | Core cockpit, market, decision, position, risk and portal screens | `15a6cde615d3429753facb2bfad2880e326ed6e1` | 7683 |
| `docs/phase-4/04-responsive-accessibility-and-motion.md` | Responsive, accessibility, state and reduced-motion rules | `7719122caf42640f94e08dcfdff9fd0c148e42ab` | 4919 |
| `docs/phase-4/05-3d-visual-placement-and-asset-map.md` | Selective 3D visual placement and brand asset rules | `d0fa7176b8e60b7b449f2f8a787799ecddd1c1cd` | 4073 |
| `docs/phase-4/06-design-acceptance-and-handoff.md` | Locked design acceptance baseline; browser and accessibility validation remains future work | `48c873a7629d483f9c5319596facad8e97f00c47` | 4882 |
| `docs/phase-4/07-design-decisions-and-open-questions.md` | Design decision register | `182b57ef18f889ec085706692c179b8a9793b87c` | 2627 |
| `docs/phase-4/08-phase-4-closeout-and-phase-5-handoff.md` | Owner-directed Phase 4 closeout; Phase 5 handoff | `178d904690e40336300c023bd9890e1b2f5e1dcf` | 3189 |
| `docs/phase-4/design-previews/dashboard-dark-concept.svg` | Static dark dashboard concept; values are illustrative | `03a8c5e6381a4c8baef7e7719de0ac10e0b9879e` | 21508 |
| `docs/phase-4/design-previews/dashboard-light-concept.svg` | Static light dashboard concept; values are illustrative | `5b62fca87c62fe8bca0ab30cca61b607c386a7ba` | 21510 |
| `docs/phase-4/design-previews/dashboard-prototype.html` | Clickable local responsive prototype; no backend/data/order endpoints | `bb61bf30e2293ad58c3f4bce6ea8fcdeafe3dc70` | 17896 |


## Phase 5 documents

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `docs/phase-5/README.md` | Closed Phase 5 foundation handoff; main-push/PR CI evidence and owner-confirmed repository settings | `48304ef5adad73a998b97eb3529f8d71098358fb` | 5157 |
| `docs/phase-5/01-repository-structure-and-conventions.md` | Monorepo structure, workspace boundaries and conventions | `5668e0b8b3bcc3e1524aedf639630401f3b71e1c` | 3521 |
| `docs/phase-5/02-environments-and-configuration.md` | Environment isolation and safe configuration policy | `883a4c9137504975a0fa2a0b217673c22f1da473` | 3496 |
| `docs/phase-5/03-ci-cd-and-security-checks.md` | Current full-SHA action pins, CI security checks and owner-side dependency/protection gates | `adb9598d667ba61fbc9fb68a314669f987cb5335` | 3940 |
| `docs/phase-5/04-development-release-and-rollback-runbook.md` | Developer, dependency update, recovery and rollback runbook | `7a616ee2fe36be77cc066e54aecb7598449c1ae2` | 2886 |
| `docs/phase-5/05-phase-5-acceptance-and-open-decisions.md` | CI/PR acceptance evidence, type/config regression checks, and owner-side settings gates | `b977a8baca7793227fa20a8f0f22fc7b20373f76` | 5179 |
| `docs/phase-5/06-phase-5-closeout-and-phase-6-handoff.md` | Phase 5 closure evidence, owner-confirmed security settings and Phase 6 handoff | `965fa149c6344eb40b1db4fc4f3743937f809721` | 2974 |

## Phase 5 foundation files

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `.nvmrc` | Node 24 development/CI major pin | `a45fd52cc5891570d6299fab38643103c3955474` | 3 |
| `.node-version` | Node 24 runtime declaration | `a45fd52cc5891570d6299fab38643103c3955474` | 3 |
| `.npmrc` | Strict engine handling and exact dependency save policy | `c20257b54d3568173ae7978f5d8215274cbd9c6b` | 57 |
| `.editorconfig` | Consistent text editing conventions | `192c070cf03df5d7af0521a1073c0919cb46f742` | 156 |
| `.gitignore` | Local secrets and generated output exclusions | `ec2ae517f6fd44da1ad3cc8506cd11f7721fdfab` | 137 |
| `.env.example` | Non-secret safe environment defaults; live trading false | `e3da7cd111de243720b72e2982f1146651416937` | 85 |
| `package.json` | Private npm workspace root with build/typecheck/test scripts and an explicit Phase 6 live-source validation command | `c192fe4262e8d09223973c61c548e9f6641b430c` | 1100 |
| `package-lock.json` | Lockfile v3 including the provider-neutral market-data workspace and exact TypeScript 7.0.2 pin | `1284f79e4646a476d7d57eece93bf0cf5db3785d` | 13815 |
| `tsconfig.base.json` | Strict shared TypeScript compiler options | `86b52b09aede81156dd12770bb317442712e5085` | 497 |
| `apps/portal/package.json` | Reserved commercial portal workspace manifest | `9994efe44e192d18af67c245d0c3f6294669a416` | 89 |
| `apps/runtime-dashboard/package.json` | Reserved runtime dashboard workspace manifest | `0da91d4fd93322cb51863a5754362e113ce3a0cf` | 100 |
| `services/agent/package.json` | Reserved local agent workspace manifest | `fc7eab1b3d505157ba7f99f312ea70c704a91992` | 88 |
| `packages/contracts/package.json` | Typed contract workspace manifest | `1ded068a0928ce0208cef6d1268cd4500f8e0e9a` | 305 |
| `packages/contracts/tsconfig.json` | Contract workspace compiler settings | `cf9e1b1a27ef4c39a4c724e106ea5d6b7ca0daf2` | 153 |
| `packages/contracts/tsconfig.type-tests.json` | Compile-time-only contract regression test settings | `58fbc45587a3023ef471695a4ca452a6ba162f90` | 248 |
| `packages/contracts/test/types.test.ts` | Exact status/outcome unions and rejection of execution-authorizing outcomes | `30e96811f794081d556cfc88ee57c3154cce86e3` | 1459 |
| `packages/contracts/src/index.ts` | Shared status and decision outcome unions | `44fff01e2fc2faf186295be2b910e24f405b743e` | 383 |
| `packages/config/package.json` | Configuration workspace manifest | `c9f982e5d4b63e225907c3753f7ce3ecc83c7d0c` | 302 |
| `packages/config/tsconfig.json` | Configuration workspace compiler settings | `cf9e1b1a27ef4c39a4c724e106ea5d6b7ca0daf2` | 153 |
| `packages/config/src/index.ts` | Safe typed config parser; refuses live trading | `e087b80daa74ea5a344ac40470a61bb7e80872d1` | 1859 |
| `scripts/validate-repository.mjs` | Workspace, env-default and common secret-pattern checks | `adff68d5d400717ae39eb4184f8648ac2a12d207` | 4760 |
| `scripts/validate-raydium-live-source.mjs` | Opt-in read-only live-source identity validation runner with explicit approvals, provider separation, HTTPS, redacted evidence and hard-disabled trading | `2124cd694680b11e22e425ad4edd806804c01283` | 12377 |
| `test/config.test.mjs` | Runtime config tests: defaults, strict booleans, immutability, no live trading and safe errors | `1c58d60e9a94dd6729d45c85c3fe63a0188ff16f` | 2383 |
| `.github/workflows/ci.yml` | Push/PR CI with reviewed checkout/setup-node/Gitleaks full-SHA pins and full-history scan | `078cc62af33a1ab87a723086e828ee91e1dcc128` | 1521 |
| `.github/dependabot.yml` | Weekly npm and GitHub Actions updates without undefined custom labels | `788d8cfa2830a8dbd2d8e3529f3a755dbd8a9f09` | 258 |

## Phase 6 documents and initial implementation

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `docs/phase-6/README.md` | Phase 6 scope, provider agreement/fallback, read-only RPC, Token-2022 policy, Raydium candidate, guarded live-source runner and open exit gates | `bb3a4fe502dc9b3623dd767b75e959ba43d420a1` | 10705 |
| `docs/phase-6/01-canonical-observation-schema.md` | Versioned canonical observation schema, units, validation and versioning | `e003f644e3ba6c72b334458f4d627478f073454d` | 2983 |
| `docs/phase-6/02-adapter-contract-and-provider-boundaries.md` | Provider-neutral adapter interface, candidate adapters and fail-closed provider agreement/fallback boundaries | `672c937208f4bc0a346a1d0eadaf103324a92601` | 5437 |
| `docs/phase-6/03-provenance-freshness-and-provider-health.md` | Separate data freshness and provider health semantics | `e1d0e227bc4f2a41b51c0fffa26d9357eb02a81f` | 2391 |
| `docs/phase-6/04-deterministic-replay-fixtures.md` | Synthetic fixture requirements and deterministic replay rules | `7ece326c244421ac22df5892c3cd3698a3252c76` | 1323 |
| `docs/phase-6/05-phase-6-acceptance-and-open-decisions.md` | Phase 6 implementation acceptance evidence, runner implementation, and still-open real-source/provider approval gates; not marked complete | `523fa71de8dee5ffcd706e8090e4906a2e874e13` | 8246 |
| `docs/phase-6/06-dexscreener-reference-adapter.md` | Read-only candidate adapter behavior, timestamp/freshness semantics, official-source quota and licensing gates | `39267e3810d06b57f7a4201f3b6f14c8da1e974e` | 6539 |
| `docs/phase-6/07-provider-agreement-and-fallback-policy.md` | Deterministic evidence eligibility, independent-source comparison, freshness, disagreement and fallback safeguards | `4fc2a8f8b2da37607b07a884639f862ab0a6152e` | 5833 |
| `docs/phase-6/08-on-chain-identity-evidence-contract.md` | Protocol-neutral pool/program/mint/vault evidence checker integrated with candidate decoder; live on-chain validation not claimed | `905bff5f2d2239477d6c4c8b6ff665b82e123718` | 6951 |
| `docs/phase-6/09-solana-rpc-account-reader.md` | Bounded read-only getMultipleAccounts transport with context-slot/provenance handling and synthetic mock boundary | `02bf2cd5405d1c3edddc27bf5d727fe33162c9b3` | 4330 |
| `docs/phase-6/10-spl-token-base-state-decoder.md` | Classic SPL Token base-state decoder; Token-2022 extensions remain blocked pending Phase 7 safety review | `e276df7be60e7365fceba63c3e2ee40a8cdf3532` | 4000 |
| `docs/phase-6/11-token2022-extension-tlv-inspector.md` | Token-2022 TLV framing and fail-closed semantic registry; known IDs routed conservatively, unknown/future extensions blocked | `65d7e6486d09b869b409097a82520f56aa4ad8d4` | 3359 |
| `docs/phase-6/12-raydium-cpmm-candidate-decoder.md` | Pinned-source Raydium CPMM PoolState/AMM-config decoder and synthetic-tested integration; real-source gate is documented in the Phase 6.13 runbook | `9ffe95643b4ee264507aadf0b593dca9658082bf` | 5919 |
| `docs/phase-6/13-live-source-validation-runner.md` | Guarded operator runbook for read-only real-source identity validation, approvals, redacted evidence and outstanding Phase 6 exit gates | `fd5d4da8d8163495f83912db99f5c6fc825b74ff` | 7249 |
| `packages/market-data/package.json` | Private canonical market-data workspace with read-only DEX Screener candidate export | `1839c9bd51848baab6a97c0d3b3541527717c2a7` | 452 |
| `packages/market-data/tsconfig.json` | Strict compiler settings for market-data package | `cf9e1b1a27ef4c39a4c724e106ea5d6b7ca0daf2` | 153 |
| `packages/market-data/tsconfig.type-tests.json` | Compile-time market data and DEX Screener adapter regression checks | `4aaed29f53a7a4b128b7309c17c910d67bde21de` | 303 |
| `packages/market-data/src/index.ts` | Canonical schema/freshness/health/replay, provider agreement, identity evidence, RPC/SPL/Token-2022 and Raydium decoder exports | `3af9ed9ea3f3dbc0d9af2fe13cfb7e7d818d3abe` | 54575 |
| `packages/market-data/src/solana-rpc-reader.ts` | Bounded read-only Solana JSON-RPC transport; raw account metadata/data only, with synthetic injected-fetch marking | `e29105356eca64192b2f22daafed66be37a6dd1e` | 15133 |
| `packages/market-data/src/solana-token-account-decoder.ts` | Classic SPL Token mint/account decoder plus Token-2022 TLV structural inspection and fail-closed known/unknown extension policy | `592aabd683d95952c5404f4d5060ebc32980cc0f` | 31135 |
| `packages/market-data/src/raydium-cpmm-decoder.ts` | Pinned-source Raydium CPMM PoolState/AMM-config decoder, raw-public-key-byte PDA derivation and nine-account identity integration | `604c10113232d082f33a2d08856fbaacb1def128` | 44782 |
| `packages/market-data/test/types.test.ts` | Compile-time assertions for Solana-only and explicit data states | `4fee465ab586823c0761d54dba49636c745dc9d4` | 1368 |
| `packages/market-data/src/providers/dex-screener.ts` | Read-only DEX Screener pair adapter with strict normalization, bounded streaming reads and sanitized failures | `da74c2196fa02454ba51afb1933fc1b8640d6fd9` | 15574 |
| `packages/market-data/type-tests/dex-screener.types.ts` | Compile-time-only regression: unit type and absence of signing/transaction methods | `f65c863c913ee63d150000f185e635d7472ab56c` | 593 |
| `test/market-data.test.mjs` | Runtime schema, freshness, provider-health and deterministic replay tests | `3b1930a53f233872edaaeb9d796650d32dc11182` | 8285 |
| `test/fixtures/market-data/replay-v1.json` | Synthetic replay fixtures for fresh/stale/unknown/future/invalid observations | `627f1f637489d1ab1aa647fe4d2964a75fea5b62` | 8394 |
| `test/provider-agreement.test.mjs` | Deterministic tests for independent-source agreement, fallback, stale/unknown data, disagreement and fail-closed outcomes | `7b527d76bd18f24c3f61831b21a42ddc0a00b00d` | 10277 |
| `test/on-chain-identity.test.mjs` | Synthetic tests for account/decoder identity, vaults, allowlist roles, context-slot/commitment, provenance and fail-closed results | `541ce0dc231344ae9fed60aa4c7d357b2a60efe3` | 9890 |
| `test/solana-rpc-reader.test.mjs` | Mocked-only getMultipleAccounts transport tests for request shape, slots, response integrity/size, cancellation, provenance and sanitized errors | `b02888281aa71831aeb346c3d39ababf123b57e0` | 9030 |
| `test/solana-token-account-decoder.test.mjs` | Constructed-byte tests for classic mint/account decoding, exact amounts, option tags, Token-2022 extension boundaries and malformed layouts | `ea640bfe90ce2532231868d3dbf2e0515a06d112` | 9777 |
| `test/token2022-extension-tlv-inspector.test.mjs` | Constructed-byte tests for TLV bounds/termination, known extension routing, unknown/future IDs and wrong account-kind rejection | `8b9336a860ef539555208c6568d6345d29d4fba8` | 9165 |
| `test/raydium-cpmm-decoder.test.mjs` | Constructed-byte and mocked-RPC tests for Raydium CPMM state/config layouts, raw-key PDA seeds, common-slot identity bundle and fail-closed mismatches | `554cdb5dd517108736d7ea2edc83f551766dbb36` | 18971 |
| `test/phase6-live-source-runner.test.mjs` | No-network tests for explicit approvals, HTTPS endpoint policy, indexed-source provenance, provider separation and fail-closed CLI behavior | `d5ff00782dde28f018b515621b0d8d0d0656adc8` | 3667 |
| `test/dex-screener.test.mjs` | Mocked adapter tests: identity, units/precision, timestamps, HTTP failures, streaming bounds and timeout cases | `602fe7a47467320c857bde6cebe863146a9347fd` | 10281 |
| `test/fixtures/market-data/dexscreener-pair-v1.json` | Synthetic DEX Screener pair payload preserving source numeric precision | `e02910c2610b949582e8b7cee99fb1486aa14173` | 909 |
| `.github/workflows/dependency-review.yml` | PR dependency review failing on high/critical findings | `20a8689e5ccf553b6463dbd39d5f78082342c9e4` | 393 |

## Brand assets

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `assets/brand/auto-trading-agent-logo-dark.svg` | Dark-theme logo lockup | `e0c904c7615ddc04b0b5f15f5918d161dc1b96d8` | 1646 |
| `assets/brand/auto-trading-agent-logo-light.svg` | Light-theme logo lockup | `c2e2ced7725f447e82254611029164a2b5456991` | 1647 |
| `assets/brand/auto-trading-agent-mark.svg` | Compact icon mark | `123919897bdbe2b44d94034e7904d8b06ac389a1` | 1088 |
| `assets/brand/auto-trading-agent-3d-hero.svg` | Reusable isometric market-intelligence visual for selective use in UI sections | `8514dae45d21ada33be9dbee56e33b8fabfc8a39` | 8489 |

## Phase 2 completion state
- Phase 2 requirements/specification is complete. Phase 3 is closed for documentation/design handoff. Phase 4 design baseline is locked for handoff; Phase 5 is closed and Phase 6 is active.
- D-030 selective 3D visuals are owner-locked; exact section placement was documented in Phase 4.
- Requirement-to-acceptance mapping is documented; test IDs are specifications and do not claim implementation tests have run.
- Numeric execution-affecting TBDs remain excluded from executable trading scope pending explicit owner approval and tests.
- D-028 adds the initial vector brand identity; D-029 records Phase 2 closure for handoff only.

## Phase 3 status
- Phase 3 is closed for documentation/design handoff at owner direction. The threat model, custody/signing, license/release security, secrets/audit/privacy, verification plan and open-decision register are handed off.
- Open security decisions and unrun verification items remain blockers for dependent implementation/release; no independent audit or production approval is claimed.

## Phase 4 status
- Phase 4 is closed for owner-approved design handoff; the package contains design tokens, portal/runtime IA, core-screen specifications, responsive/accessibility requirements, D-030 selective 3D guide, dark/light SVG concepts and a clickable local HTML prototype.
- The prototype uses illustrative data and has no backend, live data, wallet, payment or order endpoints. Browser/device and automated accessibility verification remain for implementation and QA.

## Phase 5 status
- Phase 5 is closed for engineering-foundation handoff on 29 October 2026 by owner confirmation of repository security settings.
- Phase 5 closeout main-push CI for commit `9b0a8af40a576f97a7859729e4e969dc163ca6a6` passed install, repository validation, typecheck, build/tests, npm audit and Gitleaks: https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40814464474
- The Phase 6 merge commit also passed the same main-push quality/security workflow: https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40816041202
- Phase 5 PR CI evidence includes passing quality and full-history secret-scan jobs for PR #5, #6, #7, #8 and #9. The connected GitHub integration could not read the classic branch-protection endpoint; branch protections are recorded as owner-confirmed.
- The Dependency Review Action has been reintroduced in Phase 6 PR #10 and passed run 40815728124; npm audit remains active.
- Current full-SHA action pins are checkout 7.0.1, setup-node 7.1.0 and Gitleaks v3.0.0. The project-specific root SECURITY.md and Dependabot cleanup are committed.
- No trading, signing, customer portal or payment implementation is part of Phase 5. Mainnet remains unauthorized; numeric-risk and security blockers remain.

## Phase 6 status
- Phase 6 remains active and is not complete. Implemented milestones: provider-neutral canonical market-data foundation (PR #10); fixture-tested DEX Screener read-only candidate (PR #12); deterministic provider agreement/fallback safeguards (PR #13); protocol-neutral identity evidence checker (PR #14); bounded read-only Solana RPC transport (PR #15); classic SPL Token base-state decoder (PR #16); Token-2022 TLV structural inspector and fail-closed extension policy (PR #18); and the pinned-source Raydium CPMM PoolState/AMM-config candidate decoder with raw-account identity integration (PR #19, merged as `c15420b3285a5a0a755c008af52fa5fbc34b195b`).
- Phase 6 validation evidence is deliberately separated: synthetic/mock tests pass CI, Dependency Review, Gitleaks and CodeQL; no production RPC endpoint was contacted by CI and no live on-chain identity validation is claimed. The guarded Phase 6.13 runner and non-network guard tests are implemented, but the runner has not been executed. The Raydium candidate's decoder implementation item is complete, but it remains a protocol candidate, not owner-approved production selection.
- **Outstanding Phase 6 closeout gates:** independently validate the integrated decoder against a known real pool using an owner-approved read-only RPC endpoint; verify deployed program/source compatibility; choose the production RPC/indexed provider(s) and account plans; confirm current endpoint/schema/terms/quota/retention rules and approve a usage budget; verify critical market fields through independent evidence; and test the selected provider's fallback/degraded-mode behavior.
- DEX Screener remains evaluation-only because its mapped market values do not have a trustworthy source-observation timestamp, so freshness stays UNKNOWN. Extension-bearing Token-2022 mint/vault states remain blocked pending Phase 7 review. No production wallet, private key, live signing or mainnet trading is authorized.
- The frozen Roadmap v1.0 phase order remains unchanged.

## Integrity and maintenance
- DOCX/PDF values above are SHA-256 digests of the exact uploaded files; Git blob values are different identifiers.
- Every document edit changes its Git blob SHA. This register was refreshed against source snapshot `daee1721d3b94e6a52c5c0271976e0092d5dee70`; its own blob hash is intentionally excluded.
- This register's own blob hash is intentionally excluded.
- Document presence/approval is not evidence that code is implemented, tests pass, a processor/bank approves the product, legal clearance exists or trading is profitable.
- Public provider limits/prices are dated snapshots and must be confirmed against the chosen account before implementation.
- The frozen Roadmap v1.0 phase order remains unchanged. Reopening D-025 requires explicit owner approval and a dated change request.