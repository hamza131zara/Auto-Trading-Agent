# Phase 5.1 — Repository Structure and Engineering Conventions

**Status:** Initial layout established for review.

## 1. Monorepo layers

| Path | Responsibility | Planned canonical phase |
|---|---|---|
| apps/portal | Central commercial website, quote/license/onboarding surface | Portal capabilities follow their product/design/security gates |
| apps/runtime-dashboard | Customer-local runtime UI; not a hosted multi-tenant trade console | Phase 12 |
| services/agent | Customer-local agent/orchestration service | Built incrementally from Phase 6 onward |
| packages/contracts | Shared typed status/decision vocabulary; no strategy implementation | Initial shared foundation |
| packages/config | Validated non-secret base configuration parsing | Phase 5 |
| docs/ | Canonical roadmap, decisions, requirements, threat model, design, runbooks and evidence | All phases |
| assets/brand | Logo and reusable visual assets | Phase 4 onward |
| scripts/ | Deterministic repository checks and safe developer tooling | Phase 5 |
| test/ | Built-in Node tests for the engineering foundation | Phase 5 onward |
| .github/workflows | CI and security scans | Phase 5 |

The reserved application folders are scaffold-only: no portal, trading worker or dashboard app is claimed to be implemented by this foundation.

## 2. Dependency and package conventions

- npm workspaces are the initial package mechanism. Use one repository-wide lockfile.
- Package names use the @ata/ namespace and private: true until a deliberate distribution process is approved.
- Exact dependency versions are committed with the lockfile. Avoid floating tags and unnecessary dependencies.
- Do not add a framework, database driver, Solana SDK, market-data SDK, queue, or LLM provider merely to make the scaffold look complete. Add them only when their canonical phase requires them, after compatibility/security/licensing review.
- Use TypeScript for typed application and shared package code; ESM modules and strict compiler options.
- Keep financial ledger/risk/signing logic out of UI packages; keep secrets out of shared browser packages.
- Do not add domain logic to the scaffold before Phase 6/7/10/11 work.

## 3. Coding conventions

- Strict TypeScript, explicit external data validation, narrow unions and exhaustive state handling.
- Prefer pure functions and deterministic behavior for domain logic.
- Errors include a stable safe code and sanitized context; never include secrets.
- Async side effects live behind explicit interfaces/adapters; tests use deterministic fixtures.
- Public exported types should have concise docstrings when their safety semantics are non-obvious.
- Every decision-changing rule/config is versioned once trading domains are introduced.
- Tests are named by expected behavior; no network or wallet dependency in unit tests.
- No generated output, local credentials, machine-specific paths or dependency directories are committed.

## 4. Review workflow

- Small focused pull requests, owner review for security/risk/provider/key decisions, CI required before merge once branch protection is configured.
- Protect the default branch and require review/status checks through repository settings; documentation alone does not enable GitHub rulesets.
- Changes to frozen roadmap, scope or safety invariants require explicit owner approval and a dated decision-log entry.
- Any addition of a production-capable execution path requires a new approved phase gate; no scaffold should expose a live-action shortcut.
