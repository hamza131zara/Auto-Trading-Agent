# Phase 3 — Threat Model, Custody Model and Security Architecture

**Status:** ACTIVE — architecture and threat-model work begun.  
**Started:** 28 October 2026.  
**Previous phase:** Phase 2 requirements/specification is complete for handoff.  
**Frozen roadmap:** Roadmap v1.0 order is unchanged. Phase 4 visual design follows Phase 3.

## Purpose

Define how the self-hosted trading runtime, customer-controlled signing boundary, central licensing portal, software releases, credentials and operational processes resist misuse, compromise, fraud and unsafe execution. This phase produces a security design and testable mitigation baseline; it does not claim the controls are implemented, independently audited or production-approved.

## Documents

1. [Threat model and trust boundaries](01-threat-model-and-trust-boundaries.md)
2. [Custody and transaction-signing architecture](02-custody-and-transaction-signing-architecture.md)
3. [License portal, administration and release security](03-license-portal-admin-and-release-security.md)
4. [Secrets, audit, privacy and incident response](04-secrets-audit-privacy-and-incident-response.md)
5. [Security verification plan and Phase 3 exit criteria](05-security-verification-and-phase-3-exit-criteria.md)
6. [External security reference register](06-security-reference-register.md)

## Locked baseline constraints

- D-025: V1 is self-hosted, customer-isolated software. There is no hosted multi-customer trading runtime or pooled funds in V1.
- Every customer installation has its own runtime, database, configuration, provider credentials, wallet/signer, risk policy, ledger and audit history.
- The central portal handles licensing, registration, verified payment records, authorized releases, setup documentation, booking and bounded support. It must not obtain customer wallet secrets or arbitrary transaction-signing authority.
- AI/LLM output is advisory and schema-validated; deterministic token/security/risk controls and the signer policy have final veto.
- One open or unresolved position per individual running instance/portfolio. Unknown transaction state blocks new entry until reconciled.
- Production signing keys, wallet secrets or live order flow are not authorized during Phase 3 documentation. Do not connect a production wallet.
- Numerical thresholds still marked TBD remain executable blockers. No component may invent them.
- D-030 visual requirements are locked, including selective 3D/isometric assets; they do not alter security boundaries or trading behavior.

## Architecture workstreams

1. Threat actors, assets, entry points, abuse cases, impact and residual-risk register.
2. Trust boundaries and communication contracts between portal, local runtime, AI service, provider adapters and constrained signer.
3. Customer custody and key-lifecycle model, signing policy, transaction-intent validation and recovery from unknown outcomes.
4. Authentication, MFA, authorization, admin separation, license signing, payment fraud prevention and safe offline behavior.
5. Release integrity, dependency/supply-chain controls, backup/recovery, secret-safe logs and incident response.
6. Security acceptance matrix, verification evidence requirements, unresolved decisions and independent-review criteria.

## Phase 3 exit rule

Phase 3 remains active until the threat model, trust boundaries, custody/signing design, portal/release security, operational security, mitigation traceability and security verification plan are reviewed and approved. Any unsupported signer backend, missing execution limit, unresolved critical threat or untested security-critical control must remain a blocker. Phase 3 completion does not authorize mainnet trading; later test, paper/shadow, independent review and canary gates still apply.
