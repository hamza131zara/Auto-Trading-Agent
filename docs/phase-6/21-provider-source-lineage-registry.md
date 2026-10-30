# Phase 6.21 — Reviewed provider source lineage and timestamp semantics

## Status

Merged into `main` through [PR #36](https://github.com/hamza131zara/Auto-Trading-Agent/pull/36), commit `d5ea1dbdd1a485bba559c94791ba2d5989ab9cde`. Post-merge CI [run #257](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41011278975) passed 239/239 tests, repository validation, typecheck/build, dependency audit (zero vulnerabilities) and Gitleaks. PR CodeQL [run #36](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41011147219) passed both Actions and JavaScript/TypeScript analyses. Dependency Review passed [run](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41011152466). This is a provider-neutral evidence gate only. No provider is enabled, no API credentials are created, no external market-data request is made, spend remains USD $0, and trading authorization remains false.

## Why this gate exists

The earlier provider agreement comparator correctly required distinct `independenceGroupId` values, fresh event/observation timestamps, healthy providers and exact agreement. However, the group identifier was supplied by the caller. Different strings or vendor names alone do not demonstrate different underlying data lineage.

Phase 6.21 adds a reviewed in-repository source registry and `assessProviderAgreementWithReviewedLineage`. The wrapper binds every provider ID and source-family claim to its registry profile, derives timestamp kind from the actual canonical snapshot, and invokes the lower-level agreement comparator only when the lineage gate passes.

The lower-level `assessProviderAgreement` remains a pure comparator for unit tests and specialized callers. It must not be used alone to promote an operational candidate. Evidence-promotion callers should use the reviewed-lineage wrapper and the independent reserve/USD plus on-chain gates.

## Provider registry snapshot

| Provider ID | Upstream family | Role | Timestamp semantics | Diagnostic access | Customer/production status |
|---|---|---|---|---|---|
| `dex-screener` | DEX Screener family | Pool metrics, indexed price | None for current observation/event time | One-off manual acknowledgement | Terms/quota review required; not approved |
| `geckoterminal` | GeckoTerminal/CoinGecko ecosystem | Pool metrics, indexed price | None for pool metrics; candle-start OBSERVATION for exact-pool OHLCV price | Disabled pending terms | API-specific terms and customer distribution review; not approved |
| `coingecko-api` | Same GeckoTerminal/CoinGecko ecosystem | Indexed price | OBSERVATION only where endpoint supplies it | Disabled pending terms | Custom license may be needed for redistribution; not approved |
| `pyth-hermes` | Pyth Network | USD reference | EVENT (feed publish time) | One-off manual acknowledgement | Plan/usage rights review; not approved |
| `raydium-api-v3` | Raydium API | Pool catalogue/metrics | No current source event timestamp | One-off manual acknowledgement | Commercial/API policy review; not approved |
| `birdeye` | Birdeye data platform | Exact-pair indexed price candidate | OBSERVATION for price only | Disabled pending written permission | Written permission required; not integrated |
| `solana-public-shared` | Solana finalized ledger | On-chain account state | SLOT | One-off manual acknowledgement | Shared endpoint not approved for production |

Registry claims are intentionally conservative and are not declarations of legally or technically proven independence. All providers currently have `independenceReview: UNVERIFIED`, empty pairwise attestations, and `productionUseApproved: false`. GeckoTerminal and CoinGecko share one source family and cannot count as two independent providers. Provider aliases or sibling products must share their common upstream family.

## Gate semantics

The reviewed lineage gate requires:
- unique, registered provider IDs;
- the caller-supplied group to match the registry exactly;
- the provider role to be documented for that product;
- the timestamp kind to match the registry and the actual snapshot;
- at least two distinct upstream groups;
- mutual owner attestation of the exact source-family pair;
- one-off manual acknowledgement for providers whose diagnostic access permits it;
- source timestamp evidence when policy requires it;
- commercial customer-distribution rights and explicit production approval for production purpose.

Missing or unknown timestamps are never converted from retrieval time. GeckoTerminal's exact-pool OHLCV candle-start boundary is an observation timestamp for price comparison only; it is not the event time for pool-details liquidity/reserve/volume. DEX Screener, Raydium API and GeckoTerminal pool metrics remain `NONE` for source-event time in this registry.

The combined wrapper binds the lineage candidate set one-to-one to the canonical provider evidence candidates. It derives `EVENT`, `OBSERVATION`, or `NONE` from `sourceEventAt` / `observedAt` and ignores a caller's attempted timestamp-kind promotion. A provider not present in the reviewed registry is rejected.

## Explicit current result

No pair is currently eligible for provider agreement through the reviewed wrapper. No upstream pair has been mutually attested, current source-event time is not available for the indexed pool-metrics sources, and commercial/production rights are unresolved. This is an intentional BLOCKED result—not a reason to relax evidence rules.

Birdeye remains disabled pending written permission for the intended multi-customer/self-hosted delivery model. GeckoTerminal remains disabled pending API-specific terms/plan/customer-distribution approval. Pyth remains a one-off reference candidate pending terms/plan/use review; its historical 63-bps reserve/reference disagreement against the 10-bps diagnostic tolerance remains unchanged.

## Tests and safety boundaries

`test/provider-source-registry.test.mjs` covers:
- provider registry contents, roles and timestamp semantics;
- distinct vendor names without mutual upstream attestations;
- CoinGecko/GeckoTerminal shared-family rejection;
- source-family spoofing and unknown provider IDs;
- retrieval/observation timestamp promotion attempts;
- candle-start observation versus pool metric event-time separation;
- Birdeye disabled state;
- diagnostic acknowledgement and production rights gates;
- wrapper binding of provider/group IDs and timestamp-kind derivation;
- malformed policy/candidate fail-closed behavior.

The registry and wrapper are pure functions. They make no network requests, read no environment variables, create no credentials, and cannot authorize trading. The wrapper only allows progression to the existing provider-agreement assessment; independent price comparison, exact on-chain identity, token safety, production-provider approval and trading authorization remain separate gates.

## Review and approval

Any owner attestation must be based on evidence identifying the actual upstream dataset/publisher path—not vendor branding, endpoint names or SDK differences. Update both profiles symmetrically only after documenting the upstream sources, aggregation path, timestamp meaning and relevant terms. Any new commercial-rights approval must identify the exact product delivery model, customer visibility/export, attribution, retention and redistribution rights. Never turn these fields to approved based only on an API doc or a successful test.


## Pyth Pro architecture clarification — 2026-10-30

The newer Pyth Pro architecture documentation clarifies that five router instances independently aggregate/sign the same ordered publisher-update stream; the Core contract accepts three of five router signatures. These routers are redundant data-delivery/aggregation/signing paths, not five independent publisher populations. Publisher entities are the source contributors. The registry therefore continues to treat Pyth Pro and the Hermes-compatible Pyth endpoint as the same upstream group, pyth-network, and their profiles remain independence-unverified. A count of publishers is not a substitute for identifying the contributing publishers and reviewing their source/venue lineage.

Phase 6.26 adds provider ID pyth-pro as another profile in the existing pyth-network family. It does not create a separate independence group or make Pyth and an indexed pool-metrics vendor mutually attested. See [Phase 6.26](26-pyth-pro-freshness-and-provider-rights-review.md) and the official [Pyth Pro architecture](https://docs.pyth.network/pro/how-lazer-works).
