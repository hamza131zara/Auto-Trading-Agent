# Phase 3.1 — Threat Model and Trust Boundaries

**Status:** Initial threat model drafted; risks and mitigations require design review and verification.  
**Scope:** V1 Solana spot DEX, self-hosted customer-isolated runtime and central commercial/license portal.

## 1. Security objectives

- Protect customer assets and prevent an unauthorized, unintended, duplicated or out-of-policy transaction.
- Keep signer secrets under the customer's control and inaccessible to the central portal, browser UI, LLM, analytics and support workflow.
- Prevent customer-to-customer data, credential, position-state or runtime crossover.
- Preserve integrity of transaction intent, signer decisions, execution records and realized-PnL reconciliation.
- Protect license entitlement keys, release-signing keys, admin functions and verified-payment decisions.
- Fail safely when inputs are missing/stale, providers disagree, the portal is unavailable or a transaction result is uncertain.
- Make sensitive actions attributable, reviewable and recoverable without logging secrets.

## 2. System context and trust-boundary sketch

The portal/licensing plane and each customer runtime are separate trust domains. The runtime is customer-operated and must not depend on a remote portal command to enforce local risk limits.

~~~mermaid
flowchart LR
  Prospect[Prospect / Customer] -->|HTTPS, scoped account actions| Portal[Central License Portal]
  Admin[Vendor Owner / Admin] -->|MFA + least privilege| Portal
  Portal -->|Quote, verified settlement record, approval| License[License Issuer]
  License -->|Signed scoped entitlement| CustomerHost[Customer-controlled Host]
  Release[Release Pipeline / Signing Boundary] -->|Signed manifest + artifact| CustomerHost

  subgraph CustomerRuntime[Isolated Customer Runtime]
    UI[Local Dashboard] --> API[Local Authenticated API]
    API --> Agent[Agent Orchestrator]
    Market[RPC / DEX / Data Providers] --> Data[Data Adapters + Freshness Gate]
    Data --> Agent
    Agent --> Risk[Deterministic Risk Governor]
    AI[Advisory AI / LLM] -->|Schema-validated proposal only| Agent
    Agent --> Intent[Bounded Transaction Intent]
    Intent --> Signer[Policy-Enforcing Signer]
    Risk --> Signer
    Signer -->|Signed approved transaction| RPC[Customer RPC / Solana]
    RPC --> Reconcile[Execution Reconciliation]
    Reconcile --> Ledger[Local Ledger + Tamper-evident Audit]
    Agent --> Ledger
  end

  style Portal fill:#1f2937,stroke:#60a5fa,color:#fff
  style Signer fill:#123b3d,stroke:#34d399,color:#fff
  style Risk fill:#41252c,stroke:#fb7185,color:#fff
~~~

The diagram is a logical boundary model, not a deployment topology or proof of a secure implementation. The exact transport, process/container isolation, host requirements and signer backend remain design decisions.

## 3. Assets and security properties

| Asset | Required property | Primary threat |
|---|---|---|
| Customer signing key / signer authorization | Confidentiality, integrity, constrained use | Theft or arbitrary signing |
| Customer funds and token holdings | Integrity and loss containment | Malicious or unintended transaction |
| Transaction intent and policy decision | Authenticity, integrity, traceability | Intent substitution or bypass |
| Customer ledger and audit trail | Integrity, availability, provenance | Tampering, deletion, false PnL |
| RPC/market observations and quotes | Freshness, provenance, bounded trust | Stale/manipulated data or fake liquidity |
| License signing private key | Confidentiality and constrained use | Forged lifetime entitlements |
| Release-signing private key and artifact pipeline | Integrity and attributable release | Malicious/tampered update |
| Admin identity and MFA recovery | Authenticity, least privilege | Account takeover or fraudulent approval |
| Invoice/payment and license state | Integrity and separation of duties | Fake payment evidence or premature activation |
| Customer credentials and local configuration | Confidentiality and scope isolation | Secret leakage or customer crossover |
| Backup and recovery material | Confidentiality, integrity, recoverability | Ransomware, loss or poisoned restore |

## 4. Adversary and failure model

Include deliberate attackers and accidental failures:
- Internet attackers attempting credential stuffing, session theft, exploitation, injection or administrative abuse.
- Malicious or compromised customer, employee, contractor, dependency, build action or release artifact.
- Prompt-injection content, malicious token metadata and adversarial model output.
- Compromised, dishonest, stale or inconsistent RPC/market-data/DEX quote sources.
- Attackers manipulating liquidity, token authority state, holder distribution or exitability evidence.
- Payment impersonation, forged receipt, replayed invitation or administrator collusion.
- Host compromise, malware, stolen customer credentials or insecure backup access.
- Network/provider outages, clock drift, process crash, partial submission, RPC disagreement and uncertain transaction confirmation.

Trust is not granted merely because data is on-chain, an endpoint is popular, an AI output is high-scoring or a payment notification appears authentic.

## 5. Threat register

Severity is provisional design triage; it must be re-evaluated after architecture choices and tested mitigations. “Control” below is a requirement, not a claim of implemented protection.

