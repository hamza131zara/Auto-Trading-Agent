# Phase 5 — Repository, Environments, CI/CD and Engineering Foundation

**Status:** ACTIVE — the scaffold, contract/config regression tests, dependency update configuration and refreshed CI action pins are merged. Main-push baseline CI and multiple pull-request CI runs passed. Owner-side GitHub settings remain open.  
**Started:** 28 October 2026.  
**Previous phase:** Phase 4 design baseline is locked for handoff.  
**Canonical roadmap:** Roadmap v1.0 order remains frozen.

## Purpose

Create a reproducible, reviewable engineering foundation before market-data, token-risk, strategy, signing or trading features are implemented. The scope is repository layout, pinned dependencies, environment separation, repeatable build/typecheck/test/validation, continuous integration, secret/dependency checks and documented recovery/release procedures.

## Documents

1. [Repository structure and engineering conventions](01-repository-structure-and-conventions.md)
2. [Environment and configuration policy](02-environments-and-configuration.md)
3. [CI/CD and security checks](03-ci-cd-and-security-checks.md)
4. [Development, release and rollback runbook](04-development-release-and-rollback-runbook.md)
5. [Phase 5 acceptance and open decisions](05-phase-5-acceptance-and-open-decisions.md)

## Initial tooling direction

- Use npm workspaces as the initial monorepo mechanism.
- Use Node.js 24 for the current development/CI baseline.
- Pin TypeScript and direct dependencies exactly in package.json and package-lock.json.
- Use GitHub Actions with least-privilege permissions and full commit-SHA pins for actions.
- Use the built-in Node test runner plus compile-time contract regression checks; add framework/provider dependencies only when the corresponding roadmap phase needs them.
- CI installs with `npm ci --ignore-scripts`. Dependency or lockfile changes require review and an updated lockfile.

TypeScript 7.0.2 remains an exact engineering-bootstrap pin. Its successful CI checks are evidence for the current foundation, not a permanent decision for all future modules.

## Verified CI evidence

The main-push baseline completed successfully at commit `31ce3ea97efab31e003a7e0a49747118b0c7c5b4`: [workflow run 40739952683](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40739952683).

Subsequent pull-request runs also passed both the quality job and the full-history secret-scan job:

- [PR #5 — contract and configuration regression checks, run 40809400085](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40809400085)
- [PR #6 — Dependabot configuration cleanup, run 40809562729](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40809562729)
- [PR #7 — combined GitHub Actions pin refresh, run 40809677560](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40809677560)

The current action pins are reviewed full commit SHAs for checkout 7.0.1, setup-node 7.1.0 and Gitleaks v3.0.0. PR #7 tested the combined pin changes in one run. The contract type checks now explicitly reject execution-authorizing decision outcomes, and config tests cover frozen results and exact lowercase boolean parsing.

The Dependency Review Action remains deferred because GitHub reported that this repository's dependency graph is not enabled. `npm audit --audit-level=high` is active and passed in the cited CI runs. Branch protection, required reviews and required status checks are not claimed enabled; an authorized owner must configure and verify them.

## Security invariants

- No production private keys, seed phrases, RPC secrets, API keys, payment credentials or real user data in repository, CI logs, test fixtures or sample environment files.
- Production secrets are not required by build, typecheck, tests or dependency scans.
- `.env.example` contains only non-secret safe defaults; real `.env` files are ignored.
- No live trading path is implemented in this phase. The foundation configuration rejects an attempt to enable live trading.
- No security check is reported as passed until CI or a local command has actually run and its result is available.

## Exit rule

Close Phase 5 only after clean install/build/typecheck/test/repository validation are reproducible, environment and secret boundaries are explicit, CI passes on pushes and pull requests, dependency/secret checks are automated, rollback/runbooks are reviewed, and owner-side repository protections/settings have been configured and verified or explicitly dispositioned. Phase 6 remains the next canonical phase after Phase 5; no market-data adapter is implemented by this phase starter.
