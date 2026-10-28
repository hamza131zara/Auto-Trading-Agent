# Phase 5.4 — Development, Release and Rollback Runbook

**Status:** Initial developer and failure-recovery instructions.

## 1. Local setup

1. Install a maintained Node.js 24 LTS release and npm compatible with the repository lockfile.
2. Clone the repository and check out the intended branch.
3. Copy .env.example to a local .env only if a tool specifically requires it; never place secrets in the example file.
4. Run npm ci to install the exact locked dependencies.
5. Run npm run check to validate repository rules, typecheck, build and test.
6. Review the output and commit changes only when the command succeeds.

Because this scaffold uses Node 24, an older local Node version is not the supported baseline. Do not bypass an engine mismatch with --force; install the supported runtime.

## 2. Common commands

| Command | Purpose |
|---|---|
| npm ci | Reproduce the locked dependency installation |
| npm run validate:repo | Check workspace structure and safe repository conventions |
| npm run typecheck | Typecheck the packages |
| npm run build | Build typed workspace packages |
| npm test | Build and run deterministic Node tests |
| npm run check | Run repository validation, typecheck and tests |
| npm audit --audit-level=high | Audit the locked dependency tree against the registry |

## 3. Dependency update procedure

1. Create a focused branch.
2. Update the exact package version in package.json and regenerate package-lock with a current supported npm.
3. Inspect the lockfile diff and package origin/license/maintenance.
4. Run clean install, typecheck, build, tests and audit.
5. Review for transitive changes and known advisories.
6. Submit for owner review when a change touches signing, security, quantitative policy, data custody or production runtime.

Do not hand-edit integrity strings to suppress install/audit failures.

## 4. CI failure / rollback

- If CI fails after a repository foundation change, do not merge the change; inspect the failing workflow/job logs and reproduce with the same Node major.
- If main is broken after direct commit, revert the offending commit using a reviewed revert; do not force-push or rewrite shared history to conceal a failure.
- If a dependency update introduces breakage, revert the package and matching lockfile together, then re-run the full check.
- No release artifact is built in this phase, so there is no production runtime deployment rollback yet.
- Preserve workflow logs and sanitized evidence; never paste secrets into an issue/PR.

## 5. Recovery and future release notes

When build artifacts and deployments are introduced later, add a versioned database migration and backup plan, immutable artifact checksum, signature verification, health check, canary/rollback steps and an explicit owner go/no-go. Do not invent release SLAs or automatic recovery claims before there is a deployed service.
