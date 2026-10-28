# Data Dictionary and Audit Events

This is a proposed logical model; physical schema is designed in Phase 2 and migrations are implemented only after approval.

## Core entities
- **Token:** chain, mint address, token program, decimals, metadata source, supported/unsupported status.
- **Pool:** pool address, DEX/program, base/quote mints, creation time estimate, reserves/liquidity snapshots.
- **MarketSnapshot:** observation time, source event time, price, volume windows, transaction counts, price changes, liquidity, freshness and provenance.
- **HolderSnapshot:** time, holder universe, top-N shares, labels and unknown-label fraction.
- **WalletClusterEvidence:** wallets, relationship type, evidence source, confidence and observation window; never treat cluster attribution as certainty.
- **SecurityAssessment:** individual checks, statuses, evidence references, severity, policy version and decision.
- **FeatureSnapshot:** feature schema/model version and feature values computed from information available at decision time.
- **Strategy / StrategyVersion:** logic/config hash, market regime, entry, invalidation, exit profile, status and approval history.
- **CandidateDecision:** candidate snapshot, eligible strategies, scores, uncertainty, selected decision and reason codes.
- **TradeIntent:** idempotency key, token/pool, side, amount, maximum slippage/impact, policy version, expiry and risk decision.
- **ExecutionAttempt:** quote, simulation, transaction signature, retry/replace linkage, status, fees and provider response.
- **Position:** reconciled token amount, cost basis method, entry lots, current risk state and target profile.
- **ExitEvent / Fill:** partial/full quantities, quote, actual proceeds, fees, reason and confirmed state.
- **RiskEvent:** circuit breaker, rule, observed value, threshold/policy version and action.
- **ModelPrediction:** outcome probabilities, calibration/model version, feature snapshot and uncertainty.
- **PostTradeReview:** predicted vs actual, attribution, proposed lessons and reviewer status.
- **AuditEvent:** actor/service, timestamp, action, object identifier, before/after references, correlation ID and integrity metadata.

## Required provenance fields
Every externally sourced observation should include source/provider, request or event time when available, received time, canonical identifiers, schema/version, freshness state and raw-payload reference or selected raw fields. Store UTC timestamps and explicit units.

## Event ledger
Record candidate discovered, assessment completed, candidate rejected, strategy selected, risk passed/failed, quote received, simulation result, intent approved/rejected, signing request, transaction submitted, transaction confirmed/failed/unknown, partial fill, exit triggered, exit attempted, fill reconciled, position closed, circuit breaker activated/reset, strategy version proposed/validated/promoted/quarantined and operator configuration changed.

## Integrity and idempotency
- Each logical decision and order attempt has a unique ID and idempotency key.
- Retries must not create an unintended second position or duplicate swap.
- Store transaction signatures and confirmation/reconciliation state.
- Critical audit records should be append-only or tamper-evident; define retention and backup policy.
- Corrections should be new events referencing earlier records, not silent deletion of history.

## Financial ledger
Keep raw base-unit amounts and exact token decimals. Reconcile SOL balance changes, token amounts, network/priority fees, swaps and any extra fees. Distinguish estimated, quoted, submitted, confirmed and realized values; never silently replace estimates with actuals or vice versa.
