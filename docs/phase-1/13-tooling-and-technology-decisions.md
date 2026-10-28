# Technology Decision Record — Candidates for Evaluation

No technology is permanently selected by this draft except that choices must meet security, supportability and testability requirements. Final decisions follow documentation review and small validation spikes.

## Proposed initial shape
Prefer a modular monolith for V1 with clear internal boundaries over an unnecessarily distributed system. Isolate signer, research execution and credential scopes even if other components share a deployment initially.

## Candidate stack
| Area | Candidate | Reason to evaluate | Exit criteria |
|---|---|---|---|
| Dashboard | Next.js + TypeScript | Mature React UI, server routes and strong ecosystem | Auth/session model, deployability, operator UX and security review |
| Trading/service core | Node.js + TypeScript | Shares domain types with dashboard and supports current Solana SDK ecosystem | Latency, reliability, transaction lifecycle and SDK compatibility |
| Solana client | Official @solana/kit and generated program clients | Current official client guidance | Token/Token-2022 support, signing boundary and simulation/transaction support |
| Quant research | Python, pandas/Polars, NumPy, scikit-learn; evaluate XGBoost/LightGBM | Historical analysis and calibrated statistical models | Reproducible data, calibration, inference latency and maintainability |
| Canonical database | PostgreSQL | Transactions, audit/ledger and relational queryability | Durability, migration, backup/restore and query tests |
| Time-series/analytics | Start with PostgreSQL; evaluate Timescale or ClickHouse only when measured need exists | Avoid premature infrastructure | Benchmark demonstrates benefit |
| Queue/cache | In-process durable workflow initially where safe; evaluate Redis Streams or NATS | Backpressure and asynchronous feedback | Delivery semantics, idempotency, recovery and operational cost |
| RPC/streaming | Official RPC plus evaluated provider such as Helius; independent fallback | On-chain access and lower single-provider risk | Coverage, latency, freshness, cost, rate limits and failover |
| Discovery/market data | Evaluate DEX Screener and Birdeye | Discovery and indexed analytics | Field completeness, licensing, limits, historical depth and measured value |
| Swap routing | Evaluate current Jupiter Swap V2; direct DEX path only if justified | Route aggregation and transaction generation | Quote quality, simulation, fees, failure/recovery and signer review |
| Direct DEX | Raydium SDK/API as a candidate | Pool-specific integration where needed | Added value vs complexity and testability |
| Signing | Narrow signing service; evaluate managed key system/KMS/HSM/MPC fit | Secret isolation and restricted authorization | Threat model, supported Solana transactions, recovery, cost and audit |
| Containers | Docker for repeatable development/release | Reproducible environments | Image scanning, non-root operation and reproducible builds |
| CI/CD | GitHub Actions or equivalent | Repeatable lint/type/test/security gates | Protected production release and artifact provenance |
| Observability | OpenTelemetry-compatible logs/metrics/traces, provider monitoring and alerts | Diagnose failures and verify behavior | Alert drills, retention, redaction and incident evidence |

## Language decision
Do not introduce Rust or Go solely because they are lower-level or compiled. Use TypeScript for the initial integration core unless a measured component needs Rust for deterministic low-latency parsing or compute. Keep exact transaction validation and risk rules type-safe and covered by tests. Python should serve research/model workflows rather than signing or authoritative financial ledger logic.

## Decision criteria
For every dependency, evaluate: security maintenance, upstream support, API compatibility, performance, type safety, testability, failure semantics, observability, licensing/terms, migration cost, community health and operator burden.

## Explicit prohibitions
- Never store a seed phrase in source code, a prompt, database plaintext, browser storage or a log.
- No direct production signing in the LLM runtime.
- Do not add Kubernetes/Kafka/microservices until traffic/reliability evidence requires them.
- Do not select ML complexity before a reproducible baseline and labeled evaluation dataset exist.
- Pin versions and record exact versions in the eventual dependency decision record.


## Commercial access technologies — no provider selected yet
- Add a provider-neutral commercial-access module for quote/invoice, verified settlement, invitation, registration review, approval, entitlement, suspension, refund and dispute.
- Use idempotent verified server events if a merchant provider is approved; otherwise record manually reconciled cleared bank settlement under a privileged audited admin workflow.
- Do not choose Stripe, Paddle or Lemon Squeezy by default for the proposed crypto-trading product. Their current public country/product policies create eligibility barriers; see [28 Payment Provider Eligibility Assessment](28-payment-provider-eligibility-assessment.md).
- Enforce entitlement and tenant authorization server-side, including background jobs, streaming and data access. If Supabase is chosen, validate MFA assurance levels and RLS; authentication alone is not license authorization.
- A published one-time lifetime price must be backed by cost modeling for hosting, market data, LLMs, support, security and refunds/chargebacks over an explicit assumption horizon. No recurring core subscription or free-trial state is allowed.