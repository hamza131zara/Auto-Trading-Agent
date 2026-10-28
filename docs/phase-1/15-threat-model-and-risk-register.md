# Threat Model and Initial Risk Register

## Assets
Trading capital; signer key; API keys; operator session; risk configuration; trade ledger; model/strategy integrity; provider credentials; release artifacts and deployment controls.

## Trust boundaries
1. Browser ↔ authenticated backend.
2. External providers ↔ data normalizer.
3. Untrusted token metadata/social text ↔ decision/LLM layer.
4. Decision layer ↔ deterministic Risk Governor.
5. Execution service ↔ signer.
6. Application ↔ database/queue/secret manager.
7. CI/build pipeline ↔ release environment.

## Threats and required mitigations
| Threat | Potential impact | Required mitigation / test |
|---|---|---|
| Stolen operator session | Unauthorized config changes or trading | Strong auth, server-side authorization, session protection, step-up auth, audit and revocation |
| Seed/private key exposure | Direct asset loss | No secrets in app/LLM; isolated signer/KMS option, least privilege, rotation/recovery drills |
| Malicious token metadata prompt injection | Model manipulates decision | Treat all external content as data; schema-constrained output; deterministic gates; adversarial tests |
| Fake/stale/manipulated market data | Bad candidate selection | Provenance, timestamps, freshness, schema validation and source comparison |
| Rug pull/authority abuse | Loss or untradeable token | Program/extension policy, authority checks, liquidity and sellability analysis, hard rejections |
| Holder-cluster misattribution | False rejection or missed manipulation | Evidence types and confidence; avoid claiming definite ownership without proof |
| Quote/transaction mutation | Unexpected amount/program/recipient | Verify transaction contents and program allowlists at execution and signing boundary |
| Duplicate request/retry | Double buy or overspend | Idempotency, durable state machine and race-condition tests |
| RPC/provider outage | Stale decisions or unresolved transaction | Fail closed for entries, provider redundancy and reconciliation procedure |
| LLM hallucination or outage | Incorrect recommendations | Bounded schema, confidence/abstention, timeout means no trade |
| Bad strategy/model update | Degraded performance or excessive loss | Versioning, holdout tests, paper challenger, human approval, rollback |
| Database corruption | Loss of state/audit | Backups, restore tests, durable transaction records and reconciliation from chain |
| Insider/misconfiguration | Risk limits weakened | Least privilege, approval gates, immutable/audited changes and protected release configuration |
| Supply-chain dependency compromise | Code/key compromise | Lockfiles, dependency scanning, pinned versions, CI provenance and restricted build secrets |
| Emergency exit cannot fill | Greater-than-intended loss | Do not promise stop execution; exitability filters, alerts, no-new-entry kill switch and recovery/runbook |

## Initial severity posture
- Critical: possible unauthorized signing/transfer, risk-gate bypass, secret exposure, duplicate trade beyond cap, or loss of audit/ledger integrity.
- High: failure of required security data, unbounded exposure, repeated execution mismatch, compromised operator privileges.
- Medium: degraded noncritical analytics or a single optional provider outage with verified fallback.
These labels are provisional and should be tuned during threat-model review.

## Incident workflow
Detect → stop new entries → preserve evidence → classify impact → follow position recovery/exit policy → revoke compromised credentials if relevant → reconcile transactions/balances → restore from trusted state → owner review → root-cause/post-incident actions. Emergency actions themselves must be recorded.

## Required security reviews
Threat-model review before design approval; architecture/signing review before any live-capable execution code; independent authorization and signer-bypass tests before restricted mainnet pilot.