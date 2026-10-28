# Document Register and Version Integrity

**Register version:** 1.4  
**Snapshot date:** 28 October 2026  
**Repository:** `hamza131zara/Auto-Trading-Agent`  
**Branch:** `main`  
**Main tree SHA represented by listed hashes:** `2a1616e09c6b8e19d729316f1476fe742363482b`  
**Canonical product baseline:** *Solana Autonomous DEX Trading Agent — Roadmap v1.0*, dated 20 October 2026.  
**Commercial amendment:** CR-001, owner-requested 28 October 2026; see `docs/phase-1/29-commercial-scope-amendment.md`.

## Status definitions
- **Owner-approved core:** the owner stated that the existing repository documents had been read and approved.
- **Supplemental:** new material from roadmap comparison, source verification or the commercial access request.
- **Open verification:** depends on account-specific plan/terms, payment/bank underwriting, numerical policy choices, scope confirmation or qualified legal/tax review.
- **Frozen baseline:** canonical roadmap scope/phase order remains source-controlled; amendments are recorded separately and must not silently rewrite the original.

## Canonical source files supplied by owner

| Source artifact | SHA-256 of exact uploaded file | Status |
|---|---|---|
| `Solana_Dex_Agent_Roadmap_v1(1).docx` | `0693db897929b8d9aa80fcb4acce6ee8752df0f7c6f3c88893f525b4f9aa9df7` | Frozen baseline source; hash recorded from uploaded bytes |
| `Solana_Dex_Agent_Roadmap_v1(1).pdf` | `108c8a5ca56e38810c604765ff90f5b412af155696651a1143f240369528437c` | Same frozen baseline; hash recorded from uploaded bytes |

The binary DOCX/PDF are not committed in Git at this snapshot. The repository holds a Markdown companion and phase map.

## Root entry points

| Path | Git blob SHA | Bytes |
|---|---|---:|
| `PHASE1-STATUS.md` | `31bc267d73c8168f3f33501ffa9dd33810c32fa2` | 4018 |
| `README.md` | `731ab3d8ea9b7167d1eb2f46137e393753cd00b2` | 4346 |

## Phase 1 document snapshot

The SHA shown is Git's blob object SHA, not a SHA-256 digest of plain file contents. The register file itself is excluded to avoid a self-referential hash.

