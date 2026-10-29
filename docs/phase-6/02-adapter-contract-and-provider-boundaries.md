# Phase 6.2 — Adapter Contract and Provider Boundaries

## Adapter boundary

A provider adapter may perform three narrowly scoped tasks:
1. Fetch its provider-specific payload under bounded timeout and cancellation policy.
2. Parse and normalize documented payload fields into the canonical market snapshot contract.
3. Return sanitized health/provenance information needed for observability and replay.

The adapter cannot classify a token as safe, choose a strategy, override unknown/stale fields, set trading-risk limits, produce an executable trade intent or access a signer.

## Provider-neutral interface

The shared contract defines:
- immutable `providerId`, `adapterVersion` and `sourceKind`;
- a typed request containing explicit Solana cluster and requested pair/pool identity;
- a fetch boundary that accepts cancellation/timeout context;
- a provider-specific response treated as untrusted input;
- an explicit normalization function that yields validated canonical observations plus structured validation errors;
- bounded operational failure classes (timeout, rate-limit, network, HTTP, authentication, parse and unknown), without raw credentials or unbounded provider error bodies.

The first implementation defines the interface only. No vendor endpoint, SDK, API key scheme or paid plan is chosen.

## Retry and degraded behavior

- Retries must be bounded, jitter/backoff policy must be explicit, and non-retryable authentication/configuration errors must not loop.
- A circuit-open provider must not be hammered continuously. Circuit-open time and failure count are observable and testable.
- A retry is not a duplicate logical observation; preserve request/correlation identity where available.
- If a provider required by later hard gates is unavailable, stale or malformed, downstream policy must not treat its data as passing. Provider fallback must pass the same schema, freshness and consistency validation.
- For critical on-chain facts, indexed data is only a discovery hint unless the data dictionary explicitly defines it as authoritative. Resolve provider disagreement against on-chain state or leave the fact inconsistent/unknown.

## Provider selection gate

The current provider matrix is a shortlist only. Before any concrete adapter ships, record:
- exact official endpoint/product and documented API version;
- account plan, auth scope, quota and rate-limit bucket;
- cost ceiling and stop/alert behavior at quota exhaustion;
- timeout, retry, pagination, reconnect, event replay and error payload behavior;
- latency/history/coverage evidence and independent fallback;
- terms, retention, redistribution and customer-isolation considerations;
- schema fixtures for success, missing fields, malformed data, rate limits, stale responses and provider disagreement.

No live or paid provider call is made by the Phase 6 provider-neutral package.
