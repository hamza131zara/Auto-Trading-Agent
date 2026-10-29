# Phase 6.11 — Token-2022 Extension TLV Structure Inspector

**Status:** Structural parser and fail-closed semantic registry implemented with synthetic byte tests. It is not an extension risk classifier and never makes an extended token eligible for identity evidence.

## Contract

`inspectToken2022ExtensionLayout(account, accountKind)` accepts only a raw account owned by the configured official Token-2022 program ID and an explicit `MINT` or `TOKEN_ACCOUNT` base layout. It reuses the reader's strict base64/account-space checks and the documented Token-2022 base padding and account-type marker.

The inspector parses the two-byte little-endian extension type and two-byte little-endian length, checks payload bounds, rejects duplicate extension types, and checks the uninitialized-type terminator and trailing padding. It returns only numeric type code/length/offset, never extension payload bytes. The semantic registry is based on [the published ExtensionType enum](https://docs.rs/spl-token-2022-interface/latest/spl_token_2022_interface/extension/enum.ExtensionType.html) and [the official Token-2022 guide](https://solana-program.com/docs/token-2022). It maps known types to name, expected account kind and conservative impact category; all known extensions require separate Phase 7 review, and unknown/future type codes or scope mismatches are blocked.

Official source: [Token-2022 extension implementation](https://github.com/solana-program/token-2022/blob/main/interface/src/extension/mod.rs). This inspector implements only the structural envelope around the TLV data; the official per-extension layouts and semantics remain authoritative.

## Outcomes

- `NO_EXTENSIONS`: exact base-length Token-2022 state; no TLV area is present.
- `INSPECTED`: TLV framing is structurally consistent; the result includes type codes, lengths and offsets only. It **always** returns `baseStateEligibleForIdentityEvidence: false` because extension semantics have not been approved.
- `ERROR`: malformed base64/account envelope, program owner mismatch, padding/marker problem, missing extension entries in an extended layout, malformed/truncated TLV header, out-of-bounds length, duplicate type code or invalid terminator.

The parser/policy never authorizes trading and never performs network I/O. An extension-free structural result does not validate the token base state; the base mint/account decoder and on-chain identity checker must still pass. For any extension-bearing account, known extension types are reported as `KNOWN_REQUIRES_PHASE_7_REVIEW`, unknown/future IDs as `UNKNOWN_EXTENSION_BLOCKED`, and wrong account-kind attachments as `INVALID_ACCOUNT_KIND`. The policy's `identityEvidenceEligible` result is always false. Exact extension payload decoding and token-risk decisions remain part of Phase 7.

## Tests

`test/token2022-extension-tlv-inspector.test.mjs` constructs byte fixtures for a mint extension, an account extension, exact base-length accounts, valid termination/padding and malformed lengths/headers/duplicate types/markers. It also verifies the current enum inventory, known-type blocking, unknown/future-type blocking, wrong-account-kind rejection, and that neither extension-free layout nor extension-bearing layouts alone are eligible identity evidence. It uses no RPC endpoint and does not use fixtures as live evidence.
