# Phase 6 — Market-Data Ingestion and Canonical Data Layer

**Status:** ACTIVE — live discovery found no pool meeting unchanged thresholds. Live Pyth comparison remains DISAGREEMENT (63 bps vs 10 bps); DEX Screener source timestamp remains missing. GeckoTerminal OHLCV is an opt-in price-only path. Phase 6.18 adds optional Raydium ProgramData hash verification, requiring a reference ELF SHA-256 and exact artifact byte length together and rejecting non-zero trailing allocation bytes. The hash/length and zero-padding hardening passed CI [#234](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40944936764) with 204/204 tests, typecheck/build, repository validation, zero dependency vulnerabilities and Gitleaks. No ProgramData read is made by default or during CI. Provider terms, source/build provenance, upgrade authority, independent market fields and live fallback remain open. Phase 6 remains active; trading is not authorized.
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
18. [Raydium CPMM deployed-program integrity evidence](18-raydium-program-deployment-integrity.md)

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
