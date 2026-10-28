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
