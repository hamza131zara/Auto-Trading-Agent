# Phase 6.27 — Provider lineage and commercial-use evidence intake

## Status and boundary

**Status: INTAKE WORKFLOW READY — owner evidence not yet received or approved.**

Phase 6.26 implemented a disabled Pyth Pro freshness/quorum adapter and recorded a public-documentation review. It did not provide the actual owner-reviewed Pyth feed metadata, identify the contributing publisher entities for the selected feeds, establish pairwise upstream independence, or grant customer-facing data rights.

Phase 6.27 prepares a consistent, auditable intake process for those missing materials. It does not claim that any publisher, provider, feed, permission, plan, or source pair has been verified. No provider approval flag is changed. No credentials, external accounts, provider requests, RPC requests, spend, production connection, signing, order or trading path is introduced.

This is an evidence-handling checklist, not legal advice. A public API page, successful fixture, vendor name, publisher count, router signature quorum, or unsigned sales statement is not a substitute for the evidence described below.

## 1. Evidence record format

Every submitted item must be registered before it is used to change a profile or decision. Keep an immutable copy or a controlled reference to the original artifact. Do not edit source documents to make them appear to say more than they do.

Record these fields for each artifact:

| Field | Required content |
|---|---|
| Evidence ID | Unique stable ID, for example `PythPro-Symbology-2026-10-30` |
| Provider / pair | Exact canonical provider ID(s), not a product nickname |
| Evidence type | `FEED_SYMBOLOGY`, `PUBLISHER_LINEAGE`, `PAIRWISE_ATTESTATION`, `SERVICE_TERMS`, `ORDER_FORM`, `WRITTEN_PERMISSION`, or `OWNER_DECISION` |
| Issuer | Provider, publisher, venue, legal counterparty, or owner who issued it |
| Artifact locator | Official URL or restricted evidence-store path |
| Artifact digest | SHA-256 of the exact retained artifact; record the filename and media type too |
| Version and dates | Document/version, publication date, effective-from and expiry/termination date where applicable |
| Scope | Exact feeds, endpoints, plan, channel, quotas, jurisdictions, account, delivery model and customer actions covered |
| Review record | Reviewer, review date, outcome, limitations and unresolved questions |
| Decision reference | Owner decision ID and scope, if one exists; never infer a decision from receipt alone |

Evidence quality must be classified as one of:
- **EXECUTED_OR_SIGNED** — executed agreement, signed authorization, official signed provider response, or owner-signed attestation.
- **FIRST_PARTY_PUBLIC** — provider-controlled technical or legal documentation. This can support a technical fact or identify a question, but does not independently grant a negotiated right.
- **FIRST_PARTY_ACCOUNT** — account-console entitlement or plan information tied to the actual account and effective period.
- **SECONDARY** — third-party commentary or summaries. Leads only; never approval evidence.

Never put API keys, bearer tokens, private keys, seed phrases, passwords, customer personal data, or unredacted billing/payment details in this repository. Store sensitive agreements in an owner-controlled restricted location and commit only a stable evidence ID, digest, non-sensitive scope summary and review status.

## 2. Pyth Pro feed metadata intake

The owner must supply an official, dated Pyth Pro symbology snapshot for **both** SOL/USD and USDC/USD. The submitted rows must be copied from the authoritative metadata for the chosen account/service and then checked against the exact feed identities already used by the adapter.

For each feed, record:

| Field | Required validation |
|---|---|
| `pyth_lazer_id` | Actual numeric ID from the supplied metadata; not test IDs 101/202 |
| Canonical feed ID | Exact Hermes/Core feed identity; must match the adapter's pinned binding |
| Asset identity | Exact Solana mainnet mint and canonical asset mapping |
| Feed name | Exact provider symbol/description and quote currency |
| Feed lifecycle state | Must be the provider-reported supported stable state |
| `min_publishers` | Exact feed-level minimum; positive integer and source snapshot reference |
| `min_channel` | Exact documented minimum channel; selected request channel must satisfy it |
| `market_sessions` | Every supplied session name, lifecycle state and session-specific `min_pub` value |
| Snapshot provenance | Retrieval time, provider document/version, response digest and reviewer |

Do not fill gaps from examples, synthetic tests, remembered values, another feed, or a similarly named symbol. Do not infer a missing session state or minimum from the default feed-level value. If required metadata is absent, contradictory, or cannot be tied to the exact feed and account entitlement, the Pyth Pro diagnostic stays blocked.

The adapter's current test values are fixtures only. They are not production symbology and must never be copied into a real configuration.

## 3. Publisher-level upstream lineage intake

For each selected Pyth feed, obtain the actual publisher inventory applicable to the feed and evidence that identifies the upstream source path. A numeric `publisherCount` is a freshness/quorum field; it does not reveal the publishers' identities or prove independence.

