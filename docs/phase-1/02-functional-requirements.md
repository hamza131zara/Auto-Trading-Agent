# Functional Requirements

Status values: **Proposed**, **Needs research**, **Accepted**, **Rejected**. Unless explicitly approved, items below are Proposed.

## FR-01 — Authentication and operator access
- All dashboard and administrative APIs require authentication.
- Enforce server-side authorization on every action, with deny-by-default permissions.
- Destructive or high-impact actions require re-authentication or a deliberate confirmation step.
- Record actor, timestamp, policy version and reason for changes to operating mode or risk configuration.

## FR-02 — Operating mode
- Display current mode prominently: Research, Simulation, Paper/Shadow, Restricted Pilot, or Halted.
- Live trading remains disabled by default and must require explicit owner enablement after release gates.
- A persistent global pause/kill-switch prevents new entry orders.
- Mode transitions are audited; the UI must never report success before the backend confirms the transition.

## FR-03 — Candidate discovery and review
- Discover candidates from configured data sources and on-chain observations.
- Deduplicate tokens and pools by canonical chain/program/address identifiers.
- Show discovery timestamp, source, data freshness, pool age and missing/stale fields.
- Allow filters for liquidity, pool age, volume quality, volatility, holders, concentration, price impact, estimated fees, strategy compatibility and risk status.
- Support candidate states: Discovered, Screening, Rejected, Eligible, Watching, Proposed, In Position, Cooldown and Disabled.
- Store rejection reason codes and key evidence.

## FR-04 — Security assessment
- Evaluate supported token program and extension behavior, authorities, transfer restrictions, pool state, liquidity concentration, holder concentration and available deployer/wallet-cluster evidence.
- Unknown or unsupported high-risk token behavior fails closed under a documented policy.
- Show individual findings and evidence; do not hide hard failures in an aggregate score.
- A high-upside score never overrides a hard security rejection.

## FR-05 — Strategy decision
- Maintain versioned strategies with entry, invalidation, exit, regime, minimum sample and eligibility rules.
- Allow only strategies approved for the current operating mode.
- NO_TRADE and RESEARCH_MORE are valid decisions.
- Keep deterministic calculations separate from model/LLM judgments.
- Record inputs, model versions, scores, uncertainty, selected policy and rejection reason.

## FR-06 — Risk and sizing
- Apply a deterministic Risk Governor before order creation and immediately before signing.
- Enforce the one-position invariant at the approved portfolio scope, plus wallet/balance limits, token and pool eligibility, liquidity/price-impact limits, configured loss budgets, daily drawdown, failure circuit breakers and system-health gates. The original single-operator baseline used one global position; CR-001 proposes one open/unresolved position per isolated customer workspace for a hosted multi-customer product. The scope amendment must be confirmed before design/implementation; never share positions or funds between tenants.
- Kelly estimates are constrained by policy and are not allowed to enlarge exposure beyond the independent risk cap.
- If edge is non-positive, inputs are stale, or uncertainty exceeds the accepted threshold, do not trade.

## FR-07 — Execution lifecycle
- Obtain buy quote and realistic sell/exit quote before entry where supported.
- Estimate network fees, priority fees, DEX/aggregator fees, token transfer fees, slippage, price impact and route failure risks.
- Simulate transaction when supported; perform a final freshness and risk check before signing.
- Use idempotency keys and explicit lifecycle states to prevent duplicate orders.
- Reconcile signature, confirmation, actual token amount, SOL changes, fees and realized fill.
- Never treat a submitted transaction as a confirmed fill.

## FR-08 — Position and exit management
- Support configured Quick Compound, Trend Capture and High-Upside Runner profiles.
- Exit rules must specify trigger source, partial size, net-PnL basis, trailing/invalidation logic, emergency override and failure handling.
- Risk/security emergency exits supersede profit targets, subject to transaction feasibility.
- A target reached must stop new entries when target-pause policy is active.
- Partial fills, untradeable positions and unavailable routes must trigger explicit recovery states and alerts.

## FR-09 — Portfolio goals
- Support owner-defined balance milestones (illustrative: $100, $500, $1,000 and $5,000).
- Define whether each milestone means realized equity or wallet mark-to-market equity; proposed default is reconciled equity after closing positions and reserving liabilities/costs.
- On milestone hit: stop new entries, reconcile and notify; pause/continue behavior requires explicit configuration.
- Never imply target dates or guaranteed achievement.