| ID | Threat / scenario | Inherent severity | Required mitigation | Residual state |
|---|---|---|---|---|
| TM-001 | Private key or signing capability is stolen from the host, process, CI, logs or support session | Critical | Isolated constrained signer, least privilege, protected key backend, secret scanning/redaction, rotation/revocation and incident playbook | Open until key storage/backend and host threat model are approved |
| TM-002 | AI output or prompt injection induces an arbitrary swap/transfer or attempts to bypass rules | Critical | Advisory-only model, strict output schema, independent deterministic policy, transaction-intent allowlist and signer revalidation | Open until policy enforcement is tested |
| TM-003 | RPC/quote/data manipulation or stale observations induce unsafe entry/exit | Critical | Source provenance/freshness, cross-checking for critical inputs, quote expiry, min-output/impact constraints and fail-closed behavior | Open pending provider and numeric thresholds |
| TM-004 | Transaction is submitted but outcome is unknown; restart causes a duplicate entry | Critical | Durable intent/idempotency key, transaction signature tracking, reconciliation state machine and block-new-entry invariant | Open until recovery tests pass |
| TM-005 | Customer A reaches Customer B's records, credentials, signer or runtime | Critical | Physically/logically separate deployments, per-installation credentials, no shared trading database/worker, authorization tests | Open until deployment/isolation review |
| TM-006 | Portal/admin compromise creates forged license or alters customer release entitlement | High | Separate license-signing key, protected administration, MFA, dual control for high-impact actions, signed scoped entitlements and audit | Open pending key and admin design |
| TM-007 | Forged receipt, unconfirmed transfer or webhook causes free license activation | High | Independently confirmed cleared settlement, independent approval and license issuance, replay-resistant state transitions | External payment path is not approved |
| TM-008 | Tampered package, compromised dependency or CI pipeline installs malicious code | Critical | Protected CI, dependency pinning/review, secret-scoped runners, SBOM/provenance, signed artifacts, checksum/signature validation and rollback | Open pending release pipeline design |
| TM-009 | Admin account/session or MFA recovery is hijacked | High | Strong MFA, reauthentication for high-impact actions, recovery controls, rate limits, alerting and immutable audit | Open pending identity design |
| TM-010 | API key, session token, private key or PII appears in logs/diagnostic bundle | High | Structured allowlisted logs, centralized redaction, safe defaults, test fixtures and customer preview of support bundle | Open pending tests |
| TM-011 | Insecure remote license revocation or portal outage interrupts risk controls or forces a position change | Critical | Local deterministic risk engine, signed entitlement and defined grace policy; no remote arbitrary position command or hidden forced sell | Offline policy is a Phase 3 decision |
| TM-012 | Admin payment confirmation and license issuance are abused or collusively bypassed | High | Separation of payment review and license issuance; recorded independent reason; audited overrides with bounded access | Open pending admin workflow design |
| TM-013 | DNS/network/endpoint confusion or user-controlled URL causes server-side request forgery or secret egress | High | Outbound destination allowlists, egress policy, private-address/link-local denial, redirect revalidation, timeouts and secret-free errors | Open pending portal/runtime endpoint inventory |
| TM-014 | Backup theft, corruption, rollback or restore from malicious data | High | Encrypt backups, restrict access, checksum/integrity checks, retention policy, restore drills and ledger reconciliation | Open pending recovery design |
| TM-015 | Excessive permissions/delegations, token approvals or unknown programs permit unintended asset movement | Critical | Deny-by-default instruction/program policy, decoded instruction inspection, explicit amount/recipient constraints and no arbitrary approvals/withdrawals | Open pending program allowlist/adapter validation |
| TM-016 | License or software version downgrade reintroduces a known vulnerability | High | Signed version metadata, monotonic release policy where feasible, explicit downgrade authorization and audit | Open pending update policy |

## 6. Non-negotiable trust rules

- The portal does not host the customer trading runtime and cannot command a live customer position.
- The LLM receives no private key, seed phrase, signing token or raw signer authority.
- A signer accepts bounded intents only; it does not accept arbitrary serialized transactions for blind signing.
- Unknown, stale or contradictory critical evidence is not treated as safe.
- The runtime preserves a durable execution state and blocks a new entry while any order/position is unresolved.
- Customer data and credentials never cross installation boundaries.
- A payment record, license state, UI button or remote API response is not a substitute for a local deterministic transaction-policy check.
- Live trading remains disabled until numeric policy, signer, testing, external review, paper/shadow and staged release gates are satisfied.

## 7. Phase 3 open questions

- Which customer-controlled signing backend is acceptable for unattended use and supportable on the selected platforms?
- What isolation level is required on the host: process, service account, container, VM or combination?
- Which DEX programs, instruction variants, token extensions and transaction types are explicitly supported/denied?
- What are the exact customer-data retention, telemetry opt-in and support-artifact policies?
- Which roles and independent approvals are required for payment reversals, license issuance, release signing and security recovery?
- What exact license-online/offline/grace and revocation policy preserves local risk behavior without creating a remote kill switch?

Each answer must be recorded as a decision with rationale, owner, date, affected requirement and verification evidence.
