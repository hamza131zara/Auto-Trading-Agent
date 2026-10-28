# Phase 3.4 — Secrets, Audit, Privacy and Incident Response

**Status:** Operational security baseline; retention durations, support coverage and host-specific controls require owner/legal review.

## 1. Secret classification and handling

Classify data at minimum:
- **Critical secrets:** wallet private keys/seed phrases, signer credentials, license/release-signing private keys, recovery material.
- **High sensitivity:** provider API keys, database credentials, session/access/refresh tokens, MFA recovery codes, SMTP/payment integrations.
- **Confidential customer records:** identity and invoice data, license IDs, support messages, wallet public addresses where linked to a customer, strategy configuration and audit exports.
- **Operational data:** sanitized health, timing, error and service-version metadata.
- **Public:** public marketing content and published release notes.

Controls:
- Collect only the secrets a component strictly needs; the central portal does not collect wallet secrets.
- Use platform/customer secret storage; avoid plaintext config, source control, images, CI output and unnecessary environment exposure.
- Redact before logging and before support export. Do not rely only on frontend masking.
- Restrict secret read/change/rotation operations by service identity and role; audit access attempts without recording secret values.
- Define creation, provisioning, rotation, revocation, expiry, backup and disposal for each secret type.
- Use separate credentials for environments and customers; separate production, staging and local-test values.
- Scrub secrets and personal data from error reports, traces, exception serialization, URLs and analytics.
- Provide secret-scanning and seeded-secret tests in CI. A test fixture should prove that known dummy secrets never appear in logs or support bundles.

## 2. Audit and log integrity

Use structured records with timestamp, actor/service identity, event type, resource, outcome, reason code, correlation ID, software/rule version and sanitized context. Authentication, authorization, license/payment changes, signer allow/deny, risk-veto, transaction lifecycle, configuration changes, backup/restore and release actions are auditable.

Do not log seed phrases, private keys, access tokens, passwords, API-key values, full connection strings, payment credentials or unreviewed personal data. Where request evidence is required, prefer a redacted/hashed identifier and a digest of the signed intent over storing raw secrets.

Audit data should be append-only or otherwise tamper-evident to the degree practical in the customer environment. Restrict deletion/export, use clock-synchronized UTC timestamps, correlate records across request/intent/signature/confirmation, and alert on clock drift, audit failure or unexpected deletion. Retention duration must be set with cost, privacy, contractual and jurisdictional review rather than invented here.

## 3. Customer diagnostics and privacy

- Diagnostics must be generated from an explicit allowlist, then redacted and previewed by the customer before sharing.
- Default diagnostics exclude wallet secrets, provider-key values, cookies, auth headers, transaction-signer requests containing sensitive payloads and unnecessary wallet/account identifiers.
- Customer consent is required before exporting local logs or personal data to vendor support.
- No silent collection of customer trade history, strategy state, wallet addresses or provider usage to the central portal. Any telemetry is separately opt-in, documented, minimized and revocable.
- The vendor must not receive remote shell access by default. Any future remote-support feature requires a separate consent, temporary least-privilege grant, audit and expiry design.
- Scheduling/onboarding forms must never request seed phrases/private keys. During Google Meet, customers enter credentials themselves in their own environment and avoid screen sharing secrets.

## 4. Incident classification

Use a documented severity scheme:
- **SEV-1 Critical:** suspected signing-key exposure, unauthorized/incorrect transaction, cross-customer compromise, release-signing key compromise, or broad license/admin compromise.
- **SEV-2 High:** exploitable security vulnerability, sensitive diagnostic leak, admin takeover attempt with evidence, tampered release or integrity failure.
- **SEV-3 Moderate:** contained service abuse, limited audit/monitoring gap or provider incident without evidence of asset compromise.
- **SEV-4 Low:** non-security defect or low-impact policy issue with no evidence of unauthorized access or trading impact.

## 5. Initial response playbooks

### Suspected key/signer compromise
1. Stop new entries and preserve safe local state; do not blindly submit an automated sell.
2. Revoke/disable the affected signing authority or provider credential where technically possible and safe; do not expose the key further during investigation.
3. Customer uses a trusted, independent device/process to assess wallet state and, if necessary, move remaining assets to a newly generated wallet. The agent cannot guarantee asset recovery.
4. Preserve transaction IDs, sanitized logs, host/package hashes and timeline without copying secrets.
5. Assess other credentials and installations; rotate/revoke compromised credentials.
6. Notify affected customer and follow legal, contractual and regulatory notification advice.
7. Rebuild/reinstall from a verified release after the host is trusted; document residual compromise risk.

### Wrong or unknown transaction result
1. Stop new entries and lock the affected portfolio.
2. Query independent RPC sources and on-chain transaction/account state; preserve signature and intent ID.
3. Classify the transaction as confirmed success, confirmed failure, partially reflected state or still unknown. Do not assume absence from one RPC means it failed.
4. Reconcile token balances, fills and fees; resume only when state and risk are re-established.
5. Escalate if the transaction cannot be resolved within the owner-approved time window; that numeric window remains TBD.

### Malicious or tampered release
1. Halt distribution of the artifact; preserve digest, manifest, build provenance and access logs.
2. Revoke the affected release signing identity where appropriate and block future updates using the compromised key.
3. Notify affected customers with verified version/digest and containment steps.
4. Rebuild using a known-good protected builder from reviewed source, independently verify signature and hash, then publish a corrected release.
5. Investigate credential/supply-chain exposure and retain a post-incident review.

### Portal or provider outage
1. Surface degraded/unavailable state and stop new entries if required critical market/risk evidence is unavailable.
2. Continue local reconciliation and enforce local signing limits; do not delegate risk authority to the portal or model.
3. Never treat outage as permission to skip controls, repeat ambiguous transactions or force an exit.

## 6. Recovery and review

Require owner-approved contact/escalation ownership, customer communications, evidence retention, backup restore, credential rotations, incident timeline and after-action report. Simulate key exposure, release tampering, admin compromise, stale-data shutdown and ambiguous transaction recovery during later QA/shadow preparations. Exact on-call commitments and support-hour SLAs are commercial decisions that must be published truthfully.