## FR-10 — Analytics and history
- Show net PnL, win rate, expectancy, profit factor, drawdown, fees, slippage, failed transactions, exit reasons, strategy/regime results and goal progress.
- Track rejected candidates and shadow outcomes without pretending hypothetical fills equal real fills.
- Export trade ledger and audit events in a machine-readable format.
- Store full version lineage for rules, strategies, models, feature schemas and configurations.

## FR-11 — Learning lifecycle
- Post-trade analysis compares predicted and actual outcome.
- An individual loss records evidence but does not automatically disable a strategy.
- Strategy/model updates are proposals; validated champion/challenger evaluation is required before promotion.
- Production policy, signer scope and hard risk limits cannot be changed by an LLM.

## FR-12 — Reliability and audit
- Monitor provider health, data freshness, RPC disagreement, queue lag, signer availability, transaction failures and database durability.
- On material data inconsistency, unknown transaction state or risk-service failure, halt new entries.
- Maintain append-only or tamper-evident logs for privileged changes and trade lifecycle events.

## Acceptance approach
Every accepted requirement must have a stable ID, owner, rationale, source when relevant, risk level, measurable acceptance criterion and linked test case in the traceability matrix.

## FR-13 — Autonomous discovery-to-next-candidate loop
- After all future release gates pass and an owner explicitly enables the approved live mode, the agent may autonomously discover candidates, reject unsafe candidates, select one eligible token/strategy, submit an approved trade intent, monitor the resulting position, exit under its configured policy, reconcile the result and continue to the next candidate.
- The complete state machine and exceptions are specified in [16-autonomous-trading-workflow.md](16-autonomous-trading-workflow.md); that specification is normative alongside this requirements document.
- The cycle must check operating mode, kill switch, portfolio/position state, provider health and data freshness before scanning or entering.
- Candidate selection must be preceded by hard token/pool security checks, market/exitability analysis, outcome/cost estimation and deterministic Risk Governor approval.
- Only one open or unresolved position is permitted globally. Do not open a new position until the prior position is fully reconciled and closed, including partial fills, residual tokens and unknown transaction states.
- If no candidate passes, return NO_TRADE, record rejection/abstention reasons, and retry only according to a bounded polling/event schedule. Trading frequency is not a goal.
- Before an entry, obtain fresh buy and sell/exit estimates and simulate the transaction where supported; re-check all hard rules immediately before signing.
- During an open position, continuously evaluate configured target, partial-profit, trailing/invalidation, security-emergency and portfolio-risk triggers.
- A sell submission is not closure. Confirm/reconcile the on-chain state, remaining token balance, proceeds and fees before transitioning the position to Closed.
- After closure, create the Trade Passport, compare predicted and actual outcomes, update versioned statistics asynchronously, check target/drawdown/pause policies, and then return to discovery only if new entries remain authorized.
- All model decisions use typed schemas and allowlisted results. Model timeout, malformed output, insufficient confidence or contradictory inputs must abstain; it must not cause a buy.
- The owner alone authorizes enabling live mode, changing hard risk limits, changing signing permissions, withdrawing funds, or promoting a production model/strategy version.
- Paper/Shadow mode must exercise the same lifecycle without signing or broadcasting asset-moving transactions.


## FR-02A — Canonical operating-mode taxonomy (roadmap alignment addendum)
Use the canonical mode names from Roadmap v1.0 consistently in the final design state machine:
- **Observe:** collect/display data only; no order intent can reach signing.
- **Backtest:** historical replay only; fills are simulated.
- **Paper:** generate simulated orders/fills; no signing or transaction broadcast.
- **Shadow:** run live discovery and decisioning while transaction submission is disabled.
- **Live Canary:** explicitly enabled limited-capital pilot with a small approved risk budget.
- **Live:** approved operation under the same non-bypassable risk rules and versioned policy.
- **Halted:** no new trade intents; existing-position recovery/exit follows its separate approved policy.

Previous shorthand modes in this file (Research, Simulation, Paper/Shadow, Restricted Pilot) are aliases that must be mapped to these canonical states during design, not extra states. Transition into Live Canary/Live requires owner authorization, MFA/re-authentication, an approved policy/config version and all applicable release gates. The UI cannot transition the backend by cosmetic state alone. This addendum aligns names to the frozen roadmap; it does not add scope or authorize live trading.


