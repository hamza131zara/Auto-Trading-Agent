# Phase 2.3 — Customer Portal, License Lifecycle and Self-Hosted Runtime

**Baseline:** D-025 / CR-001. **Status:** Requirements only; implementation is not authorized here.

## Separate surfaces

### Central commercial portal
Public product information, quote/consultation requests, invoices/payment status, registration/security checks, owner/admin approval, signed license issuance, authorized downloads/releases, setup documentation, booking and bounded support.

The portal is not the trading runtime. It never holds customer seed phrases/private keys, signs transactions or shares portfolio state across customers.

### Customer-isolated runtime
Each customer operates an independent installation with its own database/audit trail, provider credentials, wallet/signer, risk and strategy configuration, trade ledger and position state. A company-operated instance is separate from all customer instances. The runtime must preserve deterministic local risk controls if the central portal is unavailable.

## Portal navigation requirements

- Public site: capabilities, limitations, self-hosting prerequisites, security, quote request and optional pre-sales consultation.
- Quote/invoice: version, agreed scope, currency, line items, taxes/fees, due date, terms and status.
- Payment review: pending, verifying, settled, rejected, refunded or disputed. Customer proof is not authoritative proof of settlement.
- Registration: one-time invite, email verification, MFA, terms acceptance and owner/admin approval.
- License: license/installation identity, entitlement version, supported features, release channel, issuance, transfer/reinstallation requests and status.
- Downloads/updates: authenticated notes, signed artifacts, checksums, supported platforms, backup/upgrade/rollback instructions.
- Setup center, booking and support: ordered instructions, real calendar availability, confirmed meeting details, issue status and sanitized diagnostics.

## Admin audit controls

Record actor, timestamp, target, reason, correlation ID and before/after status for quote/invoice changes, settlement confirmation/reversal, invite, MFA/security reset, approval, license issue/suspend/replace, release publication, customer-data access and support artifact access. Require least privilege and MFA for privileged roles. Payment verification and license issuance must be separate auditable actions.

## Payment constraints

- Initial candidate is an owner/admin invoice followed by independently verified cleared bank settlement, subject to written bank/payment and legal/tax confirmation.
- Card/checkout processors remain disabled until explicit approval of the exact seller/product/service model.
- Crypto receipt remains disabled until legal, tax, bank, custody/settlement and provider eligibility are confirmed in writing. If later approved, define supported asset/network, quote expiry, confirmations, under/overpayment, wrong-network recovery and reconciliation.
- Never activate a license from a screenshot, unverified webhook, explorer URL or customer claim alone. Do not misdescribe the product to bypass provider restrictions.

## License/update constraints

The signed entitlement format, installation binding, local validation, offline/grace policy, revocation grounds, transfer/reinstall and update signing must be resolved in the relevant security/design phases before implementation. License management must not become an undocumented remote kill switch that forces a sell. Runtime must not execute arbitrary portal-delivered code.

## Runtime dashboard requirements

Show runtime/dependency health; current operating mode; data freshness; candidate security evidence/rejections; decision trail; position/order/unknown-state and reconciliation; exposure/risk limits/circuit breakers; actual/provisional PnL and cost state; audit events; backup/update/diagnostics; license state. Live controls cannot appear enabled until backend-enforced security, quantitative and release gates are met.

No pooled customer funds, shared trade worker, shared portfolio database or global position lock.
