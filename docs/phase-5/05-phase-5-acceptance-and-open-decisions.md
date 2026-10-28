# Phase 5.5 — Acceptance Criteria and Open Decisions

**Status:** Active. Main push CI evidence exists for the checks marked complete below; pull-request-specific verification and owner-side repository settings remain open.

## 1. Acceptance checklist

- [x] Clean CI checkout and npm ci --ignore-scripts installed the exact package-lock dependency tree on Node 24.
- [x] Each intended workspace package was validated/discovered by the repository check.
- [x] TypeScript strict typecheck and build completed on the supported runtime in main push CI.
- [x] Deterministic configuration tests passed, including safe defaults and live-mode rejection.
- [x] Repository validation passed for workspace manifests, safe environment defaults, ignored local env files and common secret-pattern checks.
- [ ] Main push CI is passing; verify a new pull-request run after the Gitleaks full-history checkout fix and confirm mandatory checks fail closed.
- [x] npm audit and Gitleaks secret scan are active and passed in the main push workflow. GitHub Dependency Review remains deferred until the repository dependency graph is enabled.
- [x] No production credentials are needed for install/build/test/CI.
- [x] Development/staging/production boundaries and secret handling are documented.
- [x] Rollback/recovery instructions and dependency-update workflow are documented.
- [ ] Owner confirms initial tooling choices and configures repository dependency graph, branch protection, required reviews and required status checks.

## 2. Carry-forward decisions

| ID | Question | Default / gate |
|---|---|---|
| P5-O-001 | Exact package-manager version and OS support matrix? | npm lockfile is used; CI Node 24 Linux baseline first. Add Windows/macOS matrix after compatibility and operational need are tested. |
| P5-O-002 | Is TypeScript 7.0 yet suitable for this repo? | Initial exact compiler pin is used for the foundation. Validate clean install/build on Node 24 and reassess before domain packages expand. |
| P5-O-003 | Dashboard framework, database, migrations and auth provider? | Not selected/installed by Phase 5; review in the canonical phase that needs them. |
| P5-O-004 | Staging/production deployment target and secret backend? | Not selected; no deployment credential or target assumed. |
| P5-O-005 | Branch protection / required reviews / required status checks and GitHub dependency graph? | Configuration must be enabled in GitHub settings by an authorized owner; workflow files alone cannot enforce merge rules. Dependency Review Action must remain deferred until the dependency graph is enabled; npm audit is the current dependency gate. |
| P5-O-006 | Required dependency exception process? | Require reason, owner, expiry/review date, scope and compensating control. Do not silently waive critical/high findings. |

## 3. Phase 5 exit rule

Close Phase 5 only after clean install/build/typecheck/test/repository validation are reproducible, environment and secret boundaries are explicit, CI runs on pushes and pull requests, dependency/secret checks are automated, and rollback/runbooks are reviewed. A scaffold commit or workflow definition by itself is not a successful build. The Phase 5 starter does not implement market data ingestion, token-risk calculations, strategy decisions, signing, live orders, the commercial portal or the finished dashboard. The next canonical phase is Phase 6 — Market-Data Ingestion and Canonical Data Layer.
