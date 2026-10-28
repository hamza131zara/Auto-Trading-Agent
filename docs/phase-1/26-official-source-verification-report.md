# Phase 1 — Official Source Verification Report (Pass 1)

**Reviewed:** 28 October 2026  
**Repository:** hamza131zara/Auto-Trading-Agent  
**Purpose:** Record the first source-verification pass required by frozen Roadmap v1.0. This is a dated research snapshot, not a permanent provider selection or authorization to trade live.

## Executive result

The official documentation pass supports this provisional architecture:
- Use Solana RPC and account/program decoding as the on-chain source of truth; use a production RPC provider instead of public mainnet RPC.
- Use DEX Screener as a low-cost discovery/pair-market feed only, not as a token-security or holder-concentration authority.
- Evaluate Birdeye for holder/wallet distribution and indexed analytics; verify key security fields against chain state and disclose holder/label coverage.
- Evaluate Helius as primary/secondary RPC and streaming candidate; select a plan only after measuring workload.
- Evaluate both Jupiter Swap API V2 paths in quote-only/simulation tests before choosing an execution mode.
- Use separate application authentication/MFA enforcement and server-side authorization; an MFA UI alone does not secure protected APIs.
- Keep provider values, plans and terms under dated revalidation.

**Not yet verified:** final account-level quotas, actual endpoint availability on selected plans, latency in our deployment region, outage/replay behavior in our application, redistribution/commercial rights for any public product, selected signing backend, and quantitative trading thresholds. Numeric token/risk thresholds remain open until research and owner approval.

## 1. Source matrix

### Solana SDK and RPC
**Official sources**
- TypeScript SDK: https://solana.com/docs/clients/official/javascript
- Frontend/Kit client: https://solana.com/docs/frontend/client
- RPC: https://solana.com/docs/rpc
- Fees: https://solana.com/docs/core/fees
- Token-2022: https://solana.com/docs/tokens/extensions

**Verified facts**
- Solana's current official TypeScript guidance recommends the @solana/kit SDK and generated program clients, including Token and Token-2022 clients. The docs describe legacy @solana/web3.js as legacy/maintenance and recommend Kit for new applications.
- The current frontend Kit guide references Kit v7+ and Kit plugin packages 0.13+; exact package versions still need pinning at implementation time.
- Solana states public RPC endpoints are rate-limited, have no SLA and are unsuitable for production payment flows. They are for development/testing; production should use a provider endpoint.
- Network transaction fees have a base fee and optional prioritization fee. The current fee page lists 5,000 lamports per signature and the priority fee formula based on compute-unit price and compute-unit limit.

**Design consequence**
Use Kit-compatible program clients and integer base units. Use public RPC only for development or controlled experiments. For later live-capable environments, select a production RPC topology with redundancy, freshness checks and reconciliation. Keep signer/key management as a separate threat-model decision.

**Status:** Public docs verified; exact package versions, provider topology and signer choice pending.

### Jupiter Swap API V2
**Official sources**
- Swap overview: https://dev.jup.ag/docs/swap
- V2 order/execute: https://developers.jup.ag/docs/api-reference/swap/order
- Rate limits: https://developers.jup.ag/docs/portal/rate-limits
- Pricing: https://developers.jup.ag/pricing

**Verified facts**
- Base API path is https://api.jup.ag/swap/v2.
- The Meta-Aggregator path is GET /order plus POST /execute. Documentation says routing engines compete, including Metis, JupiterZ RFQ, Dflow and OKX. The /order endpoint can return a quote and assembled transaction; /execute handles managed landing and confirmation/error reporting.
- The Router path uses GET /build and transaction submission through Jupiter's documented submission route or the integrator's own pipeline. It provides raw instructions/more transaction control and uses Metis routing only. Do not assume the two paths have identical route coverage, fees or signing requirements.
- Public rate-limit documentation lists Keyless 0.5 RPS/30 RPM, Free 1 RPS/60 RPM, Developer 10 RPS/600 RPM, Launch 50 RPS/3,000 RPM and Pro 150 RPS/9,000 RPM. The /swap/v2/execute endpoint has a separate bucket: Keyless 20 RPS, Free 50 RPS, paid tiers 100 RPS.
- Public monthly plan page lists Free at $0/1 RPS, Developer at $25 with 25M credits/10 RPS, Launch at $100 with 100M credits/50 RPS, and Pro at $500 with 500M credits/150 RPS; overage is listed at $1 per million credits on paid plans. Verify the selected account's current entitlements in the portal before relying on them.
- The /order response includes amounts, fee and route details. The /execute response distinguishes wallet-reflected total input/output from route input/output; preserve and reconcile actual wallet totals and on-chain effects.

