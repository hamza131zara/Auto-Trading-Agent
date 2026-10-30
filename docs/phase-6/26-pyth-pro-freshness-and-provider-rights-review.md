# Phase 6.26 — Pyth Pro freshness evidence and provider-rights review

## Status and scope

This step adds a read-only, fixture-tested Pyth Pro latest-price adapter and records a public-documentation review of provider lineage, timestamps and customer-facing usage rights. The adapter is not registered in a live runner, not activated, and has made no provider request. No Pyth key, numeric feed ID, minimum publisher configuration, plan, or service entitlement is embedded. Provider production approval remains false.

This work does not close upstream-independence or commercial-rights gates. A fresh price update with sufficient publishers is stronger timestamp/quorum evidence, but does not establish that those publishers are independent of another provider or that the data may be redistributed to customers.

## Why a separate Pyth Pro adapter is required

Pyth's updated architecture, effective 26 August 2026, keeps the Hermes-compatible interface but changes how data is aggregated and signed. Five routers independently compute and sign aggregates from a common ordered publisher-update message stream. The contract accepts a quorum of three router signatures out of five. These are redundant aggregation/signing paths, not five independent market-data publishers and not five independent price sources. Publisher entities are the upstream contributors; their identity, venue/source path and independence must be reviewed separately.

Official references:
- https://docs.pyth.network/pro/how-lazer-works
- https://docs.pyth.network/pro/api/rest
- https://docs.pyth.network/pro/payload-reference
- https://docs.pyth.network/pro/symbology-reference
- https://docs.pyth.network/pro/api

The existing Hermes-compatible adapter records the Hermes publish_time, but does not validate Pro's publisherCount or feed-generation feedUpdateTimestamp. Since 23 March 2026 the payload may continue carrying a feed's most recent price when a newer aggregate is not produced. A recent response/update timestamp can therefore be newer than the price it carries. The Pyth payload reference explicitly directs consumers to feedUpdateTimestamp for price-generation freshness.

## New Pyth Pro adapter

Implementation:
- packages/market-data/src/providers/pyth-pro.ts
- package export @ata/market-data/providers/pyth-pro
- fixture-only tests in test/pyth-pro-adapter.test.mjs

The adapter:
- Uses the authenticated Pyth Pro POST /v1/latest_price endpoint.
- Requires a reviewed configuration binding each numeric pyth_lazer_id to the existing canonical Hermes/Core feed ID and the exact SOL/USD or USDC/USD mint.
- Requires the selected channel to be at least as fast as the feed's reviewed min_channel.
- Requests price, exponent, confidence, publisherCount, feedUpdateTimestamp, and marketSession.
- Checks that the feed's publisher count meets the reviewed feed minimum. Optional session-specific overrides must be copied from the corresponding market_sessions.*.min_pub metadata; the response marketSession selects the applicable threshold.
- Requires feedUpdateTimestamp to equal the Pyth response timestampUs. An earlier value is explicitly rejected as a carried-forward price; a later value is invalid.
- Converts the feed-generation time from exact Unix microseconds and stores it as the observation publication time. HTTP retrieval time is retained separately and is never substituted.
- Retains publisher count, minimum count, market session, feed/update microsecond timestamps, confidence, channel and raw-payload digest.
- Keeps bearer credentials out of logs/errors and marks injected test fetches synthetic.

The numeric Pyth Lazer feed IDs and minimum values in tests (101/202 and their quorum values) are test fixtures only. They are not the real SOL/USD or USDC/USD Pyth Pro mappings. Before a diagnostic can be configured, the owner must obtain and review the actual rows from Pyth's /v1/symbols metadata for those exact feeds, including pyth_lazer_id, min_publishers, min_channel, market_sessions and feed state. This change does not fetch that endpoint.

The new pyth-pro registry profile shares independenceGroupId pyth-network with pyth-hermes. They are two interfaces to the same Pyth data family and can never count as two independent sources.

## Provider-source and commercial-rights review

The review below is a conservative engineering gate, not legal advice or a rights grant. Public documentation is not a substitute for an executed agreement covering this product and its actual customer workflow.

