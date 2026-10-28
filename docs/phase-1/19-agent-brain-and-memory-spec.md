# Agent Brain, Policy Router and Strategy Memory Specification

## Purpose
Define the boundaries between deterministic data/feature computation, model-supported decisions, hard policy checks, execution authority and asynchronous learning.

## Module authority matrix

| Module | Input to output | Permitted authority | Must not do |
|---|---|---|---|
| Data parser/state builder | Raw RPC/API to canonical timestamped state | Reject malformed/stale/inconsistent data | Trade, infer missing facts as certain |
| Candidate generator | Pool events/sources to deduplicated candidate queue | Discover candidates only | Buy or approve risk |
| Token security/rug engine | Mint/program/extensions/holders/pool/wallet evidence to hard gates and risk signals | Reject under hard policy | Let opportunity score offset a hard reject |
| Feature/regime engine | Historical snapshots to versioned features and regime estimate | Analysis only | Place orders |
| Outcome estimator | Features to outcome distribution, TP-before-stop estimate, expected net return, uncertainty | Recommend or abstain | Treat raw score as calibrated probability |
| Choice router | Eligible context to enumerated profile, RESEARCH_MORE or NO_TRADE | Choose only approved options | Invent arbitrary actions or override eligibility |
| Score/proposition evaluator | Features to dimension scores and narrowly worded yes/no assessments | Rank or trigger re-analysis | Bypass hard gates; force a positive answer |
| Allocation/Kelly research module | Validated distribution to candidate size proposal | Propose only | Exceed risk caps, sign or send transactions |
| Risk Governor | Proposal plus balances, limits and health to allow/deny and reasons | Final deterministic veto | Delegate its authority to AI |
| Execution planner | Approved intent to fresh quote, minimum-out, fee cap and instruction analysis | Prepare/validate intent | Sign or bypass signer policy |
| Isolated signer/execution | Validated transaction object to signature/submission result | Sign only allowlisted policy-compliant transactions | Arbitrary signing, withdrawal or model-controlled program calls |
| Position monitor | Confirmed position plus quotes/events to exit request | Request preconfigured exit | Assume a sell filled before reconciliation |
| Ledger/reconciliation | Signatures and chain state to canonical fills/balances/PnL | Source of truth for realized financial state | Overwrite actuals with estimates |
| Post-mortem/optimizer | Outcomes plus frozen feature snapshots to proposals/challenger version | Asynchronous research proposals only | Edit hard limits or change live policy directly |

## Choice schema
Allowed top-level outcomes:
- QUICK_COMPOUND
- TREND_CAPTURE
- HIGH_UPSIDE_RUNNER
- RESEARCH_MORE
- NO_TRADE

The selected strategy ID/version and exit policy ID/version are separate fields. If no strategy is eligible or the model returns an invalid answer, use the explicitly configured abstention path; default is NO_TRADE.

## Separate score dimensions
Keep at least:
- hard security gate (Pass/Fail/Unknown/Stale/Not Tested);
- rug-risk model score;
- data completeness/confidence;
- market quality;
- upside potential;
- exitability;
- strategy/regime fit;
- execution quality.

Do not collapse these into a compensating average where a high upside score offsets a hard rejection. Store source, timestamp, feature-schema version and model version for every score.

## Noul-style proposition checks
Every yes/no check must be a precise proposition and include answer, probability/confidence representation if provided, evidence references, timestamp, model version and abstention state. Example proposition classes: coordinated wallet distribution evidence, abnormal liquidity withdrawal, possible transfer restriction, evidence sufficient for runner profile. These judgments are supplementary—not proof of ownership/fraud and not a replacement for on-chain verification.

## Output contract
Every decision response must be schema-validated and include:
- decision ID/correlation ID;
- candidate/pool identifiers and snapshot references;
- allowed enum choice, strategy/version and exit-profile/version;
- individual features/scores and hard-gate results;
- estimated outcome distribution and calibration/model version, or explicit unavailable/uncertain status;
- compact rationale and evidence references;
- missing/stale fields and abstention reason;
- policy and configuration versions;
- time generated and expiry/freshness boundary.

Persist a concise rationale and evidence references; do not store hidden chain-of-thought. The decision must be replayable from saved state and versioned inputs.

## Memory layers
1. **Canonical ledger / structured state:** PostgreSQL or approved transactional store for balance, actual fills, fee events, strategies, versions, gate results and audit events. This is the source of truth.
2. **Feature/event history:** time-stamped raw/canonical observations and frozen feature snapshots for replay, backtest and post-mortem.
3. **Research/semantic memory (optional):** summaries of post-mortems, strategy hypotheses, regime patterns and documentation, linked to authoritative records. Vector memory is optional and never the financial source of truth.

## Post-trade learning loop
After complete position reconciliation:
1. Compare predicted distribution and quotes with actual fill, net PnL, exitability, costs and outcome.
2. Classify outcome/failure mode using a versioned taxonomy (breakout failure, liquidity deterioration, cost-model error, security miss, stale data, execution failure, normal loss, other).
3. Record both winning and losing trades, rejected candidates and skipped opportunities with appropriate hypothetical-fill caveats.
4. Update descriptive statistics and calibration only from valid labels.
5. Generate strategy/model change proposals asynchronously.
6. Evaluate challenger with chronological walk-forward/out-of-sample tests and shadow/paper evidence.
7. Require predeclared deterioration/promotion criteria, authorized approval and rollback target before production promotion.

An individual loss does not automatically kill a strategy. Repeated/statistically meaningful deterioration may quarantine it. Model performance must be reviewed by market regime, token age, liquidity, strategy and exit policy.

## Prompt and agent security
- Treat token metadata, websites, social content, RPC/API fields and tool output as untrusted data, never instructions.
- No arbitrary code execution or unbounded tools in the decision path.
- Timeouts, malformed output, contradictions, insufficient evidence or low confidence invoke abstention/NO_TRADE.
- The model cannot enable live mode, withdraw, change signer scope or policy hard limits.
- Version code, prompt/template, model, features, data, policy and thresholds; maintain a last-approved rollback version.