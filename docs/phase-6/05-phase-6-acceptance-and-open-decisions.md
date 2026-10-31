# Phase 6.5 — Acceptance Criteria and Open Decisions

**Status:** ACTIVE — not complete. Phase 6.19 build #4 produced two byte-identical 722,632-byte Raydium CPMM ELF files from the exact pinned source/toolchain; Phase 6.20 reviewed the manifest and both artifacts. Phase 6.18 live Mainnet run #4 returned pool/program identity MATCH and ProgramData ELF hash MATCH at finalized slot 463153970; the deployed program remains upgradeable. The latest Phase 6.14 discovery run #12 completed both SOL/USDC (31 records) and SOL/USDT (14 records) queries, finalized-RPC checked all 45 pool accounts, decoded 24 CPMM candidates, and cross-checked all 24 exact pool addresses against DEX Screener. The scan was complete with zero candidates meeting the unchanged USD 100,000 liquidity and USD 10,000 24-hour-volume thresholds. Indexed source freshness remains UNKNOWN, the prior Pyth diagnostic comparison remains a 63-bps disagreement against a 10-bps diagnostic tolerance, and independent market-data agreement, production-provider approval, upgrade-authority policy, and trading authorization remain unresolved/false.

## Acceptance checklist

- [x] Canonical Solana market-observation schema is versioned, strictly validated and preserves explicit units/nulls/provenance in `@ata/market-data`.
- [x] Solana public-key encoding, non-negative decimal strings, counts, slots, units and UTC timestamps have positive/negative tests.
- [x] Freshness assessment is deterministic under an injected clock and returns distinct FRESH, STALE, UNKNOWN and INVALID states.
- [x] Provider health is distinct from freshness/data quality and has tested success, retryable failure, threshold/circuit-open, auth/config failure and recovery paths.
- [x] Synthetic fixtures cover fresh, stale retrieval, stale source event, missing timestamp, future source time and invalid address; unit tests cover malformed decimal/unit and provider failure/recovery paths.
- [x] Replay tests run without external network access, production credentials or non-deterministic clocks.
- [x] The DEX Screener candidate's mocked-fetch tests pass in CI for exact identity matching, unit/decimal normalization, fetch/body timeout classification, rate-limit handling, and sanitized failures. Quality CI passed at [run 40818498807](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40818498807); Dependency Review passed at [run 40818499007](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40818499007), and the included Gitleaks scan passed in the quality CI run. These are synthetic/mock tests; CI makes no live DEX Screener API call.
- [x] Provider disagreement/fallback evidence gate implemented with deterministic tests for exact identity/value matching, unavailable primary, single-fallback insufficiency, observation and provider-health freshness rechecks, missing measures, synthetic fixtures, duplicate upstream-source rejection and fail-closed conflict handling. The provider-attempt gate now blocks active circuit cooldowns and auth/configuration-unavailable sources, permits an explicitly serialized post-cooldown recovery probe, requires stale-health rechecks, and rejects out-of-order result transitions. CI [#208](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40904053714) passed 161/161 tests, typecheck, build, dependency audit and Gitleaks. See [Phase 6.7](07-provider-agreement-and-fallback-policy.md). Current-head validation passed: [CI/Gitleaks](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982381), [Dependency Review](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982477), and [CodeQL](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819979725). The reusable `ReadOnlyMarketDataOrchestrator` is wired into the Phase 6.13 read-only identity runner, validates normalized observations against the requested pool/mints, updates health using stable error codes, and continues to configured fallbacks after a primary failure. CI [#213](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40907483897) passed 169/169 tests plus typecheck, build, dependency audit and Gitleaks. Multi-provider fallback is unit-tested with stub adapters only; live fallback remains open because only one indexed provider is approved.
- [x] Combine indexed-provider agreement with independent reserve/USD comparison using `assessCriticalMarketDataEvidenceGate`. Progression to the next on-chain validation stage is blocked unless both provider consensus and independent price comparison are `AGREED`, comparison evidence is complete, and provider evidence is non-synthetic. Added live-run #2 regression values asserting a 63-bps reserve/reference disagreement, missing indexed source timestamps, an incomplete evidence gate and `tradingAuthorized: false`. CI [#204](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40898220288) passed 156/156 tests, typecheck, build, dependency audit and Gitleaks.
- [x] Add a disabled-by-default GeckoTerminal exact-pool adapter with explicit units/nulls, strict pool/mint identity, raw-payload hash, bounded response parsing, pinned API version, sanitized failures, synthetic fixture provenance, and conservative 7-second in-process request pacing. The pool-details snapshot remains source-timestamp unknown and the adapter is not active in the live provider registry. CI [#227](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40931411803) passed 187/187 tests, typecheck, build, dependency audit and Gitleaks. A separate OHLCV price-observation path uses the latest minute candle-start timestamp conservatively, validates base/quote metadata, and requires explicit indexed-provider/source-family approval plus freshness checks. It does not timestamp liquidity/reserve/24h-volume fields or authorize live activation. See [Phase 6.16](16-geckoterminal-provider-review-and-adapter.md).
- [x] Add a read-only JSON-RPC `getMultipleAccounts` transport for explicit account lists, bounded streaming reads, strict response validation, raw-response digest, timeout/cancellation, context-slot enforcement and sanitized errors. CI uses only mocked fetch; injected responses are marked synthetic. See [Phase 6.9](09-solana-rpc-account-reader.md).
- [x] Add the provider-neutral `assessIndependentReservePriceAgreement` comparator using exact decimal/integer arithmetic. It requires explicit base/USD and quote/USD feed identities, an approved provider and independence group, source/retrieval freshness limits, and a supplied deviation tolerance; missing indexed event timestamps remain `NOT_ASSESSED`, and synthetic evidence cannot become operationally complete. CI run [#187](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40877555420) passed 143/143 tests. Live provider/feed selection and policy values remain open.
- [x] Add the Pyth Hermes SOL/USD and USDC/USD read-only reference adapter plus a manual-only workflow. Unit tests cover exact integer/exponent conversion, pinned feed↔mint identity, authentication/rate-limit/oversize handling, missing/duplicate feed data, hashes, and synthetic evidence. The comparator also fails closed when the two reference-feed publication times exceed the explicit policy skew. CI [run #194](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40880232949) passed 152/152 tests. Manual live run [#2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40892770577) fetched both feeds successfully but returned `DISAGREEMENT` (63 bps vs a 10-bps diagnostic tolerance); DEX Screener comparison remains `NOT_ASSESSED` because source timestamps are missing. See [Phase 6.15](15-pyth-hermes-reference-adapter.md).
- [x] Add a base-state decoder for classic SPL Token mint/account records with strict program-owner/size/tag/state checks and exact integer strings. Extended Token-2022 records remain flagged `EXTENSIONS_UNINSPECTED` by the base decoder and are ineligible for identity evidence pending the separate fail-closed TLV inspector/policy and Phase 7 review. See [Phase 6.10](10-spl-token-base-state-decoder.md).
- [x] Add structural Token-2022 TLV parsing for type/length boundaries, bounds checking, duplicates and terminators. The separate fail-closed registry classifies current known IDs at a conservative impact/account-kind level and blocks unknown/future or wrong-scope IDs; no extension-bearing account is safety-approved. See [Phase 6.11](11-token2022-extension-tlv-inspector.md).
- [x] Add a fail-closed semantic registry for the current official Token-2022 extension type enum: known IDs are named and mapped to a conservative impact category/account scope; wrong-scope and unknown/future IDs are blocked. No extension-bearing token is auto-approved for identity evidence; phase-specific safety review remains Phase 7. See [Phase 6.11](11-token2022-extension-tlv-inspector.md).
- [x] Add a protocol-neutral evidence-bundle checker for pool/program/mint/vault identity, explicit, disjoint decoder/token/loader allowlists, commitment/context-slot gates and evidence provenance. Synthetic-only fixtures cannot advance. See [Phase 6.8](08-on-chain-identity-evidence-contract.md).
- [x] Implement the read-only Solana `getMultipleAccounts` transport with mocked tests; it preserves context slots and returns bounded raw account data. See [Phase 6.9](09-solana-rpc-account-reader.md).
- [x] Implement and test the pinned Raydium CPMM candidate PoolState/AMM-config decoder and connect the raw reader, LP mint, mint/vault base state, authority/config/observation/vault PDA checks, and generic identity evidence gate. CI uses constructed/mock evidence and returns `SYNTHETIC_MATCH`; production protocol selection and live validation are still blocked. See [Phase 6.12](12-raydium-cpmm-candidate-decoder.md).
- [x] Add an explicit live-source validation runner for the pinned Raydium CPMM candidate with two modes: a supplied target snapshot or direct DEX Screener lookup for the exact pool/base/quote mints. Injected/mock fetch results remain synthetic. A manual-only GitHub Actions workflow asks for three explicit approvals, slot and retrieval-age policy, uses HTTPS read-only Solana RPC, and emits redacted identity evidence. Normal CI remains network-free. See [Phase 6.13](13-live-source-validation-runner.md). The first real run returned `MATCH` with `synthetic: false`, `finalized` commitment and context slot `462809432`; its evidence summary is recorded below. This is identity evidence only, not production approval or market-data validation.
- [x] Record the first live-source identity result with pool/mint identities, request IDs, raw-response digests, decoder version and known limitations. See [run #2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40840569303) and [Phase 6.13 evidence notes](13-live-source-validation-runner.md#first-real-source-run-2026-10-29).
- [x] Complete a second manual live identity validation with decoded on-chain reserves for the discovery diagnostic pool; preserve `independentComparisonStatus: NOT_ASSESSED` and `sourceFreshness: UNKNOWN` until independent source policy is approved. See [run #3](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40875718349) and [the second live-source evidence note](13-live-source-validation-runner.md#second-live-identityreserve-validation--2026-10-29).
- [x] Add a manual-only SOL stablecoin CPMM candidate-discovery tool that queries Raydium API v3's exact-mint Standard-pool list for canonical SOL/USDC and SOL/USDT pairs, uses bounded numbered pagination, verifies returned pool owner/layout/discriminator and each quote mint through finalized RPC and the pinned PoolState decoder, then cross-checks exact pool IDs/mints and unchanged liquidity/volume thresholds through DEX Screener. Mocked tests cover approval gates, exact quote mint matching, program-ID disagreement, malformed responses, incomplete pages and fail-closed validation. See [Phase 6.14](14-cpmm-candidate-discovery.md). The first DEX Screener-only scan found no CPMM among five surfaced pools; it was not evidence that no CPMM exists in Raydium's broader pool index. The initial live SOL/USDC discovery succeeded in [run #9](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40870237606) but found no qualifying candidate. The corrected expanded live run [#11](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40874763390) completed both Raydium quote searches, finalized-RPC checked all 45 accounts, and cross-checked all 24 CPMM candidates; no pool met both indexed-source thresholds. CI [#183](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40874454549) passed 136 tests and all quality/security checks. Next: run the separate Phase 6.13 identity/reserve diagnostic on the top indexed-liquidity pool, explicitly as a low-liquidity diagnostic and not as a trading candidate. Independent reserve/price review remains outstanding.
- [ ] Production approval of the DEX Screener candidate requires a fresh official schema/terms/quota review, account/budget decision where applicable, and documented on-chain validation/fallback/disagreement behavior.
- [ ] Production use stays disabled until selected adapters are tested against the chosen plan and critical fields have independent validation paths.

## Open decisions

| ID | Decision | Default / gate |
|---|---|---|
| P6-O-001 | Primary and fallback RPC provider | Unselected; official current docs, quota, latency, failover and account terms required |
| P6-O-002 | Indexed discovery provider(s) | DEX Screener has a fixture-tested read-only candidate adapter only; production selection still requires official schema/terms/quota review, budget, freshness semantics, and replacement/fallback plan |
| P6-O-003 | Source-specific freshness bounds | Must be evidence-based and approved before a freshness state is used as a trading gate |
| P6-O-004 | Canonical USD valuation semantics | Store explicit source units; no implicit conversions or inference without a reviewed FX/quote rule |
| P6-O-005 | Historical retention/raw-payload policy | Minimize retained data; define redaction, cost, provenance and reproducibility need |
| P6-O-006 | Provider disagreement tolerances | No silent preference; critical conflicts remain inconsistent/unknown until independently resolved |
| P6-O-007 | Stream reconnect/replay and rate-limit policy | Provider-specific and fixture-tested before streaming adapter approval |

## Phase exit rule

**Phase 6 remains ACTIVE. Do not mark it complete yet.** One genuine DEX Screener-to-Solana RPC run returned `MATCH` for pool `7JuwJuNU88gurFnyWeiyGKbFmExMWcmRZntn9imEzdny` with SOL/USDC mint identities at finalized context slot `462809432` ([run #2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40840569303)). This closes only the narrow requirement to demonstrate one non-synthetic on-chain identity check. The report records no source-event timestamp; DEX Screener market-data freshness therefore remains `UNKNOWN`. The pool page reviewed for this run also showed very low liquidity, so it is not accepted as a trading candidate. The initial [Phase 6.14 CPMM candidate discovery](14-cpmm-candidate-discovery.md) live scan found no pool meeting the filters. The revised code covers both canonical SOL/USDC and SOL/USDT quote pairs without changing thresholds. The corrected live scan in run #11 completed all 24 DEX Screener cross-checks with no qualified pool. Phase 6.13 live-source run #3 then returned a non-synthetic identity MATCH and decoded same-slot reserves for the diagnostic pool, but did not validate independent price agreement or source freshness. The provider-neutral comparator and Pyth adapter have been exercised against live feeds in [run #2](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40892770577), which returned a 63-bps reserve/reference disagreement and an unassessed indexed-price comparison. A combined `assessCriticalMarketDataEvidenceGate` now prevents otherwise-agreeing indexed providers from advancing when independent USD/reserve evidence disagrees or is incomplete. Regression tests cover the live values, timestamp gap and hard blocking. The orchestration path is implemented and deterministically tested. The adapter supplies a second indexed data candidate to evaluate, not an approved production fallback. Next, obtain explicit terms/use-rights and quota approval, solve the source-timestamp gap, and only then consider a controlled read-only request against a threshold-qualified pool. Do not lower existing thresholds or authorize spend. Production provider and trading approval remain false. The diagnostic pool remains ineligible for trading. Remaining gates: only choose a higher-liquidity pool after the exact pair is cross-indexed and its on-chain owner/state layout is confirmed; run the full identity workflow for any selected candidate; verify the actual deployed program binary against a build from the pinned source (account executable/loader checks alone are insufficient); validate price, liquidity and volume against a truly independent source and on-chain reserves; select and approve production RPC/indexed providers and account plans; review current endpoint/schema/terms/quota/retention rules and approve a usage budget for the intended distribution model; and exercise the selected providers' live fallback/degraded behavior. A public rate limit, account-identity `MATCH`, or successful fixture test cannot satisfy these gates. Close Phase 6 only after all acceptance items are tested, critical identity and market data are independently validated, provider disagreement/fallback modes are proven safe, and replay is deterministic. Phase 7 token safety and all trade execution remain out of scope.


## Phase 6.17 — Manual comparison price-source wiring

- [x] Wire exact-pool GeckoTerminal minute-OHLCV close into the manual Pyth comparator through `indexedSourceObservedAt`; preserve candle-open time as an observation timestamp and require explicit indexed-provider/group approval.
- [x] Keep DEX Screener as the unchanged default and identity lookup source; report the actual comparison-price provider separately.
- [x] Gate GeckoTerminal behind two affirmative default-no workflow inputs and the same script preflight checks; missing approvals block before any request.
- [x] Add deterministic resolver tests for default behavior, missing approval, timestamp-kind preservation, exact pool/mint propagation, and invalid-source rejection.
- [x] CI [run #229](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40934354059): 191/191 tests passed; typecheck, build, repository validation, dependency audit and Gitleaks passed.
- [ ] Approve GeckoTerminal current use rights, attribution, storage, quota and budget for intended use; separately authorize any manual live request.

No provider plan is purchased or assumed. Pool thresholds and the diagnostic comparison tolerance are unchanged. Phase 6 completion, production provider approval, and trading authorization remain false.


## Phase 6.18 — Deployed Raydium CPMM bytecode integrity

- [x] Add strict parsing of upgradeable-loader Program and ProgramData account state, the ProgramData pointer, metadata, deployment slot, upgrade-authority indicator, ELF magic and ELF SHA-256.
- [x] Add deterministic tests for hash match/mismatch, missing source reference, synthetic evidence, wrong ProgramData address, malformed loader metadata and context-slot ordering.
- [x] Wire an optional Program + ProgramData read at a shared finalized context slot into the manual identity runner when a reviewed reference ELF hash and exact artifact byte length are supplied.
- [x] Require separate affirmative build/hash review when the reference hash and byte length are supplied together; verify all remaining ProgramData allocation bytes are zero before accepting the exact-length ELF hash. Neither reference input is set by default.
- [x] CI [#234](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40944936764): 204/204 tests passed, typecheck/build/repository validation passed, dependency audit reported zero vulnerabilities, and Gitleaks passed for paired hash/length and zero-padding hardening.
- [x] Build the exact pinned Raydium source twice with the reviewed pinned toolchain, preserving source/tree, build-input digests, tool checksum, logs and artifact hashes in [Phase 6.19 run #4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41003199007). The two ELF files were byte-identical at 722,632 bytes.
- [x] Independently review the downloaded manifest and both ELF files with the Phase 6.20 local reviewer. The manifest and both recomputed file hashes/lengths matched; the downloaded artifact ZIP SHA-256 also matched GitHub's advertised artifact digest. This is consistency/provenance review within the pinned workflow, not independent cross-organization reproduction or cryptographic build attestation.
- [x] Obtain the separately approved one-off read-only Mainnet ProgramData comparison in [Phase 6 live validation run #4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41004294300): deployed ELF SHA-256 matched the reviewed reference at finalized context slot 463153970; exact ELF length 722,632 bytes; 71,192 bytes of trailing allocation were zero.
- [ ] Review the observed upgrade-authority presence and make an explicit deployment/monitoring policy decision before production selection.

The live comparison establishes byte equality only at the recorded finalized slot. The program remains upgradeable, so later deployments may change the bytecode; any later production decision must include an appropriate revalidation/monitoring policy. The result does not close market-data freshness, independent-price agreement, provider terms/fallback, Phase 7 token safety, production approval or trading authorization.


## Phase 6.19 — Pinned-source reference-build evidence

- [x] Add a manual-only build workflow pinned to the exact Raydium source commit/tree, official Solana Verify CLI version and CLI binary SHA-256.
- [x] Build two separate clean source copies with the controlled Docker-based verifier and capture build logs/artifacts without invoking Solana RPC.
- [x] Generate a manifest requiring pinned source/tree, clean worktrees, expected Rust/Anchor/Solana declarations, source build-input digests, successful build exit codes, ELF magic, and identical artifact SHA-256 and byte length.
- [x] Add deterministic tests for reproducible success and fail-closed handling of source drift, dirty/invalid metadata, build failure, wrong tool checksum, non-ELF artifacts and artifact hash/length divergence. CI [#236](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40957968850) passed 213/213 tests, typecheck/build/repository validation, dependency audit with zero vulnerabilities, and Gitleaks.
- [x] Run the manual build-only workflow on main after explicit approval: [successful run #4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41003199007). Both pinned-source builds completed successfully and emitted one evidence artifact.
- [x] Review the repeatability manifest, source commit/tree, toolchain/CLI pins, build-input digests, logs and two ELF artifacts with the local Phase 6.20 reviewer. Both ELF files matched at SHA-256 2a90c3302d1907dc9b8bd0b000e4620166e671316a440f10add0b4ba08f28b3d and 722632 bytes.
- [x] Separately authorize and complete the live ProgramData comparison only after reviewing the reference evidence: [Phase 6 live run #4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41004294300) returned MATCH. The source-build workflow itself remained RPC-free.

The two builds establish repeatability in the pinned runner/toolchain, not independent cross-organization reproducibility. The local review verifies the manifest/artifact consistency and GitHub artifact digest, but does not cryptographically attest the GitHub Actions runner. The later live comparison is separate and only establishes byte equality at its recorded slot; neither run authorizes trading.


## Phase 6.20 — Local reference-build evidence review

- [x] Add a local-only manifest/ELF review script that recomputes both artifact SHA-256 values and exact byte lengths, validates the pinned source/toolchain metadata and fails closed on inconsistency.
- [x] Add fixture-based regression tests and the Phase 6.20 runbook; CI [#238](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40959057478) passed 224/224 tests and Dependency Review passed.
- [x] Apply the reviewer to the successful Phase 6.19 run #4 artifact and preserve its local report outside the repository.

A passing local review is a candidate for human provenance review; it is not cryptographic build attestation, live ProgramData verification, production-provider approval or trading authorization.

## Provider legal and timestamp screening — 2026-10-30

- **Birdeye:** Its official Price endpoint documents a per-token update time and its Pair OHLCV V3 endpoint is scoped to one exact pair, with second-level intervals available. This is a potentially useful timestamped source candidate. However, the published Birdeye Data Terms of Service restrict account/service use to personal own use, prohibit resale/redistribution and third-party access to service/data without prior written consent, and prohibit using the service/data to create a competing product. The published terms page says last updated 11 April 2025. The product is intended to serve customers, so the current public terms are not enough to authorize this use. No Birdeye adapter is enabled, no key is requested, no API call is made, and spend remains $0. Obtain written permission for the exact self-hosted/multi-customer agent delivery model before integration. Official references: [Price endpoint](https://docs.birdeye.so/reference/get-defi-price), [OHLCV V3 - Pair](https://docs.birdeye.so/reference/get-defi-v3-ohlcv-pair), [pricing](https://docs.birdeye.so/docs/pricing), [Terms of Service](https://birdeye.so/data-api/terms-of-service).

- **GeckoTerminal / CoinGecko:** The timestamped OHLCV candle path remains a candidate for price-only observation evidence, not for pool liquidity/reserve/24-hour-volume freshness. Current CoinGecko licensing guidance says paid self-serve plans include standard commercial display rights with attribution, but not data/API redistribution or sublicensing; redistribution/resale requires a custom license. The free Demo/keyless tier does not grant commercial rights. The product must also follow plan-specific usage/retention rules and attribution requirements. Do not activate the existing disabled adapter or incur spend until the exact customer-facing use, whether customers can extract/reuse data, attribution, retention and plan are approved in writing where needed. Official references: [GeckoTerminal API docs](https://api.geckoterminal.com/docs/index.html), [commercial vs custom licenses](https://support.coingecko.com/articles/1043089972-what-are-the-differences-between-commercial-and-custom-licenses), [CoinGecko API plans](https://www.coingecko.com/en/api).

- **Pyth Hermes:** The existing SOL/USD and USDC/USD adapter is the current independent oracle-reference candidate and returns feed publication timestamps. Its prior live comparison disagreed with the low-liquidity diagnostic pool by 63 bps under the explicit 10-bps diagnostic tolerance; do not increase tolerance or use the diagnostic pool as a trading candidate. The Pyth provider/account plan, key handling, usage terms and comparison policy remain owner-controlled gates. Official reference: [Hermes API](https://docs.pyth.network/api-reference/pyth-core/hermes).

**Decision:** No additional indexed provider is approved or activated at this time. Continue to preserve $0 spend, default-no live provider gates, strict source freshness, exact-pool identity, independent-source requirements and existing discovery thresholds. A timestamp field alone does not prove underlying source independence, market freshness or commercial rights.


## Phase 6.14 — Latest live candidate-discovery evidence

- [x] Repeat the complete SOL/USDC and SOL/USDT Raydium CPMM candidate scan at unchanged USD 100,000 liquidity and USD 10,000 24-hour-volume thresholds: [live run #12](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41005895558) completed both terminal API queries, finalized-RPC checked all 45 returned pool accounts, decoded 24 CPMM candidates, and cross-checked all 24 exact pool addresses against DEX Screener.
- [x] Verify the scan is complete (`scanIncomplete: false`), no accounts are truncated, no CPMM candidates remain un-cross-checked, and the result is `CPMM_FOUND_BUT_NONE_CROSS_QUALIFIED` with `thresholdQualifiedCount: 0` and no recommended follow-up pool.

The leading diagnostic pool remains far below both unchanged thresholds. The indexed source freshness remains UNKNOWN, and this discovery run is not price agreement, token-safety approval, production-provider approval, or trading authorization.


## Phase 6.21 — Reviewed provider lineage and source-time gate

- [x] Add an immutable reviewed provider-source registry for DEX Screener, GeckoTerminal/CoinGecko, Pyth Hermes, Raydium API, Birdeye and shared Solana RPC.
- [x] Give CoinGecko and GeckoTerminal the same upstream family; do not count product aliases as independent sources.
- [x] Define role-specific event/observation/slot/none timestamp semantics. Retrieval time cannot satisfy missing source-event freshness.
- [x] Add `assessProviderAgreementWithReviewedLineage` to bind the claimed provider/group and timestamp kind to the canonical evidence candidate before the existing comparator runs.
- [x] Add deterministic tests for unknown providers, forged family/timestamp claims, shared-family aliases, disabled/licensing-gated sources, and production approval.
- [ ] Obtain owner-evidenced, pairwise upstream-lineage attestations for the exact indexed/reference sources.
- [ ] Obtain written/commercial rights and owner approvals for the intended customer-facing delivery model.
- [ ] Validate current source freshness and independent agreement on a threshold-qualified pool; none was found in discovery run #12.

The implementation is an explicit BLOCKED-by-default evidence control. It was merged through [PR #36](https://github.com/hamza131zara/Auto-Trading-Agent/pull/36) and verified by post-merge CI [run #249](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41011278975): 239/239 tests passed, dependency audit found zero vulnerabilities, and repository validation, typecheck/build and Gitleaks passed. Both CodeQL analyses and Dependency Review also passed on the PR. This is not a provider approval, live source validation, trading authorization or roadmap phase completion.


## Phase 6.22 — Pyth comparison and final critical-gate lineage

- [x] Add a reviewed-lineage wrapper around the independent reserve/Pyth comparison. It binds the base/USD and quote/USD feeds to the exact approved Pyth profile and derives indexed timestamp kind from the actual source fields.
- [x] Add a final critical-market-data wrapper that recomputes both the provider-agreement and independent-comparison lineage gates internally before calling the existing critical evidence gate.
- [x] Wire the manual Pyth runner to report the reviewed lineage result while preserving the arithmetic comparison as diagnostic-only when lineage is unresolved.
- [ ] Obtain evidence-backed mutual owner attestations for the actual upstream indexed/reference source pair.
- [ ] Resolve provider commercial rights, plan/quota, retention and intended customer distribution before any diagnostic provider activation or production approval.
- [ ] Run the final critical gate on real provider-agreement evidence and a qualifying pool after discovery produces one; run #12 found none.

The Pyth runner explicitly reports the final critical gate as `NOT_ASSESSED` because it does not contain the separate multi-provider pool-metrics agreement evidence. No data is synthesized to fill that gap. These wrappers cannot authorize trading. Phase 6.22 was merged through [PR #39](https://github.com/hamza131zara/Auto-Trading-Agent/pull/39) and verified by post-merge CI [run #263](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41012644552): 245/245 tests, zero dependency vulnerabilities, repository validation, typecheck/build and Gitleaks passed. Both CodeQL analyses and Dependency Review also passed on the PR.


## Phase 6.23 — Provider disagreement, health, fallback and recovery integration

- [x] Add an assessment boundary that consumes a completed read-only orchestrator collection and validates candidate/observation/health/attempt identity and cardinality.
- [x] Preserve raw agreement diagnostics separately from the reviewed source-lineage result.
- [x] Derive POOL_METRICS timestamp kind from actual sourceEventAt / observedAt fields; retrieval time cannot satisfy missing source time.
- [x] Add deterministic integration scenarios for rate limits, multiple fallbacks, disagreement, stale/missing timestamps, circuit cooldown, recovery disagreement and non-retryable authentication failure.
- [ ] Obtain owner-evidenced mutual upstream attestations and approve provider terms/rights before any source can pass the reviewed gate.
- [ ] Design and verify shared health persistence and distributed recovery-probe leases before any multi-process production deployment.

Current registry profiles remain unverified, so diagnostic agreement cannot advance the reviewed gate. No live provider or RPC request was made; no key, spend, adapter activation, order or transaction is introduced.


## Phase 6.23 — Provider resilience integration

- [x] Add a composed orchestrator assessment that validates collection candidates, observations, health and attempts, and reports raw agreement diagnostics separately from reviewed source-lineage readiness.
- [x] Add deterministic integration coverage for retryable rate limits, fallback disagreement, stale/missing source times, circuit cooldown, recovery disagreement and non-retryable authentication lockout.
- [x] Verify that diagnostic arithmetic agreement cannot set evidence progression when the reviewed lineage registry remains unverified.
- [ ] Obtain owner-evidenced mutual upstream attestations and provider rights before any indexed source can pass the reviewed gate.
- [ ] Design shared health persistence and a distributed recovery-probe lease before multi-process production deployment.

Merged in [PR #41](https://github.com/hamza131zara/Auto-Trading-Agent/pull/41). Post-merge CI [#269](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41022186170) passed 251/251 tests, zero dependency vulnerabilities, typecheck/build, repository validation and Gitleaks; both CodeQL analyses and Dependency Review passed on the PR. No live provider/RPC calls or spend; trading remains unauthorized.


## Phase 6.24 — Shared provider health and distributed recovery leases

- [x] Add a driver-neutral `ProviderHealthStore` contract and PostgreSQL implementation with transactional, versioned provider-health updates.
- [x] Add an idempotent PostgreSQL schema migration for health rows and retained recovery-lease fencing counters.
- [x] Implement database-clock atomic claim/renew/release, expiry/reclaim and monotonically increasing fencing tokens.
- [x] Require the current unexpired lease to update circuit-open health; combine recovery result and lease release in one transaction.
- [x] Wire optional shared health loading and lease acquisition into the read-only orchestrator; discard results from expired recovery workers.
- [x] Add deterministic fake-pool tests for store concurrency/expiry/fencing and two orchestrator instances contending for one lease.
- [ ] Select and review a PostgreSQL driver/adapter; no driver or DB credentials are included in this step.
- [ ] Apply the migration to an ephemeral PostgreSQL instance and run real two-connection concurrent claim, expiry/reclaim, rollback and fencing integration tests.
- [ ] Only then approve shared-store configuration for a multi-process deployment.

This step remains offline. The migration is not applied; no provider/RPC call or spending occurs; provider and trading approvals remain false.


## Phase 6.24 — Shared provider health and recovery-probe coordination

Implementation merged in [PR #43](https://github.com/hamza131zara/Auto-Trading-Agent/pull/43), commit `9ccae49`. Post-merge CI [#274](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41024455297) passed 262/262 tests, zero dependency vulnerabilities, typecheck/build, repository validation and Gitleaks; both CodeQL analyses and Dependency Review passed on the PR. The migration is committed but unapplied, no DB driver or credentials are included, and live PostgreSQL multi-connection integration remains an explicit gate before multi-process deployment. No provider/RPC calls or spend; trading remains unauthorized.


## Phase 6.25 — Real PostgreSQL integration and distributed recovery verification

- [x] Add a loopback-only PostgreSQL integration harness that refuses non-local hosts and any database other than `ata_phase6_test`.
- [x] Add a dedicated CI workflow with a disposable PostgreSQL 18.6 service, Node 24, and a pinned test-only `pg@8.23.1` driver; keep the driver out of application runtime dependencies and the committed lockfile.
- [x] Exercise the actual schema migration twice, real independent worker connections, concurrent one-winner lease claims, database-backed persistence, database-clock lease renewal, expiry/reclaim and monotonic fencing.
- [x] Verify stale-worker release/write rejection and transaction rollback preserving the health row and lease.
- [x] Verify the dedicated PostgreSQL workflow on both PR and merge commit: PR run [#4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033711991) and main run [#5](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033906105) each passed 4/4 real-engine tests on PostgreSQL 18.6. Post-merge main CI [#281](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033905950), PR Dependency Review [#116](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033711853), and PR CodeQL/Gitleaks [#257](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41033707564) passed.
- [ ] Separately review production database TLS, pooling, backup/restore, migration ownership/rollback, monitoring and operational approval before any multi-process deployment.

The integration workflow uses only its disposable local PostgreSQL service. It makes no provider/RPC calls, introduces no provider key or spend, and does not authorize database deployment, provider activation, signing, order placement or trading.


## Phase 6.26 — Pyth Pro freshness evidence and provider-rights review

- [x] Add a separate Pyth Pro adapter using exact numeric feed IDs bound to canonical SOL/USD and USDC/USD feed IDs and mint identities.
- [x] Require a stable feed lifecycle state, any configured active market-session state, and an explicitly configured channel no faster than the exact feed's reviewed minimum channel.
- [x] Request and validate publisherCount, feedUpdateTimestamp and marketSession; reject carried-forward prices and missing/under-quorum data.
- [x] Support feed-level and market-session-specific publisher minimums from a reviewed Pyth symbology snapshot.
- [x] Keep Pyth Pro and the Hermes-compatible endpoint in the same pyth-network independence group.
- [x] Add synthetic tests for request construction, exact identities, fresh feed timestamp, carried-forward rejection, publisher quorum, session-specific quorum, feed/session lifecycle state, channel constraints, missing key and sanitized failures.
- [x] Review public provider terms and technical evidence for DEX Screener, CoinGecko/GeckoTerminal, Birdeye, Raydium and Pyth Pro; record exact unresolved customer-delivery rights in [Phase 6.26](26-pyth-pro-freshness-and-provider-rights-review.md).
- [ ] Obtain the actual owner-reviewed Pyth SOL/USD and USDC/USD pyth_lazer_id, min_publishers, min_channel, market_sessions and feed-state metadata; test fixture IDs 101/202 are not production IDs.
- [ ] Obtain written/contracted Pyth Pro service rights for the chosen feeds, channel, frequency, quotas, attribution, retention and the exact customer experience before any diagnostic key/API request.
- [ ] Obtain publisher-level upstream lineage for Pyth and pairwise mutual upstream attestations with any selected indexed provider. Five router signatures and publisherCount do not prove source independence.
- [ ] Resolve DEX Screener third-party access/redistribution, CoinGecko reusable-data rights, Birdeye written permission, Raydium commercial terms and exact display/export/use model before enabling any provider.
- [ ] Do not change the USD 100,000 liquidity threshold, USD 10,000 24-hour volume threshold or 10-bps diagnostic tolerance; retain the historical 63-bps disagreement.

Implementation and fixtures make no provider/RPC request, create no API key, incur no spend, and do not activate adapters. All provider profiles remain UNVERIFIED/UNAPPROVED, Phase 6 remains ACTIVE, and trading is unauthorized.


## Phase 6.27 — Provider lineage and commercial-use evidence intake

- [x] Define a controlled evidence record, source-quality classes, artifact digest/provenance fields and restricted-storage rules.
- [x] Define the exact Pyth SOL/USD and USDC/USD symbology fields and named publisher-level upstream lineage required before a diagnostic.
- [x] Define symmetric pairwise independence review, overlap analysis and explicit UNKNOWN treatment; Pyth Pro and Hermes remain one `pyth-network` family.
- [x] Define provider-specific account, plan, contract, attribution, retention, display, export, API, redistribution and multi-customer rights evidence requirements.
- [x] Separate technical metadata verification, independent-source review, diagnostic rights, production rights and owner decisions.
- [ ] Receive and verify the actual owner-reviewed Pyth feed metadata and publisher source inventory; synthetic fixture IDs 101/202 remain non-production examples.
- [ ] Receive provider-use permissions for the exact diagnostic and customer delivery model.
- [ ] Complete a two-way lineage attestation for the selected Pyth/indexed-source pair.
- [ ] Record a separate owner decision before proposing any manual read-only provider diagnostic.

See [Phase 6.27 — Evidence intake](27-provider-lineage-and-commercial-rights-evidence-intake.md). This is a documentation/control-preparation step only: it makes no provider/API/RPC request, changes no runtime registry approvals, adds no key or spend, and leaves the 10-bps tolerance, historical 63-bps disagreement, existing liquidity/volume thresholds and trading prohibition unchanged.


## Phase 6.28 — Provider evidence manifest validation

- [x] Add an offline, versioned JSON evidence-manifest validator with deterministic reason codes.
- [x] Validate Pyth SOL/USD and USDC/USD metadata completeness, publisher disclosure, pairwise two-sided attestations, provider rights scope, owner-decision references and review-state consistency.
- [x] Verify local artifact SHA-256 inside a bounded artifact root; reject traversal, symlink escapes and credential-bearing fields.
- [x] Add deterministic positive/negative tests for malformed, expired, contradictory, missing and unsafe evidence records.
- [ ] Receive actual owner evidence and complete human review; structural validity is not authenticity, independence, legal clearance or production approval.
- [ ] Keep diagnostic and production owner decisions separate; no provider may be activated from a validator PASS alone.

See [Phase 6.28 — Evidence manifest validator](28-provider-evidence-manifest-validator.md). This step is offline only and leaves all provider profiles unverified/unapproved, spend at USD $0, existing thresholds and 10-bps tolerance unchanged, historical 63-bps disagreement unresolved, and trading unauthorized.


## Phase 6.29 — Canonical evidence binding and lineage consistency

- [x] Upgrade the offline evidence-manifest contract to v2; earlier v1 manifests require manual review and upgrade.
- [x] Bind SOL/USD and USDC/USD to the canonical feed IDs and mainnet mints pinned in the Pyth Pro adapter.
- [x] Reject illustrative synthetic Lazer IDs, duplicate IDs, unsupported channels and invalid Pyth session/state names.
- [x] Resolve pairwise provider IDs against the canonical source-family registry; block same-family and unknown-provider independence claims.
- [x] Require resolvable publisher upstream, provider attestation and overlap-evidence references.
- [x] Ensure rights evidence covers the delivery models and data actions claimed.
- [x] Require diagnostic and production owner decisions to link the appropriate technical, rights and independence evidence.
- [ ] Receive real owner evidence and complete first-party/human verification; structural validation is not authenticity, independence or legal approval.

See [Phase 6.29 — Canonical evidence binding](29-canonical-evidence-binding-and-lineage-consistency.md). No provider/API/RPC calls, credentials, spend or production activation are introduced. Existing thresholds and the 10-bps diagnostic tolerance remain unchanged; the historical 63-bps disagreement remains open.

## Phase 6.30 — Offline evidence-manifest packaging

- [x] Add a local-only builder for v2 manifest drafts that computes LOCAL_FILE artifact digests and re-runs the canonical structural validator.
- [x] Reject credential-bearing manifest field names, artifact traversal/symlinks, digest mismatch, existing-output overwrite, and private input/artifact/output paths inside the Git working tree.
- [x] Bound local artifact hashing to 50 MiB per file and 200 MiB combined; write the manifest with owner-only permissions where supported.
- [ ] Receive and human-review the actual owner-supplied Pyth feed metadata, publisher lineage, bilateral independence evidence, and provider-rights documents.

The packager is offline and emits only metadata/digests; it does not copy evidence bytes, contact providers/RPC, enable providers, or mutate approvals. A successful result is STRUCTURALLY_VALID_NOT_AN_APPROVAL only. No real owner evidence has been supplied. Provider profiles remain UNVERIFIED/UNAPPROVED, spend remains USD $0, existing thresholds and diagnostic tolerance are unchanged, and trading remains unauthorized. Phase 6 remains ACTIVE. See [Phase 6.30](30-offline-provider-evidence-packaging.md).


## Phase 6.31 — PostgreSQL runtime-role and transport preflight

- [x] Add a one-query read-only preflight using the already-connected runtime role; do not open a new connection or mutate database state.
- [x] Require both provider-health tables, a non-superuser runtime role with no ownership/membership of table-owner roles, public-schema USAGE, and SELECT/INSERT/UPDATE on both tables.
- [x] Reject excess DELETE/TRUNCATE/REFERENCES/TRIGGER table privileges and CREATE privileges on the public schema or current database.
- [x] Check backend transport encryption, while explicitly recording that the SQL query cannot verify the client driver's certificate-chain or hostname validation.
- [x] Keep the strongest passing result at TECHNICAL_CHECKS_PASSED_REVIEW_REQUIRED; the function never approves production deployment or trading.
- [x] Add unit coverage and a real PostgreSQL CI test using a disposable NOLOGIN role with narrowly granted permissions. The local CI transport is plaintext and is correctly reported BLOCKED.
- [ ] Select and review the production database driver and verify the actual client TLS certificate/hostname policy.
- [ ] Approve deployment-specific connection-pool limits/timeouts and capacity across runtime instances.
- [ ] Approve encrypted backups, retention/PITR and a successful restore drill.
- [ ] Separate migration ownership from runtime permissions and approve migration/rollback procedures.
- [ ] Configure and test database monitoring, alerts and incident runbooks; obtain owner operational approval.

The preflight is diagnostic only. It contacts no provider or Solana RPC endpoint, creates no production credentials, performs no migration/write, incurs no spend and cannot authorize provider activation or trading. Phase 6 remains ACTIVE.


## Phase 6.32 — PostgreSQL backup, restore and migration recovery

- [x] Add a loopback/test-role/database-allowlisted PostgreSQL custom-format backup drill, with a pinned PostgreSQL 18.6 client image.
- [x] Inspect the archive table of contents and calculate a SHA-256 digest.
- [x] Restore into a newly created isolated database using a single transaction and no-owner/no-privilege semantics.
- [x] Verify representative provider-health and recovery-lease rows, hash metadata, fencing token and restored ownership.
- [x] Simulate a migration worker disconnect after DDL but before COMMIT; verify PostgreSQL rolls back all uncommitted schema changes.
- [x] Apply the existing migration transactionally after interruption and re-apply it to verify idempotency.
- [x] Restrict cleanup to databases created by this test; remove the temporary archive and never upload a dump artifact.
- [ ] Approve production backup encryption, off-site destination, retention, checksum monitoring and access controls.
- [ ] Define RPO/RTO and PITR requirements and conduct a separately authorized production-like restore drill.
- [ ] Approve production migration owner separation, operational windows, rollback/forward-fix procedures, monitoring and incident response.

The automated drill operates only on the disposable local PostgreSQL 18.6 CI service and strict allowlisted test databases. It does not verify production storage, encryption, durability, retention or service-level recovery objectives. Phase 6 remains ACTIVE; no provider/RPC access, credentials, spend, wallet, signer, order, transaction or trading authorization is introduced. See [Phase 6.32](32-postgres-backup-restore-and-migration-recovery.md).


## Phase 6.33 — Migration governance and deployment preflight

- [x] Add a SHA-256 manifest binding the exact ordered set of committed migration files.
- [x] Add an offline verifier that rejects checksum drift, missing/untracked files, duplicate IDs, malformed dates, unsorted entries, traversal, symlinks, unknown files and unsupported execution-mode declarations.
- [x] Add an offline change-packet checker pinned to the verified migration-set digest, with separate change-owner/database-operator references, backup and restore evidence references, role/TLS checks, writer coordination, maintenance window and forward-recovery safeguards.
- [x] Keep the strongest preflight status at TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED; no migration runner, database connection, schema mutation or authorization is introduced.
- [x] Run migration inventory verification in normal CI and add regression tests for integrity and release-packet failure paths.
- [ ] Independently verify actual approver identities/signatures and the contents of backup, restore, TLS, role and recovery evidence.
- [ ] Approve the real migration identity, target, maintenance window, monitoring and a separately authorized deployment/recovery exercise.

The manifest protects against accidental or unreviewed SQL-file drift only when its changes receive independent review; it is not a cryptographic signature. Packet references are not authenticated. Phase 6 remains ACTIVE; production database deployment, provider activation and trading remain unauthorized. See [Phase 6.33](33-migration-governance-and-deployment-preflight.md).


## Phase 6.34 — PostgreSQL observability, monitoring and incident controls

- [x] Add a one-query aggregate monitoring snapshot for database connections, active queries, open/idle transactions, lock waits, deadlocks and database size.
- [x] Require caller-supplied, range-checked thresholds; do not invent production thresholds or defaults.
- [x] Return stable threshold-breach codes and mark partial database activity visibility or disabled activity tracking as limited monitoring.
- [x] Keep monitoring read-only, sanitized and separate from runtime and migration roles; no automatic notification, restart or remediation.
- [x] Verify deterministic alerts and malformed-input/error paths in unit tests and query actual PostgreSQL 18.6 metrics in the disposable integration workflow.
- [ ] Approve the production monitoring role and pg_read_all_stats visibility scope.
- [ ] Approve operational thresholds, sampling cadence, monitoring retention, alert receiver, on-call acknowledgement/escalation and incident exercises.

The feature is a measurement/evaluation primitive, not a hosted monitoring service. It makes no production connection and does not enable database deployment, provider activation or trading. Phase 6 remains ACTIVE. See [Phase 6.34](34-postgres-observability-monitoring-and-incident-controls.md).


## Phase 6.35 — PostgreSQL aggregate connection-budget preflight

- [x] Add an offline capacity evaluator for aggregate runtime replica/pool demand and monitoring, migration and other-service connections.
- [x] Subtract declared reserved server slots and a separately declared safety buffer before evaluating usable capacity.
- [x] Require a caller-supplied minimum headroom and return distinct fail-closed outcomes for over-capacity and insufficient headroom.
- [x] Reject missing/extra/credential-shaped fields, invalid integer counts and invalid reserved-capacity plans.
- [x] Use BigInt for exact aggregate pool multiplication and return immutable review-required reports; provider/deployment/trading authorization remains false.
- [ ] Independently verify all declared server settings and maximum shared workload against the target environment.
- [ ] Select/review the production driver and test its pool/timeouts/shutdown and strict client TLS verification.
- [ ] Obtain explicit owner/database-operator approval of a real capacity plan.

The evaluator is offline and driver-neutral. It does not open a database connection, select/configure a pool, create credentials or modify runtime state. A passing arithmetic report is not production evidence or approval. Phase 6 remains ACTIVE. See [Phase 6.35](35-postgres-aggregate-connection-budget-preflight.md).


## Phase 6.36 — PostgreSQL backup, PITR and recovery-policy preflight

- [x] Add an offline deterministic evaluator for explicit backup cadence/retention, PITR/WAL lag, owner-supplied RPO/RTO and integrity/restore evidence ages.
- [x] Calculate the declared worst-case data-loss interval from maximum permitted backup age and WAL archive lag; block an RPO miss.
- [x] Detect a stale last successful backup and reject maximum-age thresholds inconsistent with backup cadence or retention.
- [x] Compare the last restore-drill duration with RTO and block a miss.
- [x] Validate PITR retention consistency and explicit disabled-state declarations.
- [x] Require declared verification for application-level restore-drill validation, encryption at rest/in transit, restricted off-site destination, remote digest verification and PITR WAL monitoring.
- [x] Reject malformed, missing, unknown and credential-shaped inputs; return immutable, non-authorizing reports.
- [ ] Independently verify actual backup service/storage/KMS configuration, retention/lifecycle, WAL archiving, integrity monitoring and evidence authenticity.
- [ ] Approve workload-specific RPO/RTO, PITR retention and restore-drill cadence.
- [ ] Complete a separately authorized production-like restore drill with application-level validation.

The preflight evaluates declarations only. It does not create or restore backups, connect to PostgreSQL or external storage, verify encryption/digests, contact providers/RPC, incur spend or authorize production recovery. Phase 6 remains ACTIVE. See [Phase 6.36](36-postgres-backup-pitr-policy-preflight.md).


## Phase 6.37 — PostgreSQL client TLS policy preflight

- [x] Add an offline, driver-neutral PostgreSQL client TLS policy evaluator.
- [x] Require TLS, certificate-chain validation and hostname validation against the requested endpoint name.
- [x] Block plaintext fallback, invalid certificate/hostname overrides and TLS 1.0/1.1.
- [x] Require reviewed trust-anchor and server-identity references plus certificate expiry/rotation controls.
- [x] Require explicit driver-adapter review and an isolated positive/negative handshake evidence matrix.
- [x] Reject missing/extra/malformed fields and path/URL-like or credential-shaped references; preserve non-authorizing status.
- [ ] Select/pin the production driver and verify its actual TLS defaults/configuration and effective runtime options.
- [ ] Run isolated handshake tests for trusted/untrusted chains, hostname mismatch, expiry, plaintext downgrade and protocol-floor rejection.
- [ ] Verify trust-anchor, endpoint identity, expiry monitoring and rotation evidence with the owner/database operator.

The evaluator accepts declarations only; it does not choose a driver, access certificates/secrets, open a socket or connect to PostgreSQL. A successful policy result remains REVIEW_REQUIRED. Phase 6 remains ACTIVE. See [Phase 6.37](37-postgres-client-tls-policy-preflight.md).


## Phase 6.38 — PostgreSQL pool lifecycle and timeout policy preflight

- [x] Add an offline driver-neutral evaluator for declared pool timeout, queue and shutdown policy.
- [x] Check connection/acquisition, lock/statement and shutdown/statement timeout relationships.
- [x] Require bounded queue overflow rejection and stop-admission-then-drain shutdown semantics.
- [x] Require an explicit isolated-test matrix for timeout enforcement, cancellation, queue overflow and shutdown.
- [x] Reject malformed, missing, extra, path/URL-like and credential-shaped inputs; return immutable review-required reports.
- [ ] Select and pin the production PostgreSQL driver and version.
- [ ] Verify the actual driver's timeout mapping, cancellation behavior, bounded queue and shutdown lifecycle against disposable PostgreSQL.
- [ ] Verify effective role/database/session settings and reconcile the selected pool maximum with the approved aggregate capacity plan.
- [ ] Obtain owner and database-operator approval before any production database deployment.

The evaluator accepts declarations only; it does not create a pool, connect to PostgreSQL, cancel statements or change runtime settings. A technically passing policy remains REVIEW_REQUIRED. Phase 6 remains ACTIVE. See [Phase 6.38](38-postgres-pool-lifecycle-policy-preflight.md).


## Phase 6.39 — Test-only node-postgres pool lifecycle experiment

- [x] Reuse the exact pinned test-only `pg@8.23.1` package already exercised against PostgreSQL 18.6.
- [x] Add required disposable-PostgreSQL tests for saturated-pool acquisition timeout, statement cancellation, lock timeout, idle-in-transaction termination and pool shutdown/drain.
- [x] Verify the actual package version at test runtime.
- [x] Demonstrate a bounded adapter-side admission gate and verify that rejected callers do not enter the underlying FIFO queue.
- [x] Restrict test connections to the disposable local PostgreSQL service; keep the driver out of application dependencies and the committed lockfile.
- [ ] Owner explicitly selects or rejects `pg@8.23.1` as the production driver.
- [ ] If selected, implement/review a production adapter with strict TLS, bounded admission, safe transaction/cancellation handling, approved pool limits and shutdown supervision.
- [ ] Run real TLS trust/hostname/downgrade tests and verify effective production runtime settings.
- [ ] Obtain separate database deployment, backup/PITR, monitoring, provider and trading approvals.

The experiment proves behavior only for the exact test-only driver version and disposable PostgreSQL CI environment. It does not select a production driver, add production connectivity or authorize deployment, provider activation or trading. Phase 6 remains ACTIVE. See [Phase 6.39](39-node-postgres-pool-lifecycle-experiment.md).


## Phase 6.40 — node-postgres TLS handshake verification experiment

- [x] Add CI-generated disposable CA, rogue CA, valid, expired and TLS-version-restricted PostgreSQL server fixtures.
- [x] Require exact test-only `pg@8.23.1` at runtime and configure TLS through explicit client options, not connection-string SSL overrides.
- [x] Verify trusted CA acceptance and confirm the resulting database session is encrypted.
- [x] Verify untrusted CA, hostname mismatch, expired certificate and plaintext endpoint rejection.
- [x] Verify protocol negotiation rejects a server below an explicitly configured client minimum.
- [x] Keep all listeners loopback-only and remove containers/private test keys after CI.
- [ ] Owner selects/pins the production PostgreSQL driver and approves the real production CA, endpoint/SNI identity and certificate-rotation model.
- [ ] Repeat the complete handshake matrix with the owner-selected production driver and actual target certificate chain.
- [ ] Verify expiry monitoring, rotation ownership, effective runtime options and separate production deployment approvals.

The tests use only disposable containers, generated certificates and the transient CI driver. They do not approve a production TLS policy, database, provider or trading runtime. Phase 6 remains ACTIVE. See [Phase 6.40](40-node-postgres-tls-handshake-verification.md).


## Phase 6.41 — Production node-postgres adapter

- [x] Owner selected and approved `pg@8.23.1` for implementation/review; dependency pinned in the market-data workspace.
- [x] Implement strict TLS verification, bounded pool/admission, timeouts, safe client release and graceful shutdown behavior.
- [x] Merge adapter implementation in [PR #62](https://github.com/hamza131zara/Auto-Trading-Agent/pull/62); required checks and disposable integration/security verification passed before merge.
- [x] Keep production DB connection, credentials, CA deployment and operational activation separate; none is authorized by driver selection.

## Phase 6.42 — PostgreSQL adapter shutdown lifecycle verification

- [x] Test shutdown admission closure, `POOL_CLOSING`, checked-out client drain, idempotent close and pool end using disposable PostgreSQL.
- [x] Correct the test's promise-identity assertion in [PR #64](https://github.com/hamza131zara/Auto-Trading-Agent/pull/64); compare subsequent close calls with the raw drain promise.
- [x] Verify the dedicated integration workflow: [run #41196013163](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41196013163), both jobs green; TLS suite 12 passed, 0 failed.
- [x] Merge PR #64 into main at `8f9250119c5b90d1e11072177ddbf220b35648ca`.
- [ ] Verify the post-merge main workflow runs on the merge commit before closing the post-merge CI gate.

Production database deployment, provider activation, wallet signing, orders and trading remain separately unauthorized.