| Provider / source | Public evidence and technical role | Current gate for this customer-facing product |
|---|---|---|
| DEX Screener API | Its published API terms allow commercial and non-commercial use subject to limits, but give only a limited, revocable, non-transferable licence; prohibit making the API services or any portion available to third parties for unauthorized purposes; and state that API/data ownership remains with DEX Screener. Its FAQ says it builds its own indexer from blockchain logs, without external API data sources. | Not approved. Obtain written confirmation for the exact self-hosted / multi-customer agent model, customer data visibility/export, caching and permitted derived use; review current plan/rate-limit terms. A separate indexer is not automatically an independent upstream price source. |
| GeckoTerminal / CoinGecko API | CoinGecko's current licensing guide says paid standard commercial plans can support products that display CoinGecko data with prominent attribution and charge for the product. Standard commercial rights do not grant API/data redistribution, sublicensing or reusable data/API access; custom rights must expressly cover the relevant redistribution/resale. GeckoTerminal and CoinGecko remain one source family. | Disabled / not approved. Determine whether the agent only displays attributed fields or gives customers reusable/downloadable data or API access. Get the corresponding paid plan and written custom permission where the workflow goes beyond display. Pool-details source timestamps remain unknown; OHLCV candle-start time is price-only observation evidence, not pool-metrics freshness. |
| Birdeye | Its published Data API terms (last updated 11 April 2025) restrict account/service use to the user's own use, prohibit third-party access and prohibit copying/scraping/extracting/storing/distributing data without prior written consent. | Exclude unless prior written permission is obtained. No key, account or adapter activation. A public endpoint or timestamp field is not a customer-use licence. |
| Raydium API v3 | Official API/schema documentation describes pool catalogue and related endpoints. The reviewed public documentation did not establish a sufficiently specific grant for the proposed customer-facing data service, nor a trustworthy source-event timestamp for current pool metrics. | Unreviewed / not approved. Obtain authoritative terms/permission or a written clarification for commercial multi-customer use and redistribution; keep source freshness as UNKNOWN when event time is absent. |
| Pyth Pro | Public REST/symbology/payload documentation describes authenticated access, publisher counts, feed-generation timestamps, channel/feed identifiers and the publisher aggregation architecture. Public API documentation alone does not establish the complete service-plan, customer-redistribution, attribution and retention rights for this product. | Diagnostic and production use not approved. Review the Pyth Pro service agreement, API-key plan, feed/channel/frequency entitlements, quotas, data retention, attribution and whether customers may view, export or reuse the data. Router signatures are not additional independent price-source families. |
| Solana shared public RPC | Finalized ledger account state and slots can provide on-chain identity/context evidence, not independent indexed pool metrics or a substitute for source-lineage evidence. | Not approved as a production RPC service. Select and review an RPC provider, rate limits, reliability, availability and permitted usage before production reliance. |

Official documents reviewed:
- DEX Screener API Terms: https://docs.dexscreener.com/api/api-terms-and-conditions
- DEX Screener data-source FAQ: https://docs.dexscreener.com/
- CoinGecko commercial/custom licensing: https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses
- CoinGecko API plans: https://www.coingecko.com/en/api
- Birdeye Data API Terms: https://birdeye.so/data-api/terms-of-service
- Raydium API documentation: https://docs.raydium.io/
- Pyth Pro REST API: https://docs.pyth.network/pro/api/rest
- Pyth payload reference: https://docs.pyth.network/pro/payload-reference
- Pyth symbology: https://docs.pyth.network/pro/symbology-reference
- Pyth architecture: https://docs.pyth.network/pro/how-lazer-works
- Pyth legal: https://www.pyth.network/legal

## Evidence required to close the provider gates

1. Exact upstream lineage: identify each indexed source's upstream publisher/dataset and aggregation path. For Pyth, record the actual publishers that contribute to the chosen SOL/USD and USDC/USD feeds, their market/venue source provenance, and whether any indexed provider's pricing is sourced from those same publishers or the same underlying venue/aggregator. Pyth's publisherCount is a quorum/freshness input, not a complete independence attestation.
2. Mutual attestations: document both sides of each selected provider pair and require matching owner-reviewed upstream lineage evidence before marking the pair independent.
3. Freshness: require a source event/observation time supported by the actual endpoint contract. retrievedAt, a pool-creation time, a cached response timestamp, or a current REST update wrapper must not be promoted into feed-generation time.
4. Commercial terms: document the exact customer experience (display-only vs customer-visible reusable/exportable data vs API access), attribution, caching/retention, account model, end-user access, expected rate/volume and intended commercial pricing. Store the applicable plan or written permission and effective date; do not set a rights flag from a web page alone where written approval is required.
5. Runtime controls: only after the owner approves exact feed mappings, thresholds, rights, usage budget and the desired diagnostic, separately design a manual-only, default-disabled test. No key should be added until that separate decision.

## Safety and acceptance

- No provider endpoint or Solana RPC was called by this implementation/review.
- No API key, external account, paid plan, production connection, budget or spend was created.
- Pyth Pro and other new provider profiles remain disabled/unapproved; independenceReview remains UNVERIFIED and productionUseApproved remains false.
- Existing DEX/Raydium liquidity and volume thresholds and the 10-bps Pyth diagnostic tolerance remain unchanged.
- The historical 63-bps Pyth reserve/reference disagreement remains a disagreement; this adapter does not change or reinterpret it.
- No transaction, wallet, signer, order or trading capability is added.

Phase 6 remains ACTIVE. Phase 6.26's adapter/test implementation can be verified independently of the still-open owner evidence and commercial-rights decisions.
