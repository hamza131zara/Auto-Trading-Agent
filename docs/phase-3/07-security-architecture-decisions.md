# Phase 3.7 — Security Architecture Decisions and Open Questions

**Status:** Carry-forward decision register after Phase 3 design handoff. Nothing marked “proposed” is an approved production control until the owner explicitly accepts it and a verification plan is assigned.

## Decision-status meaning

- **Locked baseline:** already established in owner-approved scope; changes require a dated change request.
- **Proposed:** recommended for review; not yet a production implementation instruction.
- **Open:** needs a decision, evidence or a supported provider/platform choice.
- **Blocked:** a dependent high-risk feature must remain disabled until resolved.

## Locked baseline constraints

| ID | Decision | Status |
|---|---|---|
| D-025 | Self-hosted customer-isolated software; central portal is not a hosted multi-tenant trading runtime and does not control customer wallet keys. | Locked |
| D-030 | Selective 3D/isometric visuals are approved for appropriate UI sections; keep trading evidence, charts, risk controls and operational state accurate, legible and undistorted. | Owner-locked for Phase 4 design |
| SEC-BL-001 | AI/LLM is advisory and never receives signer secrets or arbitrary signing authority. Deterministic risk/security policy has final veto. | Locked project invariant |
| SEC-BL-002 | Unknown transaction state blocks new entry until reconciled; no new position while an open/unresolved position exists in that instance. | Locked project invariant |
| SEC-BL-003 | No live/mainnet trading during this security design phase. | Locked gate |

## Open architecture decisions

| ID | Question / decision | Current recommendation | Status and dependent gate |
|---|---|---|---|
| SEC-DEC-001 | Production key custody/signing backend | Evaluate customer-managed hardware-backed KMS/HSM or compatible policy-enforcing signer, plus an isolated local signer option. Compare Solana compatibility, unattended signing, recovery, audit and customer control. Do not select based only on convenience. | OPEN; live signing blocked |
| SEC-DEC-002 | Process and host isolation | Separate signer process/service account with authenticated local transport; decide whether customer target needs container, VM, OS sandbox, dedicated host or multiple layers. | OPEN; production deployment package blocked |
| SEC-DEC-003 | Supported DEX program/instruction allowlist | Maintain a reviewed, versioned registry of exact program identifiers and decoded instruction variants; deny unknown instructions and arbitrary transfers/approvals by default. | OPEN; execution adapter/signing blocked |
| SEC-DEC-004 | Execution-affecting numeric policy | Enumerate required position, fee, slippage, impact, exposure, drawdown, data-age and exitability limits. Every live-capable limit must have an owner-approved value, unit, rationale and test. | BLOCKED until owner-approved |
| SEC-DEC-005 | License entitlement and offline/grace behavior | Signed instance-bound entitlement validated locally. Design grace/status caching without a remote forced-sell or unsafe loss of local risk control. | OPEN; licensing implementation blocked |
| SEC-DEC-006 | Release-signing key custody and approval | Separate release-signing key from license-signing and customer wallet keys; use protected signing, immutable artifact digests, review and release audit. | OPEN; update publishing blocked |
| SEC-DEC-007 | License-signing key custody and recovery | Separate key and role boundary; define rotation, compromise, backup and customer-verification flow. | OPEN; license issuance blocked |
| SEC-DEC-008 | Authentication, MFA and identity provider | Select supported identity implementation; require strong MFA for vendor admins and reauthentication for high-impact actions; server-side authorization always. | OPEN; portal production deployment blocked |
| SEC-DEC-009 | Payment verification / separation of duties | Define how bank settlement is independently confirmed and how verification is separated/audited from invite and license issuance. | OPEN; commercial activation blocked |
| SEC-DEC-010 | Customer telemetry and diagnostics | Default to local processing and no undisclosed telemetry. Any sharing must be minimized, explicit, revocable and sanitized. Define retention with privacy/legal review. | OPEN; telemetry export disabled until defined |
| SEC-DEC-011 | Egress and provider destination controls | Inventory remote destinations and enforce approved outbound routes; validate redirects/DNS and deny unneeded loopback/private/link-local destinations for user-configurable fetches. | OPEN; exposed arbitrary-URL features blocked |
| SEC-DEC-012 | Audit retention and tamper evidence | Define minimum events, integrity controls, retention and export with customer, cost and legal needs; never log credentials or signing secrets. | OPEN |
| SEC-DEC-013 | Incident escalation and support coverage | Name incident owner/backup, contact channels, customer notices and response expectations; make no SLA claims until resourcing exists. | OPEN; public support claims blocked |
| SEC-DEC-014 | Backup, restore and license transfer | Define encrypted backup, restore authorization, signer rebinding, license replacement and incident-time recovery without duplicate unrestricted keys. | OPEN |
| SEC-DEC-015 | RPC/quote source disagreement policy | Define what sources/independent checks are required by signal, data-age bounds, disagreement behavior and fail-closed rules. | OPEN; numerical/source-dependent entry blocked |

## Required decision record format

Each resolved decision must include:
- ID and exact choice.
- Alternatives considered and trade-offs.
- Threats/requirements affected.
- Customer control, privacy and operational implications.
- Account/provider/SDK facts verified, with date and links.
- Owner approval and date.
- Acceptance tests and expected evidence.
- Rollback/recovery approach and residual risk.
- Whether implementation or release is still blocked pending external/legal review.

## Phase 3 review rule

Do not mark a proposed architecture choice as approved simply because this document recommends it. The owner and reviewer must resolve the necessary choices before Phase 3 exit. High-risk open decisions block the dependent capability but do not require unrelated low-risk documentation work to stop. Phase 3 is closed for documentation/design handoff by owner direction; this does not resolve open decisions. Phase 3 completion itself is not authorization to trade live.
