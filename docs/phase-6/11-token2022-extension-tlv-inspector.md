# Phase 6.11 — Token-2022 Extension TLV Structure Inspector

**Status:** Implemented as a structural parser with synthetic byte tests. It is not an extension risk classifier and does not make an extended token eligible for identity evidence.

## Contract

`inspectToken2022ExtensionLayout(account, accountKind)` accepts only a raw account owned by the configured official Token-2022 program ID and an explicit `MINT` or `TOKEN_ACCOUNT` base layout. It reuses the reader's strict base64/account-space checks and the documented Token-2022 base padding and account-type marker.

The inspector parses the two-byte little-endian extension type and two-byte little-endian length, checks that payload lengths fit within the account, records only the numeric type code/length/payload offset, rejects duplicate extension types, and checks the uninitialized-type terminator and trailing padding. It does not return raw extension payloads and does not infer a meaning or risk score from a numeric type code.

Official source: [Token-2022 extension implementation](https://github.com/solana-program/token-2022/blob/main/interface/src/extension/mod.rs). This inspector implements only the structural envelope around the TLV data; the official per-extension layouts and semantics remain authoritative.

## Outcomes

- `NO_EXTENSIONS`: exact base-length Token-2022 state; no TLV area is present.
- `INSPECTED`: TLV framing is structurally consistent; the result includes type codes, lengths and offsets only. It **always** returns `baseStateEligibleForIdentityEvidence: false` because extension semantics have not been approved.
- `ERROR`: malformed base64/account envelope, program owner mismatch, padding/marker problem, missing extension entries in an extended layout, malformed/truncated TLV header, out-of-bounds length, duplicate type code or invalid terminator.

The function never authorizes trading, never performs network I/O, and does not make an extension-bearing Token-2022 account safe or transferable. A subsequent reviewed policy must map known extension types to exact layouts and semantics, define the handling of unknown/future extension types, and decide whether the account is eligible for identity evidence. Token risk decisions remain part of the later safety phase.

## Tests

`test/token2022-extension-tlv-inspector.test.mjs` constructs byte fixtures for a mint extension, an account extension, exact base-length accounts, valid termination/padding and malformed lengths/headers/duplicate types/markers. It uses no RPC endpoint and does not use these fixtures as live evidence.
