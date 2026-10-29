# Phase 6.3 — Provenance, Freshness and Provider Health

## Provenance envelope

Each observation records a stable observation ID, provider ID, source kind, adapter version, canonical schema version, retrieval timestamp, source observation/event timestamps when available, request/event IDs when safe, and optional SHA-256 payload digest. Never include API keys, auth headers, wallet secrets or full private request URLs in provenance.

The request/retrieval time answers “when did this system receive it?”; source observation/event time answers “how old was the underlying evidence?” These timestamps are not interchangeable.

## Freshness states

- **FRESH:** source observation/event time exists, is not implausibly future-dated, and is within the configured age bound; retrieval is also within the bound.
- **STALE:** retrieval or source evidence exceeds its configured age bound.
- **UNKNOWN:** source timestamp is missing and retrieval is recent; recent retrieval alone does not prove recent underlying data.
- **INVALID:** timestamps/policy are malformed or data is outside the accepted future-clock-skew tolerance.

The freshness calculator uses an injected `now`, an explicit `maxAgeMs` and optional `maxFutureSkewMs`. It must be pure and deterministic. Production thresholds are source-specific decisions; Phase 6 does not invent a global trading threshold.

## Provider health is separate

Provider health states are `UNKNOWN`, `HEALTHY`, `DEGRADED`, `UNAVAILABLE` and `CIRCUIT_OPEN`. Health records request outcomes, last success/failure, latency, consecutive failures and circuit cooldown without raw provider error text.

Fresh data can still come from a provider whose aggregate health is degraded; that does not automatically make it safe for a downstream decision. Conversely, a healthy provider does not make a stale observation fresh. Data freshness, schema validity, provider health and later security/risk decisions remain separate dimensions.

A retryable failure increments consecutive failures; reaching the configured threshold opens the circuit for an explicit cooldown. A successful probe resets the consecutive-failure counter and cooldown. Non-retryable authentication/configuration errors mark the provider unavailable until corrected. This state machine is operational metadata only; a later risk/ingestion policy decides how each state affects use.
