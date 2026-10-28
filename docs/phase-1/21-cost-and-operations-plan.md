# DOC-11 — Cost and Operations Plan

**Status:** Requirements template; provider plans and numeric ceilings require owner approval after current official pricing/terms are reviewed. No vendor price is assumed here.

## 1. Cost principles
- Keep Phase 1 and paper/shadow environments low-cost.
- Purchase only data/compute capacity with a documented requirement and measurable benefit.
- Preserve security-critical checks even when approaching a cost ceiling. Degrade optional LLM analysis or research throughput before compromising mandatory safety controls.
- Distinguish operating expenditure from trade-level execution cost and realized trading loss.
- Every estimate records provider/product/plan, date checked, usage unit, allowance/quota, overage, taxes where applicable and fallback option.

## 2. Budget categories
1. RPC and streaming (requests, subscriptions, stream units, archival/history and overage).
2. Market-data/analytics APIs (discovery, price/volume, holder/wallet analytics, historical data and per-endpoint quotas).
3. Execution infrastructure (quotes, swap/transaction API calls, simulation, priority fees and failed-transaction fees).
4. LLM/model usage (input/output tokens, cached input if applicable, parallel questions, retries, summaries and batch jobs).
5. Hosting/runtime (dashboard/API, background workers, storage, egress, domains/TLS and environments).
6. Database/backup (compute, storage, retention, backup copies, restore testing and analytics).
7. Security/signing (KMS/HSM/MPC or managed signer usage, authentication/MFA, secret manager and security scanning).
8. Observability/alerts (logs, metrics, traces, retention, monitoring, notification delivery and incident handling).
9. Development/release (CI minutes, artifact storage, staging environments, independent security review and penetration testing).
10. Legal/accounting/operations (qualified legal/tax review, operational support, record retention and periodic reviews).

## 3. Provider usage model
Estimate activity for each mode and profile:
- candidates discovered per minute/hour/day;
- data calls per candidate and fields required for security vs optional scoring;
- shortlisted candidates and buy/sell quote counts per shortlisted candidate;
- snapshot frequency for open position and watchlist;
- holder/deployer/wallet-cluster query frequency and historical backfill needs;
- stream subscriptions, reconnects and replay volume;
- execution/failed-transaction reconciliation queries;
- LLM calls per decision, number of parallel questions, tokens/request and post-mortem frequency;
- expected retries, provider rate-limit responses and failover overhead.

Avoid fetching premium holder/security data for every newly discovered token if a cheaper deterministic first filter can safely reduce the set. This optimization must never remove a required security gate before a candidate is eligible to trade.

## 4. Core calculators
### Monthly provider cost
Monthly provider cost = fixed plan cost + sum(usage units × applicable unit rate) + overage + applicable taxes.
If usage is credit-based, model credit consumption by endpoint and verify quotas/overage terms.

### LLM cost
For each model/endpoint:
Model cost = input tokens × input rate + output tokens × output rate + other billed units/retries.
Use current vendor pricing and real instrumented token counts; do not assume cached/batch pricing applies unless confirmed.

### Run-rate
Monthly run-rate = RPC + market data + LLM + hosting + database/backup + security/signing + monitoring + CI + operational/review allowance.
Report fixed and variable components separately.

### Cost per candidate and completed round trip
- Cost per screened candidate = attributable data/compute/LLM cost divided by candidates screened.
- Cost per completed round trip = attributable trading infrastructure cost divided by fully reconciled round trips, reported separately from network/DEX/price-impact costs charged to the trade.
- Show how costs vary with rejection rate and number of candidates; the agent may be unprofitable at small position sizes even if gross signal performance looks positive.

### Trade-level execution costs
Use actual confirmed entry/exit amounts and fee records to calculate DEX/aggregator/provider fees, network/priority fees, transfer fees, realized impact/slippage and failed transaction costs. Do not double-count impact already reflected in realized proceeds.

## 5. Budget governance
Before each environment is enabled, configure:
- monthly total operations ceiling;
- per-provider ceiling and quota alert thresholds;
- monthly LLM ceiling;
- per-candidate or per-decision optional-model budget;
- transaction fee ceiling and per-trade maximum execution-cost ratio;
- emergency reserve for provider failover/incident work;
- owner responsible for budget changes.

Recommended alert stages are 50%, 75%, 90% and 100% of a configured budget; these are proposed defaults, not locked limits. At a ceiling, pause optional expensive analysis and notify. If required safety data cannot be obtained within the budget, block new entries instead of skipping the check.

