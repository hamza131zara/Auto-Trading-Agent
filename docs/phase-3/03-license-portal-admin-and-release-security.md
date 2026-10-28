# Phase 3.3 — License Portal, Administration and Release Security

**Status:** Security requirements baseline; identity provider, key-management backend and release pipeline are not yet implemented or approved.

## 1. Boundary and separation of duties

The central portal performs commercial licensing, access administration, signed release distribution and bounded customer onboarding. It does not host trades, hold customer signing keys or exercise transaction control.

Separate the following security authorities even if the initial owner-operated business uses a small admin team:
- Quote/invoice creation and commercial communication.
- Independent settlement verification with the financial institution/provider.
- Customer identity/registration approval.
- License issuance, replacement, suspension/revocation and transfer.
- Release approval and artifact-signing authority.
- Security incident response and audit review.

Where staffing prevents two people from performing each function, retain independent evidence and a second-person review for high-impact actions when feasible; document any compensating controls. Never let a customer-facing webhook alone activate a license.

## 2. Identity and privileged access

- Use a reputable identity platform or mature authentication implementation with supported MFA. Choose phishing-resistant MFA/passkeys where feasible for owner/admin accounts.
- Enforce least privilege and deny-by-default authorization, both on the server and for object-level access. UI hiding is not access control.
- Protect sessions with secure cookie/session settings, CSRF protection where applicable, strict session expiry/rotation and reauthentication for payment approval, license issuance, recovery and release actions.
- Rate-limit authentication, invite redemption, recovery and administrative endpoints; notify on repeated failures and high-impact state changes.
- Admin accounts must use separate privileged identities where practical; no shared admin credential.
- Recovery must not bypass MFA, payment confirmation or owner/admin approval. Break-glass recovery requires short-lived access, a reason, alerting and an audit record.
- Generic external error responses must not disclose sensitive account or infrastructure details.

## 3. Payment and license state machine

Required ordered state transitions:
1. Quote requested.
2. Quote qualified and versioned.
3. Invoice issued with agreed terms and payment instructions.
4. Settlement pending and then independently verified as cleared using an approved route.
5. One-time, scoped registration invitation issued.
6. Customer registers, verifies email, enrolls required MFA and accepts the applicable terms.
7. Owner/admin approves the account and license request.
8. License issuer signs a scoped entitlement; issuance is audited separately from payment verification.

Rejected/expired/reversed/disputed/refunded states must have explicit legal/business handling. Never roll a license into active state because a screenshot, customer email, unconfirmed transfer, explorer URL or unverified webhook says “paid.” Crypto and online-card collection remain disabled until exact eligibility is approved in writing.

## 4. Signed license entitlement

A license entitlement should be a signed, versioned payload containing only required fields, such as:
- License ID and customer/organization ID.
- Installation-binding identifier or public-key identity.
- Allowed product/version/feature scope.
- Issue time and contractually defined validity/renewal/grace metadata.
- Entitlement schema version and signing-key identifier.
- Non-sensitive status and support/update entitlement references.

Do not put customer wallet secrets, API credentials, unnecessary personal information or private host details in a token. The runtime validates the cryptographic signature and expected issuer/algorithm, schema, audience, installation binding, product/features and policy. Reject unsigned, malformed, tampered, wrong-audience, expired-outside-policy or unsupported entitlements.

The exact algorithm, key custody, rotation, online/offline validation and grace policy require a documented decision. License-signing keys must be distinct from software-release keys and customer signing keys.

## 5. Lifetime license revocation and offline behavior

Because this is a proposed lifetime license, the meaning of “lifetime,” supported updates, termination grounds, refunds and dispute terms must be contractually reviewed. Security enforcement must not become a hidden remote kill switch.

- The customer runtime must enforce local risk policy and reconcile existing transactions while the portal is unavailable.
- Portal inability to renew a status check cannot by itself submit, suppress or force a trade.
- Revocation grounds, appeal/recovery, signed denial/status, cached status expiry and grace duration are unresolved decisions until formally approved.
- Fraud/security suspension should first block new license downloads or future new-entry permissions only through a documented, reviewed mechanism that cannot arbitrarily manipulate an active position.
- The final effect of a license suspension on an already-installed runtime requires explicit security/legal review and tests for both a flat account and an open/unknown position.

## 6. Software release and supply-chain integrity

Proposed release process:
1. Protected source branch, code review and least-privilege CI identities.
2. Dependency review, pinning/lockfile integrity, vulnerability scanning and secret scanning.
3. Automated build/test/lint/type checks and security tests.
4. Produce a software bill of materials (SBOM) and build provenance where tooling permits.
5. Publish immutable versioned artifacts and a manifest containing artifact digest, version, supported platform, release notes and signing-key identifier.
6. Sign the manifest/artifact through a dedicated, access-controlled release-signing boundary. Do not keep signing keys as ordinary repo secrets accessible to all build jobs.
7. Customers verify signature and checksum before installation/update; reject tampered or untrusted artifacts.
8. Backup before migration, apply versioned migrations, perform health checks and follow a tested rollback path.
9. Record approval, artifact digest, builder identity, publication time and incident/revocation status.

The runtime must not download and execute arbitrary scripts, remote configuration-as-code, plugins or model-generated code from the portal. Remote updates must not modify risk limits silently.

## 7. Release and security events to audit

Quote versioning, settlement review/confirmation/reversal, invitation lifecycle, MFA recovery, approval, license issue/replace/suspend, signing-key rotation, release sign/publish/yank, artifact download, support artifact access and access-control changes. Record actor/service identity, UTC timestamp, target, reason, old/new state where applicable, correlation ID and outcome; do not log secrets.
