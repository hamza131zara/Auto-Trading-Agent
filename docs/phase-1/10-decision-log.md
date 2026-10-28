# Decision Log

This log records product decisions and unresolved questions. Changes to the frozen roadmap require explicit owner approval.

## Accepted baseline decisions
| ID | Decision | Status |
|---|---|---|
| D-001 | Use Roadmap v1.0 dated 20 October 2026 as the frozen project baseline. | Accepted by owner in conversation |
| D-002 | V1 targets Solana spot DEX only. | Accepted baseline |
| D-003 | Limit to one open or unresolved position per running agent/portfolio. Under the locked self-hosted model, each customer's licensed instance enforces this independently; there is no cross-customer global position lock. | Accepted baseline, clarified by D-025 |
| D-004 | Deterministic security and risk rules have veto authority over AI/LLM output. | Accepted baseline |
| D-005 | LLM/agent never receives private keys/seed phrases and cannot initiate unrestricted signing. | Accepted baseline |
| D-006 | Start with documentation approval, then design, build, testing, paper trading and controlled launch. | Accepted baseline |
| D-007 | Quick-compound, trend-capture and high-upside-runner are policies to test, not presumed winners. | Accepted concept |
| D-008 | Kelly sizing is research-only until empirically tested and bounded by independent risk caps. | Accepted concept |

## Proposed decisions needing owner confirmation
| ID | Proposal | Status / question |
|---|---|---|
| P-001 | One operator/admin account for V1. | Confirm during requirements review |
| P-002 | Stop new entries and notify owner when a portfolio milestone is hit. | Confirm expected target-hit workflow |
| P-003 | Initial +6% net full-exit policy is a benchmark, not mandatory for every trade. | Confirm exit-profile policy |
| P-004 | No live trading during documentation, design, build and initial validation phases. | Confirm no exceptions |
| P-005 | Hard rejection if a required security field is unknown/stale. | Set exceptions, if any, only after threat review |
| P-006 | Use a modular monolith initially unless load/reliability testing justifies service separation. | Architecture decision pending |
| P-007 | PostgreSQL is canonical transactional/audit store. | Validate workload and durability needs |
| P-008 | Provider redundancy for safety-critical data, with source provenance and disagreement gates. | Select providers after source review |

## Research questions
- Which token programs and extensions are supported or rejected in V1?
- What measurable thresholds apply to liquidity, price impact, holder concentration, cluster evidence, token age and volume quality?
- Which data sources supply each required field, at what latency/rate limit/cost, and with what licensing?
- Which Jupiter Swap V2 route and transaction workflow is appropriate, and what restrictions are required at signing?
- When should a partial-exit runner be enabled, and what is the maximum residual exposure?
- How are price, equity, costs and target milestones valued when assets are volatile or positions are partially exited?
- What exact drawdown, loss, slippage, transaction-failure and stale-data thresholds trigger entry halt?
- What sample size and performance evidence are sufficient for a strategy/model promotion?
- What jurisdictional, tax and platform terms should be reviewed before operating or offering the product?

## Change protocol
Every decision change records old value, new value, rationale, supporting evidence, affected requirement/test IDs, owner approval and date.

## Additional workflow clarification
| ID | Decision / clarification | Status |
|---|---|---|
| P-009 | Specify a fully automated discovery-to-next-candidate cycle: discover, screen, assess, select, risk-check, quote/simulate, execute only in an authorized mode, monitor, exit, reconcile, record learning evidence, check portfolio goals, then scan again. | Added to Phase 1 draft requirements; owner approval pending |

The workflow clarification elaborates the already frozen automation concept and does not authorize live trading or change the roadmap's phase order. See [16-autonomous-trading-workflow.md](16-autonomous-trading-workflow.md). In particular, the next position cannot start until the prior one is fully reconciled and closed, and the agent must pause when no candidate qualifies or a safety/operational gate fails.


## Roadmap comparison and document approval record
| ID | Decision / record | Status |
|---|---|---|
| D-009 | Owner explicitly approved the existing Phase 1 repository documents on 28 October 2026. | Accepted by owner in conversation |
| D-010 | Compare repository docs with the supplied 22-page Roadmap v1.0 DOCX/PDF and add missing documentation without changing the frozen scope or canonical phase order. | Completed as documentation-only supplement |
| D-011 | Use the source roadmap's exact Phase 0–17 sequence for roadmap references; treat earlier abbreviated numbering as a repository-summary inconsistency, not a baseline amendment. | Accepted alignment |
| D-012 | Add DOC-11 Cost & Operations and DOC-12 Legal/Tax/Service Boundary Review; provider costs and legal/tax applicability remain open until sourced/reviewed. | Added; verification/review remains open |
| D-013 | Use canonical operating-mode labels Observe, Backtest, Paper, Shadow, Live Canary, Live and Halted in the design state machine, mapping older shorthand as aliases. | Added to requirements; design crosswalk required |

The gap-closure documents are listed in the Phase 1 index and roadmap coverage audit. They do not authorize implementation, live signing or mainnet trading. Any changes to risk thresholds, provider selections, legal conclusions or release criteria still require evidence and an explicit decision record.


