# Phase 6.6 — DEX Screener Read-Only Reference Adapter

**Status:** Candidate adapter only; not a production vendor selection or security authority.

## Endpoint and request behavior

The adapter evaluates the documented DEX Screener pair-lookup endpoint:

- Host: `https://api.dexscreener.com`
- Method: `GET`
- Route: `/latest/dex/pairs/solana/{pairAddress}`
- Reference: [DEX Screener official API reference](https://docs.dexscreener.com/api/reference)

It requests only the explicitly supplied pair address. It does not pick a pool implicitly from a token list or use a provider's "best pair" as a substitute for the requested identity. A response is rejected unless chain ID, pair address, base mint and quote mint all exactly match the request.

The reference adapter only accepts a `mainnet-beta` request because the indexed data is for Solana mainnet. It rejects devnet/testnet requests before sending any request. This is a read-only market-data request; no transaction or wallet method is exposed.

## Normalized fields

| Provider field | Canonical field | Treatment |
|---|---|---|
| `pairAddress` | `poolAddress` | Must match requested pool |
| `baseToken.address` | `baseMint` | Must match request |
| `quoteToken.address` | `quoteMint` | Must match request |
| `priceUsd` | `price` with `USD_PER_BASE` | USD unit-price measure; `assetId: null` |
| `liquidity.usd` | `liquidity` with `USD` | Absolute USD amount; no conversion |
| `volume.h24` | `volume24h` with `USD` | 24-hour window, USD units |
| `txns.h24.buys/sells` | `buys24h` / `sells24h` | Non-negative safe integers or null when absent |
| `pairCreatedAt` | None | Pair creation is not an observation timestamp |
| `priceNative` | None in this first mapping | Not used until its exact source-side unit semantics are established |

The adapter intentionally does not infer USD from quote-token reserves, or quote-token price from a USD price. It uses `priceUsd` only when the provider supplies it in a valid non-negative decimal form.

## Timestamp and freshness semantics

The response does not provide a trustworthy source-observation timestamp for the indexed market values in this mapping. The adapter consequently sets both `observedAt` and `sourceEventAt` to null. A recent retrieval timestamp does not establish that the underlying price data is recent, so `assessFreshness()` returns `UNKNOWN` for this observation unless a later reviewed evidence source provides a real source timestamp.

Do not turn an unknown timestamp into a pass or freshness score. Until independent source timing and consistency behavior are established, these values are for discovery/research only and cannot satisfy any future hard freshness gate.

## Decimal integrity, response size and errors

- The response body is capped at 1,000,000 bytes.
- A token-preserving JSON scan wraps numeric lexemes as strings before parsing, preserving the decimal source spelling rather than first converting it to IEEE-754.
- Valid exponent-form numeric lexemes are expanded to decimal strings using string operations, not floating-point arithmetic, within a conservative size bound. Unsupported/invalid measures are rejected.
- The exact response body is represented by a SHA-256 provenance digest. The raw response body, URL query credentials, or provider error body are not included in canonical observations or error messages.
- HTTP 429 is classified as a retryable rate-limit failure; HTTP 408 and 5xx are retryable; 401/403 are non-retryable authorization/access failures. Retry policy belongs to the caller/provider-health orchestration; this adapter does not loop retries on its own.
- The request has a bounded timeout and accepts caller cancellation.

## Test coverage

The test suite uses a synthetic JSON fixture and an injected/mock `fetch`. It verifies:
- exact endpoint, GET method and absence of authorization headers;
- exact pair/base/quote identity matching and rejection of another chain;
- explicit USD-per-base versus absolute USD units;
- decimal lexeme precision for large/many-decimal provider measures;
- missing source timestamps remain unknown;
- invalid measures and unsafe counts are rejected;
- rate limits produce sanitized errors;
- devnet requests are rejected before any network call.

CI does not call the external DEX Screener API. A passing fixture suite is parser/contract evidence, not a live provider availability, latency, legal-term, data-quality or production-readiness assessment.

## Production gate

Before using this adapter outside synthetic tests, review the current official endpoint schema, permitted usage/terms, quota/rate limits, support/availability expectations and any redistribution restrictions. Set an owner-approved budget/usage cap, compare data quality against an independent source, define pool/mint authenticity checks and a provider disagreement/fallback policy, and only then record a dated provider selection decision.
