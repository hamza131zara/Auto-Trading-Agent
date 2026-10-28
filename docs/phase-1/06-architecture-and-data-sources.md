# Architecture and Data Sources

## Proposed service boundaries
1. Web dashboard and authenticated operator API.
2. Discovery service and provider adapters.
3. Market-data normalizer with freshness/provenance checks.
4. On-chain security and pool-analysis service.
5. Feature and market-regime computation service.
6. Decision service for rule-based strategies and optional bounded AI judgments.
7. Deterministic Risk Governor.
8. Quote/simulation/execution adapter.
9. Isolated signer boundary with policy validation.
10. Position monitor and exit controller.
11. Trade ledger, audit store and strategy/model registry.
12. Research/backtest and strategy-evaluation pipeline.
13. Observability, alerts and incident-control service.

Services may initially be modules in a modular monolith if the boundaries are enforced in code and credentials. Microservices are not a goal by themselves.

## Trust boundaries
- Dashboard and LLM are untrusted with respect to transaction authorization.
- Risk Governor validates all proposed trade intents using canonical policy and fresh state.
- Signer receives only a narrow, typed intent; it must independently validate allowed programs, mint/pool, amount limits, slippage bounds, blockhash/freshness, destination and policy version.
- No API key, seed phrase or signing secret is placed in prompts, browser code, logs, analytics or general-purpose agent environment.
- Research optimizer cannot directly deploy or modify live rules.

## Integration candidates (not yet selected)
- Solana: official RPC and current TypeScript client documentation.
- Streaming/indexed chain data: evaluate Helius or another provider plus an independent RPC source.
- Token/pair discovery and market snapshots: evaluate DEX Screener and Birdeye, with direct on-chain validation for safety-critical state.
- Execution routing: evaluate current Jupiter Swap V2 and direct DEX integrations such as Raydium where justified.
- Security analytics: provider signals are additional evidence only; no single vendor score is a sufficient safety gate.
- Database: PostgreSQL as canonical transactional ledger; time-series extensions or columnar analytics only if workload tests justify them.
- Cache/event transport: Redis Streams or NATS are candidates; select based on failure semantics and recovery tests.
- Observability: structured logs, metrics, traces and alerting; tool selection follows operational requirements.
- Secret/signing options: review KMS/HSM/MPC or dedicated signer architecture according to threat model and cost.

## Data-provider interface requirements
Each adapter must record request parameters, source, retrieval time, source event time if available, schema/version, status, rate-limit response, retry behavior and provenance. Normalize token/pool identifiers and units without losing raw source fields. Enforce provider timeouts, bounded retries, backoff and circuit breakers.

## Reconciliation
For critical on-chain state, compare independent sources where practical and validate against chain state before signing. If providers disagree beyond documented tolerances, halt new entries rather than selecting the more convenient answer.

## Selection criteria
Evaluate data completeness, latency, rate limits, historical coverage, holder/authority coverage, uptime, geographic/network behavior where relevant, commercial terms, redistribution restrictions, data licensing and failure/recovery behavior. Document vendor lock-in and replacement strategy.

## Initial source register
See SOURCES.md. Provider selection and current endpoint/product versions remain open until official documentation, pricing, terms and rate limits are rechecked during Phase 1.


## Commercial access boundary — CR-001
The requested paid access model adds a central commercial licensing portal alongside the self-hosted customer runtime. Its responsibilities are quote/invoice versioning, payment/settlement verification, single-use registration invitations, registration status, owner/admin approval, signed lifetime-license entitlement, authorized software download/update access, refund/dispute state and commercial audit events.

The commercial component must be separate from the decision brain, Risk Governor, execution and signer:
- Payment/registration administration cannot create a trade intent or loosen a risk limit.
- The customer-local trading agent cannot mark invoices paid, approve a customer, issue license entitlements or process refunds.
- Entitlement evaluation runs in the central portal for licensing/registration/download actions; the self-hosted runtime separately verifies signed entitlement and enforces local policy.
- If a payment provider is added later, its adapter is selected only after written seller-country and product-category approval. Until then, the proposed initial path is manual invoice and verified settlement.
- Each self-hosted installation keeps customer data, balances, position state, model history, data-source credentials and signer policies inside its own environment. The central portal stores only necessary commercial/license metadata. No customer funds are pooled and no hosted trading runtime exists in V1.

See [27 Commercial Access](27-commercial-pricing-access-and-lifetime-license.md) and [28 Payment Provider Assessment](28-payment-provider-eligibility-assessment.md).

## Locked deployment model D-025
The selected V1 shape is a central licensing portal plus separately self-hosted customer installations. Trading discovery, decisioning, execution, monitoring and memory run in the customer-controlled/customer-dedicated environment. The central portal cannot access signing secrets or issue transaction instructions. One open/unresolved position is enforced per running licensed instance. Any future hosted trading service requires a separate owner-approved change request.