# Phase 4.2 — Information Architecture and Navigation

**Status:** Initial IA baseline. The central commercial portal and self-hosted customer runtime remain separate products/trust domains.

## 1. Product surfaces

### A. Public website
- Home / Product overview
- How it works
- Security and self-hosted deployment
- Features and limitations
- Pricing and license terms summary
- Documentation preview / prerequisites
- Request a license / request a quote
- Optional pre-sales consultation
- Contact, privacy, terms and risk disclosures

The CTA is “Request a License” or “Request a Quote”; do not promise instant unrestricted access, guaranteed profits or live trading before launch gates pass.

### B. Customer commercial portal
- Overview / onboarding progress
- Quotes and invoices
- Payment status (pending/verification/settled/rejected/refunded/disputed)
- Registration, email verification and MFA
- License and installation identity
- Authorized downloads, checksums and release notes
- Installation/setup documentation
- Book Setup Session (real calendar availability and confirmed meeting details)
- Support requests and sanitized diagnostic uploads
- Account security and session management

Portal visibility and controls follow server-enforced roles and license status. Payment verification is separate from license issuance. No wallet secret or arbitrary signing action is available in this portal.

### C. Self-hosted agent runtime
Primary navigation on desktop:
1. Overview / Cockpit
2. Markets & Discovery
3. Agent Brain / Decisions
4. Positions & Execution
5. Risk Center
6. Performance & Evaluation
7. Configuration
8. Integrations & Health
9. Logs, Audit & Recovery
10. License, Documentation & Support

On mobile, show Overview, Markets, Position/Activity and a clearly labelled More menu; emergency/paused/unknown state remains discoverable and reachable.

## 2. Critical cross-surface flows

### Prospect to license
Public product → request quote → owner/admin qualification → versioned quote/invoice → approved-route settled payment → single-use invitation → registration/email/MFA/terms → owner/admin approval → signed scoped license → authorized download.

Every step has its own state. A payment receipt screenshot is not settlement proof. Card and crypto methods stay hidden/disabled until specifically approved.

### Licensee to guided setup
License overview → prerequisite checklist → download/verify package → installation documentation → customer selects an actual available booking slot/timezone → confirmation with Meet details → guided setup → sanitized completion checklist → unresolved issues/support.

Never invent availability or advertise a placeholder booking URL. The customer inputs secrets in their own environment.

### Runtime decision lifecycle
Market evidence → candidate safety checks → strategy/agent proposal → deterministic risk governor → no-trade/research-more or bounded intent → signer policy decision → submission → confirmation/unknown state → reconciliation → ledger/audit update.

Every step has a distinct status, timestamp and reason/evidence. An unknown transaction blocks a new entry.

### Incident / risk interruption
Visible alert → reason/details → stop new entries/pause where defined → reconcile current state → recover provider/runtime if safe → audit event and recovery checklist. The UI must not imply that pause equals guaranteed liquidation.

## 3. Navigation behavior

- Stable left sidebar on wide desktop; collapsible sidebar at reduced desktop/tablet widths.
- Breadcrumbs or clear page titles for deep configuration/record pages.
- Global search supports only the resources that exist; it must not imply live token search when data is stale/unavailable.
- Current runtime mode, health and risk-critical state are global contextual indicators.
- Show version, data freshness and environment in a compact status area.
- Destructive and financial actions use clear verbs and confirmation dialogs.
- Theme switch belongs in top-level account/preferences area and is available in every major surface.
- Do not surface controls for features that are not configured/approved; use explicit “Not configured”, “Blocked” or “Unavailable” states with reason.

## 4. Page hierarchy by user intent

| Intent | Primary destination | Secondary task |
|---|---|---|
| Is the agent safe/healthy? | Overview/Cockpit | Integrations & Health |
| Why did the agent choose or reject a coin? | Agent Brain/Decisions | Markets & Discovery |
| What is the exact current order/position state? | Positions & Execution | Logs/Audit |
| Why is trading blocked? | Risk Center | Candidate evidence / configuration validation |
| How did performance calculate? | Performance & Evaluation | Reconciled ledger detail |
| How do I install or update? | License, Docs & Support | Release verification / recovery guide |
| How do I book guided setup? | Portal Setup Center | Availability-based booking |
| What can I buy and what is included? | Public pricing/quote | License agreement/consultation |

## 5. Architecture design rules

The commercial portal is not embedded in a way that shares the local trading database. Customer runtime pages do not expose central admin/payment actions. A future shared design system can provide shared visual components, but authentication, data, permissions and API contracts remain separate. All screens must represent actual backend state and never authorize actions based on UI-only checks.
