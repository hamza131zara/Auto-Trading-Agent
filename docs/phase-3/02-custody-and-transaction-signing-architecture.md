# Phase 3.2 — Custody and Transaction-Signing Architecture

**Status:** Security architecture proposal; key backend, host isolation and supported-program allowlist need explicit review before implementation.

## 1. Custody principle

Each customer controls their trading capital, host environment and wallet. V1 must not pool funds, custody customer assets in a vendor-controlled wallet, collect seed phrases through the portal, or make the central portal a transaction signer.

The signing boundary is separate from the agent's strategy/LLM. Customer wallet secrets are never sent to the model, browser, central license portal, telemetry, logs or support workflow.

## 2. Logical signing path

1. **Candidate and evidence layer:** produces source-tagged, time-stamped token/pool evidence and current data freshness.
2. **Policy/strategy layer:** returns a versioned decision proposal, including NO_TRADE or RESEARCH_MORE where appropriate.
3. **Deterministic risk governor:** checks approved numeric policy, position state, liquidity/impact/cost constraints, circuit breakers and operating mode.
4. **Transaction intent builder:** generates a narrow intent contract—token mints, approved route/program identifiers, exact input bounds, minimum output, maximum fee/priority cost, expiry and portfolio reference.
5. **Signer policy gate:** independently validates identity, mode, intent schema, allowed instructions, program IDs, accounts, amounts, approvals, fee caps, quote/blockhash validity and all mandatory risk predicates.
6. **Customer-controlled signing backend:** signs only after validation using a key-management mechanism approved for the customer deployment.
7. **Submission and reconciliation:** records signature/transaction ID, watches confirmations, distinguishes failed/partial/unknown states, reconciles fills/fees/balances and keeps the entry lock until resolved.

A valid transaction signature proves authorization of the serialized transaction; it does not prove that the transaction was economically safe or that the expected asset output was received.

## 3. Signer independence and API contract

- Signer is a separate process/service boundary with an authenticated, local-only interface by default; network exposure requires an explicitly approved architecture.
- It accepts a typed intent, not an arbitrary byte buffer supplied by the LLM or browser.
- It reconstructs or independently decodes the transaction and verifies that the serialized transaction corresponds to the approved intent.
- It binds the request to the specific customer installation, portfolio, mode, policy version, nonce/idempotency key, expiry and one-position state.
- It rejects missing, stale, invalid, contradictory, expired or unsupported values. An absent risk limit cannot be interpreted as unlimited.
- It records a machine-readable allow/deny decision and stable reason code before signing; a denial cannot be overridden by a user-interface flag or model score.
- It accepts only explicitly supported and reviewed program IDs and instruction variants. Do not infer program identifiers from token metadata, social posts or model output.
- Unknown instruction, unknown program, unexpected account meta, token approval/delegate change, authority change, unexpected native transfer or destination mismatch is denied by default.
- It applies explicit input amount, minimum output, maximum slippage/impact, transaction fee/priority fee caps, quote expiry and network/cluster checks.
- It validates blockhash/transaction validity and uses durable intent state to prevent duplicate submissions; any ambiguous result enters reconciliation instead of resubmission as a fresh trade.
- No signer endpoint exists for arbitrary withdrawal, key export, policy-limit modification or unrestricted message signing.

## 4. Transaction policy constraints

Until the allowed program/instruction matrix and numerical limits are approved, live signing stays disabled. A future supported adapter must document:

- Program address and upgradeability/trust review.
- Instruction discriminators and decoded fields.
- Required signer and writable accounts.
- Input mint, output mint, source/destination account and token program.
- Transfer-fee/tax/extensions behavior and associated risks.
- Minimum-output, price-impact and quote-expiration semantics.
- Permitted ancillary instructions and explicit denylist.
- Simulation behavior, expected state changes and tolerated events.
- Failure, retry, partial/unknown confirmation and reconciliation behavior.
- Program/version change monitoring and procedure for disabling an affected adapter.

Do not allow arbitrary token approvals, delegate grants, wallet-authority changes, account-draining instructions, generic transfer instructions or dynamic programs solely because a route provider included them.

## 5. Key generation, storage and lifecycle

The production key backend is an open Phase 3 decision, not yet selected. Evaluate supported options against unattended operation, recovery, key isolation, provider/vendor dependency, host compromise, audit, rotation/replacement and customer usability.

Candidate classes to assess:
- Customer-managed hardware-backed KMS/HSM or a policy-enforcing managed signer compatible with the required Solana signing path.
- A local isolated signer with an operating-system or customer-controlled secret-management facility.
- An encrypted local key container only if the threat model, unlock lifecycle, permissions, backup, host protection and residual risk are explicitly accepted.

Production private keys must not be placed in source code, frontend bundles, container images, ordinary logs, CI variables with unnecessary reach, or plaintext configuration. Never print/export keys for debugging. Key backup and recovery must not silently duplicate unrestricted production signing authority. Local test keypairs must be low-value disposable fixtures.

Key lifecycle must specify secure creation, least privilege, distribution, access, rotation/replacement, revocation, compromise response, backup/recovery and disposal. A compromised customer key may require fund migration by the customer; the agent cannot guarantee recovery of stolen assets.

## 6. Operating modes and position invariant

The runtime must distinguish disabled, research, backtest/replay, paper, shadow and approved live modes. Only a later signed/reviewed release may make live order capability available, and all required gates must pass.

Every running instance/portfolio enforces at most one open or unresolved position. Before an entry, the system must prove the prior intent has no unresolved submission, partial fill or open position. Process restart, RPC disagreement, expired quote, failed simulation or uncertain confirmation cannot silently release the lock.

A kill/pause action prevents new entry immediately once state is durable. Exit behavior is a separate policy; pausing does not assert guaranteed liquidation. The signer must continue local hard-policy enforcement if the licensing portal is down.

## 7. Review and acceptance examples

- Crafted LLM output asking for a native-coin transfer is rejected before signing.
- A transaction contains a different program/account/mint/recipient than the typed intent: reject.
- A required risk limit or current position state is unknown: reject.
- Quote or blockhash expires before signing: reject and recompute with new evidence.
- RPC returns contradictory status after submit: persist unknown state and block the next entry.
- Duplicate idempotency key: no second signed transaction/submission.
- Unsupported program upgrade or new instruction variant: adapter becomes unavailable pending review.
- Customer portal offline: local risk/signer policy continues; no arbitrary remote command or forced sell is accepted.
- Seed phrase appears in a log/support fixture: redaction test fails and release is blocked.
