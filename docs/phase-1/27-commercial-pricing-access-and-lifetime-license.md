# Commercial Access, Pricing, Quote, Registration and Lifetime License

**Status:** Owner-requested commercial requirement, recorded 28 October 2026.  
**Scope amendment:** Paid, owner-approved license access model. Deployment decision is locked to self-hosted, customer-isolated software; see [D-025](30-self-hosted-deployment-decision.md). The frozen roadmap phase order remains unchanged.

## 1. Commercial model — mandatory rules

- No free tier.
- No customer free trial, trial extension, time-limited operational demo, or complimentary operational account.
- No recurring subscription or monthly/annual renewal for the core license.
- Proposed published standard price: **USD $12,000 one-time lifetime license**. The owner/admin can issue a written, versioned quote with the final price/currency, expiry and included scope. Any discount or different price requires an authorized owner/admin action and an audit record.
- The operational agent, trading controls, private dashboard and customer services remain inaccessible until payment is confirmed, registration is completed, and the owner/admin approves the account.
- Public marketing, pricing, terms and documentation pages may be viewable without payment; these do not include access to the application, live market-analysis service, agent decisions, trading automation or customer dashboard.
- No shared demonstration account or publicly reusable invitation may expose operational features. Product walkthrough videos/screenshots are marketing collateral, not a free trial.
- Do not market the product as guaranteeing trading profits, a win rate or reaching an account-balance target.

## 2. Meaning of “lifetime” — contract must be explicit

Proposed interpretation, to be reflected in the sales contract before accepting payment:
- A one-time fee grants a license to the named customer/entity for the licensed self-hosted software installation(s) defined in the quote, for the lifetime of the software product under published license terms. The vendor's central portal provides licensing/download administration, not hosted trading runtime.
- “Lifetime” means the software product's lifetime under contract, not the natural life of the purchaser and not a promise that a company will exist forever.
- The quote/contract must state what product updates/security fixes, installation assistance, support, number of seats/installations and license limits are included. Customer-side hosting, RPC/data and LLM/API usage are paid by the customer unless expressly included.
- There are no hidden recurring software charges. Any separately priced optional service/add-on must be disclosed in advance and priced as a one-time purchase unless the owner explicitly revises this commercial policy.
- Any included vendor-provided support/update allowance must use transparent limits. Customer infrastructure/provider usage is controlled in the customer's own environment. If optional analysis reaches a limit, the agent may pause optional analysis and notify the operator; it must not skip safety checks. Any paid expansion needs an explicit new one-time quote.
- Trading capital, wallet balances, token losses, swap/DEX fees, Solana network/priority fees, customer tax obligations and bank/payment conversion/transfer fees are not part of the license price. State exactly which platform data/compute services are included in the quote.
- Lifetime economics must be modelled against expected customer lifetime, hosting/data/LLM/support/security costs, payment fees, refunds/chargebacks and infrastructure growth before the price is advertised as final.

## 3. Customer purchase-to-activation sequence

1. **Public pricing page:** show the USD $12,000 proposed one-time self-hosted software license, included/excluded items, risk disclosure, license terms and “Request a quote” action. No free-trial or sign-up-for-access control.
2. **Quote request:** collect minimum necessary business/contact details and requested use case. This is a lead request, not an account and confers no product access.
3. **Owner/admin qualification:** assess service eligibility, customer/jurisdiction restrictions and technical fit. If declined, no payment is requested.
4. **Issue a formal quote/invoice:** unique quote ID, customer/entity, price/currency, issue/expiry dates, product/license scope, payment instructions, taxes/fees, terms version and support/usage inclusions. Quote changes create a new version and audit event.
5. **Customer pays:** use only the approved settlement method listed on the issued invoice. The initial path is admin-issued invoice and verified bank settlement; no payment gateway has been approved for this crypto-trading product yet.
6. **Verify settled funds:** financial staff/admin reconciles the received amount/currency, sender/reference, quote/invoice ID and cleared/settled status. A screenshot, browser redirect or customer claim alone is not proof of payment.
7. **Issue single-use invitation:** only after payment is marked PAID_VERIFIED. Invite is bound to the quoted contact email/entity, expires, is single-use, and cannot grant service access itself.
8. **Customer registration:** customer completes invitation, verifies email, creates credentials, enables required MFA, accepts current terms/privacy/license and completes any required eligibility/customer checks.
9. **Owner/admin approval:** review registration details and eligibility. Approve or reject with a reason code. Payment is not bypassed by admin approval and payment does not bypass admin approval.
10. **Activate entitlement:** active only when all required predicates are true: settled payment; matching active quote/order; invite consumed; email verified; account approved; MFA satisfied; terms accepted; license is active; customer/workspace checks passed.
11. **Issue activation package:** generate the signed, instance-bound license entitlement and access to approved software release artifacts. The customer installs the agent in their own or dedicated infrastructure and configures their own database, provider credentials, wallet and signer boundary. The portal must not provision or host a shared trading runtime and never receives private keys.
12. **Activation receipt:** send an account-activation notification and show access to the paid service. State clearly that purchase does not guarantee trading performance.

## 4. Required access predicate

The central portal must deny registration/licensing downloads and protected account functions unless:

`canReceiveLicense = paymentVerified AND registrationComplete AND adminApproved AND emailVerified AND MFARequiredAndSatisfied AND termsAccepted AND licenseActive AND installationApproved`

This predicate is evaluated server-side for licensing/download/portal actions. The self-hosted runtime separately verifies a signed entitlement locally and enforces trading policy. No trial state exists in the data model.

