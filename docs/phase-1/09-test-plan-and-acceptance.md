# Test Plan and Acceptance Gates

## Test layers
1. Unit tests: arithmetic, token/amount parsing, net PnL, fee aggregation, risk policy, state transitions and idempotency.
2. Contract/schema tests: provider adapters, response versions, missing/null fields, rate limits and malformed data.
3. Property-based tests: financial invariants, monotonic risk limits, amount boundaries and state-machine transitions.
4. Integration tests: database transactions, queues, RPC/provider failover, quote/simulation/execution interfaces and signer policy.
5. Replay/backtest tests: chronological data replay, no look-ahead, fees/slippage, partial exits, failed exits and stop/kill-switch behavior.
6. Security tests: authentication/authorization, session/CSRF protections where applicable, secrets scanning, dependency and container scanning, API abuse and signer policy bypass attempts.
7. Resilience tests: provider outage, stale/disagreeing sources, database loss/restore, process restart, duplicate events, stuck/unknown transactions and queue backlog.
8. Paper/shadow validation: live market observations, quotes and simulated decisions with no signing or asset-moving transactions.
9. Restricted pilot validation: only after explicit approval and all exit gates pass.

## Required invariant tests
- Failed/unknown security gate cannot reach signer.
- No more than one open position portfolio-wide, including restart and race conditions.
- Stale/conflicting critical data blocks new entries.
- A score or LLM answer cannot override deterministic rejection.
- No secret appears in logs, prompts, frontend assets or repository history.
- A submitted transaction is not treated as filled until reconciled.
- Idempotent retry does not create an unintended duplicate trade.
- Risk and portfolio caps cannot be exceeded by Kelly/model output.
- Milestone target triggers the configured pause/notification behavior.
- Emergency and daily loss controls block new entries.
- Financial PnL reconciles to chain-confirmed amounts and attributable fees within defined tolerances.

## Quantitative evaluation
- Use chronological train/validation/test windows and walk-forward evaluation.
- Lock metrics and comparison criteria before evaluating variants.
- Report sample size, confidence intervals, calibration, net expectancy, profit factor, drawdown, tail losses and costs.
- Include unsuccessful candidates and realistic entry/exit assumptions where data allows.
- Run sensitivity analysis for slippage, fees, latency, missing data, liquidity loss and model miscalibration.
- Reject results dominated by a small number of extreme winners or unreasonable fill assumptions.

## Phase gates
### Documentation exit
Owner accepts scope, policies, risk model, provider choices, security model, data model and acceptance criteria.
### Design exit
Approved UX, architecture, trust boundaries, schemas, threat model, operational workflows and test strategy.
### Build exit
CI passes; required automated tests pass; no known critical/high unresolved security issues; reproducible build and migrations verified.
### Paper-trading exit
Pre-agreed observation window/sample requirements and thresholds are met for data reliability, execution estimates, calibrated predictions, net expectancy and drawdown; no unresolved critical incidents.
### Mainnet readiness
Explicit owner approval, limited capital, isolated signer, independent kill switch, alerting, backup/restore drill, tested recovery, audit review and a rollback/disable plan.

No numerical performance gate should be invented after viewing results. Set evaluation criteria before the relevant test period.

## Commercial access and licensing tests (CR-001)
- **No free access:** public self-signup cannot create an agent account; no trial state exists in schema/UI/API; an unpaid customer cannot access protected dashboard/API/streams/agent jobs.
- **Payment-first:** no invite before verified settlement; payment pending, screenshot-only, underpaid, overpaid, wrong-currency, expired quote and unrelated invoice never auto-activate access.
- **Registration approval:** paid user still cannot access before email verification, required MFA, terms acceptance and owner/admin approval.
- **Webhook integrity:** invalid signature, replay, duplicate, out-of-order, delayed, refunded, disputed and chargeback events are tested; idempotency prevents duplicate license fulfillment.
- **Manual settlement integrity:** payment reference/amount/currency/customer/quote must reconcile to trusted bank evidence; reviewer and audit trail recorded; suspicious/mismatched payments enter manual review.
- **Invite security:** single-use/expiry/email binding, revocation, resend, replay and account takeover attempts are tested; raw invite token never appears in logs.
- **License behavior:** one-time payment creates one license under exact terms; no recurring invoice/subscription gets created; suspension/refund/revocation follows approved policy.
- **Commercial admin:** privilege tests ensure only authorized roles issue/change quotes, verify payment, approve registrations, grant/revoke license and execute refunds. High-impact operations require step-up auth/MFA.
- **Tenant isolation:** cross-tenant IDOR/API/job/cache/object-store/database access tests; tenant-specific wallet, ledger, model/strategy history, risk policy and positions remain isolated.
- **Position isolation:** if the owner approves a tenant model, race/restart tests enforce at most one open/unresolved position per tenant and prohibit one customer's activity from blocking or modifying another's position.
- **High-ticket financial controls:** duplicate invoice, wrong settlement currency, bank reversal, refund, chargeback and failed reconciliation scenarios are tested.
- **Payment provider restrictions:** production checkout remains feature-flagged off unless seller country and exact product/category receive written provider approval and the approved webhook path passes tests.

## Commercial release gate
Public sales require an approved payment/settlement route, versioned license/refund terms, legal/tax/service-boundary review, privacy notice, tenant isolation tests, chargeback/refund operations and explicit owner launch approval. A checkout success page alone can never authorize account activation.