## FR-14 — Paid-only quote and lifetime-license model
- The core product has no free tier, free trial, trial extension or free operational demo.
- The proposed standard license is USD $12,000 as a one-time lifetime payment, not a recurring subscription. Final published price, currency, service lifetime, updates/support, included data/compute allowances and exclusions must appear in versioned terms and an owner-issued quote.
- Public users may view marketing/pricing/terms and submit a quote request; this does not create an agent account or grant access to protected services.
- Admin issues a versioned quote/invoice with unique ID, customer, amount, currency, expiry, included license/workspace/service scope, payment instructions, applicable fees/taxes, refund terms and terms version.
- No payment provider is selected until it confirms seller-country and exact crypto-trading-product eligibility in writing. Initial proposed flow is invoice + verified cleared bank settlement.
- Access is not granted from client-side redirect or customer-uploaded payment screenshot alone. Payment must be confirmed through a trusted provider webhook or manually reconciled bank settlement evidence.
- The quote, payment, settlement, invitation, registration, admin approval, license entitlement, refund and dispute states are separately persisted and auditable.

## FR-15 — Payment-first invitation and owner/admin registration approval
- An invitation is issued only after the quote/invoice is verified as settled/paid.
- Invitation is single-use, short-lived, bound to the quoted email/customer identity and cannot itself grant operational access.
- User must complete registration, verify email, complete required MFA, accept the active license/terms/privacy notice and provide required account eligibility details.
- Owner/admin approval is mandatory after registration. Approval does not override missing/failed payment, terms, MFA or compliance checks.
- The server denies all protected UI/API/stream/agent jobs unless payment is verified, registration is complete, email verified, admin approval granted, required MFA satisfied, terms accepted, entitlement active and tenant enabled.
- If the application is declined after payment, follow the documented refund/contract/legal policy; do not silently retain funds without a documented lawful basis.
- No free-trial state, coupon, manual override or test seed may create an unpaid operational entitlement.

## FR-16 — Commercial tenant isolation (scope amendment)
- Each paid customer has an independent tenant/workspace, data namespace, configuration, audit history, licensed access and customer-specific wallet/signer boundary.
- Server-side authorization and database isolation prevent one customer or background job from reading/changing another customer's wallet, keys, trade history, quotes, invoices, risk controls, decisions or PnL.
- Proposed design default is at most one open/unresolved position per customer workspace, not one global position shared by all buyers. This changes the original single-operator/global-position assumption and must be explicitly confirmed before Phase 2 design.
- Customer balances/funds must not be pooled. The agent cannot withdraw or move assets to a platform/admin wallet.
- Whether unattended signing uses customer-controlled signing or an isolated customer-specific signing service is a security/legal design gate; do not place all customer keys in the general agent process.
- Admin owner/support roles are distinct, least-privileged and audited. A payment administrator cannot change trading risk settings by virtue of payment privileges.

## FR-17 — Lifetime entitlement lifecycle and payment-event integrity
- Model Quote, Invoice/Order, Payment/Settlement, Invitation, Registration, AdminApproval, LicenseEntitlement, Refund and Dispute as distinct linked records.
- Use idempotency for settlement/provider events; reject mismatched amount/currency/quote/customer, expired quotes and duplicate fulfillment.
- Webhook integrations (if approved) must verify signatures, persist event IDs, handle duplicate/out-of-order deliveries, and reconcile against provider state.
- A pending, reversed, refunded, disputed or charged-back transaction changes entitlement only under the reviewed contract/dispute policy and is auditable.
- Admin pricing/quote/approval/refund/suspension/revocation actions require server-side permission checks, re-authentication/MFA when high impact, reason codes and audit trail.
- No recurring subscription invoices are created for the core lifetime license. Any later change to recurring pricing requires explicit owner approval and a roadmap/business-model amendment.

### Commercial acceptance tests
See [27-commercial-pricing-access-and-lifetime-license.md](27-commercial-pricing-access-and-lifetime-license.md), [28-payment-provider-eligibility-assessment.md](28-payment-provider-eligibility-assessment.md) and [29-commercial-scope-amendment.md](29-commercial-scope-amendment.md).