## 5. Quote, payment and account states

### Quote/order
`DRAFT → ISSUED → ACCEPTED → PAYMENT_PENDING → PAID_VERIFIED → FULFILLMENT_PENDING → FULFILLED`

Other states: `EXPIRED`, `CANCELLED`, `PAYMENT_FAILED`, `DISPUTED`, `REFUND_PENDING`, `REFUNDED`, `CHARGEBACK`.

A quote may be accepted only during its validity window. A late or mismatched payment goes to manual review, not automatic fulfillment.

### Registration/license
`NOT_INVITED → INVITED → REGISTRATION_PENDING → PENDING_ADMIN_APPROVAL → APPROVED → ACTIVE`

Other states: `REJECTED`, `SUSPENDED`, `REVOKED`, `REFUND_PENDING`, `REFUNDED`, `DISPUTED`.

An invite is not an entitlement. A paid-but-unregistered customer has no access. A registered-but-unapproved customer has no access. A rejected account is handled under the refund/contract policy and applicable law.

## 6. Payment verification and refunds
- For manual transfer: require bank/provider settlement confirmation; use two-person approval for high-value payment reconciliation if operationally feasible; record source evidence and reconcile against the bank statement/invoice.
- If a provider is approved later: accept payment events only through authenticated, signature-verified webhooks; verify the event relates to the expected quote, amount, currency, customer and product; use idempotency and handle duplicate/out-of-order events. Never activate solely from a client-side “success” page.
- A delayed, reversed, disputed or chargeback payment revokes or suspends entitlement according to the terms and dispute/legal process, with an audit trail.
- Define refund timing and eligibility before taking money. If the owner/admin rejects a paid registration, process the refund according to the published quote/terms and applicable law; do not silently retain funds without a documented lawful basis.
- Never store raw card numbers or security codes. Use a payment provider's hosted checkout only if the provider has explicitly approved this product and seller jurisdiction.
- A payment callback or admin click must not change trading risk limits, authorize a wallet, or start live trading.

## 7. Owner/admin controls

Admin-only actions:
- Review quote requests and issue/expire/cancel quotes.
- Verify/reconcile payment, with evidence and reason.
- Resend/revoke invitation; never extend it silently.
- Approve/reject registration with reason and appropriate eligibility review.
- Suspend/revoke a license, workspace or account; initiate refund/dispute workflow where applicable.
- View audit and entitlement history; export a payment/license record.
- Change published one-time price or included fair-use limits through versioned approval.

Every action records admin identity, timestamp, old/new status, quote/customer/license ID and reason. Require re-authentication/MFA for refunds, admin approval, entitlement overrides, price changes and license revocation. No hidden manual override should create unpaid access.

## 8. Multi-customer isolation requirement

Multiple customers receive separately licensed installations. Their runtime data, risk settings, decision history, portfolio, API credentials and signer policy remain isolated because each runs in their own environment; central portal customer/quote/payment/license records are access-controlled and scoped to the customer.

**Locked architecture:** self-hosted, customer-isolated software. Each running agent instance has one independent portfolio and wallet/signer boundary and may hold at most one open or unresolved position at a time. There is no shared platform-level position state, central trading worker or pooled customer funds. See [D-025](30-self-hosted-deployment-decision.md).

The customer controls their wallet and approved signer configuration in their own environment. Exact local signer/KMS/HSM design remains a security review item. The central licensing portal must never receive seeds/private keys or unrestricted signing authority.

## 9. Acceptance criteria
- No account can register directly without a valid post-payment invitation.
- No user, admin error or API route can access the agent without all access predicates.
- No free/trial entitlement exists in schema, seed data, UI or API.
- Duplicate/out-of-order payment webhooks cannot double-fulfil an order or double-create a license.
- Wrong amount/currency/quote/customer, pending payment, expired quote, reversed payment and unverified manual transfer never activate access.
- Registration approval without verified payment fails; payment without admin approval fails.
- A rejected registration follows the explicit refund/legal policy.
- Separate installations cannot access one another's runtime data or wallets; the portal prevents cross-customer quote/license/registration record access.
- Owner/admin entitlement changes and all payment/license lifecycle events are auditable.
- The license contract states service lifetime, included updates/support/data/usage, limits, fees excluded, refund/dispute terms and no-return guarantee language carefully reviewed by counsel.


## 10. Locked self-hosted deployment addendum

The owner has selected **self-hosted, customer-isolated deployment** for V1. The central portal is a commercial licensing/registration layer only; it does not host customers' trading processes or portfolios.

- The customer installs and operates the agent in their own or customer-dedicated environment.
- Each installation uses customer-specific storage, RPC/market-data/LLM credentials, trading wallet, signer configuration, risk policy, trade ledger and audit records.
- The approved one-position rule is enforced per running agent instance/portfolio.
- The portal issues a signed, instance-bound lifetime license after verified payment, completed registration, required MFA/terms and admin approval.
- License verification must not expose secrets or permit a portal outage to weaken risk controls or blindly force-sell a position.
- The exact signed-license token, instance binding, offline/online verification cadence, safe grace behavior, license transfer/reinstall policy and signed update mechanism are Phase 2 design decisions. Do not introduce an undocumented remote kill switch.
- Hosting, provider APIs, LLM usage, network/DEX fees and trading capital are customer-paid unless explicitly itemized as included in the one-time quote.
- No hosted multi-tenant trading SaaS is in V1 scope. Any future hosted version requires a separate, owner-approved change request.

See [D-025 — Self-Hosted Deployment Decision](30-self-hosted-deployment-decision.md).