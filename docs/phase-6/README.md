# Phase 6 — Market-Data Ingestion and Canonical Data Layer

**Status:** ACTIVE — Phase 6.41 production `pg@8.23.1` adapter is implemented and merged; Phase 6.42 shutdown lifecycle verification is merged and its corrected disposable PostgreSQL TLS integration passed (12 passed, 0 failed) on PR #64 head `e07d00b` (run [#41196013163](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41196013163)). Post-merge `main` workflows are tracked separately. Production database deployment, CA/endpoint identity, rotation/monitoring, effective TLS/pool configuration, backup/PITR evidence and owner approvals remain open. Market-data freshness, provider rights/lineage and independent price agreement remain unresolved; production-provider approval and trading authorization remain false.

**Status:** ACTIVE — Phase 6.19/6.20 reproducible reference build and local evidence review completed; Phase 6.18 live Mainnet ProgramData comparison returned exact ELF hash MATCH at finalized slot `463153970`, with upgrade authority still present. Latest live Phase 6.14 candidate-discovery run [#12](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41005895558) completed both SOL/USDC and SOL/USDT pagination, checked 45 returned accounts, decoded 24 CPMM candidates and cross-checked all 24; zero candidates met unchanged USD 100,000 liquidity / USD 10,000 24-hour volume thresholds. Indexed source freshness remains UNKNOWN; independent price agreement, provider selection/terms/fallback, upgrade-authority policy and Phase 7 token safety remain open. Phase 6 stays active; production-provider approval and trading authorization are false.
**Started:** 29 October 2026.
**Previous phase:** Phase 5 closed for engineering-foundation handoff; see [Phase 5 closeout](../phase-5/06-phase-5-closeout-and-phase-6-handoff.md).
**Canonical roadmap:** Frozen Roadmap v1.0; phase order is unchanged.

## Objectives

1. Define a stable canonical schema for Solana token/pool market observations.
2. Record provider identity, adapter/schema version, retrieval and source timestamps, request/event identifiers and optional raw-payload digest without storing credentials or raw sensitive payloads.
3. Keep values, units and missingness explicit: decimal values are strings, null means unavailable/not provided, and no absent value is converted to zero.
4. Assess observation freshness deterministically using an injected clock and documented maximum age.
5. Represent provider health as a separate operational state from data quality/freshness.
6. Build deterministic, synthetic replay fixtures that run without network access.
7. Define adapter boundaries and add fixture-backed read-only candidate adapters only after documenting endpoint semantics; provider plan, terms, quota and fallback decisions remain separate production gates.
8. Compare independent provider observations deterministically; reject conflicts, stale/unknown data, unhealthy providers and single-source fallback as insufficient evidence. Require independent on-chain validation before any future production use.

## Documents

1. [Canonical observation schema](01-canonical-observation-schema.md)
2. [Provider adapter contract and boundaries](02-adapter-contract-and-provider-boundaries.md)
3. [Provenance, freshness and provider health](03-provenance-freshness-and-provider-health.md)
4. [Deterministic replay fixtures](04-deterministic-replay-fixtures.md)
5. [Acceptance criteria and open decisions](05-phase-6-acceptance-and-open-decisions.md)
6. [DEX Screener read-only reference adapter](06-dexscreener-reference-adapter.md)
7. [Provider agreement and fail-closed fallback policy](07-provider-agreement-and-fallback-policy.md)
8. [On-chain identity evidence contract](08-on-chain-identity-evidence-contract.md)
9. [Read-only Solana RPC account reader](09-solana-rpc-account-reader.md)
10. [SPL Token base-state decoder](10-spl-token-base-state-decoder.md)
11. [Token-2022 extension TLV structure inspector](11-token2022-extension-tlv-inspector.md)
12. [Raydium CPMM candidate pool decoder](12-raydium-cpmm-candidate-decoder.md)
13. [Explicit live-source validation runner](13-live-source-validation-runner.md)
14. [Read-only Raydium CPMM candidate discovery](14-cpmm-candidate-discovery.md)
15. [Pyth Hermes USD reference adapter and manual validation](15-pyth-hermes-reference-adapter.md)
16. [GeckoTerminal provider review and read-only adapter](16-geckoterminal-provider-review-and-adapter.md)
17. [Timestamped indexed-price evidence in the manual reserve comparator](17-timestamped-indexed-price-comparison-runner.md)
18. [Raydium CPMM deployed-program integrity evidence](18-raydium-program-deployment-integrity.md)
19. [Pinned Raydium source build and reference hash evidence](19-raydium-reference-build-evidence.md)
20. [Local review of pinned Raydium reference-build evidence](20-reference-build-evidence-review.md)
21. [Real PostgreSQL integration and distributed recovery verification](25-real-postgres-integration.md)
22. [Pyth Pro freshness evidence and provider-rights review](26-pyth-pro-freshness-and-provider-rights-review.md)
23. [PostgreSQL runtime-role and transport preflight](31-postgres-runtime-role-and-transport-preflight.md)
24. [PostgreSQL backup, restore and migration recovery](32-postgres-backup-restore-and-migration-recovery.md)
25. [Migration governance and deployment preflight](33-migration-governance-and-deployment-preflight.md)
26. [PostgreSQL observability, monitoring and incident controls](34-postgres-observability-monitoring-and-incident-controls.md)
27. [PostgreSQL aggregate connection-budget preflight](35-postgres-aggregate-connection-budget-preflight.md)
28. [PostgreSQL backup, PITR and recovery-policy preflight](36-postgres-backup-pitr-policy-preflight.md)
29. [PostgreSQL client TLS policy preflight](37-postgres-client-tls-policy-preflight.md)
30. [PostgreSQL pool lifecycle and timeout policy preflight](38-postgres-pool-lifecycle-policy-preflight.md)
31. [Test-only node-postgres pool lifecycle experiment](39-node-postgres-pool-lifecycle-experiment.md)
32. [node-postgres TLS handshake verification experiment](40-node-postgres-tls-handshake-verification.md)

## Initial implementation boundary

The shared contract package performs validation, freshness assessment, provider-health transitions and fixture replay. A read-only DEX Screener candidate adapter exists for evaluation and can only query an explicitly requested Solana mainnet pair. A deterministic provider-agreement gate is now added to reject inconsistent inputs and to keep single-source fallback blocked. These adapters/gates are not production selection; tests use synthetic fixtures and mocks and do not call external APIs. The adapter does not select a market route, assert token safety, calculate a trade, authorize an entry, sign a transaction or place an order.

## Initial implementation validation

- Main-push CI passed on merge commit `2ba2bdd357257d2d01799f8f7a80bc7439a942ec`: [run 40816041202](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40816041202). This includes repository validation, strict typecheck, build, Node tests, `npm audit` and Gitleaks.
- Dependency Review passed on PR #10: [run 40815954105](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40815954105).
- GitHub's optional AI code-scan workflow passed on PR #10: [run 40815955521](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40815955521).
- CodeQL analysis on the main merge commit completed successfully: [run 40816040698](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40816040698).

## Candidate adapter in the current slice

A read-only DEX Screener reference adapter is included for evaluation. Its fixture and mocked-fetch tests are part of the active branch/CI evidence; its existence does not close provider selection or production data-readiness gates. It uses a USD-per-base price measure and explicit USD liquidity/volume measures. Because the response lacks a trustworthy source-observation timestamp, it retains null observation/event timestamps and freshness remains `UNKNOWN`. See [the DEX Screener reference adapter note](06-dexscreener-reference-adapter.md).

## Provider-selection gate

Candidates remain those in the owner-approved provider matrix (Solana RPC, Helius, DEX Screener, Birdeye and other reviewed sources as appropriate). This phase must not turn the research shortlist or earlier dated pricing snapshot into an implied vendor commitment. A provider adapter may be considered production-ready only after endpoint/version and terms review, quota/budget selection, schema validation, timeout/retry/circuit-breaker behavior, fallback/disagreement tests, and deterministic fixtures pass.

## Protocol-specific candidate decoder

The Raydium CPMM candidate decoder in [Phase 6.12](12-raydium-cpmm-candidate-decoder.md) now connects the bounded account reader to decoded PoolState, AMM config, LP mint, mint/vault state, and PDA/authority checks. Tests are synthetic only; this is not production provider selection or live-source validation.

## Explicit live-source validation runner

Phase 6.13 now supports two modes: a supplied canonical snapshot, or a direct lookup of the exact operator-specified pool/base-mint/quote-mint from DEX Screener followed by read-only Solana RPC identity checks. The direct mode uses the existing bounded adapter, preserves request ID and raw-response SHA-256, and rejects injected/mock fetch responses as synthetic. A separate manual-only GitHub Actions workflow is available on `main`; normal CI never calls live provider APIs. Before a workflow run, the operator must explicitly approve the public read-only RPC request, review the exact indexed pair and current provider terms/rate limits/usage budget, and provide the exact pool/mint identities. The runner writes only redacted identity evidence and always reports Phase 6 completion, production-provider approval, and trading authorization as false. The corrected SOL/USDC + SOL/USDT discovery and the second manual identity/reserve diagnostic are complete; no candidate qualifies under current thresholds. The live Pyth run returned `DISAGREEMENT` (63 bps against a 10-bps run tolerance), while DEX Screener's source timestamp is missing. The combined `assessCriticalMarketDataEvidenceGate` requires both independent indexed-provider consensus and the independent reserve/USD comparison to pass with complete non-synthetic evidence before progression to the next on-chain validation stage. Its regression test uses the observed live values and preserves fail-closed behavior. CI [#204](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40898220288) passed 156 tests, typecheck, build, dependency audit and Gitleaks. Phase 6.16 adds an OHLCV candle-start price observation path for timestamped price comparisons; pool-detail liquidity/volume timestamps remain unknown. Phase 6.17 wires price-only evidence into the manual Pyth comparison behind two default-no approvals. DEX Screener remains the default and CI does not call GeckoTerminal. Provider activation stays blocked pending terms/use-rights/quota approval; do not relax thresholds. Production-provider selection, deployed-binary/source matching and live fallback approval remain open. Phase 6 stays ACTIVE; trading is not authorized.

## Token-2022 extension TLV structure and semantic policy

The structural inspector and fail-closed semantic registry in [Phase 6.11](11-token2022-extension-tlv-inspector.md) validate TLV entry boundaries, lengths, duplicate types, termination and account-kind applicability. Known types are inventoried against the published `spl-token-2022-interface` 3.1.2 enum with a conservative impact category; unknown/future IDs are explicitly blocked. No extension-bearing token is deemed safe or eligible for identity evidence by this Phase 6 policy. Token-specific safety review remains Phase 7.

## SPL Token base-state decoder

The decoder in [Phase 6.10](10-spl-token-base-state-decoder.md) parses the classic 82-byte mint and 165-byte token-account base layouts and validates the base prefix of Token-2022 data. Extended Token-2022 accounts are flagged `EXTENSIONS_UNINSPECTED` by the base decoder; the separate [Phase 6.11 inspector/policy](11-token2022-extension-tlv-inspector.md) inspects TLV structure and routes known, unknown and scope-invalid types conservatively. Extension-bearing accounts remain ineligible for identity evidence pending the actual token-safety review in Phase 7.

## Read-only RPC transport

A bounded, read-only `getMultipleAccounts` transport is implemented in [Phase 6.9](09-solana-rpc-account-reader.md). It preserves the response context slot and account order, hashes the response, marks injected-fetch results synthetic, and never makes an RPC call in CI. It returns raw base64 account data only; [Phase 6.12](12-raydium-cpmm-candidate-decoder.md) now consumes that transport for a pinned-source Raydium CPMM candidate. Provider selection and real-source validation remain separate gates.

## On-chain identity evidence boundary

The pure evidence checker in [Phase 6.8](08-on-chain-identity-evidence-contract.md) validates a decoded pool/program/mint/vault bundle against an explicitly approved program/decoder registry with disjoint DEX/token/loader roles. It does not fetch RPC data or decode raw account bytes. The generic reader and a pinned-source Raydium CPMM candidate decoder now exist, but only mocked/synthetic tests have run; no live identity result may be claimed until independent real-source verification and owner-approved provider selection.

## Provider agreement and fallback safeguards

Implementation and synthetic-test validation on the active PR branch passed CI/typecheck/build/tests/npm audit/Gitleaks ([run 40819982381](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982381)), Dependency Review ([run 40819982477](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982477)), and CodeQL ([run 40819979725](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819979725)). No provider endpoint was contacted by these tests.

The agreement evaluator requires at least two eligible independent providers; recalculates freshness from the injected clock; checks candidate health and provenance identity; and uses exact identity/value comparison without invented tolerances, and requires distinct upstream independence groups (not just distinct adapter names). A lone fallback, timestamp mismatch, missing required measure, stale data, or provider disagreement blocks progression. Even an agreement only permits consideration for independent on-chain validation; trading is always unauthorized. See [Phase 6.7](07-provider-agreement-and-fallback-policy.md).

## Exit rule

**Phase 6 remains ACTIVE.** The protocol-decoder implementation item now has synthetic test coverage, but Phase 6 cannot close until an integrated identity assessment succeeds against a real, independently sourced pool using an owner-approved read-only RPC source, the chosen RPC/indexed-provider plans and their current terms/quota/retention behavior are reviewed, the usage budget is explicitly approved, and the selected provider's fallback/degraded modes are tested. A mock run cannot count as live-source verification. Closing Phase 6 does not authorize token-safety scoring (Phase 7) or execution.


## Program deployment integrity

Phase 6.18 adds an optional SHA-256 verification path for the Raydium CPMM ELF bytes stored in the loader-v3 ProgramData account. It requires the exact reference artifact byte length alongside the hash to handle allocation padding safely. Without both values, it remains NOT_ASSESSED and no additional ProgramData request occurs by default or in CI. CI [#234](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40944936764) passed 204/204 tests and all quality/security checks; the run was fixture-only and did not read live ProgramData. A matched hash is evidence of byte equality to that reference only and does not certify the build, permanently pin an upgradeable program, or authorize trading. See [Phase 6.18](18-raydium-program-deployment-integrity.md).


## Pinned-source build evidence (Phase 6.19)

The manual build workflow clones the pinned Raydium CPMM source commit, uses the checksum-pinned Solana Verify CLI and its Docker build environment, then performs two clean builds and compares exact ELF SHA-256 and byte length. The resulting manifest records the source commit/tree, critical build-input hashes, declared toolchain versions, binary checksum, both build outcomes and artifact digests. Implementation CI [#236](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40957968850) passed 213/213 tests, typecheck/build/repository validation, zero dependency vulnerabilities and Gitleaks. CI does not trigger the actual build workflow and no RPC/network identity request is included. Run it manually from `main` only when the build-only confirmation is intentionally set to `yes`. The build manifest is candidate evidence, not proof that the deployed program currently matches; the separate Phase 6.18 ProgramData check remains an explicit operator-reviewed step.


## Local reference-build evidence review (Phase 6.20)

A local-only review script and synthetic regression tests were added in [PR #32](https://github.com/hamza131zara/Auto-Trading-Agent/pull/32). CI [#238](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40959057478) passed 224/224 tests, repository validation, typecheck/build, dependency audit and Gitleaks; [Dependency Review run](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40959057546) passed. The script checks a completed Phase 6.19 manifest against both supplied ELF files, recomputes SHA-256 and exact byte lengths, verifies the independent source/toolchain pins and fails closed on inconsistent or incomplete evidence. It does not prove GitHub artifact provenance, call RPC, inspect live ProgramData, or authorize trading. Phase 6.19's actual pinned source build still must be run manually before any reference artifact is considered; Phase 6.18 live verification remains a separate explicitly approved step.


## First live Raydium ProgramData hash comparison

The separately approved [Phase 6.18 live run #4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41004294300) returned MATCH for both pool/program identity and the deployed Raydium CPMM ELF. Expected and observed SHA-256 were identical for the exact 722,632-byte ELF; 71,192 bytes of remaining ProgramData allocation were zero. Both Program and ProgramData were read at finalized context slot 463153970. The program is still upgradeable. The indexed source timestamp remains unknown and independent market-price comparison remains not assessed. This is historical byte-identity evidence at the recorded slot—not a permanent pin, production approval, or trading authorization. See [Phase 6.18](18-raydium-program-deployment-integrity.md) for details.


## Latest live Phase 6.14 discovery — run #12

[Run #12](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41005895558) completed both allowlisted SOL/USDC and SOL/USDT Raydium API queries (31 and 14 terminal records), checked all 45 returned accounts via finalized RPC, decoded 24 CPMM candidates and cross-checked all 24 exact addresses against DEX Screener. The scan was complete with no un-cross-checked candidates and zero pools meeting the unchanged USD 100,000 liquidity and USD 10,000 24-hour-volume thresholds. The leading diagnostic pool reported about USD 569.56/569.77 liquidity and USD 415.92/440.32 24-hour volume in Raydium/DEX Screener respectively. Source freshness remained UNKNOWN; no pool was recommended. This is discovery evidence only, not trade approval.


## Phase 6.21 — Reviewed provider lineage and source timestamps

A fail-closed provider registry and combined lineage/agreement wrapper now define the upstream source family, allowed evidence roles, event/observation/slot/none timestamp semantics, diagnostic access and commercial-rights status for each reviewed provider. GeckoTerminal and CoinGecko share one upstream family. All profiles remain independence-unverified and production-unapproved; missing source timestamps remain UNKNOWN. Birdeye and GeckoTerminal remain disabled pending terms/rights review. See [Phase 6.21](21-provider-source-lineage-registry.md). Merged through [PR #36](https://github.com/hamza131zara/Auto-Trading-Agent/pull/36). Post-merge CI [#249](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41011278975) passed 239/239 tests, zero dependency vulnerabilities, repository validation, typecheck/build and Gitleaks. Both CodeQL analyses and Dependency Review passed on the PR. No live provider calls were made; spend remains $0.


## Phase 6.22 — Pyth and critical market-data lineage

The Pyth reserve-price path now uses the Phase 6.21 provider registry. Base/USD and quote/USD feed identity/publication times are checked against the Pyth profile; indexed price timestamps are classified from the actual event/observation fields. A composed final gate recomputes both provider-agreement and independent-price lineage before any on-chain evidence progression. Current providers remain unverified and blocked; the manual Pyth report marks the final critical gate not assessed when multi-provider agreement evidence is absent. See [Phase 6.22](22-pyth-independent-lineage-and-critical-gate.md). It was merged in [PR #39](https://github.com/hamza131zara/Auto-Trading-Agent/pull/39); post-merge CI [#263](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41012644552) passed 245/245 tests, zero vulnerabilities, typecheck/build, repository validation and Gitleaks. Both CodeQL analyses and Dependency Review passed on the PR.


## Phase 6.23 — Provider resilience integration

The read-only collection now has a composed assessment that validates attempt/health/observation consistency and keeps raw provider agreement diagnostics separate from the registry-backed lineage result. Rate-limit, fallback disagreement, stale/missing timestamps, circuit cooldown, recovery disagreement and authentication lockout are covered by deterministic tests. The current unverified provider registry still blocks evidence progression. Multi-process shared health persistence and probe leases remain open. See Phase 6.23 (23-provider-resilience-integration.md).


## Phase 6.23 — Provider resilience integration

A composed assessment now validates orchestration candidates, normalized observations, provider health and attempts; reports raw agreement separately from reviewed source lineage; and only permits progression through the reviewed gate. Deterministic tests cover rate limits, fallback disagreement, stale/missing timestamps, circuit cooldown, recovery disagreement and auth lockout. Shared health persistence and distributed recovery-probe leasing remain open before multi-process production. See [Phase 6.23](23-provider-resilience-integration.md). Merged through [PR #41](https://github.com/hamza131zara/Auto-Trading-Agent/pull/41); post-merge CI [#269](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41022186170) passed 251/251 tests and all repository checks. Both CodeQL analyses and Dependency Review passed on the PR.


## Phase 6.24 — Shared health and recovery-probe leases

An optional driver-neutral PostgreSQL store now persists provider health and coordinates circuit-recovery probes using database-clock atomic leases, expiry/reclaim and monotonically increasing fencing tokens. The orchestrator loads shared health and requires the distributed lease for recovery; stale workers cannot publish results. Only token digests are stored. The SQL migration is committed but unapplied, no driver is bundled, and real PostgreSQL multi-connection integration remains an explicit deployment gate. See [Phase 6.24](24-shared-provider-health-and-recovery-leases.md).


## Phase 6.24 — Shared provider health and recovery-probe leases

Merged through [PR #43](https://github.com/hamza131zara/Auto-Trading-Agent/pull/43), commit `9ccae49`. Post-merge CI [#274](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41024455297) passed 262/262 tests, zero dependency vulnerabilities, typecheck/build, repository validation and Gitleaks. Both CodeQL analyses and Dependency Review passed on the PR. The migration remains unapplied, no production driver or database credentials are included. Real PostgreSQL multi-connection verification was completed in Phase 6.25; production deployment still requires separate operational approval. See [Phase 6.24](24-shared-provider-health-and-recovery-leases.md).


## Real PostgreSQL shared-health verification

Phase 6.25 is merged through [PR #45](https://github.com/hamza131zara/Auto-Trading-Agent/pull/45), commit `8ea700041c77ae661b12beee0c0bdacc305026ed`. PR PostgreSQL run [#4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033711991) and main PostgreSQL run [#5](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033906105) both passed 4/4 real-engine integration tests on PostgreSQL 18.6. Main CI [#281](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033905950), PR Dependency Review [#116](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033711853), and PR CodeQL/Gitleaks [#257](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033707564) also passed. The actual schema, independent worker connections, lease claim arbitration, DB-clock renewal/expiry, fencing, persistence and rollback are now verified against PostgreSQL; production DB deployment and trading remain unauthorized. See [the Phase 6.25 runbook](25-real-postgres-integration.md).


## Phase 6.26 — Pyth Pro feed freshness and provider rights

A separate, disabled Pyth Pro latest-price adapter now validates feed-generation time, publisher count, market session, session-specific quorum metadata, feed ID/mint binding and the minimum supported channel. Carried-forward prices and under-quorum updates fail closed. Synthetic tests use illustrative numeric feed IDs only; production Pyth Lazer IDs and min-publisher values require owner-reviewed symbology metadata.

Pyth Pro and its Hermes-compatible endpoint share the same pyth-network family. Five routers are redundant aggregation/signature paths over the common publisher-update stream; they do not count as five independent publisher data sources. Pyth publisherCount is not a source independence attestation.

The public terms review keeps all providers unapproved: DEX Screener customer-facing access/redistribution needs clarification; CoinGecko standard paid commercial use supports attributed display but not raw/API redistribution; Birdeye remains excluded absent written permission; Raydium use rights remain unreviewed; and Pyth Pro plan/customer data rights remain owner decisions. No provider API/RPC calls, keys, activation or spend were used. See [Phase 6.26](26-pyth-pro-freshness-and-provider-rights-review.md).


## Phase 6.27 — Provider lineage and commercial-rights evidence intake

The next owner-evidence gate is now specified as a controlled intake workflow. It lists the exact Pyth SOL/USD and USDC/USD symbology fields, publisher-level upstream source disclosure, symmetric pairwise independence evidence, and provider-specific plan/contract rights needed for the actual customer experience. Evidence receipt, technical review, lineage independence, diagnostic rights and production rights are separate states; none automatically changes runtime approvals.

No owner artifacts have been received or approved by this step. Provider profiles remain UNVERIFIED/UNAPPROVED, spend remains USD $0, no provider/RPC calls or credentials are introduced, and trading remains unauthorized. See [Phase 6.27](27-provider-lineage-and-commercial-rights-evidence-intake.md).


## Phase 6.28 — Provider evidence manifest validator

An offline validator now checks the structure and internal consistency of a versioned provider-evidence manifest: Pyth feed-pair metadata, publisher disclosure, two-sided pairwise attestations, commercial-rights scope and local artifact digests. It rejects credential-bearing fields and unsafe local artifact paths. A successful result means `STRUCTURALLY_VALID_NOT_AN_APPROVAL` only; it cannot establish authenticity, publisher independence, legal permission or production readiness and does not mutate provider flags. No real owner evidence or permissions have been supplied. See [Phase 6.28](28-provider-evidence-manifest-validator.md).


## Phase 6.29 — Canonical evidence binding and lineage consistency

The evidence manifest is now version 2. Its validator binds Pyth metadata to the adapter's exact SOL/USD and USDC/USD feed IDs and mainnet mints, checks pairwise independence against the canonical source-family registry, requires cross-record evidence references, and prevents rights scopes or owner decisions from exceeding linked evidence. Pyth Pro/Hermes and GeckoTerminal/CoinGecko remain same-family aliases and cannot be declared independent. No real owner evidence or permission has been added. See [Phase 6.29](29-canonical-evidence-binding-and-lineage-consistency.md).

## Phase 6.30 — Offline provider-evidence packaging

A local-only v2 manifest packager now computes bounded SHA-256 digests for owner-supplied LOCAL_FILE artifacts, checks supplied digests, and runs the canonical validator before writing. It refuses symlink/traversal paths, repository-local evidence locations, output overwrite and credential-bearing metadata keys. It writes only the manifest metadata, never artifact contents, and has no network, provider, RPC, credential, wallet, or trading path. No owner evidence has been received or approved; all providers remain unapproved and Phase 6 remains ACTIVE. See [Phase 6.30](30-offline-provider-evidence-packaging.md).


## Phase 6.38 — PostgreSQL pool lifecycle and timeout policy

An offline driver-neutral preflight now checks explicit pool timeout relationships, a bounded acquisition queue, stop-admission-then-drain shutdown behavior and an isolated evidence matrix for timeout enforcement/cancellation. It complements the aggregate pool arithmetic in Phase 6.35 and the strict client TLS policy in Phase 6.37. No driver is selected or configured; effective runtime mapping and real PostgreSQL behavior still require owner-selected driver evidence. All database deployment, provider activation and trading approvals remain false. See [Phase 6.38](38-postgres-pool-lifecycle-policy-preflight.md).


## Phase 6.39 — Test-only node-postgres pool lifecycle experiment

The disposable PostgreSQL 18.6 workflow now exercises the existing transient `pg@8.23.1` dependency for pool acquisition timeout, server statement/lock/idle-transaction timeouts, an adapter-side bounded admission gate and graceful `pool.end()` behavior. The exact package version is asserted at runtime. The driver remains test-only and is not selected for production; a passing run establishes behavior only in the disposable CI service. See [Phase 6.39](39-node-postgres-pool-lifecycle-experiment.md).


## Phase 6.40 — node-postgres TLS handshake verification experiment

The PostgreSQL CI workflow now creates disposable CA/certificate fixtures and tests the test-only node-postgres client against PostgreSQL 18.6 for trusted-chain acceptance, untrusted CA rejection, hostname mismatch rejection, expired-certificate rejection, TLS-disabled endpoint rejection and protocol-minimum negotiation. The driver remains test-only; no production CA, endpoint, connection configuration or driver selection is approved. See [Phase 6.40](40-node-postgres-tls-handshake-verification.md).


## Phase 6.43 — Signed owner provider-use decisions

A separate Ed25519 verification primitive now checks the full provider-use decision payload against an independently supplied owner-controlled trust-key registry. Key validity/revocation, provider and purpose scope, owner identity, finite decision expiry, ambiguous records and signature integrity are fail-closed. The resolver is not wired into live runtime bootstrap because no real owner public key or signed decision has been supplied and reviewed. Test keys are ephemeral only. A valid signature does not authenticate underlying evidence or grant provider/legal rights. See [Phase 6.43](43-signed-provider-use-decisions.md). The work is under review; no provider activation, production approval, DB deployment, wallet, signer or trading permission is added.


## Phase 6.44 — Live owner-key revocation freshness

A reloadable provider-use resolver now re-reads the trusted-key/revocation registry for each provider attempt. It requires a bounded-age snapshot timestamp (maximum five minutes), rejects future/stale/malformed snapshots, and defaults to deny if the registry cannot be read. Tests prove a key revocation blocks the next attempt without a process restart. This still requires a real owner-controlled authoritative registry and does not create or approve a signing key. See [Phase 6.43 revocation-freshness section](43-signed-provider-use-decisions.md). Phase 6 remains ACTIVE and trading remains unauthorized.


## Phase 6.44 — Live owner-key revocation freshness

A reloadable provider-use resolver re-reads the trusted-key/revocation registry for each provider attempt. It requires an explicit bounded-age snapshot (maximum five minutes), rejects future/stale/malformed snapshots, and defaults to deny if the registry cannot be read. Tests prove that key revocation blocks the next attempt without a process restart. This still requires a real owner-controlled authoritative registry; no key is created or approved. See [Phase 6.44](44-owner-key-revocation-freshness.md). Phase 6 remains ACTIVE and trading remains unauthorized.


## Phase 6.45 — Live-source signed provider authorization bootstrap

The manual live-source CLI now requires verified signed diagnostic decisions for its selected RPC provider before RPC I/O, and passes a signed resolver into the DEX Screener orchestrator for direct pair lookups. The GitHub Actions job uses the protected `phase6-provider-authorization` Environment and reads decision envelopes/trusted Ed25519 public keys only from owner-managed environment secrets. Missing, malformed, revoked, out-of-scope or stale authorization blocks before network activity. No owner key, signed decision or provider approval has been created; an owner must configure the protected environment and supply current reviewed records. The one-shot GitHub Environment is not a dynamic revocation transport for a long-running agent. See [Phase 6.45](45-live-source-signed-provider-authorization-bootstrap.md). Phase 6 remains ACTIVE and trading remains unauthorized.
