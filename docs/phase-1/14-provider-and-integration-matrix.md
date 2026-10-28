# Provider and Integration Matrix

This matrix is a research starting point, not a final vendor commitment. Current endpoint versions, pricing, rate limits, terms and coverage must be checked directly before implementation.

| Candidate | Intended responsibility | Safety-critical? | Design rule |
|---|---|---|---|
| Solana RPC | Account state, token mint/program state, transaction simulation/confirmation and chain queries | Yes | Do not rely on a shared public endpoint for production; define provider redundancy and disagreement rules |
| Helius | RPC and streaming/indexing candidate | Potentially | Evaluate freshness, stream delivery/replay, quotas, provider errors and fallback behavior |
| DEX Screener API | Discovery and pair/market snapshots | No, not sole authority | Use for discovery/analytics, then verify critical mint/pool state independently |
| Birdeye API | Historical and indexed market/holder/wallet analytics candidate | Depends on field | Label source, timestamp, plan/quota and missing coverage; never treat one vendor score as ground truth |
| Jupiter Swap V2 | Aggregated quote/transaction construction and swap execution path | Yes for selected route | Revalidate route, transaction payload, output/slippage limits, program allowlist and signing policy |
| Raydium API/SDK | Direct pool/route data or execution where justified | Yes if selected | Support only explicitly reviewed program/version and pool types |
| PostgreSQL | Canonical ledger, decisions, config/version records and audit | Yes | Transactions, backups, restore tests, idempotency and retention policy required |
| LLM inference provider | Bounded classification, explanation, research hypotheses and post-trade review | No | Treat outputs as untrusted typed suggestions; no credentials or direct execution |
| KMS/HSM/MPC/managed signer | Signer key isolation | Yes | Select only after threat model and test/recovery review |
| CI/security tools | Tests, dependency and secret scanning, build provenance | Yes to release gate | Fail release on agreed severity thresholds and preserve artifacts |

## Data field ownership
- Token authority/extensions: canonical on-chain/program-specific observation where possible.
- Pool existence and reserves: verified account/program state; indexed API may be a discovery hint.
- Price/volume/transaction counts: indexed provider plus freshness and consistency checks.
- Holder distribution: provider/indexed scan with coverage/unknown-holder caveats.
- Buy and sell execution estimates: current route/quote from the selected execution path.
- Actual fill and fees: confirmed transaction and reconciled wallet/account changes.
- Strategy outcome: internal ledger derived from reconciled actual fills, not provider-reported performance.
- Model metrics: internal reproducible evaluation pipeline.

## Required provider evaluation worksheet
For each provider record: endpoint/product, version, auth, rate limits/quota units, cost, data latency and history, supported chain/programs, errors/timeout behavior, retries, terms/license, data retention/redistribution, fallback, health monitor and last-reviewed date.

## Degraded-mode policy
If a data source required for a hard gate becomes unavailable, stale or inconsistent, block new entries. Fallback may restore data availability only after the same schema, freshness and validation checks pass. Never silently substitute a different field meaning or provider price.


## First official source-verification pass — 28 October 2026

A dated detail report is maintained at [26-official-source-verification-report.md](26-official-source-verification-report.md). Public facts below were verified against the linked official sources; they are not final vendor choices.

| Provider | Verified public facts | Current integration position | Open before selection |
|---|---|---|---|
| Solana Kit/RPC | Official TypeScript SDK guidance recommends @solana/kit for new applications. Public mainnet RPC is rate-limited/no-SLA and not for production. Solana fee documentation lists 5,000 lamports per signature plus an optional priority fee. | Kit + generated token/Token-2022 clients are the preferred SDK candidate; public RPC only for dev/test. | Pin exact package versions, evaluate provider redundancy, measure freshness/latency and choose signer backend. |
| Jupiter Swap V2 | Current base path is https://api.jup.ag/swap/v2. Meta-Aggregator is /order + /execute with multiple routing engines; Router uses /build and has more direct instruction control with Metis routing. Public tiers include Free at $0/1 RPS, Developer $25/25M credits/10 RPS, Launch $100/100M/50 RPS and Pro $500/500M/150 RPS. /execute has a separate request bucket. | Quote-only comparison first; no route has been approved for live execution. | Compare route coverage, fees, inspectability, latency, transaction construction, simulation, failures and reconciliation. Confirm account-tier limits. |
| Helius | Public monthly tiers list Free $0/1M credits/10 RPS/1 sendTransaction RPS; Developer $49/10M/50/5; Business $499/100M/200/50; Professional $999/200M/500/100. Streaming/add-ons have separate billing/eligibility. | Evaluate as RPC/streaming provider; free tier only for initial tests. | Measure real credit use, stream volume, regional latency and fallback behavior. |
| Birdeye | Public plan prices appeared as Standard $0, Lite $39, Starter $99, Premium $199 and Business $499. The current public documentation surfaces returned conflicting included-CU/overage values. Token holder endpoint is /defi/v3/token/holder; docs list 35 CU/request. Wallet mode groups token accounts by owner; holder results do not include trade history, PnL or wallet labels. | Evaluate for holder/wallet intelligence and market analytics. | Treat current CU allowance/overage as unverified until confirmed in the account portal or in writing; also verify endpoint access/coverage, holder labels/accuracy, quota/budget and comparison against chain data. |
| DEX Screener | Public API docs list 300 RPM for pair/search/token-pair/token-address endpoints and 60 RPM for profile/boost/ad/order endpoints; token batch supports up to 30 addresses. Published terms are dated 18 Aug 2023 and limit third-party availability/resale in specified cases. | Discovery/market snapshot only; never sole security authority. | Check checkout entitlement/current terms; re-review before redistribution or public/third-party service. |

### Early public-plan cost comparison
One paid plan each at the reviewed entry tiers would total approximately $113/month (Jupiter Developer $25 + Helius Developer $49 + Birdeye Lite $39), excluding hosting, database, LLM, network/DEX fees, overages, stream add-ons, taxes and other providers. This is an illustrative comparison, not a selected budget or requirement to purchase all three. Free tiers may be used for initial non-signing tests, but plan limits do not establish production readiness.

### Source status
Current product/API pages and listed public prices were reviewed on 28 October 2026. The exact account plan, endpoint availability, rate-limit bucket, route behavior, provider terms and real-world latency must be confirmed before implementation. The source report lists references and unresolved decisions.

## Commercial payment provider gate (28 October 2026)

The customer access model is a USD $12,000 proposed one-time lifetime license with no free tier/trial, owner-issued quote/invoice, verified settlement, registration invitation and mandatory owner/admin approval. See [Commercial Access Specification](27-commercial-pricing-access-and-lifetime-license.md) and [Payment Provider Assessment](28-payment-provider-eligibility-assessment.md).

No online checkout provider is approved. Stripe's current supported-country list does not list Pakistan and crypto/financial service categories require review. Paddle's published AUP prohibits crypto trading platforms/trading strategies in relevant categories. Lemon Squeezy explicitly lists crypto-related products as prohibited. The proposed initial method is manual invoice and cleared bank settlement after the business bank and qualified counsel confirm it is permitted. Do not enable online checkout or misdescribe the product to evade provider policy.