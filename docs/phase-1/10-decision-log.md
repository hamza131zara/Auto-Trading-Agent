# Decision Log

This log records product decisions and unresolved questions. Changes to the frozen roadmap require explicit owner approval.

## Accepted baseline decisions
| ID | Decision | Status |
|---|---|---|
| D-001 | Use Roadmap v1.0 dated 20 October 2026 as the frozen project baseline. | Accepted by owner in conversation |
| D-002 | V1 targets Solana spot DEX only. | Accepted baseline |
| D-003 | Limit to one open position globally. | Accepted baseline |
| D-004 | Deterministic security and risk rules have veto authority over AI/LLM output. | Accepted baseline |
| D-005 | LLM/agent never receives private keys/seed phrases and cannot initiate unrestricted signing. | Accepted baseline |
| D-006 | Start with documentation approval, then design, build, testing, paper trading and controlled launch. | Accepted baseline |
| D-007 | Quick-compound, trend-capture and high-upside-runner are policies to test, not presumed winners. | Accepted concept |
| D-008 | Kelly sizing is research-only until empirically tested and bounded by independent risk caps. | Accepted concept |

## Proposed decisions needing owner confirmation
| ID | Proposal | Status / question |
|---|---|---|
| P-001 | One operator/admin account for V1. | Confirm during requirements review |
| P-002 | Stop new entries and notify owner when a portfolio milestone is hit. | Confirm expected target-hit workflow |
| P-003 | Initial +6% net full-exit policy is a benchmark, not mandatory for every trade. | Confirm exit-profile policy |
| P-004 | No live trading during documentation, design, build and initial validation phases. | Confirm no exceptions |
| P-005 | Hard rejection if a required security field is unknown/stale. | Set exceptions, if any, only after threat review |
| P-006 | Use a modular monolith initially unless load/reliability testing justifies service separation. | Architecture decision pending |
| P-007 | PostgreSQL is canonical transactional/audit store. | Validate workload and durability needs |
| P-008 | Provider redundancy for safety-critical data, with source provenance and disagreement gates. | Select providers after source review |

## Research questions
- Which token programs and extensions are supported or rejected in V1?
- What measurable thresholds apply to liquidity, price impact, holder concentration, cluster evidence, token age and volume quality?
- Which data sources supply each required field, at what latency/rate limit/cost, and with what licensing?
- Which Jupiter Swap V2 route and transaction workflow is appropriate, and what restrictions are required at signing?
- When should a partial-exit runner be enabled, and what is the maximum residual exposure?
- How are price, equity, costs and target milestones valued when assets are volatile or positions are partially exited?
- What exact drawdown, loss, slippage, transaction-failure and stale-data thresholds trigger entry halt?
- What sample size and performance evidence are sufficient for a strategy/model promotion?
- What jurisdictional, tax and platform terms should be reviewed before operating or offering the product?

## Change protocol
Every decision change records old value, new value, rationale, supporting evidence, affected requirement/test IDs, owner approval and date.

## Additional workflow clarification
| ID | Decision / clarification | Status |
|---|---|---|
| P-009 | Specify a fully automated discovery-to-next-candidate cycle: discover, screen, assess, select, risk-check, quote/simulate, execute only in an authorized mode, monitor, exit, reconcile, record learning evidence, check portfolio goals, then scan again. | Added to Phase 1 draft requirements; owner approval pending |

The workflow clarification elaborates the already frozen automation concept and does not authorize live trading or change the roadmap's phase order. See [16-autonomous-trading-workflow.md](16-autonomous-trading-workflow.md). In particular, the next position cannot start until the prior one is fully reconciled and closed, and the agent must pause when no candidate qualifies or a safety/operational gate fails.
