# DOC-12 — Legal, Tax and Service-Boundary Review

**Status:** Open legal/compliance questions register; not legal or tax advice.  
**Scope:** Review before operating the system with live assets, and again before providing software/trading services to any other person. The owner must confirm all relevant operator/entity and user jurisdictions.

## 1. Why this is a required gate
The product is initially scoped as a private single-operator tool trading the operator's own capital. That is materially different from custody, exchange, arranging, investment-management, brokerage, transaction execution or a public SaaS service for other people's assets. The actual legal classification depends on the implemented functions, who controls funds/keys, who receives the service, where operators/users are located, fees/business model and applicable law. Do not assume “non-custodial” or “software only” automatically resolves classification.

## 2. Initial Pakistan research context (revalidate before reliance)
The official PVARA pages reviewed in the 28 October 2026 source-verification pass publish the Virtual Assets Act, 2026, a VASP licensing/NOC framework and related regulatory resources. The pages inspected do not independently establish the exact consolidated text/version of every related regulation or verify the previously stated notification date for particular regulations. Do not rely on that unverified date or assume an online summary is the full legal text. A qualified adviser must inspect the actual applicable Act, gazetted regulations, circulars and current amendments. PVARA's FAQ is guidance, not a substitute for primary legislation. See:
- PVARA regulatory framework: https://pvara.gov.pk/regulations
- PVARA licensing page: https://www.pvara.gov.pk/licensing
- PVARA FAQ: https://www.pvara.gov.pk/faq
- Virtual Assets Act, 2026 (official copy linked by PVARA): https://www.pvara.gov.pk/documents/Virtual%20assets%20Act%202026%20passed%20by%20NA.pdf
- State Bank of Pakistan circular concerning accounts for PVARA NOC/licensed VASPs: https://www.sbp.org.pk/circulars/bprd-circular-letter-no-10
- FBR Income Tax Ordinance index: https://fbr.gov.pk/Categ/Income-Tax--Income-Tax-Ordinance/326
- FBR Income Tax Rules index: https://www.fbr.gov.pk/categ/income-tax-rules-2002/335

**Source-freshness correction from the 28 October 2026 verification pass:** the FBR Ordinance index page inspected during review displayed a consolidated version amended through 30 June 2024, and the Income Tax Rules page displayed a version amended through 24 November 2023. These landing pages do not prove the currently consolidated tax text or amendments through 2026. This register must not be treated as evidence that those older page snapshots are current. Obtain the current Finance Act/amendments and applicable primary tax provisions, then get a qualified Pakistani tax adviser to document the actual position.

The PVARA page publishes a Virtual Assets Act, 2026 and regulatory documents, but neither that page nor the cited FAQs decides whether this exact private own-capital software setup is a regulated service or what tax treatment applies to a specific user. Qualified Pakistani counsel/tax adviser must assess the facts, actual activity model and current primary legislation/regulations. See [the dated source verification report](26-official-source-verification-report.md).

## 3. Activity classification questions for counsel
Document a written answer for each relevant scenario:
1. Operator runs the bot solely on their own wallet and their own capital, with no customer access, custody or fee-based service.
2. Bot is made public as downloadable software but users self-host and manage their own keys.
3. Hosted platform provides market analysis/signals only.
4. Hosted platform prepares/sends transactions from a user's wallet or integrates with a wallet.
5. Platform has custody, control, co-signing, discretionary control, withdrawal ability or trading authority over customer assets.
6. Platform trades on behalf of others, pools funds, copies trades, routes/arranges transactions, charges performance fees or offers subscriptions.
7. Platform markets to or onboards users in Pakistan or another jurisdiction.
8. The operator provides APIs, infrastructure or decision services to other businesses.

For every scenario, determine whether any licence, registration, sandbox/NOC, authorization, disclosure, capital, governance, cybersecurity, AML/CFT, sanctions, complaint-handling or recordkeeping obligation applies. Do not launch an out-of-scope service until counsel approves it.

## 4. Tax and accounting questions
Obtain a written tax/accounting position for the actual operator/entity on:
- treatment of swaps as disposals/exchanges and timing/valuation of gains/losses;
- cost basis/lot accounting, token decimals, transfer fees, airdrops, dust, wrapped assets if ever in scope, failed transactions and reimbursed costs;
- source and timestamp of fiat/USD/PKR values;
- reporting of trading gains/losses, business vs capital treatment where relevant, foreign-platform/provider payments and applicable withholding/VAT/sales-tax questions;
- wallet-to-wallet transfers vs taxable disposals;
- record retention, return filing, transaction evidence and reconciliation standards;
- changes in law, finance acts, regulator rules and tax guidance.

Do not encode a tax rate into the dashboard until a qualified adviser confirms it for the operator/entity and tax year.

## 5. Provider terms, IP and privacy
- Verify each RPC, market-data, DEX, LLM, hosting and signing provider's terms, permitted use, rate limits, storage/redistribution, commercial-use rights, retention and geographic restrictions.
- Do not scrape authenticated dashboards when a documented API/RPC exists and terms restrict scraping.
- Review use of addresses, wallet-cluster inference and any personal data; minimize stored data and define access/retention/deletion rules.
- Disclose data sources and limitations; do not describe provider scores or model predictions as regulatory approval or guarantees.
- Review open-source licences and third-party code/strategy licences before distribution.

## 6. Decision record required
For each reviewed jurisdiction and service model, record:
- factual operating model and user/customer population;
- counsel/adviser name or firm, review date and scope;
- primary legal provisions and versions examined;
- conclusion and assumptions;
- licence/registration/tax/recordkeeping actions required;
- unresolved questions, limitations and re-review trigger;
- owner approval and date.

## 7. Re-review triggers
Reassess before enabling mainnet with an entity account; onboarding another operator/customer; offering a paid hosted service; custody/co-signing/trading on behalf of others; adding exchange/arranging/brokerage-like functions; expanding jurisdiction; changing fee model; or upon a material change in applicable law.

## Gate
No public/third-party service rollout, custody, customer transaction execution or related business claim until the service boundary is reviewed and written approval is recorded. A private own-capital pilot still requires the operator to follow applicable laws and tax duties; this document does not certify it as legally cleared.