# Phase 2.7 — Requirements Traceability and Acceptance Matrix

**Status:** Baseline completed for design/security handoff.  
**Important:** The IDs below define future automated/manual acceptance evidence. They do not claim those implementation tests have already been run.

## How to use this matrix

Every requirement maps to a verification ID, a verification layer and a passing result. Phase 5 and later phases implement the tests against actual code. Phase 2 is accepted when the requirements and expected outcomes are unambiguous, owner-facing unresolved decisions are recorded, and execution-affecting TBDs are explicitly excluded from executable scope.

## Product requirements mapping

| Requirement | Verification ID | Layer | Passing result |
|---|---|---|---|
| PR-001 Candidate data provenance/freshness | AT-DATA-001 | Unit/integration | Every candidate records identity, source, observation/retrieval time and freshness; stale or missing data is visible. |
| PR-002 Versioned decision evidence | AT-DEC-001 | Unit/integration | Decision includes scores, hard-gate outcomes, reason codes and applicable rule/config/model versions. |
| PR-003 NO_TRADE / RESEARCH_MORE | AT-DEC-002 | State/integration | Both outcomes are valid terminal decisions for a candidate and do not trigger an order. |
| PR-004 Hard-gate veto | AT-SAFE-001 | Security/integration | Any mandatory gate failure blocks execution regardless of rank, strategy or LLM recommendation. |
| PR-005 Single unresolved position | AT-EXEC-001 | Concurrency/recovery | Concurrent/restarted attempts cannot open a second position while one is open or unresolved within the same instance/portfolio. |
| PR-006 Transaction lifecycle | AT-EXEC-002 | Integration/recovery | Intent, validation, simulation, submission, confirmation, unknown/partial states and reconciliation are distinguishable and recoverable. |
| PR-007 PnL truthfulness | AT-LEDGER-001 | Unit/integration | Actual/estimated, gross/net, realized/unrealized and provisional/final values remain distinct. |
| PR-008 Secret and transaction scope | AT-SEC-001 | Security | No LLM/portal/support path exposes signer secrets or provides arbitrary withdrawal/signing authority. |
| PR-009 Fail-safe unknown data | AT-SAFE-002 | Unit/integration | Missing, stale, contradictory, blocked or non-evaluable evidence never silently becomes a pass. |
| PR-010 Pause/emergency actions | AT-CTRL-001 | Integration/E2E | Pause/stop prevents new entries according to the approved state machine; UI shows result and does not promise liquidation. |
| PR-011 Commercial portal capabilities | AT-PORTAL-001 | Portal E2E | Quote, invoice status, registration, MFA, approval, license/download, docs and support have distinct permissions/states. |
| PR-012 Verified payment activation | AT-BILL-001 | Portal integration | Screenshot, customer claim, unverified webhook or unconfirmed chain transaction cannot independently activate a license. |
| PR-013 Customer isolation | AT-ISO-001 | Security/integration | Customer runtime, DB, position state, signer, credentials and audit trail do not cross installation boundaries. |
| PR-014 Real booking/onboarding | AT-ONBOARD-001 | Portal E2E/manual | Only actual available slots can be booked; timezone and confirmed Meet details are unambiguous; setup checklist is available. |
| PR-015 Themes and responsive UI | AT-UI-001 | Component/E2E/visual | Light/dark modes work throughout the UI; major screens remain usable on desktop/tablet/mobile; no global horizontal overflow. |
| PR-016 Status semantics | AT-UI-002 | Unit/component | PASS/WARN/FAIL/UNKNOWN/NOT_TESTED/BLOCKED/unavailable remain distinct; color is not the only signal; unknown checks do not increase score. |

## Non-functional and commercial acceptance mapping

