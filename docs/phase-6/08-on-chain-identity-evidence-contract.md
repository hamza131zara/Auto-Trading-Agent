# Phase 6.8 — On-Chain Identity Evidence Contract

**Status:** The deterministic evidence-bundle checker, generic read-only JSON-RPC transport and classic/Token-2022 base-state decoder are implemented with synthetic/mock tests. A pinned Raydium CPMM candidate pool decoder and fail-closed Token-2022 extension-semantic routing are implemented. The Raydium decoder is a synthetic-tested candidate only; extension-bearing token state remains ineligible for identity evidence, Phase 7 review is still required, and no production RPC/indexed provider is selected. This contract must not be described as completed live on-chain verification.

## Why this is a separate gate

Indexed market-data services report a pool and token identifiers; their response is not proof that the accounts exist on Solana, that the pool is owned by the expected program, or that its vaults actually hold the expected mints. Before a candidate can move into token-safety review, the system needs a read-only account evidence bundle that validates those identities from Solana account state.

The official [Solana `getMultipleAccounts` RPC documentation](https://solana.com/docs/rpc/http/getmultipleaccounts) describes a response containing a shared context slot and account records in request order. [Solana account-read documentation](https://solana.com/docs/intro/quick-start/reading-from-network) distinguishes the account's program `owner` from its `executable` flag. The [Token Mint documentation](https://solana.com/docs/tokens/basics/create-mint) describes mint state including initialization and decimals. These are distinct fields and must not be conflated.

## Implemented checker boundary

`assessOnChainIdentityEvidence(target, evidence, policy)` is a pure deterministic checker. It performs no network calls and does not decode raw account bytes. The bounded generic reader and a pinned-source Raydium CPMM candidate decoder now produce synthetic-testable evidence for this gate. Real-source verification and production provider approval remain outstanding.

The separate reader returns raw base64 account data at a shared context slot. The SPL Token base-state decoder parses standard mint/token-account prefixes; a separate Token-2022 TLV inspector/policy blocks unresolved extensions, and the Raydium CPMM candidate decoder parses its pinned protocol-specific pool layout. The identity check requires:

- **Explicit scope:** target must be a canonical Solana `mainnet-beta` observation with a non-null pool address.
- **Read provenance:** safe RPC provider ID, UTC retrieval time, context slot, requested `minContextSlot`, commitment, request ID and SHA-256 of raw response bytes. Non-synthetic evidence without request ID or digest is insufficient.
- **Slot and commitment gates:** evidence commitment must equal the caller's explicit required commitment; the response context slot and requested minimum slot must meet an explicit minimum context slot; retrieval age is checked with an injected clock and explicit maximum age.
- **Approved protocol decoder:** the pool's account owner must match an explicitly allowlisted DEX program ID, and decoder ID/version must match the exact allowlist entry. Empty or duplicate program/token/loader allowlists are invalid, and a DEX program, token program and loader address cannot be reused across roles.
- **Program account:** the program account address must equal the pool owner program ID, the account must be executable, and its account owner must be in the explicitly allowlisted loader program IDs.
- **Mint identity:** base and quote mint account addresses must match the target, each mint must exist and be initialized, and each account's program owner must be in the approved token-program IDs.
- **Pool/vault identity:** decoded pool address, base/quote mints, base/quote vault addresses and vault authorities must match the account evidence. Each vault must exist, be initialized, use the correct token-program owner, and report the expected mint and decoded authority.
- **Synthetic evidence:** consistent synthetic fixtures return `SYNTHETIC_MATCH`, never `MATCH`, and cannot advance. No test fixture represents a live RPC result.

## Outcomes

| Status | Meaning | Can advance? |
|---|---|---|
| `MATCH` | Non-synthetic evidence is internally consistent with the target identity and explicit decoder/program allowlists at the stated context slot | Only to separate independent safety review |
| `SYNTHETIC_MATCH` | Fixture-only data passes the structural checks | No |
| `MISMATCH` | An account owner, executable flag, program/decoder, mint, vault, authority or target identity disagrees | No |
| `INSUFFICIENT_EVIDENCE` | Required accounts/decoder are missing, commitment/context slot is below policy, evidence is stale, or audit provenance is incomplete | No |
| `INVALID_INPUT` | Target, evidence envelope or policy is malformed, or required allowlists are empty/duplicated | No |

Every return includes `tradingAuthorized: false`. `MATCH` is not token-safety approval or trade authorization. This checker does not assess mint/freeze authorities, Token-2022 extension risk, liquidity, pool economics, program upgrade authority, transaction simulation or profitability.

## Tests

`test/on-chain-identity.test.mjs` exercises the evidence-checker branches using constructed fixtures only: matching identity bundle, synthetic-only match, owner/program mismatch, non-executable DEX program, vault/decoder mismatch, missing account/decode, lower commitment, insufficient context slot, stale retrieval, missing digest, unsupported target cluster, unapproved decoder version, malformed policy, overlapping program-role allowlists and unconditional denial of trading authorization.

These tests do not connect to a Solana RPC endpoint, decode live protocol data, or prove that any allowlisted DEX address is authentic.

## Remaining implementation gates

1. Approve a real DEX program ID and the exact protocol decoder/version from authoritative program documentation/source. Do not populate production allowlists from indexed provider labels.
2. Implement a read-only RPC reader that requests the pool, program, mint and vault accounts in one `getMultipleAccounts` call at the required commitment and `minContextSlot`, preserves the context slot and raw-response digest, and fails closed on missing accounts or transport errors.
3. Implement and independently test the selected protocol's account decoder, including program-specific vault-address/authority derivation and account-layout version checks.
4. Add recorded, redacted fixtures sourced from a reviewed account snapshot, then validate the reader/decoder offline. Any live RPC smoke test must be explicit and separate from normal CI.
5. Keep this identity gate separate from Phase 7 token safety and from execution/signing. Production use remains disabled until provider/terms/budget, independent data-source and security review gates are closed.
