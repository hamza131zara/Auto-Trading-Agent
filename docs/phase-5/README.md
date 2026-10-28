# Phase 5 — Repository, Environments, CI/CD and Engineering Foundation

**Status:** ACTIVE — foundation setup started.  
**Started:** 28 October 2026.  
**Previous phase:** Phase 4 design baseline is locked for handoff.  
**Canonical roadmap:** Roadmap v1.0 order remains frozen.

## Purpose

Create a reproducible, reviewable engineering foundation before market-data, token-risk, strategy, signing or trading features are implemented. The initial scope is the repository layout, pinned dependencies, environment separation, repeatable build/typecheck/test/validation, continuous integration, secret/dependency checks and documented recovery/release procedures.

## Documents

1. [Repository structure and engineering conventions](01-repository-structure-and-conventions.md)
2. [Environment and configuration policy](02-environments-and-configuration.md)
3. [CI/CD and security checks](03-ci-cd-and-security-checks.md)
4. [Development, release and rollback runbook](04-development-release-and-rollback-runbook.md)
5. [Phase 5 acceptance and open decisions](05-phase-5-acceptance-and-open-decisions.md)

## Initial tooling direction

- Use npm workspaces as the initial monorepo mechanism.
- Use an active Node.js LTS line for development/CI; initial target is Node 24.
- Pin TypeScript and all dependencies exactly in package.json and package-lock.json; no ranges for direct build tools.
- Use GitHub Actions with least-privilege permissions and full commit-SHA pins for actions.
- Start with built-in Node test runner and small typed workspace packages; add application/framework/provider dependencies only when the relevant roadmap phase needs them.
- CI install is npm ci. Dependency or lockfile changes require review and an updated lockfile.

The first TypeScript pin is an engineering bootstrap, not a final architecture choice. Reassess exact compiler/tool versions during Phase 5 validation before core product modules are built.

## Security invariants

- No production private keys, seed phrases, RPC secrets, API keys, payment credentials or real user data in repository, CI logs, test fixtures or sample environment files.
- Production secrets are not required by build, typecheck, tests or dependency scans.
- .env.example contains only non-secret safe defaults; real .env files are ignored.
- No live trading path is implemented in this phase. The foundation configuration rejects an attempt to set live trading enabled.
- No security check is reported as passed until CI or a local command has actually run and its result is available.

## Exit rule

Phase 5 can close when clean install/build/typecheck/test/repository validation are reproducible, environment and secret boundaries are explicit, CI runs on pushes and pull requests, dependency/secret checks are automated, and rollback/runbooks are reviewed. Phase 6 remains the next canonical phase after Phase 5; no market-data adapter is implemented by this phase starter.
