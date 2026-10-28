# Commercial Scope Amendment CR-001 — Paid Customer Access

**Request date:** 28 October 2026  
**Requested by:** Product owner in conversation.  
**Status:** Commercial requirement accepted as a documentation amendment; specific tenancy/position-cap and signer decisions are proposed and must be approved before design.

## Owner-requested requirements
- The product is not free for customers.
- No free tier or free trial.
- One-time lifetime license only; no recurring core subscription.
- Proposed public standard price USD $12,000.
- Customer first requests/receives an owner/admin-issued quote, pays the issued invoice, and only after settlement verification receives registration invitation.
- The customer completes registration; owner/admin must approve it before agent access.
- Paid purchase alone does not activate service; registration approval alone does not activate service.
- The service, agent and protected dashboard remain unavailable until all entitlement/access conditions are met.

See:
- [Commercial pricing, access and lifetime license](27-commercial-pricing-access-and-lifetime-license.md)
- [Payment provider eligibility assessment](28-payment-provider-eligibility-assessment.md)

## Impact on original frozen roadmap

The canonical Roadmap v1.0 phase order remains frozen. This amendment adds a commercial access model and does not delete or reorder the original 0–17 phases.

However, the original product charter described a private single-operator V1 and the original one-position invariant was global. Selling hosted access to multiple customer entities changes identity, authorization, database tenancy, billing, admin operations, wallet/signing boundaries, product liability and unit economics. Treating the product as merely a public pricing page would understate this change.

## Proposed design defaults to resolve before Phase 2

1. **Deployment model:** hosted multi-tenant SaaS with physically/logically isolated tenant workspaces, not a public shared trading wallet.
2. **Position cap:** one open or unresolved position per customer workspace/portfolio, not one shared platform-wide position.
3. **Wallet/signing:** customer-specific wallet and isolated signer boundary, with key-management/custody/control classification reviewed by security and legal counsel before any mainnet operation.
4. **License scope:** one named customer/entity, one tenant workspace; included seats, platform quota, support and product updates must be stated in the quote.
5. **Initial payment path:** admin-issued invoice + verified cleared bank settlement. Online processors stay disabled until they approve the exact product/category and seller jurisdiction in writing.
6. **Price:** USD $12,000 is the proposed standard list price; issued quote is the legal transaction document. The final published price/terms and lifetime service definition need owner approval and legal review.
7. **Launch gating:** no public sales or customer access until seller/payment eligibility, legal/tax/service classification, refund/dispute handling, privacy and security obligations are reviewed.

These are recommended defaults, not claims that the relevant legal, banking or payment conditions have been satisfied.

## Non-negotiable safety invariants remain
- Solana spot DEX only for V1 unless separately approved.
- No leverage or borrowing.
- Deterministic security and risk rules have final veto over model outputs.
- Model cannot access signing secrets, withdraw assets or change hard limits.
- No pooled customer funds; tenant state and signer authority are isolated.
- Full confirmed transaction reconciliation before declaring position closure.
- No guarantee of profit/win rate/target attainment.
- Backtesting, out-of-sample, security review, paper/shadow and staged launch gates remain mandatory.

## Approval needed before design
The owner should explicitly confirm that CR-001 means a paid hosted multi-customer service and that the one-position rule applies per customer workspace. If the intended model is instead a self-hosted single-operator license per purchaser, the product/access/billing requirements must be revised before design.