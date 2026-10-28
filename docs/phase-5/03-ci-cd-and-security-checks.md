# Phase 5.3 — CI/CD and Security Checks

**Status:** Initial GitHub Actions workflow is part of the Phase 5 scaffold.

## 1. Pull request / push checks

Run on pull requests and pushes to main:
1. Checkout at a full commit SHA.
2. Set up Node from the checked-in version file.
3. Install exactly from package-lock using npm ci.
4. Validate repository invariants and safe configuration.
5. Typecheck every workspace.
6. Build packages.
7. Run deterministic tests.
8. Run npm audit --audit-level=high; dependency findings require triage and remediation or documented exception before release.

Do not supply wallet, RPC, database, payment, LLM or production secrets to ordinary CI.

## 2. Security and dependency checks

- Gitleaks scans current commit/PR changes for exposed credentials and key material.
- Built-in repository validator checks forbidden secret/config patterns in source paths and confirms local environment files are not tracked.
- npm audit evaluates the dependency tree; dependabot proposes reviewable updates.
- GitHub Action dependencies use full commit SHA pins and read-only token permissions where possible.
- Later container builds must scan base images and built artifacts before publication; Phase 5 contains no container image and cannot claim container scans have run.
- Code-scanning/secret-scanning repository settings and branch protection may require owner-side GitHub configuration. The files alone do not prove those settings are enabled.

## 3. Artifact and release boundary

- No public release, signed runtime artifact or production deployment occurs in this phase.
- Future builds should publish versioned artifacts with checksums, provenance, a dedicated release-signing boundary and rollback guidance.
- Release-signing keys must not be ordinary CI environment secrets.
- A successful CI build is not evidence of trading safety, performance, legal approval or independent security review.

## 4. Failure behavior

A failing validation, typecheck, build, test, secret scan or high-severity dependency audit must fail the workflow. Do not use continue-on-error on a mandatory check and do not skip tests because no trading module exists yet; foundation tests are still required.

## 5. Required evidence

For each release candidate retain commit SHA, workflow run, tool/runtime versions, audit report, test output and review. After branch protection is configured, require the relevant CI checks before merge. Manual changes directly on main remain subject to the same tests on push, but direct-push prevention is a GitHub settings decision.
