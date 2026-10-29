# Phase 6 — Market-Data Ingestion and Canonical Data Layer

**Status:** ACTIVE — the provider-neutral data-contract/replay slice merged in [PR #10](https://github.com/hamza131zara/Auto-Trading-Agent/pull/10) to main commit `2ba2bdd357257d2d01799f8f7a80bc7439a942ec`. No production provider has been selected.
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
7. Define adapter boundaries so individual provider integrations can be added only after current official documentation, account plan, terms, quotas and fallback behavior are reviewed.

## Documents

1. [Canonical observation schema](01-canonical-observation-schema.md)
2. [Provider adapter contract and boundaries](02-adapter-contract-and-provider-boundaries.md)
3. [Provenance, freshness and provider health](03-provenance-freshness-and-provider-health.md)
4. [Deterministic replay fixtures](04-deterministic-replay-fixtures.md)
5. [Acceptance criteria and open decisions](05-phase-6-acceptance-and-open-decisions.md)

## Initial implementation boundary

The first package is provider-neutral and performs validation, time/freshness assessment, provider-health transitions and fixture replay only. It performs no external RPC/API requests and contains no provider credentials. It does not select a market route, assert token safety, calculate a trade, authorize an entry, sign a transaction or place an order.

## Initial implementation validation

- Main-push CI passed on merge commit `2ba2bdd357257d2d01799f8f7a80bc7439a942ec`: [run 40816041202](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40816041202). This includes repository validation, strict typecheck, build, Node tests, `npm audit` and Gitleaks.
- Dependency Review passed on PR #10: [run 40815954105](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40815954105).
- GitHub's optional AI code-scan workflow passed on PR #10: [run 40815955521](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40815955521).
- CodeQL analysis on the main merge commit completed successfully: [run 40816040698](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40816040698).

## Provider-selection gate

Candidates remain those in the owner-approved provider matrix (Solana RPC, Helius, DEX Screener, Birdeye and other reviewed sources as appropriate). This phase must not turn the research shortlist or earlier dated pricing snapshot into an implied vendor commitment. A provider adapter may be considered production-ready only after endpoint/version and terms review, quota/budget selection, schema validation, timeout/retry/circuit-breaker behavior, fallback/disagreement tests, and deterministic fixtures pass.

## Exit rule

Phase 6 closes only after the canonical schema and adapter contract are approved, selected adapters have fixture-backed parse/error/retry/freshness/provenance tests, provider-health and degraded-mode behaviors are verified, and replay is deterministic. The Phase 6 exit does not authorize token-safety scoring (Phase 7) or execution.
