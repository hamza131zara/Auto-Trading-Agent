# Requirements Traceability

This matrix is a starter index. Tests do not exist until implemented; do not mark a test as passing before evidence is recorded.

| Requirement group | Requirement IDs | Evidence/artifact | Planned test evidence |
|---|---|---|---|
| Identity/access | FR-01 | Auth and authorization policy | Role/permission matrix, negative API tests, session/security tests |
| Operating mode | FR-02 | State transition table | API/UI transition tests, unauthenticated transition rejection |
| Discovery/data | FR-03 | Data-source matrix and schemas | Adapter contract, stale data, duplicate and malformed payload tests |
| Token security | FR-04 | Security gate catalog | Unit/integration security rejection tests and labeled retrospective evaluation |
| Strategy decision | FR-05 | Strategy registry and decision contract | Deterministic replay and model-output schema/abstention tests |
| Portfolio risk | FR-06 | Risk policy and formulas | Boundary/property tests, race conditions, daily drawdown and one-position invariants |
| Execution | FR-07 | Execution state machine | Simulation, failed/unknown tx, idempotency, actual fill reconciliation tests |
| Exit lifecycle | FR-08 | Exit policy specification | Partial-fill, trigger, trailing/invalidation and emergency path tests |
| Targets | FR-09 | Milestone semantics | Equity reconciliation and pause/continue behavior tests |
| Analytics | FR-10 | Metric definitions and data dictionary | Independent PnL calculation and exported-ledger reconciliation |
| Learning | FR-11 | Model/strategy promotion policy | Holdout isolation, version provenance, approval and rollback tests |
| Reliability/audit | FR-12 | Event catalog and incident playbooks | Restore drills, tamper-evidence checks, outage and restart recovery tests |
| Security baseline | SEC-* | Threat model and OWASP/NIST reference checklist | Security review, dependency/secrets scans and penetration-test findings |
| Quant validity | QUANT-* | Quant methodology | Chronological splits, probability calibration, sensitivity and uncertainty reports |
| Release gate | REL-* | Acceptance plan | Signed stage checklist, evidence links and owner approval |

## Evidence record format
For each test execution, store test ID, software/strategy/model versions, dataset/window, environment, result, logs/artifact reference, known limitation and reviewer. Tests that depend on live/provider responses should preserve sanitized fixtures and provider/version context.

## Promotion traceability
Every production-approved strategy/model version must link to a research proposal, data/features schema, evaluation protocol, out-of-sample report, paper-trading evidence, risk review, approval record and rollback version.