**Design consequence**
Begin quote-only. Compare /order + /execute and /build using saved quotes, route visibility, signer inspection, fee breakdown, minimum output, transaction expiry, allowed instructions, simulation support and actual failure/reconciliation behavior. Do not choose a path solely on headline price. Require independent transaction parsing and policy validation before the isolated signer. Test 429 handling using response headers/backoff.

**Status:** Current official surface and listed public tiers reviewed; route choice and actual account quota pending. Prices/limits can change.

### Helius RPC and streaming
**Official sources**
- Pricing: https://www.helius.dev/pricing
- RPC docs: https://docs.helius.dev/
- Solana RPC nodes: https://www.helius.dev/solana-rpc-nodes/

**Verified public monthly plan snapshot**
| Plan | Listed monthly price | Included credits | RPC requests/sec | sendTransaction/sec |
|---|---:|---:|---:|---:|
| Free | $0 | 1M | 10 | 1 |
| Developer | $49 | 10M | 50 | 5 |
| Business | $499 | 100M | 200 | 50 |
| Professional | $999 | 200M | 500 | 100 |
| Enterprise | Custom | Custom | Custom | Custom |

Public pricing also lists $5 per additional million credits on paid plans, getProgramAccounts at 10 credits (getProgramAccountsV2 is documented separately), and LaserStream bandwidth/add-ons. The page lists data add-ons starting at $400/month and higher fixed tiers for additional data volumes. Check the current billing page for method/stream-specific credits and plan eligibility.

**Design consequence**
Use the free plan only for early development/adapter evaluation. Load-test actual methods and streaming before buying a plan. Separate rate-limit buckets such as sendTransaction and program-account queries; instrument credit usage and keep a fallback provider. Do not assume marketing latency comparisons apply to our deployment region.

**Status:** Public plan table verified; actual consumption, service level, streaming quota and fallback provider selection pending.

### Birdeye market and holder analytics
**Official sources**
- Pricing: https://docs.birdeye.so/docs/pricing
- Token holder endpoint: https://docs.birdeye.so/reference/get-defi-v3-token-holder
- API documentation: https://docs.birdeye.so/

**Verified public pricing snapshot**
| Plan | Listed monthly price | Included compute units | Listed rate limit | Access summary |
|---|---:|---:|---:|---|
| Standard | $0 | 30,000 | 1 RPS | Limited |
| Lite | $39 | 1.5M | 15 RPS | Most APIs |
| Starter | $99 | 5M | 15 RPS | Most APIs |
| Premium | $199 | 15M | 50 RPS | Most APIs + WebSockets |
| Business | $499 | 60M | 100 RPS | All APIs + WebSockets |
| Business B-15 | $899 | 150M | 150 RPS | All APIs + WebSockets |

The public pricing page lists separate overage rates by plan; review that page at purchase time.

**Verified Token - Holder endpoint behavior**
- Endpoint: GET https://public-api.birdeye.so/defi/v3/token/holder.
- Official docs describe 35 compute units per request.
- It returns top holders for Solana tokens. mode=token_account produces one row per token account; mode=wallet groups token accounts by owner wallet. Use wallet mode for owner-level concentration to avoid counting multiple token accounts as independent owners.
- get_holder_infos=true works only in wallet mode and adds net worth, SOL balance and funding context.
- Pagination allows a limit up to 100 and offset up to 10,000. The docs state holder results are balances, not trade history, PnL or wallet labels.
- The 30,000-CU Standard plan would support at most about 857 requests of this endpoint alone in a month at 35 CU/request, before other endpoints and overhead. This is an arithmetic ceiling, not an entitlement guarantee or recommended usage plan.

**Design consequence**
Use the provider for candidate triage and richer holder snapshots, but store snapshot time, mode, returned coverage and unknown labels. Use wallet mode for wallet concentration. Do not infer identity or fraud solely from address relationships. Cross-check token program, mint state, pool state and selected critical facts using RPC/on-chain data.

**Status:** Endpoint and public plan table verified; endpoint access/coverage on selected plan, latency, holder-label quality and budget pending.

### DEX Screener discovery and pair data
**Official sources**
- API reference: https://docs.dexscreener.com/api/reference
- API terms: https://docs.dexscreener.com/api/api-terms-and-conditions
- FAQ: https://docs.dexscreener.com/

