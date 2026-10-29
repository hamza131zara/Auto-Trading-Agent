# Phase 6.10 — SPL Token Base-State Decoder

**Status:** Base-state decoding for the classic SPL Token Program and Token-2022 is implemented with synthetic tests. This is not full Token-2022 extension decoding, token-safety assessment or protocol-specific DEX pool decoding.

## Official layout references

- [Solana token program overview](https://solana.com/docs/tokens) describes mints, token accounts, the classic Token Program and Token-2022.
- [Official classic Token Program account layout](https://github.com/solana-program/token/blob/main/interface/src/state.rs) defines the base mint and token-account fields. The mint base size is 82 bytes; the token-account base size is 165 bytes.
- [Official Token-2022 extension implementation](https://github.com/solana-program/token-2022/blob/main/interface/src/extension/mod.rs) confirms that the first base-state bytes retain the common layout, and that extensions follow a type marker and TLV data. When extensions are present, a mint is padded to the 165-byte account base length before its type marker; the account type is `Mint = 1` or `Account = 2`.

## Decoded fields

### Mint base state

- Optional mint authority and freeze authority, parsed as explicit `COption<Pubkey>` tags.
- Total supply as an exact unsigned integer decimal string (never a JavaScript `Number`).
- Decimal precision and initialized state.

### Token-account base state

- Mint public key and token-account authority (distinct from the Solana account's program owner).
- Amount and delegated amount as exact unsigned integer decimal strings.
- Delegate, close authority, native reserve, and distinct `UNINITIALIZED`, `INITIALIZED`, or `FROZEN` state.

The decoder first requires the Solana account's program owner to be exactly the classic Token Program ID or Token-2022 program ID. It rejects executable accounts, malformed base64, mismatched RPC `space` vs decoded byte length, unsupported byte layouts, invalid option tags and invalid state bytes.

## Token-2022 extension boundary

For a Token-2022 account without extension bytes (exact base length), the base state may be `DECODED`. If the account is longer than the base layout, the decoder validates the padding and Token-2022 account-type marker but returns `EXTENSIONS_UNINSPECTED`, and `baseStateEligibleForIdentityEvidence` is `false`. It does not inspect extension TLVs or claim that the extended token is safe.

This is deliberate: Token-2022 can add transfer fees, transfer hooks, non-transferable state, confidential transfer, pausable controls and other behavior that changes token semantics. The separate [Phase 6.11 TLV inspector](11-token2022-extension-tlv-inspector.md) checks framing, while its fail-closed semantic registry names the current official extension IDs, maps conservative impact categories and blocks unknown/future or wrong-account-kind types. This is not a token-safety approval; extension-bearing tokens remain blocked from identity evidence pending Phase 7 policy. The decoder's “base state eligible” boolean is only a parsing gate; it is not a safety score, recommendation or trading permission.

## Error and data boundaries

Decoder results are discriminated as `DECODED`, `EXTENSIONS_UNINSPECTED`, or `ERROR` with stable error codes. Missing accounts and unsupported program owners are not coerced to empty data. All returned integer amounts remain strings. It does not fetch RPC data; its input is the raw result of the separately tested reader. No DEX pool layout, vault PDA, mint-risk authority policy, or program upgrade authority is inferred.

## Tests

`test/solana-token-account-decoder.test.mjs` covers classic mint/account values, large amounts, optional authorities, Token-2022 extended account classification, padding and type-marker failures, owner program checks, size mismatches, malformed base64, invalid option/state fields, missing accounts and initialized/frozen/uninitialized states. Tests use constructed byte arrays and never call an RPC endpoint.
