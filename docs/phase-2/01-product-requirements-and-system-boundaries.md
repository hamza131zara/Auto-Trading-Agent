# Phase 2.1 — Product Requirements and System Boundaries

**Status:** Baseline drafted; numeric/commercial decisions remain open.

## Product mission

Build a Solana-only, self-hosted autonomous DEX agent that discovers candidates, evaluates evidence and risk, decides whether to trade, executes only policy-approved spot swaps through a constrained signer, reconciles outcomes, and continues only after the prior position is closed and reconciled. The dashboard must explain actual state, evidence and limitations.

The business has two separate operating contexts: (a) selling licensed software and (b) potentially operating a proprietary agent. A company-operated instance must have separate infrastructure, capital, wallet/signer, credentials, ledger, risk policies and audit history from every customer instance.

## Actors and boundaries

- **Prospect:** public information, quote/consultation request only; no operational access.
- **Customer/licensee:** registration, terms, authorized download, own runtime, documentation, onboarding and support.
- **Vendor owner/admin:** quote/invoice, settlement review, registration approval, license/release administration and bounded support.
- **Customer runtime:** local market evaluation, deterministic policy checks, constrained execution, ledger and audit trail.
- **Signer:** independent validation of transaction scope, permissions and approved risk rules; never exposes signing secrets to the LLM or portal.
- **External providers:** RPC/data/DEX route, optional LLM, hosting, email and scheduling. Provider availability/terms are not assumed.

## Functional requirements

- **PR-001 Discovery:** persist candidate identity, source provenance, timestamps, freshness and evidence.
- **PR-002 Decisions:** record versioned scores, hard-gate results, reason codes, strategy/config/rule versions and missing/unknown inputs.
- **PR-003 No-trade:** NO_TRADE and RESEARCH_MORE are valid; no forced trade frequency.
- **PR-004 Veto:** a failed mandatory security/risk gate cannot be overridden by rankings or LLM output.
- **PR-005 Position cap:** one open or unresolved position per instance/portfolio; unknown execution state blocks new entry.
- **PR-006 Reconciliation:** preserve intent, validation, simulation, submission, confirmation, unknown/partial result, fills, fees, exits and final reconciliation.
- **PR-007 Accounting:** distinguish actual from estimated, gross from net, realized from unrealized and provisional from reconciled.
- **PR-008 Safety:** no arbitrary withdrawals, secret exposure or autonomous alteration of hard limits.
- **PR-009 Fail-safe:** missing/stale/contradictory critical evidence cannot be silently treated as safe.
- **PR-010 Emergency controls:** pause/stop state is auditable and prevents new entries as specified; it does not guarantee liquidation.
- **PR-011 Portal:** quote request, invoice status, registration/email/MFA/terms, owner/admin approval, signed license, authorized releases, setup docs and support.
- **PR-012 Payments:** activation requires independently verified settlement via an approved route. Card/crypto paths remain disabled pending clearance.
- **PR-013 Isolation:** portal never hosts cross-customer trade execution or stores wallet secrets; each runtime has separate database, config, credentials and ledger.
- **PR-014 Onboarding:** show setup docs and a booking link fed by real availability; confirmed meetings include timezone and Google Meet details.
- **PR-015 UI:** support light and dark themes plus accessible, responsive desktop/tablet/mobile layouts.
- **PR-016 State semantics:** distinguish PASS, WARN, FAIL, UNKNOWN, NOT_TESTED, BLOCKED and unavailable states. Unknown checks must not improve scores or coverage.

## Non-functional requirements

- **Security:** least privilege, MFA for privileged roles, signed artifacts, secret redaction, audit logging and secure defaults.
- **Isolation:** no shared customer wallet, database, position lock or trading worker.
- **Reliability:** safe handling of provider timeouts, stale feeds, RPC disagreement, process restart and unknown transaction outcomes.
- **Observability:** structured timestamped logs, correlation IDs and dependency status without secrets.
- **Accessibility:** keyboard navigation, visible focus, semantic labels, sufficient contrast and no color-only status.
- **Responsiveness:** core status, risk alerts, position state and emergency controls stay usable on narrow screens; contained table scrolling is acceptable where deliberate.
- **Explainability:** show evidence for act, wait, reject and no-trade decisions; do not imply unvalidated probability from an arbitrary score.
- **Updates:** signed/checksummed releases, compatibility checks, backup and documented rollback.

All requirements must map to acceptance tests before Phase 2 exit. TBD numeric thresholds are not production defaults.
