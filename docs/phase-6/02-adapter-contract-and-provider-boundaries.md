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

The initial provider-neutral interface is implemented. A fixture-tested read-only DEX Screener candidate adapter has also been added for evaluation only; its presence is not a production vendor selection. No SDK, plan, account or production quota has been approved.

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

No live or paid provider call is made by the Phase 6 provider-neutral package. Provider disagreement/fallback assessment is implemented as a pure deterministic gate in [Phase 6.7](07-provider-agreement-and-fallback-policy.md); each candidate must identify its upstream independence group, and the gate cannot count aliases as independent, select around a conflict, or authorize trading.


## DEX Screener candidate adapter (evaluation only)

A read-only reference adapter targets the documented pair lookup route `GET /latest/dex/pairs/{chainId}/{pairId}` on `https://api.dexscreener.com` for the requested Solana pair address. See the [official API reference](https://docs.dexscreener.com/api/reference). It only queries an explicitly requested pool; it does not discover arbitrary pools from a base mint and silently pick one.

- Only `mainnet-beta` requests are supported by this indexed-market adapter. Devnet/testnet requests fail before a network call.
- The adapter requires the returned chain, pair address, base mint and quote mint to match the request exactly.
- It normalizes `priceUsd` as `USD_PER_BASE`, `liquidity.usd` and `volume.h24` as USD measures, and 24-hour buy/sell counts only when they are valid safe integers.
- JSON numeric tokens are captured as strings before normalization. Exponent notation is expanded using string arithmetic; values do not pass through JavaScript floating-point numbers before canonical storage.
- The API response does not establish when the price observation itself occurred. Therefore `observedAt` and `sourceEventAt` remain null and freshness is `UNKNOWN`, even when retrieval is recent. Pair creation time is not substituted for an observation timestamp.
- Only a SHA-256 digest of the exact response text is retained as provenance. Raw provider bodies and credentials are not logged or included in the canonical observation.
- The adapter is read-only and never calls Solana RPC, evaluates token safety, submits transactions or authorizes trades. Unit tests use a mocked fetch and synthetic response fixtures; CI does not call the external API.

Before any production use, re-check the official endpoint/schema, terms, quota and rate-limit bucket, and define independent on-chain confirmation and provider fallback/disagreement behavior. A syntactically valid indexed observation is not proof that a pool is authentic or that any market measure is safe to trade on.
