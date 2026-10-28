# Execution, Reconciliation and Signer Contract

**Status:** Requirements supplement; implementation comes only after later design/build gates. No transaction is authorized by this document.

## 1. Order lifecycle state machine

Canonical lifecycle:
CREATED → QUOTED → RISK_APPROVED → SIGNING_REQUESTED → SIGNED → SUBMITTED → CONFIRMED / FAILED / EXPIRED / UNKNOWN → RECONCILED.

- A lifecycle transition is persisted atomically with its event/audit record.
- Not every state is reachable from every state; invalid transitions are rejected.
- UNKNOWN is a first-class state for ambiguous RPC/submit outcomes. Reconcile signature/chain state before retrying.
- CONFIRMED does not automatically mean the intended token amount/PnL is reconciled; chain state and actual balance/fee changes are still checked.
- A submitted sell is not a closed position until actual remaining balance, partial fills and proceeds are reconciled.

## 2. Pre-entry quote and transaction checks
- Start with quote-only / non-signing behavior.
- Evaluate the currently supported Jupiter Swap API V2 flow and its current official documentation: Meta-Aggregator /order + /execute versus Router /build / submit path. Record the exact endpoint/schema/version, auth, fees, rate limits and error semantics before selecting.
- Preserve quote response and timestamp; enforce maximum quote age.
- Compare desired input/output, minimum output, token mint/program, pool/route, platform/aggregator fees, price impact, slippage, transaction expiry/blockhash and expected network/priority fees.
- Verify transaction instructions/program IDs and destinations against the signer policy; do not sign opaque/unexpected transactions.
- Simulate where supported; treat simulation as evidence, not a guarantee that state will remain unchanged.
- Re-read position state, balances, policy version, kill switch, token security state, quote freshness and risk limits immediately before signing.
- Require both buy and sell/exit feasibility estimates for candidate approval when supported. A missing sell route or unacceptable impact rejects the entry.

## 3. Trade-intent contract
Required fields:
- unique intent ID and idempotency key;
- chain, mint, pool, approved route/program and side;
- exact input amount in integer base units and intended output/min-out constraints;
- strategy/model/exit-profile versions and source snapshot IDs;
- maximum slippage, price impact, fee ceiling and spend ceiling;
- quote timestamp/expiry and transaction expiry;
- hard-gate results, Risk Governor decision and policy version;
- correlation ID and a bounded reason/evidence reference.

Free-form LLM text is not an executable intent. Every field is schema validated and checked by trusted services.

## 4. Signer policy
The signer must independently validate:
- authenticated caller/service identity and authorization;
- current approved policy version and unexpired intent;
- explicit allowlisted programs/instruction types and transaction structure;
- token/mint/pool identity and approved route;
- maximum input spend, expected minimum output, slippage/price-impact limit and transaction fee ceiling;
- no withdrawal/arbitrary transfer or unknown destination;
- correct network/cluster and transaction expiry;
- kill switch, operating mode and current risk approval;
- idempotency and no unresolved duplicate order or open-position conflict.

Reject unknown/opaque instructions, changed transaction payloads, unexpected program IDs, stale quotes, invalid signatures/intent, excess spend/fees/slippage, mismatched mint/pool, expired blockhash or signer policy version. The signer key is never sent to the dashboard, general backend prompt, research process or model.

## 5. Submission/retry/reconciliation
- Do not blindly retry a timed-out submission. Query signature/status and reconcile on-chain state before retry/replace.
- Deduplicate repeated stream events and provider callbacks using transaction signature and stable event/intent IDs.
- Record submitted transaction signature, confirmation level, failure/error details, slot/time, actual token amount, SOL changes, network/priority fees, transfer fees and other attributable execution costs.
- Failed transactions may still incur network fees; record incurred costs.
- Reconcile wallet/token balances against confirmed chain state after each entry/exit and after restart.
- On unknown state, signer anomaly, signature/balance mismatch or unresolved partial fill, halt new entries and alert the operator.

## 6. Position and one-position invariants
- Enforce a concurrency-safe global lock/state constraint from first order intent through final reconciliation.
- One open, partially exited or unresolved position counts as the single position.
- Any residual token amount remains an open position until the accepted dust/minimum-balance policy resolves it and the ledger reconciles.
- Do not begin a next-token entry while an existing position, order or transaction is unresolved.

## 7. Required failure fixtures
Stale quote; mismatched mint/pool; modified instructions; unknown program; expired transaction; excessive fee; excessive slippage/impact; malformed intent; repeat intent; timeout after submission; duplicate event delivery; failed transaction with fee; RPC disagreement; partial sell; sell route disappearance; signer unavailable; risk policy changes between quote and sign; kill switch between approval and submit.

## Exit gate for this specification
Every validation check is mapped to a positive and negative test. Before live-capable signing exists, independent review must demonstrate that a model/dashboard caller cannot bypass the signer policy or cause an arbitrary transaction.