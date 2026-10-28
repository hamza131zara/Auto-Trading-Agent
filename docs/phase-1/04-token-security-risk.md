# Token Security and Rug-Risk Requirements

## Principle
A security score is explanatory; hard rejection rules are authoritative. No strategy, upside estimate, model confidence or LLM judgment can override a hard failure. Missing or stale data is not equivalent to a clean result.

## Evidence categories
1. Token/program identity: mint address, owning program, decimals, supply and supported token program.
2. Authorities and permissions: mint authority, freeze authority, and relevant Token-2022 extensions or hooks.
3. Transfer behavior: transfer fees, transfer hooks, permanent delegate, pause/freeze/non-transferability behavior and other applicable restrictions.
4. Pool/route: pool identity, supported DEX/program, quote token, reserves, pool age, liquidity distribution and sell-route availability.
5. Holder distribution: top 1/3/5/10 concentration, concentration excluding confidently identified infrastructure addresses, deployer/creator holdings when attributable, and supply changes.
6. Wallet relationships: funding links, acquisition timing and related transaction patterns; treat clusters as probabilistic evidence, not proof of common control.
7. Liquidity and exits: liquidity trend, withdrawal velocity, buy and sell quotes, price impact, route depth and transaction simulation.
8. Market integrity: unique buyer/seller counts where reliable, repeated-wallet share, top-wallet volume share, abrupt volume bursts and other wash-trading indicators.
9. External reputation: optional provider signals as corroboration only; record source, timestamp and freshness.

## Initial hard-rejection candidates
The following are proposed gates to validate during Phase 1:
- Unsupported token program or unknown high-risk extension behavior.
- Active authority or extension that violates the accepted V1 policy.
- Sell simulation/route unavailable or estimated exit impact above the approved threshold.
- Liquidity below minimum policy or rapidly declining beyond the approved threshold.
- Material data disagreement, stale data or inability to obtain required safety evidence.
- Suspicious transfer restrictions or evidence of token-specific sell restrictions.
- Creator/deployer/connected-wallet concentration above an accepted threshold.
- Risk governor, RPC, quote, signer, simulation or execution health failure.

Thresholds must be empirically researched and explicitly approved; do not invent them during implementation.

## Holder concentration
Report top-holder concentration at multiple ranks and separately report known LP/burn/treasury/exchange/infrastructure classifications only where labels have credible sources. Do not blindly subtract unlabeled addresses. Compute concentration metrics on transparent address sets and note uncertainties.

HHI may be calculated as the sum of squared holder-share fractions, with the chosen holder universe and treatment of unknown holders specified. Wallet clustering is supplementary evidence and must not be presented as definitive attribution.

## Scoring vs. gates
Keep separate outputs:
- Hard-gate status: Pass, Fail, Unknown, Stale or Not Tested.
- Risk findings with severity, evidence and source.
- Optional normalized scores for ranking eligible candidates.
An aggregate score cannot convert Fail/Unknown into Pass.

## False positives and false negatives
Label test data where possible and measure precision, recall, false rejection rate and missed-risk rate. A provider's token label is not ground truth. Preserve snapshots to support later review.

## Emergency triggers
Possible triggers include a sudden liquidity collapse, new dangerous authority/extension observation, abnormal connected-wallet selling, sell-route disappearance, unsupported token behavior, RPC disagreement or a material execution anomaly. Define thresholds and actions in a reviewed policy. Exit attempts may fail; emergency logic is not a guarantee of liquidity.