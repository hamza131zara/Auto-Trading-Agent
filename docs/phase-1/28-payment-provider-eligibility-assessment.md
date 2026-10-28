# Payment Provider Eligibility Assessment — One-Time Lifetime License

**Review date:** 28 October 2026  
**Product:** self-hosted, customer-isolated Solana DEX auto-trading software; proposed USD $12,000 one-time lifetime license.  
**Conclusion:** no online payment processor is approved yet. Use an owner-issued invoice and a compliant, bank/provider-approved settlement path for initial sales only after bank/legal approval; provider automation can be added only after written underwriting approval.

## Why normal SaaS checkout cannot be selected by default

The product is self-hosted software whose advertised primary purpose includes automated cryptocurrency trading and transaction preparation. A processor may classify it as crypto-trading software, a financial service or a product enabling cryptocurrency transactions even though the trading runtime is run by the customer. Do not misdescribe the product to obtain processing approval.

### Stripe
Official sources:
- Global supported-country list: https://stripe.com/global
- Restricted business list: https://stripe.com/legal/restricted-businesses
- Restricted-business FAQ: https://support.stripe.com/questions/prohibited-and-restricted-business-list-faqs
- Checkout fulfillment/webhook guidance: https://docs.stripe.com/payments/existing-customers?platform=web&ui=stripe-hosted

The public global list reviewed on 28 October 2026 does not list Pakistan as a Stripe Payments supported country. Stripe says accounts opened in a different country require a legal entity, tax ID, physical location, phone, government ID, and physical bank account in that country. Stripe also lists cryptocurrency exchanges/wallets and other financial services as restricted/limited-availability categories requiring contact/prior review. These facts mean Stripe is not selected for the current Pakistan-based seller/product without both eligible merchant-country setup and explicit product underwriting. Do not use another person's account or misrepresent the country/product.

### Paddle
Official source: https://www.paddle.com/help/start/intro-to-paddle/what-am-i-not-allowed-to-sell-on-paddle

Paddle's published AUP prohibits exchanges/dealers/trading platforms that enable transactions in cryptocurrencies and investment/financial advice including trading signals/strategies. Our automated DEX agent appears close to the named restricted categories. Do not select Paddle unless Paddle provides explicit written confirmation that the exact product/service model is acceptable.

### Lemon Squeezy
Official sources:
- Prohibited Products: https://docs.lemonsqueezy.com/help/getting-started/prohibited-products
- Supported countries: https://docs.lemonsqueezy.com/help/getting-started/supported-countries

Lemon Squeezy's prohibited-product page explicitly lists NFT and crypto-related products as prohibited. Even though its supported-countries list includes Pakistan, country support does not override the product-category prohibition. Do not use for this product unless its written policy changes and it explicitly approves the exact use.

## Initial commercial collection path

- Issue a formal quote/invoice manually.
- Use a business bank/payment institution that explicitly confirms it may receive the stated international software/service proceeds from the intended countries and business activity.
- Reconcile settled funds against the invoice using a bank/provider statement or trusted settlement event.
- Only then issue the registration invitation.
- This is a proposed manual workflow, not confirmation that any particular bank account or payment rail is eligible. The owner's bank and qualified counsel must confirm payment classification, foreign-currency/export documentation, taxes, fee treatment and any applicable licensing obligations before sales commence.

## Requirements before automated checkout is reconsidered
1. Seller country/entity/bank eligibility confirmed.
2. Product description and operation model disclosed accurately to prospective processor.
3. Written provider approval specifically covers self-hosted Solana DEX auto-trading software, one-time lifetime license, customer registration/admin approval and the countries served.
4. Confirm supported one-time invoice/checkout, high ticket amount, card/bank payment methods, settlement currency, chargeback/dispute handling, payout timing and reserves.
5. Confirm fees, taxes/merchant-of-record scope, refund requirements, customer verification, sanctions/AML obligations and prohibited territories.
6. Test webhook signature verification, replay/idempotency, duplicate/out-of-order events, amount/currency mismatch, refunds and chargebacks in sandbox.
7. Store provider secrets only in a secret manager; no secrets in source control/client bundle.
8. Record approval ID/date, contract/terms version, rate limits/fees and permitted product description in this document and the decision log.

## Integration architecture recommendation

Build a provider-neutral payment interface in a later implementation phase. The domain logic handles Quote, Payment, Invoice, SettlementProof, Invitation, Registration, Approval, Entitlement, Refund and Dispute separately from any provider SDK.

A provider adapter may be enabled only after it passes product eligibility, seller-country and legal gates. Do not implement a real checkout using Stripe, Paddle or Lemon Squeezy as the default. Until an approved online provider exists, the only supported path is manual invoice plus manually reconciled cleared bank settlement.

## Access-control rule

Payment confirmed + registration complete + email verified + admin approved + MFA satisfied + current terms accepted + entitlement active + tenant enabled are all required. No payment success return URL can grant access. No free trial, free tier or unpaid operational access is permitted.

## Sources consulted
- Stripe global availability and restricted business policy.
- Paddle acceptable use policy.
- Lemon Squeezy prohibited products and supported countries.
- Stripe's documented recommendation to trigger fulfillment from server-side webhook events rather than a browser redirect.


## Deployment-model update (D-025)
The owner has locked V1 to self-hosted, customer-isolated software; the central portal handles licensing/registration only and does not host the trading runtime. Reassess the exact product description with each prospective payment institution using this self-hosted model. The restrictions above remain relevant; self-hosting does not guarantee processor eligibility.