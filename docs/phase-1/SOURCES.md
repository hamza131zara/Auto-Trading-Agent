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