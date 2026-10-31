# Customer-Local Agent Service Workspace

Reserved for the customer-operated agent/service process. It must own local configuration and a separate local ledger/audit boundary, and it must not expose secrets to browser code, the commercial portal or an LLM.

This workspace is intentionally scaffold-only. Market ingestion, token risk, quant features, decisions, risk calculations and transaction execution remain in their canonical roadmap phases.


## Provider trust-registry startup boundary

Phase 6.46 exposes an opt-in startup composition API:

1. Parse the process environment with `parseProviderTrustRegistryConfig` from `@ata/config`.
2. Obtain the owner-reviewed signed provider-use decision envelopes through the customer's protected local configuration channel.
3. Initialize the application-managed PostgreSQL pool and pass its query client to `createProviderTrustRegistryAuthorizationRuntime` from `@ata/market-data`.
4. Inject the returned `resolveProviderUseDecision` callback into `ReadOnlyMarketDataOrchestrator`. The orchestrator awaits asynchronous authorization before any provider adapter call.

The feature defaults to disabled. When enabled, all endpoint, DNS/IP allowlist, registry identity and pinned Ed25519 root fields are required. Startup validates the root SPKI fingerprint before any database query or network request. Each matching provider/purpose attempt fetches a fresh signed registry snapshot and passes the durable PostgreSQL anti-rollback gate before the decision key is used. Any failure returns no authorization.

This README documents the integration contract only. The agent service still has no executable entrypoint, automatic polling loop, production database configuration or live collection process. Do not add production endpoints, root keys, provider-use decisions or IP allowlists to this repository. Do not expose the returned resolver's configuration, public keys or decisions to browser code or an LLM. Wallet signing, order placement and trading remain unavailable and unauthorized.


## Trust-registry provisioning preflight

Before changing the opt-in flag or delivering any trust configuration, prepare the provisioning packet outside the Git working tree and run:

```sh
npm run trust-registry:preflight -- --input /absolute/path/outside/repository/provisioning-packet.json
```

The packet must be a bounded regular JSON file outside the repository. It contains owner-reviewed metadata, evidence references and the fingerprint/configuration descriptor; it must not contain private keys, credentials, connection strings or inline key material. The CLI does not write configuration, contact a registry, resolve DNS, connect to PostgreSQL or retrieve evidence. It prints a redacted technical result only.

A `TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED` result is not an approval to provision or enable the registry. The registry-owner, security-reviewer, database-operator and service-owner approvals and all referenced evidence must be independently authenticated by the responsible humans. Registry provisioning, provider activation and trading authorization remain false.
