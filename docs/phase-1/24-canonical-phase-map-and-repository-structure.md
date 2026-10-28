# Canonical Phase Map and Proposed Repository Structure

**Authority:** the uploaded and approved Roadmap v1.0 DOCX/PDF, dated 20 October 2026.  
**Purpose:** make the repository companion match the source roadmap's phase names and order. This is a correction to an abbreviated summary, not a change to the frozen scope.

## Canonical phase order

| Phase | Canonical name | Main output / exit gate |
|---:|---|---|
| 0 | Project governance and scope freeze | Named approval authority, V1 boundaries, decision log and frozen roadmap |
| 1 | Documentation research and source verification | Source-verified requirements, formulas, source/cost matrix, risk/regulatory register |
| 2 | Product requirements and quantitative policy | PRD, trading policy/state machine, exit policy, formulas/units, acceptance tests |
| 3 | Threat model, custody model and security architecture | Threat model, wallet/signer policy, auth/MFA, incident and key-rotation runbooks |
| 4 | UX, dashboard information architecture and design system | Sitemap/flows, wireframes, design system, clickable prototype, UX sign-off |
| 5 | Repository, environments, CI/CD and engineering foundation | Reproducible build/test pipeline, isolated environments, security scanning, rollback plan |
| 6 | Market-data ingestion and canonical data layer | Provider adapters, schemas, provenance/freshness, health panel and replay fixtures |
| 7 | Token safety, rug-risk and exitability engine | Deterministic security gates, risk feature schema, token/pool snapshots and validation |
| 8 | Quant features, regime model and strategy research | Feature catalog, strategy registry, baseline backtests, outcome labels and model card |
| 9 | Decision brain, policy router and strategy memory | Typed choices/scores/propositions, decision trace, memory and champion/challenger policy |
| 10 | Risk governor, portfolio ledger and Kelly-aware sizing | Exact PnL/fee ledger, risk service, calculators, Kelly simulator and reconciliation report |
| 11 | Execution service, quote validation and isolated signer | Execution adapter, signer policy, order-state machine, reconciliation worker and failure suite |
| 12 | Web dashboard and operator control surface | Authenticated dashboard, page permission matrix, UI/accessibility tests and operator handbook |
| 13 | Backtesting, paper trading and replay lab | Reproducible strategy/exit comparisons, target/compounding calculator and limitations disclosure |
| 14 | Testing, quality engineering and independent security review | Automated test reports, remediation tracker, independent review and signed evidence pack |
| 15 | Shadow mode and controlled paper launch | Shadow/paper reports, predeclared-gate result and version-locked proposed live config |
| 16 | Live canary, launch controls and staged expansion | Small-risk canary, launch/rollback runbook, reliability report and approval per expansion |
| 17 | Post-launch governance and controlled learning | Periodic review, model cards/release history, incident register and approved promotion process |

The current repository's abbreviated phase list had re-numbered or combined some items. Use this canonical order in future plans and milestone tracking.

## Canonical operating-mode labels
Observe → Backtest → Paper → Shadow → Live Canary → Live; Halted is the global no-new-entry state. A transition into Live Canary/Live requires explicit owner approval, MFA/re-authentication, a versioned policy and all release gates. Previous labels such as Research, Simulation and Restricted Pilot are aliases or working descriptions, not extra release stages.

## Proposed repository/package layout

This is a proposed structure for the later engineering phase; do not create application code before the approved design/build gate.

```text
apps/
  dashboard/            Next.js operator UI
  api/                  authenticated backend/API
services/
  market-data/          provider adapters, parser, snapshots
  security-engine/      token/program/pool/holder checks
  feature-engine/       indicators and market regimes
  decision-brain/       Choice/Score/proposition policy
  risk-governor/        hard limits and allocation veto
  execution/            quote, intent, submit and reconciliation
  signer/               isolated transaction-policy signer
  position-monitor/     exit rules and state watcher
  research-ml/          Python features, calibration and backtests
  optimizer/             asynchronous post-mortem/challenger jobs
packages/
  domain/               typed entities, schemas and enums
  finance/              PnL, fee, risk, drawdown and Kelly calculators
  data-contracts/        provider-normalized schemas
  strategy-sdk/         strategy interface and version contract
  test-fixtures/        historical/replay/adversarial fixtures
infra/
  docker/
  ci/
  migrations/
  monitoring/
  deployment/
docs/
  roadmap/
  phase-1/
  prd/
  adr/
  threat-model/
  api/
  strategies/
  testing/
  runbooks/
  references/
```

The package layout defines logical boundaries, not a requirement to run every module as a separate network service. The roadmap prefers a TypeScript modular backend plus a separate Python research/model service at the start; extract services only when measured reliability, security isolation or throughput justifies the added operational burden. The signer remains a major isolation boundary.

## Engineering foundation requirements carried forward
- TypeScript monorepo candidate with pinned dependencies/lockfiles, code owners, protected branches and PR review.
- Separate local, test, paper, shadow, live-canary and live secrets/configs, databases and signer permissions.
- Configuration schema validation; fail startup when critical risk values are missing/inconsistent.
- CI for lint/typecheck/tests, secret scanning, dependency/SBOM checks, static analysis, container scanning and build provenance.
- Structured logs/metrics/traces with sensitive-field redaction.
- Clean checkout reproduces build/tests; development and CI cannot access live credentials.


## Commercial scope amendment cross-reference
The source roadmap remains the frozen canonical baseline. The owner subsequently requested a paid customer-access model; see [CR-001](29-commercial-scope-amendment.md). It adds quote/payment/registration/license and tenant isolation requirements without changing Phase 0–17 order. The proposed position cap is per customer workspace and requires owner confirmation before design.

## Commercial access module extension (CR-001)
For the separately requested paid multi-customer model, the proposed later code layout also needs a commercial boundary (it remains a design item, not code created in Phase 1):

```text
services/
  commercial-access/    quotes, invoices, verified settlement, invitations and entitlements
  admin-approvals/      owner review, approval/rejection, refund/dispute workflows
packages/
  commercial-contracts/ quote/payment/invitation/license schemas and state machines
  tenant-authz/         server-side entitlement and tenant-scope authorization helpers
```

This should initially be a logical module, not automatically another deployed microservice. It must not be able to sign transactions or modify Risk Governor limits. A provider adapter stays disabled until the seller country and exact product category are approved by the provider; no free-trial entitlement is permitted.