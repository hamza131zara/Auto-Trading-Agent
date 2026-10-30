# Phase 6.33 — Migration governance and deployment preflight

## Objective

Pin the exact ordered set of committed SQL migrations, detect accidental or unreviewed checksum drift in CI, and provide a local-only completeness check for a future deployment change packet. This is governance and evidence preparation only. It is not a database migration runner, does not open a database connection, and cannot approve a deployment.

## Migration inventory and integrity manifest

The committed inventory is stored in infra/migrations/manifest.json. Every migration entry binds:

- A unique dated identifier and direct-child SQL filename.
- The SHA-256 digest of the exact committed file bytes.
- The required transactional execution mode.

The verifier rejects missing or extra files, duplicate identifiers, malformed dates/names, unsorted manifest entries, checksum drift, unsupported execution modes, unknown files, directories, symlinks, path traversal and oversized SQL files. The inventory directory is intentionally flat and contains only SQL files plus manifest.json.

Run npm run migrations:verify from the repository root. CI runs the same check on every pull request and main push. When a legitimate new migration is proposed, append it in lexical order and update the manifest digest in the same reviewed change. Never rewrite an already merged migration to repair history; create a new forward migration and preserve the old checksum.

The manifest is an integrity baseline against accidental drift, not a cryptographic signature or proof that a migration is safe. A pull request can change both SQL and manifest, so reviewers must inspect the SQL diff and the manifest change independently. Branch protections and independent review remain necessary.

## Offline release-packet preflight

A future operator may prepare a JSON release packet outside the Git working tree and run:

    npm run migrations:verify -- --plan /absolute/path/to/change-plan.json

The packet is bounded to 64 KiB and must include:

- The exact migration-set digest produced by the verifier and stable target environment, cluster, database, schema-version and application-release references.
- Backup checksum and verification reference, plus a separately recorded restore-drill reference.
- Explicit writer-quiescence, migration-role separation and full TLS certificate/hostname verification review.
- Two distinct human approver references: change owner and database operator, with evidence references and timestamps.
- A defined maintenance window.
- A recovery owner and runbook, choosing a forward-fix or separately reviewed restore-and-cutover strategy; preserving monotonic lease-fencing counters; and prohibiting automatic down migrations.

The packet validator checks schema, required fields, timestamp shape, approver separation, migration-set binding and credential-free metadata. It does not fetch or authenticate referenced evidence, verify identities or signatures, inspect a real target database, prove that writers are quiesced, validate TLS, or grant access. Evidence references are not approvals by themselves.

A structurally complete packet returns TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED. That status means only that the declared fields are present and internally consistent. The CLI always reports migration execution, provider activation and trading authorization as false. A BLOCKED result must be resolved before a human review; a passing result still requires independent owner and database-operator verification.

## Deployment and failure controls

The repository deliberately does not ship a production migration executor or a production schema-version table in this step. Before any database deployment, the owner and database operator must independently verify the actual target identity, current schema, service/version compatibility, recent encrypted backup, successful restore evidence, role grants and ownership, strict client-side TLS verification, writer coordination, maintenance window and monitoring.

Use a dedicated migration identity separated from the runtime role. Never place connection strings, passwords, certificates, private paths or keys in a release packet, repository, command line or CI output. CI uses only its disposable local PostgreSQL test service.

For migrations that support transactional DDL, execute the reviewed migration in one transaction and stop on the first error. On interruption, verify that the backend has ended and that PostgreSQL rolled back the uncommitted transaction before retrying. For a migration that committed but produced an invalid state, do not improvise a destructive down migration: stop writers, preserve logs and fencing state, restore a verified backup into a separate database, validate it, and perform only an owner-approved cutover or forward fix. Record the failed migration identifier/checksum, observed schema state, backup digest, incident/change references, decision owner and verification evidence.

Provider-health history and recovery-probe fencing counters must remain monotonic across recovery. Do not reset counters, delete lease history, or allow a stale worker to become current again.

## Acceptance and boundary

- [x] Commit a SHA-256 inventory manifest for the existing dated migration.
- [x] Verify exact directory membership, sort order, names, IDs, checksums and transactional declarations.
- [x] Reject checksum drift, duplicate/missing entries, traversal, symlinks, unknown files and unsupported execution modes.
- [x] Add an offline release-packet completeness check pinned to the exact migration-set digest.
- [x] Require separate owner and database-operator evidence references and explicit backup, restore, TLS, role, writer and recovery controls.
- [x] Ensure the strongest status is TECHNICAL_PRECHECK_PASSED_REVIEW_REQUIRED and all authorization booleans remain false.
- [x] Run the inventory integrity check in pull-request and main CI.
- [ ] Independently review actual owner/operator identities, signed approvals and evidence contents before any use of a release packet.
- [ ] Approve a production migration identity, target, maintenance window, monitoring and operational runbook.
- [ ] Verify production backup encryption, destination, retention/PITR, restore objectives and client TLS certificate/hostname verification.
- [ ] Run a separately authorized staging/production-like migration and failure-recovery exercise.

No production database was contacted or modified. No provider/API/RPC endpoint, wallet, signer, order or transaction was used; no credentials or new spend were added. Phase 6 remains ACTIVE, providers remain unapproved, and trading remains unauthorized.