## 6. Operational model
- Keep local, test, paper, shadow and live configuration/secrets separated.
- Monitor provider uptime, request/error rates, quota exhaustion, data freshness, stream/RPC lag, p50/p95 latency, queue age, database lag, signer health, transaction unknown/failure rates and audit persistence.
- Implement backup and restoration drills for the ledger, approved policies and configuration; caches are not the financial source of truth.
- Define owner/on-call responsibilities, alert channels, retention, escalation, incident note taking and post-incident review.
- Reconcile wallet and open position after restarts and provider failover.
- Record recurring cloud/data costs and actual execution fees in monthly operating reports.

## 7. Cost operations acceptance
- Provider matrix contains current plan, prices/quotas/terms and last-reviewed date for each selected integration.
- A request-volume worksheet estimates normal, peak and incident/failover activity.
- Budget alerts and safe behavior at quota/budget limit are tested.
- Required security checks never silently downgrade due to cost.
- The application can export a monthly cost report separating operating costs, execution costs and trading PnL.

## 8. First public provider pricing snapshot (28 October 2026)
See [official source verification report](26-official-source-verification-report.md) for source URLs, limits and caveats.

| Provider plan | Publicly listed price | Public included usage/rate summary | Status |
|---|---:|---|---|
| Jupiter Developer | $25/month | 25M credits; 10 RPS main API bucket; separate /swap/v2/execute bucket | Public listing verified; actual account quota pending |
| Helius Developer | $49/month | 10M credits; 50 RPC RPS; 5 sendTransaction RPS | Public listing verified; actual use/stream billing pending |
| Birdeye Lite | $39/month | 1.5M CUs; 15 RPS; most APIs | Public listing verified; exact endpoint access/usage pending |
| DEX Screener | Public docs describe free API and refer to paid entitlements at checkout | 300 RPM for pair/search/token endpoints; 60 RPM for profile/boost/ad/order endpoints | Account-tier price not established from public reference; check terms and checkout |

An illustrative sum for Jupiter Developer + Helius Developer + Birdeye Lite is $113/month before other costs. It is not the final plan selection or total-cost forecast. Free plans can support limited early non-signing prototyping, but free access does not prove production suitability. Record plan-specific quotas and billing data from the actual selected accounts before a budget is approved.

## 9. Lifetime-license unit economics (CR-001)
The proposed USD $12,000 one-time license cannot be treated as pure margin: it may fund hosting, RPC/data plans, LLM inference, security operations, support, payment fees, refunds/chargebacks and lifetime service obligations.

Model per acquired license:
- Net one-time revenue = settled license amount - payment/bank fees - applicable taxes - refunds/chargebacks expected under the documented terms.
- Lifetime vendor cost = expected retained support years × annual licensing-portal hosting, license/download security, release signing, software maintenance/security updates, support, incident handling and any provider/data/LLM usage explicitly included in the license. Customer self-hosting, customer RPC/market-data/LLM accounts, local storage and network/DEX fees are customer costs unless the quote explicitly includes them.
- Contribution margin = net one-time revenue - expected lifetime service cost - acquisition/implementation/support allocation.
- Stress-case cost uses high but plausible usage, provider plan upgrades, price increases, outage/recovery and longer service lifespan. Model low/base/high cases and a sensitivity curve, not a single guessed lifetime.

No recurring core subscription is permitted by the current owner-requested model. Service usage limits/fair-use terms must be transparent and agreed before payment; no hidden recurring or surprise mandatory charge. A one-time optional capacity upgrade may be quoted separately if the owner later approves it.

## 10. Provider allowance freshness note
The Birdeye public page's indexed content and rendered snapshot returned different compute-unit allowance/overage figures during the 28 October 2026 review. Plan prices appeared consistent, but included compute units and overage rates are **not considered verified** until confirmed in the provider portal or in writing. Do not purchase a plan or build a cost model from one cached quota value.


## 11. Self-hosted lifetime economics note (D-025)
The $12,000 one-time fee funds the promised software license, included update/support window and central licensing/download portal, not an unlimited vendor-hosted trading runtime. Separate vendor cost lines from customer-paid infrastructure/API/LLM costs. Model the likely maintenance/support lifetime, security-response obligations, release signing, license portal uptime, customer installation support, refunds and provider price changes. Publish no included hosting/data/LLM allowance unless the quote and cost model expressly include it.