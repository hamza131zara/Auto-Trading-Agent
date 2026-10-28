# Phase 3.5 — Security Verification Plan and Exit Criteria

**Status:** Verification plan handed off. Phase 3 is closed for documentation/design handoff by owner direction; tests are planned, not yet executed.  
**Purpose:** Convert the threat model and architecture requirements into independently verifiable security acceptance evidence.

## 1. Security verification principles

- Test the backend/runtime/signing boundary, not only the UI.
- Use disposable wallets, test keys, local validators, mocks and simulation environments. Never use production secrets as test fixtures.
- Retain code commit, test/tool version, configuration, sanitized output and reviewer for every high-risk test.
- Test negative paths and recovery paths, not just successful operation.
- A control is not PASS until evidence is retained. A written requirement or diagram alone is not test evidence.
- Independent security review remains a later mandatory gate; completing this phase does not grant live-trading permission.

## 2. Planned acceptance matrix

| ID | Security property | Planned verification | Required result |
|---|---|---|---|
| SEC-001 | Signer isolation | Inspect process, transport, filesystem and access controls; attempt direct unauthorized access | Only authorized local runtime identity can request constrained signing; portal/LLM/browser cannot read keys |
| SEC-002 | Intent/transaction binding | Mutate destination, mint, amount, program, account meta, fee or min output between validation and signing | Every unexpected field is denied and reason-coded |
| SEC-003 | Program/instruction allowlist | Try unknown program and unsupported instruction variants, approvals and authority changes | Denied by default; allowlist change needs reviewed versioned policy |
| SEC-004 | Risk-veto authority | Mock model recommending a trade with failed gate, unknown threshold or stale evidence | No transaction is signed or submitted |
| SEC-005 | Unknown execution state | Simulate timeout after submit, RPC disagreement and process restart | Durable unknown state; new entry remains blocked until reconciliation |
| SEC-006 | Duplicate prevention | Repeat identical intent/request and race concurrent requests | Idempotency/position invariant prevents duplicate entry |
| SEC-007 | Customer isolation | Probe tenant/license IDs, endpoints, logs, downloads, storage and runtime identities across customers | Cross-customer access denied; no shared trade state |
| SEC-008 | License token integrity | Tamper, omit, change audience, substitute key ID or rebind an entitlement | Invalid/unsupported license rejected; no unsigned fallback |
| SEC-009 | Payment activation integrity | Provide screenshot, forged webhook, stale/replayed receipt or pending settlement | Cannot activate license without independently verified cleared settlement and approval |
| SEC-010 | Admin MFA and separation | Test privileged flows, recovery, role bypass and direct API calls | Least privilege and reauthentication enforced server-side; actions audited |
| SEC-011 | Release integrity | Corrupt artifact/manifest, use unknown signer, downgrade version or replay old package | Tampered/untrusted package rejected; downgrade policy enforced |
| SEC-012 | Secret redaction | Seed dummy secrets in error paths, logs and diagnostic bundles | No secret value appears; support export is allowlisted and previewed |
| SEC-013 | Audit integrity | Alter/delete event, change clock or drop event writer | Tampering/omission detectable; operations fail or alert per approved policy |
| SEC-014 | Portal outage safety | Disconnect licensing portal during local reconciliation and policy checks | Local policy remains authoritative; no remote forced trade or hidden bypass |
| SEC-015 | Network/egress constraints | Test unexpected redirects, loopback/private/link-local targets and DNS changes where user-configurable URLs exist | Deny destinations outside the approved set and revalidate redirects |
| SEC-016 | Session/API protections | Test CSRF, auth expiry, replay, rate limits, object authorization, CORS and management endpoint exposure | Unauthorized requests denied with safe errors and auditable events |
| SEC-017 | Backup and recovery | Corrupt backup, restore stale snapshot and restart in unknown transaction state | Integrity check fails safely or restore completes with ledger/reconciliation validation |
| SEC-018 | Dependency/build supply chain | Secret/dependency scan; protected CI permissions; manifest and provenance verification | Findings are triaged; critical unmitigated risks block release |
| SEC-019 | Privacy and telemetry | Verify defaults and inspect outbound requests on customer runtime | No undisclosed telemetry or customer data export; consent is explicit if any telemetry exists |
| SEC-020 | Emergency stop semantics | Trigger pause/stop in flat/open/unknown position conditions | New entries stop promptly; exit behavior is explicit, audited and never falsely guaranteed |

## 3. Required evidence artifacts

- Updated architecture diagram and signed-off trust-boundary inventory.
- Threat register with owner, severity, mitigation, test ID, residual-risk rationale and status.
- Signer intent schema and policy/allowlist versioning decision.
- Key-backend decision and key lifecycle playbook.
- License entitlement and update/rollback design.
- Authentication/authorization matrix and administrative separation-of-duties model.
- Secret classification, log-redaction policy, retention/privacy decision and diagnostic bundle contract.
- Incident response runbooks and recovery drills.
- Test reports with implementation commit and independent reviewer notes.
- Explicit list of open risks accepted by owner and risks that block subsequent phases.

## 4. Phase 3 exit checklist

Under the normal exit criteria, Phase 3 may close only after:
- [ ] Threat actors, assets, trust boundaries and external dependencies are inventoried.
- [ ] Critical/high threats have a concrete mitigation, evidence plan, owner and residual-risk disposition.
- [ ] Customer wallet custody and supported signing backend are explicitly chosen with documented trade-offs.
- [ ] Typed intent contract, program/instruction allowlist, transaction validation and unknown-state recovery are defined.
- [ ] Admin authentication, MFA, authorization, settlement/license separation and recovery flows are specified.
- [ ] License-signing and release-signing key boundaries, rotation, offline/grace and rollback behaviors are designed.
- [ ] Secret handling, telemetry, privacy, audit integrity and customer-support boundaries are specified.
- [ ] Threat-to-test traceability is complete and implementation tests are planned for relevant later phases.
- [ ] Any open Critical risk blocks progression into implementation of the affected security-sensitive capability.
- [ ] Owner reviews/accepts the architecture baseline and the next phase handoff is documented.

The owner has elected to close the phase for design handoff before all these criteria are evidenced. Therefore the checklist remains an open verification checklist for later implementation/release gates; unchecked items must not be described as completed.

## 5. Explicit exclusions

This plan does not authorize live-wallet connection, mainnet transaction signing, public payment collection, card checkout, crypto receipt or hosted multi-tenant runtime. Numeric trading limits still marked TBD block execution. Phase 4 remains the canonical phase for final UI visual design, including D-030 selective 3D visual placement.