| Area | Verification IDs | Passing result |
|---|---|---|
| Authentication and privileged access | AT-IAM-001 | Privileged actions require the configured MFA/authorization controls; least-privilege role boundaries are enforced. |
| Auditability | AT-AUDIT-001 | Sensitive administrative and runtime actions record timestamp, actor, target, reason/status and correlation identity without secrets. |
| Health and observability | AT-OBS-001 | Dependency health, data freshness, provider errors and sanitized diagnostics are actionable and time-stamped. |
| Signed release and rollback | AT-REL-001 | Release authenticity is checked; tampered artifacts are rejected; supported rollback/recovery is documented and tested. |
| Backup/recovery | AT-REC-001 | A backup can be restored and checked; unknown transaction state survives restart safely. |
| Theme/accessibility | AT-A11Y-001 | Keyboard access, visible focus, semantic labels and sufficient contrast pass in both themes. |
| Responsive layout | AT-RESP-001 | Core health/risk/position/stop state remains discoverable and usable at agreed viewport sizes. |
| Secrets in diagnostics | AT-SEC-002 | Test secrets are redacted from logs/support bundles; the customer reviews sanitized diagnostics before sending. |
| License state | AT-LIC-001 | Invite, payment verification, registration/MFA, terms and admin approval are independent required predicates before activation. |
| Booking support | AT-BOOK-001 | Test verifies timezone display, slot reservation conflict behavior, confirmation, configured reminders and cancellation/rescheduling. |

## Quantitative and evaluation acceptance mapping

| Contract | Verification ID | Passing result |
|---|---|---|
| Candidate data and signal units | QAT-DATA-001 | Every signal declares unit, observation window, provenance and freshness; missing values stay unknown. |
| Evaluable coverage | QAT-SCORE-001 | UNKNOWN, NOT_TESTED, BLOCKED and other non-evaluable states do not count as evaluated points or inflate coverage; execution status is separately recorded. |
| Net PnL | QAT-PNL-001 | Realized net result includes actual fills and attributable execution costs under the declared formula. |
| Zero versus omitted margin | QAT-PNL-002 | Gross margin of 0% is treated as an explicit zero and is not confused with omitted input. |
| Unknown transaction blocks entry | QAT-EXEC-001 | New entry is denied until the previous order/position is resolved and reconciled. |
| Risk veto authority | QAT-RISK-001 | Strategy rank and LLM output cannot bypass hard risk/security controls. |
| Kelly research-only | QAT-KELLY-001 | Kelly output cannot authorize execution or exceed independent size/exposure/drawdown caps; invalid/uncertain inputs fail safely. |
| Backtest integrity | QAT-BT-001 | Tests use time-aware splits, avoid leakage, record data/config versions and model realistic costs and adverse fills. |
| Mode separation | QAT-REPORT-001 | Backtest, OOS, paper, shadow and live evidence are separately labelled and never silently combined. |
| Strategy comparison | QAT-STRAT-001 | Candidate policies are compared with a stated benchmark, comparable costs, windows, sample sizes and regime context. |
| Risk parameter readiness | QAT-GATE-001 | Any execution-affecting TBD prevents an executable mode from being enabled. |
| No profitability claim | QAT-REPORT-002 | Reports state sample sizes and limitations and make no unsupported return/win-rate guarantees. |

## Customer portal and runtime acceptance scenarios

1. A prospect can request a quote without accessing operational runtime controls.
2. A pending/unverified payment cannot create an active license. Confirmed settlement is audited separately from license issuance.
3. Invitation reuse/expiry and unauthorized admin actions are denied and audited.
4. A licensed customer can download only authorized releases and verify the published checksum/signature.
5. One customer cannot view another customer's credentials, positions, wallet address where private, logs, data or license administration.
6. A customer can follow the setup guide and select a real available setup slot. The session outcome checklist is recorded without collecting secrets.
7. The runtime continues to enforce local safety controls through a licensing-portal outage under the eventual approved entitlement/grace policy.
8. Theme switch and viewport changes never alter runtime mode, permissions or risk configuration.
9. Unknown transaction state, stale critical data, provider outage and failed risk checks are visible and fail closed according to policy.
10. No path enables mainnet order placement before the separate security, quantitative, test, shadow and release approvals.

## Verification status and evidence

- **Phase 2 specification status:** acceptance expectations defined.
- **Implementation verification status:** not run; code implementation and executable tests belong to later canonical phases.
- **Evidence to retain later:** test run ID, code commit, build/version, environment, sanitized logs, test report and reviewer/approval for security-sensitive cases.
- **No result may be marked PASS based on this table alone.** A PASS requires test execution and retained evidence.
