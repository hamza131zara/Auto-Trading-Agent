# Phase 6 — Market-Data Ingestion and Canonical Data Layer

**Status:** ACTIVE — canonical market-data contracts, deterministic replay and the read-only DEX Screener candidate are merged to main. The next Phase 6 slice adds fail-closed multi-provider agreement and fallback assessment; no production provider is selected.
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

## Read-only RPC transport

A bounded, read-only `getMultipleAccounts` transport is implemented in [Phase 6.9](09-solana-rpc-account-reader.md). It preserves the response context slot and account order, hashes the response, marks injected-fetch results synthetic, and never makes an RPC call in CI. It deliberately returns raw base64 account data only; pool/mint/vault decoding and production provider selection remain separate gates.

## On-chain identity evidence boundary

The pure evidence checker in [Phase 6.8](08-on-chain-identity-evidence-contract.md) validates a decoded pool/program/mint/vault bundle against an explicitly approved program/decoder registry with disjoint DEX/token/loader roles. It does not fetch RPC data or decode raw account bytes. The read-only `getMultipleAccounts` reader and protocol-specific decoder are still required before any live identity result may be claimed.

## Provider agreement and fallback safeguards

Implementation and synthetic-test validation on the active PR branch passed CI/typecheck/build/tests/npm audit/Gitleaks ([run 40819982381](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982381)), Dependency Review ([run 40819982477](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982477)), and CodeQL ([run 40819979725](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819979725)). No provider endpoint was contacted by these tests.

The agreement evaluator requires at least two eligible independent providers; recalculates freshness from the injected clock; checks candidate health and provenance identity; and uses exact identity/value comparison without invented tolerances, and requires distinct upstream independence groups (not just distinct adapter names). A lone fallback, timestamp mismatch, missing required measure, stale data, or provider disagreement blocks progression. Even an agreement only permits consideration for independent on-chain validation; trading is always unauthorized. See [Phase 6.7](07-provider-agreement-and-fallback-policy.md).

## Exit rule

Phase 6 closes only after the canonical schema and adapter contract are approved, selected adapters have fixture-backed parse/error/retry/freshness/provenance tests, provider-health, provider disagreement and fallback/degraded-mode behaviors are verified, independent on-chain validation is implemented and tested, and replay is deterministic. The Phase 6 exit does not authorize token-safety scoring (Phase 7) or execution.
