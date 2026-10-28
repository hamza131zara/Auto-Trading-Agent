# Commercial Scope Amendment CR-001 — Paid Customer Access

**Request date:** 28 October 2026  
**Status:** Owner-requested commercial requirements recorded; **deployment decision locked** by owner on 28 October 2026.  
**Deployment choice:** Self-hosted, customer-isolated licensed software (no hosted multi-customer trading SaaS for V1).  
**Decision record:** [D-025 — Self-Hosted Deployment](30-self-hosted-deployment-decision.md).

## 1. Owner-requested commercial requirements
- The product is not free for customers.
- No free tier, free trial, trial extension or unpaid operational access.
- One-time lifetime software license only; no recurring core subscription.
- Proposed standard price: **USD $12,000 one-time**.
- Owner/admin issues a formal quote/invoice. Payment must be verified before a single-use registration invitation is issued.
- The customer completes registration, verifies email, enables required MFA and accepts current license/terms/privacy notices.
- Owner/admin approval is mandatory before license activation and any protected access.
- Purchase alone does not activate a license; registration alone does not activate a license.
- No profit, win-rate or target-attainment guarantee.

## 2. Locked deployment decision

V1 will be **self-hosted, customer-isolated licensed software**, with optional separately quoted managed installation/support. It will not launch as hosted multi-tenant trading SaaS.

Each customer runs an independent instance in their own or customer-dedicated infrastructure. Each instance has its own configuration, database, provider credentials, wallet/signer boundary, trading ledger, risk policy, audit history and position state.

A central licensing portal manages quote requests, invoices/payment reconciliation, registration invitations, owner/admin approval, signed license issuance, authorized software downloads/updates and support/licensing administration. It is not the trading runtime and must never receive wallet seed phrases, private keys or arbitrary signing authority.

## 3. Position limit scope

The frozen single-operator rule of one open position is applied **per running agent instance/portfolio**. Each self-hosted customer's instance independently permits at most one open or unresolved position at a time. There is no shared platform-level position lock, shared trade ledger or pooled customer funds. The next candidate cannot be entered until the active position in that customer's instance is fully reconciled and closed.

## 4. Quote and license scope

1. The public product/pricing page shows the proposed $12,000 one-time lifetime license, clear inclusions/exclusions, risk disclosure, license terms and “Request a quote”. There is no trial or free operational demo.
2. Quote request is a lead request only; it does not create a service entitlement.
3. Owner/admin checks eligibility and issues a versioned quote/invoice with customer/entity, amount/currency, issue/expiry dates, license scope, supported installation count, support/update scope, usage/fair-use terms, exclusions, payment instructions, taxes/fees and refund/dispute terms.
4. Payment is verified as cleared settlement before the portal sends a single-use registration invitation.
5. Customer completes registration, email verification, MFA and terms acceptance.
6. Owner/admin approves/rejects the registration.
7. A signed, instance-bound lifetime license is issued only after all required conditions pass.
8. The customer downloads and installs the software in their environment and activates the license.
9. The runtime verifies the signed entitlement under a documented online/offline validation policy. It must not let a licensing portal outage weaken trading risk gates or blindly force-sell a position.
10. Reinstallation, transfer or additional installation requires an audited owner/admin workflow and must follow the issued license terms.

## 5. Customer isolation and wallet boundary

- Each customer's runtime, configuration, data, ledger, logs, API credentials, risk settings, wallet and signer policy are independent.
- No shared trading wallet, pooled funds, central multi-customer trading worker or platform-level position state.
- Customer supplies/configures their own infrastructure and provider/API credentials unless an issued quote explicitly includes a separately approved managed component.
- The customer controls their trading wallet and signing configuration. Never upload private key/seed phrase to the central licensing portal.
- The license portal should store only necessary commercial/account/entitlement metadata and audit events.
- Telemetry/diagnostics must be opt-in or contractually disclosed, minimized and scrubbed of secrets. Support exports must not contain private keys or seed phrases.
- Software updates must be signed/versioned, verified by the installer/runtime, and provide migration and rollback instructions. No arbitrary remote code/config push may alter risk limits.

## 6. Payment path and provider eligibility

Initial proposed collection path: owner/admin-issued invoice and manually verified cleared bank settlement. **No online payment provider is approved** for this product/seller jurisdiction. Do not enable Stripe, Paddle, Lemon Squeezy or another processor unless it confirms seller-country and exact product-category eligibility in writing. Do not misdescribe the product to bypass policy.

For manual transfer, match settled amount/currency/reference/customer/quote and trusted bank evidence. A customer-provided screenshot or browser redirect is not proof. Refund/rejection/dispute/chargeback handling must be defined in the signed terms and comply with applicable law. See [28 Payment Provider Eligibility Assessment](28-payment-provider-eligibility-assessment.md).

## 7. “Lifetime” definition and customer expectations

“Lifetime” must be defined contractually as the lifetime of the licensed software product/service under the specified terms—not the natural life of the purchaser and not a promise that a company will exist forever. The quote/contract must state:
- whether updates and security fixes are included and under what support window;
- whether installation help and ongoing support are included;
- required customer-paid hosting, RPC/data, LLM and network costs;
- what version access and license reactivation/replacement are covered;
- per-license/installation scope and fair-use limits;
- refund, dispute, termination and transfer rules;
- that trading capital, realized trading loss, DEX/network fees and customer taxes are excluded unless explicitly included.

No hidden recurring software fee. Any optional separately priced service must be disclosed and separately accepted; the core license remains one-time under this decision. Lifetime economics must be modelled before public price launch.

## 8. External release gates

Before public sales:
- qualified legal/tax review for the exact product/service model, jurisdictions and wallet/signing-control boundaries;
- written confirmation from the bank/payment institution that the settlement method supports this seller, transaction type and business activity;
- final license, privacy, refund/dispute, support/update and fair-use terms;
- cost model for lifetime support, security updates, customer support, provider/LLM costs if included, fraud and refunds;
- payment/registration/approval/licensing and license-integrity tests;
- supply-chain/update signing and license server security review.

Before live trading:
- all separate backtest, out-of-sample, signer/threat-model review, paper/shadow, canary and release approval gates in the frozen roadmap must pass. A paid license does not bypass trading safety gates.

## 9. Change control and references

This decision adds a commercial model but does not change the canonical Roadmap v1.0 Phase 0–17 order.
- [D-025 — Self-Hosted Deployment Decision](30-self-hosted-deployment-decision.md)
- [Commercial pricing/access/lifetime license](27-commercial-pricing-access-and-lifetime-license.md)
- [Payment provider eligibility assessment](28-payment-provider-eligibility-assessment.md)
- [Cost and operations plan](21-cost-and-operations-plan.md)
- [Legal/tax/service-boundary review](22-legal-tax-and-service-boundary-review.md)

The self-hosted deployment decision is locked for V1 unless the owner explicitly approves a dated change request.