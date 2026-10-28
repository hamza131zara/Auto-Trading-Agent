# Phase 2.4 — Installation, Onboarding, Booking and Support

**Status:** Requirements locked; actual calendar URL, availability and commercial session terms remain to be configured.

## Guided setup journey

Every paid, approved licensee must have an Installation & Customer Setup Center and a booking path for a guided setup session. Use real availability from Google Calendar appointment scheduling or an equivalent configured booking tool; Google Meet is the preferred conferencing path.

Show actual available slots, appointment duration and timezone. Confirm the selected slot and send verified meeting details, preparation instructions and rescheduling/cancellation options where configured. Never show a made-up time or placeholder URL as a live booking. The included session count, duration and prices for additional support must be explicit before sale; lifetime software access does not imply unlimited human consulting.

## Required step-by-step guides

1. **Prerequisites:** supported OS/runtime, hardware, network, required accounts and permissions.
2. **Download/verify:** authenticated access, authorized release, checksum/signature and version compatibility.
3. **Install:** platform-specific steps, least-privilege service user, config paths and start/stop.
4. **Activate license:** invitation, account/email verification, MFA, terms and installation binding.
5. **Configure providers:** customer-owned RPC/data/optional LLM keys, connectivity checks and secret-safe storage.
6. **Wallet/signer:** own wallet and constrained signer setup; verify network/address and permissions.
7. **Risk configuration:** review approved limits, reject unset required limits and keep unsupported/live mode disabled.
8. **Health check:** dependencies, data freshness, clock, database, disk, logs and audit persistence.
9. **Paper/replay walkthrough:** candidate decisions, no-trade reasons, order lifecycle, reconciliation and emergency controls without production orders.
10. **Backup/update/rollback:** verified backup, signed updates, health verification and recovery steps.
11. **Restore and incident handling:** backup restoration, unknown transaction state and safe recovery.
12. **Troubleshooting/support:** common errors, sanitized diagnostics, supported versions and escalation.

Each guide uses numbered steps, expected outcome, prerequisites, safe defaults and troubleshooting; screenshots and terminal examples where helpful, with version/date of last review.

## Booking flow

1. Customer opens Book Setup Session from their activated license/dashboard or onboarding email.
2. Real calendar availability is displayed with timezone and duration.
3. Customer chooses a slot, provides only necessary details, and accepts the disclosed session terms.
4. Confirmation includes exact date/time/timezone, Meet details, preparation checklist and rescheduling/cancel information where supported.
5. Reminders are sent only if actually configured and disclosed.
6. After the call, a checklist records software version, health checks, configuration status, paper-test result, unresolved issues and next steps.

A pre-sales consultation is separate from paid onboarding and must not grant an unpaid trial or runtime access.

## Meeting agenda

Confirm environment/version; guide installation and license activation; verify providers without collecting secrets; check signer isolation/risk settings; run paper/replay checks; review audit logs, emergency controls, backup and updates; record unresolved issues.

Never ask for or accept seed phrases/private keys via chat, email, support forms or screen-share. If one is exposed, stop sharing and follow the secret-compromise incident procedure.

## Support limits and acceptance criteria

- Redact secrets from diagnostics; customer reviews a bundle before upload.
- No arbitrary remote commands or wallet custody via support.
- Remote access, if ever offered, needs explicit consent, temporary least-privilege access and audit logging.
- Clearly distinguish defect support, custom installation, strategy tuning, financial advice and managed trading.
- Test that customers cannot book fictitious times, timezone is unambiguous, meeting details are confirmed, and setup coverage includes license/providers/signer/risk/health/paper/recovery.
- Support forms and onboarding must never request private keys or seed phrases.
