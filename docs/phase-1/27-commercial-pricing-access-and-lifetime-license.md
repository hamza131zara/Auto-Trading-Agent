# Commercial Access, Pricing, Quote, Registration and Lifetime License

**Status:** Owner-requested commercial requirement, recorded 28 October 2026.  
**Scope amendment:** Extends the original private single-operator product concept into a paid, owner-approved customer access model. The frozen roadmap phase order remains unchanged. See the scope amendment record and remaining tenancy decision before UX design.

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
- A one-time fee grants a license to the named customer/entity's single licensed workspace for the lifetime of the commercial product/service, while the service is operated and provided under the published license terms.
- “Lifetime” means product/service lifetime, not the natural life of the purchaser and not a promise that a company or hosted service will operate forever.
- The quote/contract must state what product updates, support, hosting, data/API allowances, number of seats, number of workspaces and usage limits are included.
- There are no hidden recurring software charges. Any separately priced optional service/add-on must be disclosed in advance and priced as a one-time purchase unless the owner explicitly revises this commercial policy.
- The included service allowance must use transparent fair-use/service limits. If a limit is reached, the system may rate-limit/pause optional analysis and notify the owner/customer; it must not silently bypass security checks. Any paid expansion needs an explicit new one-time quote.
- Trading capital, wallet balances, token losses, swap/DEX fees, Solana network/priority fees, customer tax obligations and bank/payment conversion/transfer fees are not part of the license price. State exactly which platform data/compute services are included in the quote.
- Lifetime economics must be modelled against expected customer lifetime, hosting/data/LLM/support/security costs, payment fees, refunds/chargebacks and infrastructure growth before the price is advertised as final.

## 3. Customer purchase-to-activation sequence

1. **Public pricing page:** show the USD $12,000 proposed one-time license, included/excluded items, risk disclosure, license terms and “Request a quote” action. No free-trial or sign-up-for-access control.
2. **Quote request:** collect minimum necessary business/contact details and requested use case. This is a lead request, not an account and confers no product access.
3. **Owner/admin qualification:** assess service eligibility, customer/jurisdiction restrictions and technical fit. If declined, no payment is requested.
4. **Issue a formal quote/invoice:** unique quote ID, customer/entity, price/currency, issue/expiry dates, product/license scope, payment instructions, taxes/fees, terms version and support/usage inclusions. Quote changes create a new version and audit event.
5. **Customer pays:** use only the approved settlement method listed on the issued invoice. The initial path is admin-issued invoice and verified bank settlement; no payment gateway has been approved for this crypto-trading product yet.
6. **Verify settled funds:** financial staff/admin reconciles the received amount/currency, sender/reference, quote/invoice ID and cleared/settled status. A screenshot, browser redirect or customer claim alone is not proof of payment.
7. **Issue single-use invitation:** only after payment is marked PAID_VERIFIED. Invite is bound to the quoted contact email/entity, expires, is single-use, and cannot grant service access itself.
8. **Customer registration:** customer completes invitation, verifies email, creates credentials, enables required MFA, accepts current terms/privacy/license and completes any required eligibility/customer checks.
9. **Owner/admin approval:** review registration details and eligibility. Approve or reject with a reason code. Payment is not bypassed by admin approval and payment does not bypass admin approval.
10. **Activate entitlement:** active only when all required predicates are true: settled payment; matching active quote/order; invite consumed; email verified; account approved; MFA satisfied; terms accepted; license is active; customer/workspace checks passed.
11. **Provision isolated workspace:** create customer tenant, audit namespace, risk policy, market-data configuration, wallet/signer boundary and notifications. Never reuse a global admin/trading wallet for all customers.
12. **Activation receipt:** send an account-activation notification and show access to the paid service. State clearly that purchase does not guarantee trading performance.

## 4. Required access predicate

The server must deny access unless:

`canUseAgent = paymentVerified AND registrationComplete AND adminApproved AND emailVerified AND MFARequiredAndSatisfied AND termsAccepted AND licenseActive AND tenantEnabled`

This predicate is evaluated server-side for every protected API/job/stream, not just on the UI. No trial state exists in the data model.

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

The commercial request implies multiple customer workspaces. Every customer's identity, quote, payment, license, data, risk settings, decision history, portfolio, API credentials and signer policy must be tenant-scoped. Server/database authorization must enforce tenant isolation.

**Proposed architecture default:** one open or unresolved position per customer workspace, not one shared position across the entire paid platform. Each tenant has an independent portfolio and wallet/signer boundary. This is necessary for customers not to share a position or money, but it is a material change from the original single-operator/global-position assumption and must be explicitly confirmed before design approval. Never pool customer funds.

Whether the hosted product's unattended signer is customer-controlled, managed by a separately isolated customer-specific signer, or uses another approved architecture is still a security/legal decision. Never centralize all customers' private keys in the general agent process.

## 9. Acceptance criteria
- No account can register directly without a valid post-payment invitation.
- No user, admin error or API route can access the agent without all access predicates.
- No free/trial entitlement exists in schema, seed data, UI or API.
- Duplicate/out-of-order payment webhooks cannot double-fulfil an order or double-create a license.
- Wrong amount/currency/quote/customer, pending payment, expired quote, reversed payment and unverified manual transfer never activate access.
- Registration approval without verified payment fails; payment without admin approval fails.
- A rejected registration follows the explicit refund/legal policy.
- Cross-tenant reads/writes/jobs/wallet/strategy history are denied and tested.
- Owner/admin entitlement changes and all payment/license lifecycle events are auditable.
- The license contract states service lifetime, included updates/support/data/usage, limits, fees excluded, refund/dispute terms and no-return guarantee language carefully reviewed by counsel.
