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

A retryable failure increments consecutive failures; reaching the configured threshold opens the circuit for an explicit cooldown. The deterministic `assessProviderAttemptPermission` gate blocks requests while cooldown is active and permits a recovery probe only after expiry. Callers must atomically claim/serialize that probe; competing attempts are blocked when `recoveryProbeInFlight` is true. Authentication/configuration failures remain unavailable until operator correction. Stale health permits only a health recheck, not use of stale market observations. `recordProviderResult` also rejects malformed prior health and out-of-order results so a delayed response cannot roll provider health backwards. These are permission decisions only. ReadOnlyMarketDataOrchestrator now applies them before registered adapter calls, serializes attempts per provider within one process, updates health from sanitized outcomes, validates normalized observations against the requested pool/mints, and continues to configured fallbacks after a primary failure. It returns all candidates for a separate assessProviderAgreement call; one successful provider is never treated as independent consensus. Health and in-flight locks are process-local, so a multi-worker deployment must persist health and use a shared atomic lease. The orchestrator does not authorize trades.


## Phase 6.21 — source-family lineage and timestamp semantics

Freshness timestamps are now paired with a reviewed provider source profile. A vendor/product name does not prove upstream independence: source families such as CoinGecko and GeckoTerminal share one independence group. The reviewed-lineage wrapper derives EVENT/OBSERVATION/NONE from the canonical source fields and checks the source role against the profile; retrieval time cannot be substituted. All current profiles remain unverified and no production source is approved. See [Phase 6.21](21-provider-source-lineage-registry.md).


## Phase 6.22 — independent Pyth lineage

The Pyth USD reference pair is one `USD_REFERENCE` source family with publication time typed `EVENT`. The indexed source is separately typed as `EVENT`, `OBSERVATION`, or `NONE` from its actual source fields. The reviewed comparison wrapper retains arithmetic diagnostics but blocks evidence promotion until upstream families are owner-attested and timestamps/rights pass. Retrieval time is never substituted. See [Phase 6.22](22-pyth-independent-lineage-and-critical-gate.md).
