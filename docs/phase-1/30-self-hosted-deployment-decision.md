# Deployment Decision D-025 — Self-Hosted, Customer-Isolated License

**Decision date:** 28 October 2026  
**Status:** LOCKED for Phase 2 design baseline by explicit owner instruction.  
**Applies to:** CR-001 paid commercial model and subsequent architecture/design work.  
**Frozen source roadmap:** Roadmap v1.0 phase order remains unchanged.

## 1. Decision

V1 will be **self-hosted, customer-isolated licensed software**, with optional separately quoted managed installation/support. It will not launch as a hosted multi-customer trading SaaS.

Each customer runs their own dedicated instance in infrastructure they control or explicitly provision for that customer. Each instance has its own configuration, data store, provider credentials, wallet/signer boundary, trading ledger, risk policy, audit history and one-position state.

A central commercial portal will handle quote requests, invoices/payment reconciliation, registration invitations, identity/email/MFA, owner/admin approval, lifetime license activation, authorized downloads/updates and support/licensing administration. The central portal is not the customer's trading runtime and must not have access to private keys, seed phrases or arbitrary transaction-signing authority.

## 2. Commercial model retained

- No free tier or free trial.
- Proposed standard price: USD $12,000 one-time lifetime software license.
- No recurring core subscription.
- Quote/invoice is issued by owner/admin; payment is verified before a single-use registration invitation is issued.
- Customer completes registration, email verification, required MFA and terms acceptance; owner/admin approval is mandatory.
- The central portal issues an instance-bound license after every required predicate passes.
- No operational agent access is granted to an unpaid or unapproved customer.
- Installation, hosting, APIs/data plans, LLM consumption, support and update entitlements must be explicitly stated in the quote. Customer-controlled infrastructure/provider accounts are excluded from the base price unless the quote expressly says otherwise.
- The final definition of lifetime, update/support scope, license transfer/replacement rules, fair-use limits and refund terms requires written license terms and qualified review before sales.

## 3. Customer runtime and control boundaries

- Customer controls the host/cloud account and chooses the approved deployment target, subject to documented prerequisites.
- Customer supplies/configures their own RPC, market-data and optional LLM credentials, unless a quote specifically includes an authorized managed service.
- Customer controls their trading wallet and approved signer configuration. The agent never requires the customer to upload a seed phrase to the licensing portal.
- The licensing portal stores commercial records and license metadata only; it does not store trade secrets or signing keys.
- No pooled funds, shared trading wallet, shared position state or centrally hosted cross-customer trading process.
- Default position invariant: no more than one open or unresolved position per individual running agent/portfolio. Each licensed customer's installation is independent.
- No global platform-level one-position lock across all customers.
- The runtime must continue to enforce deterministic security/risk rules if the central licensing portal is temporarily unavailable. License checks must use a signed, instance-bound entitlement and a documented safe validation/grace policy; do not introduce an undocumented remote kill switch capable of manipulating a live position.

## 4. License activation and validation

Proposed activation flow:
1. Customer quote request → owner/admin qualification → versioned quote/invoice.
2. Verified cleared settlement → one-time registration invitation.
3. Customer registration, email verification, MFA and terms acceptance.
4. Owner/admin approval.
5. Portal issues a signed license entitlement bound to the customer/license ID and approved installation identity.
6. Customer installs the package in their own environment and activates it using the entitlement.
7. Runtime verifies the entitlement signature, scope, version/feature flags and expiry/status policy locally; it never receives private keys through the portal.
8. License transfer/reinstallation/replacement goes through an audited owner/admin workflow, never a public bypass.
9. Authorized software updates are distributed through authenticated release artifacts with checksums/signatures; runtime does not execute arbitrary remote code from the portal.

The signed entitlement format, instance binding, offline verification, periodic validation interval, grace behavior, privacy/telemetry stance and revocation consequences remain design items. Because the license is a lifetime one-time purchase, revocation must be limited to defined contractual/security/fraud grounds and must not blindly force-sell a customer's position.

## 5. Security and commercial implications

- Self-hosting reduces central operational custody and cross-tenant runtime risk, but does not remove software-supply-chain, customer-server, license-server, or local key-management risks.
- The central portal still needs strict admin controls, payment/invitation integrity, MFA, audit history and protection against license forgery/replay.
- A signed license must not contain secrets. The customer runtime must never accept arbitrary remote configuration that can loosen hard risk limits or create signing permissions.
- Updates must be versioned and signed, with rollback instructions and an owner-controlled release record.
- Document a clear support boundary: what the vendor can see remotely, what logs the customer may choose to share, and how secrets/addresses are redacted.
- Legal/tax/payment/bank eligibility review remains required before public sales; no payment processor is approved yet.

## 6. Scope exclusions for V1

- No hosted SaaS trading runtime.
- No central multi-tenant trading worker, customer-hosted positions in a shared database, or platform-controlled customer funds.
- No pooled/custodial wallets or platform-level transaction-signing key.
- No free trial, free operational tier or unpaid override.
- No recurring core software subscription.
- No automatic arbitrary code/configuration push that changes risk rules without a signed, owner-approved version and customer-controlled update process.

## 7. Design handoff requirements

Phase 2 must design:
- public marketing/pricing/quote-request pages;
- central owner/admin quote, settlement, invitation, registration-review and license-management portal;
- secure download/update entitlement and license activation flow;
- customer installation/onboarding guide and health/support diagnostic exports;
- instance-specific wallet/signer, provider/API credentials, database, logs and risk policy;
- license validation that does not compromise trading safety during portal outages;
- signed update artifacts, version compatibility, migrations and rollback;
- documentation of the one-position-per-instance invariant;
- self-hosted threat model, supported OS/container/deployment targets and upgrade/recovery process.

## 8. Change control

This decision replaces the previously proposed hosted multi-tenant default in CR-001. It does not change the frozen Roadmap v1.0 Phase 0–17 order, Solana-only scope, risk invariants, no-free-trial requirement, proposed one-time price or mandatory payment-before-registration and owner/admin-approval flow.

Reopening this decision requires explicit owner approval and a dated change request explaining commercial, security, licensing, support, legal and operational consequences.