**Verified API documentation**
- Pair lookup, token-pair lookup, search and token-address batch endpoints are listed at 300 requests/minute.
- Latest token profiles, community takeovers, ads, boosts and paid-order checks are listed at 60 requests/minute.
- Token batch route accepts up to 30 comma-separated token addresses.
- Pair responses can include chain/pair/token addresses, price, volume, price changes, liquidity, FDV/market cap, pool creation time, links and boosts. These are useful for discovery; they do not replace direct token-program/authority or holder ownership validation.
- The FAQ describes the API as free, while API terms refer to free and paid API versions whose limits are set during checkout. Exact current plan price/entitlement was not established from the public endpoint reference; check at account/checkout.
- The published API terms are dated 18 August 2023. They permit commercial use subject to restrictions but prohibit making the API services/portions available to third parties for unauthorized purposes and allow access suspension/termination. Re-check current terms and obtain a suitable agreement before exposing data through a public product.

**Design consequence**
Use DEX Screener for discovery and pair/market snapshots only. Respect endpoint-specific limits, deduplicate returned pools, preserve pair creation/source timestamps where present, and verify every candidate through on-chain/security checks and sell-side quotes. Do not assume public SaaS redistribution rights.

**Status:** Endpoint fields/limits and published terms reviewed; account-level pricing and future third-party usage rights pending.

### Authentication and agent security
**Official sources**
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- PostgreSQL Row-Level Security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html
- OWASP Top 10 for Agentic Applications 2026: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- NIST AI RMF: https://www.nist.gov/itl/ai-risk-management-framework
- NIST SSDF: https://csrc.nist.gov/pubs/sp/800/218/final

**Verified points**
- Supabase supports JWT-based authentication and MFA flows. Its docs emphasize that MFA must be enforced in application/server/API/database authorization, not merely presented in a UI.
- AAL claims can be used in server-side/database policies to distinguish basic authentication from an MFA-verified session.
- OWASP publishes its Top 10 for Agentic Applications 2026 as an agent-risk reference; use it as a threat-review checklist, not a compliance certificate.

**Design consequence**
Use one authenticated operator initially, server-side authorization and MFA/step-up confirmation for Live Canary/Live, risk changes, signer changes and strategy promotion. If Supabase is selected, test session assurance and RLS/API enforcement explicitly. Never place secrets or signing authority in LLM context.

**Status:** Official security guidance verified; final auth provider and implementation policy pending.

## 2. Public price comparison and early budget implication

As listed on reviewed public pages on 28 October 2026:
- Jupiter Developer: $25/month.
- Helius Developer: $49/month.
- Birdeye Lite: $39/month.
- **Illustrative sum: $113/month** for one paid plan of each, before hosting, database, LLMs, taxes, overages, streaming add-ons, execution/network fees and any additional providers. This is not a final budget or a requirement to buy all three.

Low-cost early prototyping can start with free tiers and quote-only/non-signing mode, but quotas are constrained. A free plan is not proof of production suitability.

## 3. Legal/tax source caveat discovered during verification

- PVARA's official regulatory page currently lists the Virtual Assets Act, 2026 and regulatory documents. This establishes that a current official regulatory framework is published, but does not decide whether this exact private own-capital agent is a regulated service.
- The FBR Income Tax Ordinance index page opened during this pass displayed consolidated texts amended through 30 June 2024; the FBR Income Tax Rules index displayed a version amended through 24 November 2023. Those landing pages do not support the earlier statement that those same pages provide consolidated versions through 2026. Current amendments must be obtained and reviewed separately with qualified advice.
- Do not hard-code a tax rate or claim regulatory clearance. DOC-12 remains an open issue register pending a qualified adviser review of the actual operating model and current primary legislation.

Sources:
- PVARA: https://pvara.gov.pk/regulations
- FBR Ordinance index: https://www.fbr.gov.pk/Categ/Income-Tax--Income-Tax-Ordinance/326
- FBR Rules index: https://www.fbr.gov.pk/categ/income-tax-rules-2002/335

## 4. Open decisions to record next

1. Choose primary RPC and independent fallback after a measured read/stream/reconcile workload.
2. Decide whether Birdeye holder mode/plan fits candidate scan and snapshot budget; define required holder coverage.
3. Choose Jupiter V2 path only after quote-only execution-spike results: route coverage, transaction inspectability, fees, latency, failure handling and reconciliation.
4. Decide whether DEX Screener terms are acceptable for intended private V1; re-review before any third-party/public access or data redistribution.
5. Record plan ceilings and safe quota-exhaustion behavior.
6. Choose auth/signer architecture through threat-model and prototype tests, not brand preference alone.
7. Confirm current legal/tax treatment with qualified advice; the available FBR landing indexes are not current consolidated proof.
8. Define quantitative security/market/risk thresholds and evaluation gates before backtesting or shadow evaluation; do not infer them from provider pricing pages.

## 5. Release boundary

This is a source-verification snapshot only. It does not select a final trading strategy, approve numeric thresholds, authorize a production wallet, permit mainnet signing, or declare the system profitable or legally cleared.