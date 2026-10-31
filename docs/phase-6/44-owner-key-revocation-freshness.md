# Phase 6.44 — Live owner-key revocation freshness

## Status and boundary

**Implementation candidate:** a reloadable resolver is added on the review branch. It is not wired into live provider runtime because no owner-controlled key registry or actual signed owner decision has been configured. No real key material is included.

This step closes a lifecycle gap in Phase 6.43: a static key snapshot can continue trusting a key after revocation until the process restarts or the resolver is rebuilt. Long-running runtimes need bounded-freshness revalidation of the owner-controlled trust registry.

## Runtime contract

`createReloadableSignedProviderUseDecisionResolver` accepts the signed decision envelopes, a synchronous `loadTrustedKeySnapshot` callback, and an explicit `maxSnapshotAgeMs`:

- The allowed freshness bound is 1–300,000 milliseconds (maximum five minutes).
- The loader is called again for every provider/purpose resolution.
- The snapshot contains exactly `loadedAt` and `keys`; unknown fields are rejected.
- `loadedAt` must be a valid UTC timestamp no later than the injected evaluation time.
- A snapshot older than the configured bound is rejected.
- The current key list is cloned from JSON data before verification.
- If the registry loader throws, returns malformed data, or returns stale/future-dated data, no decision is returned.
- A revoked/expired key blocks the next attempt using the refreshed snapshot.

The resolver returns the same decision type expected by the PR #75 orchestrator, so the existing default-deny behavior is retained. It never caches a successful key-verification result across requests.

## Trust-source requirement

The callback must read the authoritative owner-controlled registry on each call, or from a cache whose source freshness is independently enforced. The timestamp is supplied by that loader; this module cannot prove that the timestamp is truthful or that the registry is authoritative. If the authoritative source cannot provide a current snapshot within the configured age bound, provider use is denied.

The static resolver from Phase 6.43 remains appropriate only where an external supervisor guarantees short process lifetime and key-registry reload behavior. A long-running process should use the reloadable resolver.

## Verification

Tests use ephemeral signing keys only. They confirm that:
- A currently active key authorizes only its signed, scoped decision.
- Updating the loaded trust snapshot to mark the key revoked blocks the next request without restarting the resolver.
- Stale and future-dated snapshots deny.
- An unavailable or throwing registry loader denies.
- Extra snapshot fields and an excessive freshness bound deny.

No provider/RPC request, production credential, production database connection, wallet, signer, transaction or order path is introduced. Roadmap scope, liquidity/volume thresholds and the 10-bps comparison tolerance are unchanged. Phase 6 remains ACTIVE, and trading authorization remains false.
