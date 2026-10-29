# Phase 6.16 — GeckoTerminal provider review and read-only adapter

**Status:** Adapter and deterministic tests implemented; live provider activation is **not approved**. Do not add this provider to an active live registry or call the endpoint until an operator reviews the applicable API terms, permitted use, attribution, rate limits, and budget for the intended use.

## Official provider sources

- API documentation: https://api.geckoterminal.com/docs/index.html
- OpenAPI schema: https://api.geckoterminal.com/docs/v2/swagger.json
- API Terms of Service: https://www.coingecko.com/en/api_terms
- Public API support page: https://support.coingecko.com/articles/6867086195-does-geckoterminal-have-an-api
- Pricing: https://www.coingecko.com/en/api/pricing

The exact-pool endpoint is GET /networks/{network}/pools/{address}, using network=solana and the exact approved pool address, with base-token, quote-token and DEX relationships included. GeckoTerminal is operated within the CoinGecko ecosystem and is a distinct indexed vendor from DEX Screener, but vendor distinction alone does not prove independent underlying data or timestamp alignment.

The official V2 docs describe the API as beta, state that endpoint responses are cached for one minute, recommend pinning Accept: application/json;version=20230203, and specify an approximate public limit of 10 requests/minute. A CoinGecko support page updated 2 October 2026 reports 30 calls/minute. Because these published values conflict, the adapter enforces a conservative seven-second minimum request-start interval in a single process (at most about 8.6 calls/minute). This process-local guard is not a distributed quota lease; multi-worker use needs a shared limiter. Keep the provider disabled unless the effective limit and account rights are reviewed.

The endpoint is documented as a public API and this adapter does not require an API key. Public accessibility is not permission for every commercial, redistribution, or deployment model. The linked API terms say permitted scope depends on the selected plan, require prominent CoinGecko attribution for API use, and impose rate-limit and data-use/storage restrictions. The intended self-hosted trading-agent and any future distribution model have not been formally cleared against a specific plan/terms. No paid plan or spend is authorized; the current budget decision remains $0.

## Data contract and safety behavior

The fixture-tested adapter is exported as @ata/market-data/providers/geckoterminal but is not registered or enabled in the Phase 6.13 live runner. It fetches the exact pool only, pins the documented API version, caps responses at 1 MiB, uses timeout/cancellation, hashes the raw payload, sanitizes errors, and validates exact pool address plus base/quote token relationship IDs. Injected fetch implementations are marked synthetic and cannot become live evidence.

The adapter maps base_token_price_usd, reserve_in_usd, volume_usd.h24, and transactions.h24 into explicit canonical units and nulls. Crucially, pool_created_at is not a current market observation timestamp. The documented pool schema does not provide a trustworthy current snapshot/event time, so observedAt and sourceEventAt remain null. The resulting freshness is UNKNOWN and it cannot satisfy the current source-alignment or critical-evidence gate. Do not infer source freshness from retrieval time or a pool-creation timestamp.

The default live adapter uses a seven-second process-local pacing guard to stay below the stricter documented rate limit. The existing orchestrator health/in-flight state is also process-local; a multi-worker deployment requires shared rate limiting, durable health and an atomic lease before production use.

## Validation

The adapter tests use fixtures and injected fetch only. They cover exact endpoint/version selection, request pacing, pool/mint identity rejection, missing measures, malformed decimal/count values, HTTP/rate-limit mapping, response-size limits, invalid envelopes and synthetic provenance. The integration test `test/geckoterminal-evidence-gate.test.mjs` additionally proves that GeckoTerminal's missing source timestamp is rejected even alongside another fresh indexed provider; recent retrieval time alone does not establish freshness. CI [run #221](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40929864753) passed 181/181 tests, typecheck, build, dependency audit and Gitleaks. No live GeckoTerminal API request was made.

## Source-timestamp acceptance regression

The new `test/geckoterminal-evidence-gate.test.mjs` verifies that even when another indexed provider offers a current, timestamped observation, GeckoTerminal's otherwise well-formed pool snapshot is rejected with `FRESHNESS_UNKNOWN` and `SOURCE_TIMESTAMP_MISSING`. A recent retrieval time alone does not make the missing source timestamp acceptable, and the provider agreement result remains `INSUFFICIENT_EVIDENCE` or `NO_ACCEPTABLE_PROVIDER`, with on-chain progression and trading authorization false. The test uses fixture data and makes no network call. This preserves the open timestamp gap as a real acceptance blocker rather than silently treating this candidate as a production fallback.

## Open approval gates

- Review and approve CoinGecko/GeckoTerminal API terms, permitted use for this self-hosted agent, attribution, retention/storage, and any public/commercial distribution model.
- Confirm the effective public rate limit with the provider; the adapter intentionally assumes the stricter approximately 10-calls/minute policy.
- Solve the genuine source-timestamp gap. Until a trustworthy current observation/event timestamp is available, GeckoTerminal evidence remains UNKNOWN for freshness and cannot complete provider agreement.
- Keep the provider disabled and spend at $0 until approval. Only then consider a manual, read-only test against an already approved pool. Do not change the pool thresholds or price-deviation tolerance.
