# Official Documentation and Research Register

**Purpose:** source register for Phase 1. Re-open sources before implementation because endpoint versions, SDKs, prices, quotas and terms can change. Vendor marketing claims are not evidence of profitability.

## Solana foundation
- JavaScript/TypeScript client guidance and Solana Kit: https://solana.com/docs/clients/official/javascript
- Frontend/client and Kit overview: https://solana.com/docs/frontend/client
- RPC documentation: https://solana.com/docs/rpc
- Fees: https://solana.com/docs/core/fees
- Token authorities: https://solana.com/docs/tokens/basics/set-authority
- Freeze authority: https://solana.com/docs/tokens/basics/freeze-account
- Token-2022 extensions: https://solana.com/docs/tokens/extensions
- Key-management package and supported backends are linked from the official JavaScript client documentation; assess threat model and custody implications before selecting.

## Execution and DEX
- Jupiter developer documentation: https://dev.jup.ag/docs
- Jupiter Swap API documentation: https://dev.jup.ag/docs/swap
- Raydium developer documentation: https://docs.raydium.io/
- Direct integration must be compared with aggregator routing, quote freshness, transaction construction, simulation, slippage constraints, fee handling and transaction landing behavior.

## Discovery and market data
- DEX Screener API reference: https://docs.dexscreener.com/api/reference
- Birdeye API documentation: https://docs.birdeye.so/
- Helius documentation: https://docs.helius.dev/
- Solana RPC and providers are not interchangeable by default; verify field semantics, timestamps, coverage, rate limits, terms, outage behavior and cost.
- Safety-critical decisions should validate critical state directly on-chain or against independent sources where practical.

## Security engineering
- OWASP ASVS 5.0.0 overview: https://asvs.owasp.org/
- OWASP Secrets Management Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html
- NIST SP 800-218 Secure Software Development Framework: https://csrc.nist.gov/pubs/sp/800/218/final
- Use these as reference frameworks; do not claim compliance until controls are mapped and tested.

## AI/agent decision methodology
- Treat output schemas, confidence thresholds, abstention and downstream action as application-owned policy.
- For any external decision framework/model considered, review its official documentation and evaluation methods. Do not copy a tool dependency where only the general public design pattern is needed.
- Model probabilities require calibration against the system's own labeled outcomes.

## Quantitative research
- Maintain dated papers and datasets for probability calibration, backtest overfitting, Kelly/log-growth allocation and risk management in a research folder when selected.
- Separate theoretical derivations, vendor claims, simulation results and live performance evidence.
- No paper or backtest alone certifies future profitability.

## Source review record
For each selected API/package: record exact endpoint/product version, access plan, auth method, request limits, cost/usage units, data-retention/redistribution restrictions, latency expectations, failure modes, last reviewed date and replacement plan.

## Additional official sources required by the canonical Roadmap v1.0

### Dashboard authentication and database permissions
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase MFA: https://supabase.com/docs/guides/auth/auth-mfa
- PostgreSQL Row-Level Security: https://www.postgresql.org/docs/current/ddl-rowsecurity.html

### Agent/API security and AI risk governance
- OWASP Top 10 for Agentic Applications 2026: https://genai.owasp.org/resource/owasp-top-10-for-agentic-applications-for-2026/
- OWASP API Security Top 10: https://owasp.org/API-Security/
- NIST AI Risk Management Framework: https://www.nist.gov/itl/ai-risk-management-framework
- NIST Secure Software Development Framework: https://csrc.nist.gov/pubs/sp/800/218/final
- OWASP ASVS: https://asvs.owasp.org/

### Durable workflow orchestration (optional)
- Temporal documentation: https://docs.temporal.io/
Evaluate only if workflows/retries/long-running recovery justify its cost and operational load.

### Pakistan legal/tax/service boundary review (if applicable to the operator/service)
- PVARA regulatory framework page: https://pvara.gov.pk/regulations
- PVARA VASP licensing page: https://www.pvara.gov.pk/licensing
- PVARA FAQ: https://www.pvara.gov.pk/faq
- Virtual Assets Act, 2026 official copy: https://www.pvara.gov.pk/documents/Virtual%20assets%20Act%202026%20passed%20by%20NA.pdf
- State Bank of Pakistan circular on accounts for PVARA NOC/licensed VASPs: https://www.sbp.org.pk/circulars/bprd-circular-letter-no-10
- FBR Income Tax Ordinance: https://fbr.gov.pk/Categ/Income-Tax--Income-Tax-Ordinance/326
- FBR Income Tax Rules: https://www.fbr.gov.pk/categ/income-tax-rules-2002/335

These are research sources, not legal/tax conclusions. Record the jurisdiction, applicable service model, exact primary text/regulation version, review date and qualified adviser conclusion in DOC-12 before relying on the result.

## Provider and policy review metadata
For every selected integration, add a review record containing exact product/API/SDK version, endpoint names, auth method, applicable plan, rate/quota units, current pricing, terms/licensing, data retention/redistribution rights, latency/failure behavior, tested fallback and date reviewed. Links alone do not constitute an approved integration decision.

## Dated source-verification record
- **Pass 1 reviewed:** 28 October 2026.
- **Report:** [26-official-source-verification-report.md](26-official-source-verification-report.md).
- Provider pricing/rate limits verified from current public Jupiter, Helius and Birdeye pages. DEX Screener API limits/terms and the current Solana Kit/RPC/fee guidance were also reviewed.
- **Caution:** this verifies public documentation at the review date, not an account-specific entitlement, production SLA, live route behavior or final integration choice. Re-check official sources before implementing adapters and record actual account/plan evidence.
- The official FBR landing pages opened during this pass showed older consolidated tax documents (Income Tax Ordinance amended through 30 June 2024; Income Tax Rules amended through 24 November 2023). Do not rely on the landing pages alone as current consolidated tax texts; qualified review of the current amendments is an open DOC-12 item.