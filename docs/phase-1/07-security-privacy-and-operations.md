# Security, Privacy and Operations

## Threat model
Assets include trading funds, signing capability, API credentials, session tokens, strategy configuration, trade history and operator controls. Threat actors include compromised accounts, malicious tokens/programs, poisoned market data, supply-chain compromise, prompt injection, replay/duplicate requests, provider outages and internal mistakes.

## Authentication and authorization
- Require authenticated sessions for all protected pages and APIs.
- Prefer established identity/session libraries and secure, HttpOnly, SameSite cookies where applicable.
- Enforce authorization server-side for every operation; never rely on hidden buttons or client-side checks.
- Protect state-changing routes against CSRF where relevant and apply rate limits.
- Require strong authentication and step-up verification for enabling live mode, altering risk limits or changing signer configuration.
- Log access and sensitive configuration changes without logging credentials or secrets.

## Signer isolation
- The LLM and dashboard never receive seed phrases, private keys or unrestricted signing methods.
- Keep signer in a separate process/service or managed key system, with minimum permissions and auditable requests.
- Accept only typed trade intents produced by the trusted execution service and revalidate them at signing time.
- Restrict supported programs, tokens/pools, amount, slippage, transaction size, fee cap, destination and expiry/freshness according to policy.
- Reject opaque, unexpected or policy-incompatible transactions.
- No withdrawal or arbitrary transfer function is exposed to the agent.
- Define key rotation, backup/recovery, compromise response and signer outage behavior before mainnet release.

## Secret management
- Keep API keys and secrets out of source control, prompts, browser bundles, test fixtures, logs and generated reports.
- Use environment-specific secret stores and least-privilege credentials.
- Separate development, paper and live credentials; use no production secret in development.
- Rotate/revoke leaked keys quickly; scan history and CI artifacts.

## LLM/agent safety
- Treat token metadata, website text, social content, API fields and tool output as untrusted data, never instructions.
- Apply typed schemas and allowlists to model outputs.
- The model cannot change risk limits, permissions, release gates, signer policy or operating mode.
- Require deterministic validation after every model recommendation.
- Record model name/version, prompt/template version, input snapshot references and parsed output; minimize or redact sensitive content.
- Timeout or abstention means no trade, not an automatic fallback buy.

## Operational fail-safe
- Global kill switch stops new entries.
- Separate exit/recovery policy covers existing positions if the system is halted.
- On stale data, RPC disagreement, risk-service failure, signer failure, unknown transaction state or abnormal slippage, block new entries.
- Define alert severity, on-call/owner contact and escalation steps.
- Document transaction reconciliation and recovery from process restart, duplicate events and partial fills.
- Back up ledger/policy state and periodically verify restore procedures.

## Security assurance baseline
Use OWASP ASVS as a web/API verification checklist and NIST SSDF as a secure-development process reference. Determine required verification level and controls in Phase 1; do not claim compliance until tested and reviewed.

## Incident playbooks
Document token rug/liquidity emergency, compromised API key, possible signer compromise, RPC outage, database corruption, duplicate order, transaction stuck/unknown, abnormal fee/slippage, unauthorized operator action and rollback. Every incident needs timestamped evidence and post-incident review.