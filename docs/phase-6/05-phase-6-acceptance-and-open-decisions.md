# Phase 6.5 — Acceptance Criteria and Open Decisions

**Status:** Active, not complete. Canonical contracts, fallback assessment, read-only RPC transport, SPL Token base decoder and fail-closed Token-2022 extension classification are implemented with synthetic tests. No DEX pool protocol or production market-data/RPC provider is owner-approved.

## Acceptance checklist

- [x] Canonical Solana market-observation schema is versioned, strictly validated and preserves explicit units/nulls/provenance in `@ata/market-data`.
- [x] Solana public-key encoding, non-negative decimal strings, counts, slots, units and UTC timestamps have positive/negative tests.
- [x] Freshness assessment is deterministic under an injected clock and returns distinct FRESH, STALE, UNKNOWN and INVALID states.
- [x] Provider health is distinct from freshness/data quality and has tested success, retryable failure, threshold/circuit-open, auth/config failure and recovery paths.
- [x] Synthetic fixtures cover fresh, stale retrieval, stale source event, missing timestamp, future source time and invalid address; unit tests cover malformed decimal/unit and provider failure/recovery paths.
- [x] Replay tests run without external network access, production credentials or non-deterministic clocks.
- [x] The DEX Screener candidate's mocked-fetch tests pass in CI for exact identity matching, unit/decimal normalization, fetch/body timeout classification, rate-limit handling, and sanitized failures. Quality CI passed at [run 40818498807](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40818498807); Dependency Review passed at [run 40818499007](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40818499007), and the included Gitleaks scan passed in the quality CI run. These are synthetic/mock tests; CI makes no live DEX Screener API call.
- [x] Provider disagreement/fallback evidence gate implemented with deterministic tests for exact identity/value matching, unavailable primary, single-fallback insufficiency, observation and provider-health freshness rechecks, missing measures, synthetic fixtures, duplicate upstream-source rejection and fail-closed conflict handling. See [Phase 6.7](07-provider-agreement-and-fallback-policy.md). Current-head validation passed: [CI/Gitleaks](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982381), [Dependency Review](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819982477), and [CodeQL](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40819979725).
- [x] Add a read-only JSON-RPC `getMultipleAccounts` transport for explicit account lists, bounded streaming reads, strict response validation, raw-response digest, timeout/cancellation, context-slot enforcement and sanitized errors. CI uses only mocked fetch; injected responses are marked synthetic. See [Phase 6.9](09-solana-rpc-account-reader.md).
- [x] Add a base-state decoder for classic SPL Token mint/account records with strict program-owner/size/tag/state checks and exact integer strings. Token-2022 records with extensions remain flagged uninspected and are ineligible for identity evidence until a separate extension-aware parser is implemented. See [Phase 6.10](10-spl-token-base-state-decoder.md).
- [x] Add structural Token-2022 TLV parsing for type/length boundaries, bounds checking, duplicates and terminators; results remain ineligible for identity evidence because the parser does not classify extension semantics. See [Phase 6.11](11-token2022-extension-tlv-inspector.md).
- [x] Add a fail-closed semantic registry for the current official Token-2022 extension type enum: known IDs are named and mapped to a conservative impact category/account scope; wrong-scope and unknown/future IDs are blocked. No extension-bearing token is auto-approved for identity evidence; phase-specific safety review remains Phase 7. See [Phase 6.11](11-token2022-extension-tlv-inspector.md).
- [x] Add a protocol-neutral evidence-bundle checker for pool/program/mint/vault identity, explicit, disjoint decoder/token/loader allowlists, commitment/context-slot gates and evidence provenance. Synthetic-only fixtures cannot advance. See [Phase 6.8](08-on-chain-identity-evidence-contract.md).
- [x] Implement the read-only Solana `getMultipleAccounts` transport with mocked tests; it preserves context slots and returns bounded raw account data. See [Phase 6.9](09-solana-rpc-account-reader.md).
- [x] Implement and test the pinned Raydium CPMM candidate PoolState/AMM-config decoder and connect the raw reader, LP mint, mint/vault base state, authority/config/observation/vault PDA checks, and generic identity evidence gate. CI uses constructed/mock evidence and returns `SYNTHETIC_MATCH`; production protocol selection and live validation are still blocked. See [Phase 6.12](12-raydium-cpmm-candidate-decoder.md).
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

**Phase 6 remains ACTIVE. Do not mark it complete yet.** The remaining technical gate is the protocol-specific pool decoder plus end-to-end raw-account-to-identity evidence integration. The owner decision gates also remain open: choose the production RPC/indexed provider(s), confirm current endpoint/terms/quota/retention rules and account-specific plan, approve usage budget, and obtain at least one independently verifiable real-source identity validation. These cannot be claimed complete from synthetic fixtures or a public rate-limit page. Close Phase 6 only after all acceptance items are tested, selected adapters and fallback behavior are documented, failure/degraded modes are proven safe, critical identity is independently validated, and replay is deterministic. Phase 7 token safety and all trade execution remain out of scope.
