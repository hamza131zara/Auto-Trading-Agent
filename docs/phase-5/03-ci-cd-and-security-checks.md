# Phase 5.3 — CI/CD and Security Checks

**Status:** Current CI workflow and action pins were verified by successful pull-request CI run [40809677560](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40809677560). GitHub protection and dependency-graph settings remain owner-controlled gates.

## 1. Pull request / push checks

Run on pull requests and pushes to main:
1. Checkout at a full commit SHA.
2. Set up Node from the checked-in version file.
3. Install exactly from package-lock using `npm ci --ignore-scripts`.
4. Validate repository invariants and safe configuration.
5. Typecheck workspace packages and compile-time contract regression tests.
6. Build packages.
7. Run deterministic tests.
8. Run `npm audit --audit-level=high`; dependency findings require triage and remediation or a documented exception before release.

Do not supply wallet, RPC, database, payment, LLM or production secrets to ordinary CI.

## 2. Pinned workflow actions

The current workflow uses full commit-SHA pins for:
- `actions/checkout` 7.0.1: `3d3c42e5aac5ba805825da76410c181273ba90b1`
- `actions/setup-node` 7.1.0: `949feb2413d6458794dcd2491c4babbbce0c15c1`
- `gitleaks/gitleaks-action` v3.0.0: `e0c47f4f8be36e29cdc102c57e68cb5cbf0e8d1e`

Both checkout steps use the reviewed pin, and the secret-scan job fetches full Git history for pull-request range scanning. The combined action updates passed the quality and secret-scan jobs in [PR #7's CI run](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40809677560).

## 3. Security and dependency checks

- Gitleaks scans commit/PR changes for exposed credentials and key material.
- The built-in repository validator checks forbidden secret/config patterns in source paths and confirms local environment files are not tracked.
- `npm audit` evaluates the dependency tree; Dependabot proposes reviewable updates. The invalid custom label references were removed from `.github/dependabot.yml` so its scheduled runs no longer depend on repository labels that do not exist.
- GitHub Action dependencies use full commit SHA pins and read-only token permissions where possible.
- The separate Dependency Review Action is deferred because GitHub reported that the repository dependency graph is not enabled. An authorized owner must enable the dependency graph in repository Settings → Security before that separate PR gate is reintroduced; `npm audit` is the current dependency gate.
- Later container builds must scan base images and built artifacts before publication; Phase 5 contains no container image and cannot claim container scans have run.
- Code-scanning/secret-scanning repository settings and branch protection may require owner-side GitHub configuration. Workflow files alone do not prove these settings are enabled.

## 4. Artifact and release boundary

- No public release, signed runtime artifact or production deployment occurs in this phase.
- Future builds should publish versioned artifacts with checksums, provenance, a dedicated release-signing boundary and rollback guidance.
- Release-signing keys must not be ordinary CI environment secrets.
- A successful CI build is not evidence of trading safety, performance, legal approval or independent security review.

## 5. Failure behavior

A failing validation, typecheck, build, test, secret scan or high-severity dependency audit must fail the workflow. Do not use `continue-on-error` on a mandatory check and do not skip tests because no trading module exists yet; foundation tests are still required.

## 6. Required evidence

For each release candidate retain commit SHA, workflow run, tool/runtime versions, audit report, test output and review. After branch protection is configured, require the relevant CI checks before merge and verify they are enforced. Manual changes directly on main remain subject to the same tests on push, but direct-push prevention is a GitHub settings decision.