For each publisher, capture:

| Field | Required content |
|---|---|
| Publisher identifier | Exact stable identifier in provider metadata |
| Publisher name and operator | First-party name and legal/operator identity, where disclosed |
| Feed coverage | Exact SOL/USD or USDC/USD feed and relevant observation period |
| Upstream market / venue | Named exchanges, markets, venues, datasets or other source inputs, with evidence |
| Instrument mapping | Exact instruments/pairs and quote currency used upstream |
| Collection path | Direct venue feed, vendor feed, aggregator or other documented route |
| Transformations | Filtering, weighting, normalization, aggregation or cross-rate conversion, if any |
| Update semantics | Meaning and origin of the publisher timestamp and feed-generation timestamp |
| Evidence and confidence | Artifact IDs, source URL, date, limitations and unresolved fields |

Explicitly distinguish Pyth's five router instances from publishers. Router redundancy/signatures are not additional market-data publishers. Do not count routers, API endpoints, SDKs, cloud regions, keys, or branded products as independent upstream sources.

Where a publisher's venue/data lineage is not publicly disclosed, record **UNKNOWN** and request first-party clarification. Do not infer an exchange source from price correlation or a publisher's company name.

## 4. Pairwise mutual independence review

Only compare sources that are candidates for the same critical evidence role and whose actual upstream path can be assessed. The initial candidate comparison may include Pyth Pro/Pyth Hermes as one Pyth family and a separately selected indexed provider. Pyth Pro and Hermes must remain in the same `pyth-network` independence group.

For every proposed independent pair, retain both sides of the review:
1. Source A's documented upstream datasets, publishers, venues and aggregation path.
2. Source B's documented upstream datasets, publishers, venues and aggregation path.
3. Explicit overlap analysis covering shared exchanges, market makers, publisher entities, data vendors, indexers, aggregators and source datasets.
4. First-party evidence or signed owner/provider attestations supporting each path; record any non-disclosure limits.
5. A written conclusion that identifies the evidence supporting independence or the exact reason it remains unknown.
6. Two-way owner attestation: both profiles refer to the same pair, evidence IDs and review scope. A one-sided statement is insufficient.

A lack of known overlap is not evidence of no overlap. Correlation tests, different hostnames, different vendor names, separate API keys, different transport protocols and separate router signatures do not establish upstream independence. If either side's path is unknown, the pair remains **NOT VERIFIED** and cannot satisfy the independent-source gate.

## 5. Commercial and customer-use rights intake

For each provider, the owner must document the exact legal entity/account, purchased plan, governing terms version and customer workflow. Review each data action separately; permission to call an endpoint does not automatically permit data redistribution or sublicensing.

Required scope questions:
- Who is the contracting entity and who owns the account/API key?
- Which exact API product, endpoints, feeds, channel, request rate, quotas and paid tier are covered?
- May the service store raw responses, normalized observations, publisher metadata, historical values and derived values? For how long?
- May the platform display values to multiple unrelated customers? Is prominent attribution or a disclaimer required?
- May each customer export, download, cache, reuse, query through an API, or otherwise obtain reusable data?
- May the platform sublicense, redistribute or resell source data or API access? Are derived outputs treated differently?
- Are hosted multi-tenant and self-hosted customer deployments both covered?
- What rate limits, burst limits, seat/customer limits, geographic restrictions, audit duties and termination rules apply?
- What deletion, retention, backup and incident obligations apply after expiry or termination?
- Is explicit written permission required for any intended action, and is that permission attached to this exact legal entity and delivery model?

Provider-specific items:

| Provider | Evidence required before the proposed use can be approved |
|---|---|
| Pyth Pro | Actual service agreement and account plan; exact feeds/channels/frequency/quotas; attribution, retention and customer display/export/API/reuse/redistribution rights; any written clarification for multi-customer delivery |
| DEX Screener | Current API terms and applicable quota/plan plus written clarification for the exact self-hosted or multi-customer service, customer visibility/export, caching and derived outputs |
| CoinGecko / GeckoTerminal | Exact plan and governing licence; determine whether use is attributed display only or reusable/exportable/API data; obtain custom written rights for any redistribution, sublicensing or reusable-data delivery not granted by the plan |
| Birdeye | Prior written permission covering the named account, third-party access, storage and distribution workflow; do not activate or request a key while this is absent |
| Raydium API v3 | Authoritative commercial-use and customer-distribution terms or written permission for the exact intended service; separately document timestamp limitations |
| Solana RPC provider | Selected provider plan/terms, quotas, uptime/failover and permitted production use; RPC identity evidence does not substitute for indexed market-data independence |

Record clauses and page/section references in the restricted evidence dossier. Where a contract or permission is ambiguous, expired, contradicted by another term, or silent on a customer action, treat that action as **NOT CLEARED** and obtain provider/legal clarification. This table is a checklist, not a conclusion that any provider has granted these rights.

