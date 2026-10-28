# Phase 5.5 — Acceptance Criteria and Open Decisions

**Status:** Active until checks are implemented and evidence is recorded.

## 1. Acceptance checklist

- [ ] Clean checkout and npm ci reproducibly install the exact package-lock dependency tree on Node 24.
- [ ] Each intended workspace package is discoverable by npm.
- [ ] TypeScript strict typecheck and build complete on the supported runtime.
- [ ] Deterministic tests pass, including safe configuration defaults and live-mode rejection.
- [ ] Repository validation rejects unsafe local environment files and secret-like values in source paths.
- [ ] GitHub Actions runs on pull requests/pushes and fails on any mandatory check.
- [ ] Dependency audit and secret scan are active; their actual run results are retained.
- [ ] No production credentials are needed for install/build/test/CI.
- [ ] Development/staging/production boundaries and secret handling are documented.
- [ ] Rollback/recovery procedure and dependency-update workflow are reviewable.
- [ ] Owner confirms the initial monorepo/tooling choices and any external GitHub settings needed.

## 2. Carry-forward decisions

| ID | Question | Default / gate |
|---|---|---|
| P5-O-001 | Exact package-manager version and OS support matrix? | npm lockfile is used; CI Node 24 Linux baseline first. Add Windows/macOS matrix after compatibility and operational need are tested. |
| P5-O-002 | Is TypeScript 7.0 yet suitable for this repo? | Initial exact compiler pin is used for the foundation. Validate clean install/build on Node 24 and reassess before domain packages expand. |
| P5-O-003 | Dashboard framework, database, migrations and auth provider? | Not selected/installed by Phase 5; review in the canonical phase that needs them. |
| P5-O-004 | Staging/production deployment target and secret backend? | Not selected; no deployment credential or target assumed. |
| P5-O-005 | Branch protection / required reviews / required status checks? | Configuration must be enabled in GitHub settings by an authorized owner; workflow files alone cannot enforce merge rules. |
| P5-O-006 | Required dependency exception process? | Require reason, owner, expiry/review date, scope and compensating control. Do not silently waive critical/high findings. |

## 3. Phase 5 exit rule

Close Phase 5 only after clean install/build/typecheck/test/repository validation are reproducible, environment and secret boundaries are explicit, CI runs on pushes and pull requests, dependency/secret checks are automated, and rollback/runbooks are reviewed. A scaffold commit or workflow definition by itself is not a successful build. The Phase 5 starter does not implement market data ingestion, token-risk calculations, strategy decisions, signing, live orders, the commercial portal or the finished dashboard. The next canonical phase is Phase 6 — Market-Data Ingestion and Canonical Data Layer.
