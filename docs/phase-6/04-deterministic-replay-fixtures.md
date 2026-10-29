# Phase 6.4 — Deterministic Replay Fixtures

## Goals

Fixtures must reproduce parser, validation, freshness and provider-health outcomes without live network access, secrets, random values or wall-clock dependence.

Each fixture has:
- a schema/fixture version and stable case ID;
- a canonical or intentionally malformed observation;
- an explicitly injected clock time and maximum-age policy;
- the expected validation/freshness outcome;
- a short purpose/rationale label.

## Required cases

1. Valid fresh observation.
2. Stale retrieval timestamp.
3. Old underlying source event despite recent retrieval.
4. Missing source event/observation timestamp, producing UNKNOWN rather than FRESH.
5. Future timestamp outside allowed skew.
6. Invalid Solana public-key encoding.
7. Malformed decimal or unit mismatch.
8. Missing activity counts/market measures retained as null.
9. Provider timeout/rate-limit/auth failure transitions, including circuit-open and successful recovery.
10. Provider payload schema drift/missing required identity fields.

Synthetic fixtures must be labelled as synthetic and must never be interpreted as live market data or backtest evidence. Replay must produce the same result for the same fixture and policy inputs. The test suite must not depend on provider credentials or network access.