| Repository path | Coverage/status class | Git blob SHA | Bytes |
|---|---|---|---:|
| `docs/phase-1/01-product-charter.md` | DOC-01 / product charter | `fc431eb400875d3bbdfc3b8bb0094338cf4ad4a7` | 6179 |
| `docs/phase-1/02-functional-requirements.md` | DOC-01 / requirements + access | `85ade3c8e12ae6402c19506c54de69c599ac3b36` | 15209 |
| `docs/phase-1/03-trading-and-exit-policy.md` | DOC-02 / trading policy | `d13967eb61efc5008e5fb98cf8ec72a7968835f2` | 6857 |
| `docs/phase-1/04-token-security-risk.md` | DOC-04 / token security | `7cc450bf743c4d793796e745c65cf38aaf93f699` | 3905 |
| `docs/phase-1/05-quantitative-methodology.md` | DOC-03 / quantitative methods | `2c1e0f35fb65701743dfad981109d8724236d733` | 4022 |
| `docs/phase-1/06-architecture-and-data-sources.md` | DOC-05 / architecture/data | `643a14d0a46ff3c164e278abc16217bc64488638` | 5050 |
| `docs/phase-1/07-security-privacy-and-operations.md` | DOC-07 / security operations | `d1f33edd49e23f8cdaa225095cbbd276c3ab01c0` | 3832 |
| `docs/phase-1/08-data-dictionary-and-audit.md` | data dictionary/audit/tenant | `32a65f46b452aa3a2ce943705c8bcf7429cc5c69` | 6229 |
| `docs/phase-1/09-test-plan-and-acceptance.md` | DOC-10 / testing | `ca8e0c1a122c7e56e0987b5e1dc8a2ea1353acc3` | 6301 |
| `docs/phase-1/10-decision-log.md` | decision/approval log | `31784f5b497d4f7adfd63a44cb170daf503af264` | 10946 |
| `docs/phase-1/11-requirements-traceability.md` | requirements traceability | `8e6d47527829cf34f6ac4e7ab20e5bd82a127abc` | 5656 |
| `docs/phase-1/12-dashboard-pages-and-operator-controls.md` | DOC-09 / dashboard + commercial flows | `a7dd1583b7f946d228a541c2aac4df945792fd86` | 12456 |
| `docs/phase-1/13-tooling-and-technology-decisions.md` | technology decisions | `9c19e976ab985e32f41dd20ec4c6a96d136ed654` | 5607 |
| `docs/phase-1/14-provider-and-integration-matrix.md` | DOC-05 / provider matrix | `fee394995c498d6289294ff188afb1ded2e78b9d` | 8280 |
| `docs/phase-1/15-threat-model-and-risk-register.md` | DOC-07 / threat model | `6f5578573829e4df2e5982f39436438a820c2441` | 6552 |
| `docs/phase-1/16-autonomous-trading-workflow.md` | DOC-02/06/08 / autonomous loop | `230370cb1c7965086fdecad4590bd523dbcd334d` | 15649 |
| `docs/phase-1/17-roadmap-coverage-audit.md` | roadmap coverage + commercial addendum | `c4aa2e84e88e1f06a72b68d5f45769fba124ae08` | 11436 |
| `docs/phase-1/18-indicators-formulas-and-units.md` | DOC-03 / formulas and units | `e2d3b265a511279cc5428693997696cff1c17b35` | 8727 |
| `docs/phase-1/19-agent-brain-and-memory-spec.md` | DOC-06 / brain and memory | `69f76d34508204887aae0a4bcc159db9073e07e5` | 6893 |
| `docs/phase-1/20-execution-reconciliation-and-signer-contract.md` | DOC-07/08 / execution/signer | `6b4899439ab7e54b54599a94949fd0ec20a8b150` | 5714 |
| `docs/phase-1/21-cost-and-operations-plan.md` | DOC-11 / costs and lifetime unit economics | `b3e6106cffed584b62510bf823cf9a59421bdc98` | 9504 |
| `docs/phase-1/22-legal-tax-and-service-boundary-review.md` | DOC-12 / legal/tax review | `4b9c2e0ca657842354797b01108f826df9a1457c` | 7307 |
| `docs/phase-1/23-shadow-canary-launch-and-post-launch-governance.md` | DOC-10 / launch governance | `70ae05e3fa072e02124fc71913f7975be29cd5ea` | 8800 |
| `docs/phase-1/24-canonical-phase-map-and-repository-structure.md` | canonical phases/repository + commercial module | `05aedb5e2f88851c60e8a4fda0d37b23d105a005` | 7427 |
| `docs/phase-1/25-canonical-dashboard-page-crosswalk.md` | DOC-09 / canonical dashboard crosswalk | `3601e5145dd8d67350c31ef9a85cf49d4125893d` | 6520 |
| `docs/phase-1/26-official-source-verification-report.md` | official source verification + payment assessment | `31d79888cd03432609ff5678a529df41c102e35a` | 20233 |
| `docs/phase-1/27-commercial-pricing-access-and-lifetime-license.md` | CR-001 / price, payment, signup, admin approval | `e4e7fd6f1ab87a1eb31b87506ffa012194323575` | 11390 |
| `docs/phase-1/28-payment-provider-eligibility-assessment.md` | CR-001 / payment provider eligibility | `d4713e4934a2050f4c9fd744cc57de021574bff7` | 6108 |
| `docs/phase-1/29-commercial-scope-amendment.md` | CR-001 / scope amendment | `308a01fa33448239d2a9ceb14dbae14607a0e8c1` | 4164 |
| `docs/phase-1/README.md` | Phase 1 index | `6efb6d7f630642d524e46eb733d4ab1e63f8b30e` | 8790 |
| `docs/phase-1/SOURCES.md` | official source register | `95dd96929939ff766225fa0cf5eabefb82d842ca` | 9465 |

## Roadmap companion snapshot

| Repository path | Git blob SHA | Bytes |
|---|---|---:|
| `docs/roadmap/ROADMAP-BASELINE.md` | `c8cec8ce1a3247aadc8897ba6f1fef27153c7692` | 3265 |
| `docs/roadmap/ROADMAP-CANONICAL-PHASE-MAP.md` | `aea4de6392fdae9127c440735f25ebc99995e151` | 5899 |
| `docs/roadmap/Solana_Dex_Agent_Roadmap_v1.md` | `26c9d47124e1e630147c39058da0484bda88f3ca` | 12657 |

## Commercial scope status
- No free tier or free trial; proposed standard price USD $12,000 one-time lifetime license; no recurring core subscription.
- Access is payment verified → registration → owner/admin approval → active license/tenant.
- No automated online checkout provider is approved; initial proposal is an owner-issued invoice with manually verified cleared bank settlement, subject to bank/legal confirmation.
- A paid hosted multi-tenant service is a scope amendment. Proposed one open/unresolved position per customer workspace is a blocking owner confirmation before Phase 2 design.
- Public sales require separate payment/banking/product-category underwriting and qualified legal/tax/service-boundary review. Documentation does not constitute such approval.

## Integrity and maintenance rules
- DOCX/PDF values are SHA-256 digests of uploaded source files, not Git blob IDs.
- Git blob values apply to the tree SHA above. Every subsequent edit changes the relevant blob.
- This register intentionally excludes its own hash. Refresh it after each controlled documentation release.
- A document's presence/approval is not evidence of implemented code, passing tests, processor/bank eligibility, regulatory clearance or profitability.
- Public provider limits/fees may change. The report records a dated public snapshot; confirm account-level entitlements before implementation.
- Roadmap scope/phase order remains frozen unless the owner explicitly approves a dated change.