## Official source-verification pass 1 — 28 October 2026
| ID | Finding / decision record | Status |
|---|---|---|
| D-014 | First official source pass is recorded in 26-official-source-verification-report.md; Solana Kit/RPC/fees, Jupiter Swap V2, Helius, Birdeye holder API/pricing, DEX Screener limits/terms, Supabase MFA, OWASP agentic risks and Pakistan tax/regulatory indexes were reviewed. | Research snapshot committed; revalidation required before implementation |
| D-015 | Public prices suggest an illustrative $113/month sum for Jupiter Developer + Helius Developer + Birdeye Lite, excluding all other costs. This is not a selected budget or commitment to purchase all providers. | Recorded for cost planning; account-specific usage pending |
| D-016 | DEX Screener will be treated as discovery/market data only, not a security/holder source of truth; its published API terms require renewed review before any public/third-party data exposure. | Proposed architecture rule pending owner/provider terms review |
| D-017 | The current FBR index pages inspected in this pass display older consolidated Ordinance/Rules texts than earlier notes implied. | Correction accepted; current tax position remains unresolved pending primary-source review/adviser |

## Provider and numeric-policy decisions still open
- Primary/fallback RPC provider, and measured failover behavior.
- Whether Birdeye's holder endpoint/plan meets required coverage and budget.
- Jupiter V2 path choice (/order + /execute versus /build/submission), after quote-only and signer-inspection tests.
- DEX Screener account plan and acceptable terms for the exact intended private V1; re-review for any public service.
- Provider and LLM budget ceilings and safe quota exhaustion policy.
- Hard token-security, liquidity/exitability, quote-age, slippage/impact, per-position, daily-loss, drawdown and error-breaker thresholds.
- Pre-registered backtest/shadow/paper observation window, sample size, multi-regime coverage and pass/fail metrics.
- Qualified legal/tax review for the actual operating model.

Do not convert any public pricing table or vendor statement into a trading threshold or production approval.

## Commercial model and source-based payment findings — 28 October 2026
| ID | Decision / proposal | Status |
|---|---|---|
| D-018 | Owner requested no free tier/trial and a one-time lifetime license, with quote/invoice, payment first, then registration invitation and mandatory owner/admin approval before access. | Owner-requested requirement recorded |
| D-019 | USD $12,000 is the proposed standard lifetime-license price; quoted terms define actual amount/currency, service-lifetime meaning, inclusions, exclusions, usage limits and refund/dispute terms. | Proposed price; publish only after owner and legal review |
| D-020 | Customer-facing commercial distribution will use self-hosted, customer-isolated licensed software, not hosted multi-tenant trading SaaS. Each licensed running instance has its own portfolio and one-position limit. | Locked by owner on 28 October 2026; see D-025 |
| D-021 | Initial payment path: owner-issued invoice and manually verified cleared bank settlement. No online checkout provider has been approved for this product/seller location. | Proposed; bank/provider/counsel must confirm eligibility |
| D-022 | Stripe is not selected: public supported-country list reviewed does not list Pakistan and crypto/financial businesses require restricted-business underwriting. | Source-reviewed, no account eligibility conclusion |
| D-023 | Paddle and Lemon Squeezy are not selected by default: published policies appear to prohibit cryptocurrency trading platform/trading-strategy or crypto-related products of this type. | Source-reviewed; do not integrate absent explicit written approval |
| D-024 | Core licensing has no recurring subscription, trial, free operational account or unpaid override. Payment and admin approval are independent access requirements. | Owner-requested rule, documented in CR-001 |

## Source verification correction
The current Birdeye pricing page returned conflicting quota/overage values between its rendered page and more recent indexed result. Base plan prices appeared consistent, but included compute-unit quotas/overage should be treated as **unverified** until confirmed in the actual provider portal or in writing. Do not budget or select a plan based on stale values.

## Commercial scope amendment
See [CR-001 — Commercial Scope Amendment](29-commercial-scope-amendment.md). This request adds paid customer access to the original product roadmap without changing the canonical phase order or authorizing public sales/live trading. The owner has now locked self-hosted, customer-isolated licensed software; the central portal handles payment/license/approval, while each customer runs a separate agent instance and controls their own environment and wallet. See D-025.

## Remaining Phase 1 close-out items
- Deployment model is locked by D-025: self-hosted, customer-isolated licensed software; one open/unresolved position per running licensed instance. Remaining design questions are license activation/update mechanics, customer installation requirements, wallet/signer isolation and payment/legal launch gates.
- Obtain written bank/payment institution confirmation for the invoice/settlement process and counsel review of the service classification/refund and tax terms before accepting public payments.
- Select provider plans after account-specific rate/term/usage verification.
- Pre-register quantitative and paper/shadow pass criteria before test runs.


## Locked deployment decision — D-025 (28 October 2026)
| ID | Decision | Status |
|---|---|---|
| D-025 | Use self-hosted, customer-isolated licensed software for V1. No hosted multi-customer trading SaaS. The central portal handles quotes/invoices, verified payment records, registration invitations, owner/admin approval, signed license issuance and authorized downloads/updates only. Each customer runs an isolated instance in their own or dedicated environment with their own provider credentials, wallet/signer, risk policy, ledger and configuration. One open/unresolved position per running instance. No free tier/trial; proposed $12,000 one-time lifetime license; payment verified before invitation and admin approval before activation. | **LOCKED by explicit owner instruction on 28 October 2026** |

### Implications of D-025
- CR-001's prior proposed hosted multi-tenant model is superseded.
- Do not build a central hosted trading runtime, shared portfolio database/worker, global cross-customer position lock or pooled wallet for V1.
- The central license portal must never request/store private keys or seed phrases or exercise arbitrary signing authority.
- Signed license token design, instance binding, online/offline validation/grace behavior, update signing, license transfer/reinstall, customer support boundary and install requirements remain Phase 2 design work.
- Customer-specific infrastructure, RPC/market-data/LLM services, trading capital and execution/network fees are customer-paid unless the quote explicitly includes a separately reviewed item.
- The frozen Roadmap v1.0 phase order does not change. Online payment processor, bank eligibility and legal/tax review remain external pre-sale gates.
