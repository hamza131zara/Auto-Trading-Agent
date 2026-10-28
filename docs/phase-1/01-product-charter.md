# Product Charter

## Purpose
Build a research-first, auditable Solana spot-DEX trading system that discovers candidates, checks token/pool risk, evaluates strategies, sizes positions within strict limits, executes through a constrained signer, manages exits, and learns from reconciled outcomes. The product is not represented as a guaranteed-profit system.

## Product objectives
- Make token selection and trade decisions traceable to dated market data and versioned rules.
- Prefer capital preservation and expected net performance over trading frequency.
- Support multiple validated exit profiles: quick-compound, trend-capture and high-upside runner.
- Track candidate, trade, execution, risk and model outcomes, including rejected/skipped candidates.
- Evaluate every new strategy or model through research, out-of-sample testing and paper trading before promotion.

## V1 scope
- Solana mainnet spot tokens/pools only, with test/dev environments for development and simulation.
- **Original baseline:** at most one open position in the single operator's portfolio. Under commercial amendment CR-001, the proposed hosted multi-tenant scope applies the cap per customer workspace; this must be confirmed before design.
- **Original baseline:** one operator/admin role and private dashboard. CR-001 proposes customer accounts with owner/admin approval and tenant-isolated workspaces; see the separate amendment.
- Market discovery, token/pool validation, holder concentration and wallet-cluster indicators where data is reliable, liquidity and exitability analysis, market-regime features, strategy selection, risk governor, execution adapter, position monitor, ledger/audit, reports and kill switches.
- Fixed-target, trend-capture and high-upside-runner exit profiles as competing policies to test.
- Statistical strategy registry and controlled champion/challenger promotion.
- Optional LLM/structured decision layer for bounded classification, ranking, research summaries and post-mortems; no signing authority.
- Kelly-based sizing only as a research module until explicitly validated.

## Non-goals for V1
- No new wallet product or custody service for public customers.
- No pooled/multi-tenant custody, cross-chain execution, leverage, borrowing, perpetuals, lending, market-making, arbitrage, MEV extraction, or unrestricted copy trading. Customer-access tenancy requested under CR-001 must not imply custody, pooled funds or shared signing keys.
- No promise that any trade wins, a strategy is profitable, a token is safe, or a milestone will be reached.
- No automatic self-modification of production code, hard risk limits, permissions, or signer policy.

## Actors
- Owner/operator: configures bounded policy, reviews reports, pauses system and approves releases.
- Discovery/data services: provide on-chain and market observations.
- Decision services: calculate features, estimates and candidate rankings.
- Risk governor: enforces non-bypassable limits.
- Execution/signer boundary: validates approved intents, signs only permitted transactions and reconciles results.
- Research evaluator: backtests, tests calibration/drift and proposes versioned changes.

## Operating modes
1. **Research:** historical datasets and offline analysis only.
2. **Simulation/backtest:** replay data with explicit fill/fee/slippage assumptions.
3. **Paper/shadow:** live observations and quotes, no asset-moving transaction.
4. **Mainnet restricted pilot:** only after all release gates; very limited capital and explicit owner enablement.
5. **Halted:** no new entries; exits and recovery follow separately defined operational policy.

## Success measures
Success is judged by data quality, safety-gate coverage, execution reliability, cost-model error, calibrated outcome estimates, out-of-sample net expectancy, drawdown, audit completeness, reproducibility and controlled operation—not win rate alone.

## Requirement status
All statements are proposed until accepted in the Phase 1 decision log.

## Commercial scope addendum — CR-001 (28 October 2026)
The owner requested a paid customer access model. This is a scope amendment to the original private single-operator description; the canonical Roadmap v1.0 phase order remains unchanged.

- No free tier, free trial, trial extension or complimentary operational access.
- Proposed standard price: USD $12,000 one-time lifetime license; final price/definition/inclusions must be published in reviewed quote/license terms.
- Customer requests a quote, receives a formal owner/admin-issued quote/invoice, pays, and only after settlement verification receives a single-use registration invitation.
- Customer completes registration and is approved by owner/admin. Agent/dashboard/service access is allowed only after payment verified + registration complete + email verified + admin approval + required MFA + terms accepted + active license.
- No recurring core subscription. Public marketing pages and documentation may be visible, but no free operational agent access is available.
- Multi-customer hosting requires tenant isolation and individual customer wallet/signer boundaries. Proposed default is one open/unresolved position per customer workspace; this changes the earlier global portfolio-wide rule and must be confirmed before design.
- Payment-provider eligibility and seller-country/legal/tax review are release prerequisites. The initial proposed collection method is admin-issued invoice plus manually verified cleared bank settlement; no automated checkout provider is approved yet.
- “Lifetime” must be contractually defined as product/service lifetime, including exact updates/support/hosting/data allowance/fair-use terms. It is not a promise that a company/service will operate forever and cannot be advertised as guaranteed uninterrupted service.

See [CR-001](29-commercial-scope-amendment.md), [commercial license and access requirements](27-commercial-pricing-access-and-lifetime-license.md), and [payment-provider assessment](28-payment-provider-eligibility-assessment.md). These additions do not authorize production trading, custody, or public sales before applicable gates are passed.
