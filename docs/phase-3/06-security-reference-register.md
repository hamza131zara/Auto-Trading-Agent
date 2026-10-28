# Phase 3.6 — Security Reference Register

**Review date:** 28 October 2026  
**Purpose:** Provide authoritative references for security architecture and verification planning. This list informs design but does not certify compliance.

## Standards and references

| Reference | Relevant use in this project | Boundary/caveat |
|---|---|---|
| [OWASP Application Security Verification Standard (ASVS), version 5.0.0](https://asvs.owasp.org/) | Structured application-security verification requirements for the central portal, local dashboard and APIs | Adopt selected mapped requirements based on threat model; do not claim ASVS certification without a completed assessment. Version 5.0.0 is identified as stable and published 30 May 2025 on the official site. |
| [OWASP Secrets Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html) | Secret lifecycle, least privilege, access auditing, rotation, revocation and incident response | Apply according to each customer's host/provider capability and the final key-backend decision. |
| [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html) | Security events, log-injection prevention, log hygiene and avoiding direct sensitive-data logging | Retention and privacy policy must be set using contractual/legal review and actual support needs. |
| [OWASP REST Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/REST_Security_Cheat_Sheet.html) | API endpoint access, management endpoint exposure, safe error handling, security headers and audit events | Apply separately to the central portal and any authenticated local API. |
| [NIST SP 800-218, Secure Software Development Framework v1.1](https://csrc.nist.gov/pubs/sp/800/218/final) | Secure development, build/release integrity, vulnerability reduction and release evidence | Framework published February 2022; use as a process reference, not a claim of NIST certification. |
| [Solana transactions documentation](https://solana.com/docs/core/transactions) | Transaction structure, signatures, atomic transaction execution, byte-size and recent-blockhash constraints | Protocol limits can evolve; verify the relevant current specification against supported SDK/cluster before implementing adapters. |
| [Solana Signing in Production](https://solana.com/docs/core/transactions/signing-in-production) | Key custody trade-offs and prohibition on embedding/committing private keys | The production signer mechanism still requires a project-specific decision and threat assessment. |

## Baseline application notes

- Use ASVS and the OWASP cheat sheets as a traceable checklist for portal/API security, not as a substitute for threat modeling.
- Use the Solana transaction model to ensure a signer decodes and validates the full transaction intent rather than blindly signing arbitrary serialized bytes.
- Fee handling matters even for failed Solana transactions; execution accounting and security reconciliation must preserve transaction outcomes.
- Protect key lifecycle and audit trails. Avoid logging raw signer requests or sensitive account/configuration values.
- Use secure development and release controls from the beginning: review, dependency management, secret scanning, signing, provenance where feasible, and rollback.

## Review maintenance

Recheck these official sources when Phase 3 is reviewed and before release, because standards, supported versions, SDKs, and provider behavior can change. Record the exact version/date adopted for each required control. No official source reference implies that legal, licensing, custody or trading approval exists.
