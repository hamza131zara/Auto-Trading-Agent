# Phase 5.5 — Acceptance Criteria and Open Decisions

**Status:** CLOSED for engineering-foundation handoff on 29 October 2026. The owner confirmed repository security settings are complete; latest main-push CI and the recorded PR checks passed. The classic branch-protection endpoint was not readable by the connected GitHub integration, so its setting is recorded as owner-confirmed.

## 1. Acceptance checklist

- [x] Clean CI checkout and `npm ci --ignore-scripts` installed the exact package-lock dependency tree on Node 24.
- [x] Each intended workspace package was validated/discovered by the repository check.
- [x] Strict TypeScript typecheck and package build completed in CI.
- [x] Compile-time contract regression checks keep `AssessmentState` and `DecisionOutcome` as explicit unions and reject an execution-authorizing outcome such as `EXECUTE_TRADE`.
- [x] Deterministic configuration tests passed, including safe defaults, rejection of live mode, frozen returned config and exact lowercase boolean parsing.
- [x] Repository validation passed for workspace manifests, safe environment defaults, ignored local env files and common secret-pattern checks.
- [x] Pull-request verification after the Gitleaks full-history checkout fix passed both quality and secret-scan jobs on [PR #5, run 40809400085](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40809400085) and [PR #7, run 40809677560](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40809677560).
- [x] `npm audit --audit-level=high` and Gitleaks are active and passed in the cited PR runs. The combined action pin refresh was verified in PR #7. The most recent separately recorded main-push baseline is [run 40739952683](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40739952683).
- [x] No production credentials are needed for install/build/typecheck/test/CI.
- [x] Development/staging/production boundaries and secret handling are documented.
- [x] Rollback/recovery instructions and dependency-update workflow are documented; custom Dependabot labels that did not exist in the repository were removed.
- [x] Owner confirmed branch protection/rulesets, required reviews and required status checks are configured on 29 October 2026. The connected GitHub integration could not independently read the classic branch-protection endpoint (403); retain the settings page as the owner-side source of truth.
- [x] Owner confirmed the GitHub dependency graph and associated repository security settings are enabled on 29 October 2026. The Dependency Review Action is reintroduced in `.github/workflows/dependency-review.yml`; its new PR run must confirm GitHub accepts the graph configuration. `npm audit` remains active in parallel.

## 2. Carry-forward decisions

| ID | Question | Default / gate |
|---|---|---|
| P5-O-001 | Exact package-manager version and OS support matrix? | npm lockfile is used; CI Node 24 Linux baseline first. Add Windows/macOS matrix after compatibility and operational need are tested. |
| P5-O-002 | Is TypeScript 7.0 suitable for this repo? | Exact compiler pin remains the bootstrap choice. CI typecheck/build and contract type tests pass on the current Node 24 baseline; reassess before domain packages expand. |
| P5-O-003 | Dashboard framework, database, migrations and auth provider? | Not selected/installed by Phase 5; review in the canonical phase that needs them. |
| P5-O-004 | Staging/production deployment target and secret backend? | Not selected; no deployment credential or target assumed. |
| P5-O-005 | Branch protection / required reviews / required status checks? | An authorized owner must configure GitHub rulesets/branch protection and verify mandatory checks before Phase 5 closes. Workflow files alone cannot enforce merge rules. |
| P5-O-006 | Required dependency exception process? | Require reason, owner, expiry/review date, scope and compensating control. Do not silently waive critical/high findings. |
| P5-O-007 | GitHub dependency graph / Dependency Review? | Enable the repository dependency graph under Settings → Security before reintroducing the separate Dependency Review Action; `npm audit` remains the active dependency check in the meantime. |

## 3. Phase 5 exit rule

Phase 5 is closed for the engineering-foundation handoff based on reproducible CI, pull-request checks, documented environments/secrets/rollback, the current automated dependency/secret checks, and the owner's confirmation that repository protections/settings are configured. The final Phase 6 pull request must validate the reintroduced Dependency Review workflow; if the GitHub dependency graph is still unavailable to Actions, fix that setting before merging. A scaffold commit or workflow definition by itself is not a successful build. The Phase 5 starter does not implement market-data ingestion, token-risk calculations, strategy decisions, signing, live orders, the commercial portal or the finished dashboard. The next canonical phase is Phase 6 — Market-Data Ingestion and Canonical Data Layer.