## 6. Review states and approval boundaries

Use these statuses in the dossier; receipt or review does not automatically mutate runtime registry flags:

| State | Meaning |
|---|---|
| `MISSING` | Required material has not been supplied |
| `RECEIVED_UNREVIEWED` | Artifact received and recorded, not evaluated |
| `REVIEWED_INSUFFICIENT` | Reviewed, but scope/evidence is incomplete or ambiguous |
| `TECHNICAL_METADATA_VERIFIED` | Exact feed metadata and publisher inventory have been checked against first-party evidence |
| `LINEAGE_REVIEWED_NOT_INDEPENDENT` | Upstream paths reviewed but independence is not proven |
| `PAIRWISE_INDEPENDENCE_VERIFIED` | Both sides' evidence supports the exact pair and scope |
| `RIGHTS_CLEARED_FOR_DIAGNOSTIC` | Written/account evidence covers the exact one-off read-only diagnostic |
| `RIGHTS_CLEARED_FOR_PRODUCTION_SCOPE` | Rights evidence covers the specifically documented production/customer workflow |
| `OWNER_DECISION_RECORDED` | Separate explicit owner decision identifies what may proceed, limits and expiry |

The last two rights states are not interchangeable. Diagnostic permission does not imply production permission. Technical feed verification does not imply lineage independence. Pairwise independence does not imply commercial rights.

No state in this document sets `diagnosticAccess`, `commercialRights`, `independenceReview`, `independentlyVerifiedWithGroups`, or `productionUseApproved` in the runtime registry. Any future registry change requires a separate reviewed implementation with evidence IDs, tests, and an explicit owner decision. Do not change profile booleans based solely on this intake checklist.

## 7. Ordered work queue and stop conditions

1. Owner supplies the official Pyth Pro SOL/USD and USDC/USD symbology rows and the associated publisher inventory/source disclosures.
2. Owner supplies the Pyth Pro service/plan evidence and written clarification for the exact intended diagnostic/customer-use scope.
3. Owner selects the indexed provider and exact product delivery model; supplies that provider's account/terms/permission evidence.
4. Assemble the source-by-source upstream lineage map and analyze overlaps at publisher, venue, dataset and aggregator levels.
5. Complete the pairwise, two-way attestation and independent review. Leave UNKNOWN fields explicit.
6. Record a scoped owner decision for diagnostic-only or production use separately. Any expiry or material change reopens the affected review.
7. Only after all prerequisites for a diagnostic are satisfied should a separate change propose a manual, read-only, explicitly approved diagnostic. That change must still preserve the existing 10-bps tolerance and report the historical 63-bps disagreement without reinterpretation.

Stop and keep the relevant gate blocked when metadata is missing, publishers are unnamed, upstream paths are undisclosed, rights are not explicit, plans/terms do not cover the customer workflow, or evidence is contradictory/expired. Do not compensate by lowering quorum, changing feed IDs, changing thresholds, increasing tolerance, inferring timestamps, adding API keys, or calling an endpoint.

## 8. Acceptance checklist

- [x] Define the evidence artifact fields, provenance classes, digest and restricted-storage handling.
- [x] Define exact Pyth feed metadata and publisher-level inventory requirements.
- [x] Define symmetric, pairwise source-lineage review and explicit UNKNOWN handling.
- [x] Define provider-specific customer-use rights and account/plan evidence requirements.
- [x] Separate technical verification, source independence, diagnostic rights and production rights.
- [ ] Receive and verify actual owner-reviewed Pyth SOL/USD and USDC/USD symbology metadata.
- [ ] Receive named publisher-level upstream lineage evidence for the selected Pyth feeds.
- [ ] Receive rights evidence covering the chosen provider and exact diagnostic/customer workflow.
- [ ] Complete mutual pairwise independence review with the selected indexed provider.
- [ ] Record the separate owner decision before any manual provider diagnostic.

## Safety and non-goals

- Provider profiles remain **UNVERIFIED / UNAPPROVED**; production approval and `tradingAuthorized` remain false.
- No external provider API, Pyth symbols endpoint, or Solana RPC request is made by this intake step.
- No API key, external account, paid plan, budget or spend is created; spend remains USD $0.
- The existing USD 100,000 liquidity threshold, USD 10,000 24-hour volume threshold and 10-bps diagnostic tolerance are unchanged.
- The historical 63-bps Pyth reserve/reference disagreement remains unresolved and must remain visible.
- No adapter activation, production database connection, wallet, signer, transaction, order or trading capability is added.
- Phase 6 remains **ACTIVE**. Phase 6.27 prepares the owner evidence workflow; it does not close the evidence gates or complete Phase 6.
