# Phase 6.9 — Read-Only Solana RPC Account Reader

**Status:** The bounded JSON-RPC transport is implemented with mocked-fetch tests. No production RPC provider is selected and no RPC endpoint is contacted by CI. A pinned-source Raydium CPMM candidate decoder consumes the returned account data; it has only synthetic/mock integration coverage.

## Request contract

`SolanaRpcAccountReader.readAccounts()` accepts an explicit list of 1–100 distinct Solana public keys, a caller-specified `confirmed` or `finalized` commitment, an explicit `minContextSlot`, a safe request ID, and optional cancellation. It sends one JSON-RPC `getMultipleAccounts` request using `encoding: "base64"`. Accounts are returned in the requested order; missing accounts remain explicit `exists: false` records and are never omitted or replaced.

The RPC response must carry the exact request ID, JSON-RPC 2.0 envelope, a non-negative safe-integer context slot, and an account array matching the number of requested addresses. A context slot below the requested minimum is rejected. For each present account, the reader validates the base64 data envelope, account owner public key, executable flag and safe account-space value. It does not interpret the account bytes.

Official reference: [Solana `getMultipleAccounts` RPC](https://solana.com/docs/rpc/http/getmultipleaccounts).

## Transport and provenance safeguards

- Endpoints must be HTTPS; HTTP is accepted only for an explicitly configured loopback development endpoint. URL user-info and fragments are rejected.
- Redirects are rejected. The configured endpoint (which may contain a provider token) is never returned or copied into error messages.
- Timeout and caller cancellation are distinguished. HTTP rate limits/timeouts, transport failures, RPC errors, malformed JSON, invalid UTF-8, malformed account data, low context slots, and oversized responses return stable sanitized error codes. The reader never retries automatically.
- Response body size is capped and enforced while streaming. An over-limit body is cancelled; the complete response is not buffered first.
- The exact UTF-8 response body is represented by a SHA-256 digest. The returned source envelope records provider ID, caller request ID, retrieval time, commitment, requested minimum context slot, response context slot and whether the transport is synthetic.
- Supplying a custom/injected `fetchImpl` deliberately marks output as synthetic. This is intended for tests and adapters and prevents mock responses from being interpreted as live RPC evidence. The default global fetch path is not marked synthetic.
- RPC errors, error bodies, credentials and endpoint URLs are never exposed. There are no transaction, signing, wallet, instruction-building or order-placement methods.

## Explicit boundaries

This module is a transport reader, not the complete on-chain identity validator. It returns raw base64 account bytes plus metadata; the [Phase 6.10 SPL Token decoder](10-spl-token-base-state-decoder.md) parses standard mint/token-account base fields only. The pinned-source [Phase 6.12 Raydium CPMM candidate decoder](12-raydium-cpmm-candidate-decoder.md) separately decodes the protocol pool state and derives protocol PDAs, but it is not production-selected and has not been verified against a real source. The Token-2022 TLV inspector/policy rejects unresolved extension states; no component here validates upgrade-authority risk or proves the RPC provider is honest. The transport does not translate a context slot into a source-event timestamp; market-data freshness rules remain separate.

The evidence contract in [Phase 6.8](08-on-chain-identity-evidence-contract.md) remains fail-closed until a reviewed adapter turns this raw bundle into typed pool/mint/vault evidence and the approved program/decoder allowlists are populated from authoritative sources.

## Validation

`test/solana-rpc-reader.test.mjs` injects a deterministic mock fetch and covers request shape, explicit addresses, ordered/missing accounts, invalid requests, endpoint policy, context-slot floors, JSON-RPC ID validation, malformed base64, rate-limit/RPC error sanitization, streamed response-size enforcement, strict UTF-8 decoding, timeout and cancellation. The tests make no external network calls and output is marked synthetic.
