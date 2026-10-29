# Document Register — Auto-Trading-Agent

Canonical source artifacts, phase documents, design assets and engineering foundation files. Git blob hashes and byte sizes refer to the tracked main-branch file state before this register refresh.


**Register version:** 2.5  
**Last refreshed:** 29 October 2026  
**Repository:** `hamza131zara/Auto-Trading-Agent`  
**Branch:** `main`  
**Source snapshot before this register refresh:** `a78f5ef38f393f32863ea15b126e36afe7437993`  
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

| Path | Git blob SHA in pre-register snapshot | Bytes |
|---|---|---:|
| `PHASE1-STATUS.md` | Phases 1–4 handoffs closed; Phase 5 PR CI evidence and owner-side gates documented | `c17678839ddb02e1fd93aae4f90884a49d50bdaf` | 7058 |
| `README.md` | Project overview, frozen roadmap, Phase 5 active status and current gates | `ff642a4ace7ac81c09e7b9f06a6993f94b97ed84` | 6678 |

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
| `docs/phase-5/README.md` | Active foundation; main-push baseline and PR CI evidence, current pins and owner-side gates | `9d4108cfd774763429aed56ed8cf7162f0c6a5e9` | 4636 |
| `docs/phase-5/01-repository-structure-and-conventions.md` | Monorepo structure, workspace boundaries and conventions | `5668e0b8b3bcc3e1524aedf639630401f3b71e1c` | 3521 |
| `docs/phase-5/02-environments-and-configuration.md` | Environment isolation and safe configuration policy | `883a4c9137504975a0fa2a0b217673c22f1da473` | 3496 |
| `docs/phase-5/03-ci-cd-and-security-checks.md` | Current full-SHA action pins, CI security checks and owner-side dependency/protection gates | `adb9598d667ba61fbc9fb68a314669f987cb5335` | 3940 |
| `docs/phase-5/04-development-release-and-rollback-runbook.md` | Developer, dependency update, recovery and rollback runbook | `7a616ee2fe36be77cc066e54aecb7598449c1ae2` | 2886 |
| `docs/phase-5/05-phase-5-acceptance-and-open-decisions.md` | CI/PR acceptance evidence, type/config regression checks, and owner-side settings gates | `11fbde27b88b003ab9d24686865d1ba95130c3dc` | 4574 |

## Phase 5 foundation files

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `.nvmrc` | Node 24 development/CI major pin | `a45fd52cc5891570d6299fab38643103c3955474` | 3 |
| `.node-version` | Node 24 runtime declaration | `a45fd52cc5891570d6299fab38643103c3955474` | 3 |
| `.npmrc` | Strict engine handling and exact dependency save policy | `c20257b54d3568173ae7978f5d8215274cbd9c6b` | 57 |
| `.editorconfig` | Consistent text editing conventions | `192c070cf03df5d7af0521a1073c0919cb46f742` | 156 |
| `.gitignore` | Local secrets and generated output exclusions | `ec2ae517f6fd44da1ad3cc8506cd11f7721fdfab` | 137 |
| `.env.example` | Non-secret safe environment defaults; live trading false | `e3da7cd111de243720b72e2982f1146651416937` | 85 |
| `package.json` | Private npm workspace root with compile-time contract type tests in the typecheck script | `90f4b210b6232324cd33f44bc6254023e70adad7` | 835 |
| `package-lock.json` | Lockfile v3 for exact TypeScript 7.0.2 dependency tree | `14e3b3070d3615458ab18a7e973c8c1e19bec5cf` | 13612 |
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
| `scripts/validate-repository.mjs` | Workspace, env-default and common secret-pattern checks | `fea8112f8f8a1812922658911f97f73300c96fc8` | 4684 |
| `test/config.test.mjs` | Runtime config tests: defaults, strict booleans, immutability, no live trading and safe errors | `1c58d60e9a94dd6729d45c85c3fe63a0188ff16f` | 2383 |
| `.github/workflows/ci.yml` | Push/PR CI with reviewed checkout/setup-node/Gitleaks full-SHA pins and full-history scan | `078cc62af33a1ab87a723086e828ee91e1dcc128` | 1521 |
| `.github/dependabot.yml` | Weekly npm and GitHub Actions updates without undefined custom labels | `788d8cfa2830a8dbd2d8e3529f3a755dbd8a9f09` | 258 |

## Brand assets

| Repository path | Coverage/status | Current main-branch Git blob SHA | Bytes |
|---|---|---|---:|
| `assets/brand/auto-trading-agent-logo-dark.svg` | Dark-theme logo lockup | `e0c904c7615ddc04b0b5f15f5918d161dc1b96d8` | 1646 |
| `assets/brand/auto-trading-agent-logo-light.svg` | Light-theme logo lockup | `c2e2ced7725f447e82254611029164a2b5456991` | 1647 |
| `assets/brand/auto-trading-agent-mark.svg` | Compact icon mark | `123919897bdbe2b44d94034e7904d8b06ac389a1` | 1088 |
| `assets/brand/auto-trading-agent-3d-hero.svg` | Reusable isometric market-intelligence visual for selective use in UI sections | `8514dae45d21ada33be9dbee56e33b8fabfc8a39` | 8489 |

## Phase 2 completion state
- Phase 2 requirements/specification is complete. Phase 3 is closed for documentation/design handoff. Phase 4 design baseline is locked for handoff; Phase 5 engineering foundation is active.
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
- Phase 5 is active; the Node 24/npm workspace foundation, exact TypeScript 7.0.2 pin, typed contracts/config parser, compile-time contract regression tests, strict config tests, CI, npm audit, Gitleaks v3 and Dependabot configuration are committed.
- Main-push baseline at commit `31ce3ea97efab31e003a7e0a49747118b0c7c5b4` passed install, repository validation, typecheck, build/tests, dependency audit and secret scan: https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40739952683
- PR-specific CI evidence includes passing quality and full-history secret-scan jobs for PR #5 (run 40809400085), PR #6 (run 40809562729) and combined action refresh PR #7 (run 40809677560).
- Current workflow action pins are checkout 7.0.1, setup-node 7.1.0 and Gitleaks v3.0.0, each pinned by a full commit SHA. The undefined Dependabot labels were removed.
- The separate Dependency Review Action remains deferred because the GitHub dependency graph is not enabled. An authorized owner must enable it in Settings → Security before that gate is reintroduced; npm audit remains active.
- GitHub branch protection/required checks/reviews remain owner-side settings and are not claimed enabled.
- No trading, signing, provider, customer portal or payment implementation is part of this foundation. Mainnet remains unauthorized; numeric-risk and security blockers remain.

## Integrity and maintenance
- DOCX/PDF values above are SHA-256 digests of the exact uploaded files; Git blob values are different identifiers.
- Every document edit changes its Git blob SHA. This register was refreshed against source tree `a78f5ef38f393f32863ea15b126e36afe7437993`; its own blob hash is intentionally excluded.
- This register's own blob hash is intentionally excluded.
- Document presence/approval is not evidence that code is implemented, tests pass, a processor/bank approves the product, legal clearance exists or trading is profitable.
- Public provider limits/prices are dated snapshots and must be confirmed against the chosen account before implementation.
- The frozen Roadmap v1.0 phase order remains unchanged. Reopening D-025 requires explicit owner approval and a dated change request.