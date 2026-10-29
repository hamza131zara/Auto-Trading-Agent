# Phase 6.12 — Raydium CPMM Pool-State Decoder and Identity Integration

**Status:** Implemented as an evaluation-only protocol adapter with synthetic byte/RPC tests. It is not a production DEX selection, a token-safety approval, or trading authority.

## Pinned protocol source

This candidate decoder was implemented against the official Raydium \`raydium-cp-swap\` source snapshot at commit \`f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5\` (review snapshot 2026-10-29):

- [Program ID and pool program declarations](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/lib.rs) — mainnet program ID \`CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C\`.
- [PoolState layout](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/states/pool.rs) — Anchor discriminator, packed state layout and \`PoolState::LEN = 637\`.
- [AMM config layout](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/states/config.rs) — discriminator and \`AmmConfig::LEN = 236\`.
- [Pool initialization and vault/authority seeds](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/instructions/initialize.rs) and [official test PDA helpers](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/tests/utils/pda.ts).

The decoder is pinned to a source snapshot so later upstream changes do not silently change byte interpretation. Before any production use, review the current upstream program/deployment and decide whether this decoder remains compatible.

## Data layout and checks

\`decodeRaydiumCpmmPool()\` requires the exact Raydium CPMM owner, non-executable pool account, matching account space, exact 637-byte state and exact Anchor discriminator. It decodes all ten public keys, fee/supply counters as exact decimal strings, status bits, decimals, flags and padding. It rejects unknown status bits, invalid booleans, unknown creator-fee mode and mint ordering that contradicts the upstream initialization constraint. It does not use floating-point amounts.

\`decodeRaydiumCpmmAmmConfig()\` checks the exact Raydium owner, non-executable account, 236-byte size and discriminator; it parses the config index, PDA bump, owner fields and fee values. The derived config PDA must match the index seed encoded as two **big-endian** bytes, matching the Rust \`index.to_be_bytes()\` implementation.

PDA helpers implement Solana's program-address derivation using SHA-256 and the Ed25519 curve-point rejection rule. The candidate computes the pool, vault authority, token vault, LP mint and observation addresses from the source-defined seeds. The assessment checks the pool's canonical PDA match as evidence, validates the expected LP mint and observation addresses, checks vault PDAs, checks pool mint/vault ordering and verifies the stored authority bump. Raydium's own source also supports signer-created non-PDA pool accounts, so the pool PDA match is recorded rather than treated as an unconditional rejection by itself.

## Raw RPC integration

\`readRaydiumCpmmIdentityBundle()\` performs a small pool discovery read, decodes the pool's dependent addresses, then performs a second read containing the nine accounts needed for identity assessment: pool, executable DEX program account, AMM config, LP mint, both target mints, both derived vaults and observation account. The full evidence bundle is requested with \`minContextSlot\` at least the discovery slot; all accounts consumed by the identity checker come from that second response and share its returned context slot.

The read helper uses the shared bounded \`getMultipleAccounts\` transport. It is read-only; it does not choose an RPC vendor, use credentials beyond the configured endpoint, scan arbitrary addresses, or construct transactions.

## Integrated identity outcome

\`assessRaydiumCpmmIdentityEvidence()\` joins the raw pool/config/mint/vault account checks to the existing protocol-neutral identity evidence checker. It verifies mint identity, vault derivation, vault-to-mint/token-program relationships, token decimals, AMM config PDA, authority bump, LP-mint PDA/base state and the observation account relationship.

- Malformed, missing or mismatched evidence blocks progression with explicit reason codes.
- Token-2022 extension-bearing mint/vault data stays blocked by the fail-closed extension policy pending Phase 7 risk review.
- A synthetically injected RPC response remains \`SYNTHETIC_MATCH\`; it cannot advance to safety review.
- A non-synthetic \`MATCH\` would only permit consideration for independent safety review. The function always returns \`tradingAuthorized: false\`.

## Tests and remaining gates

\`test/raydium-cpmm-decoder.test.mjs\` covers the published authority PDA vector, packed pool/config decoding, invalid owner/size/discriminator, common-slot two-stage mock reads, identity matching, bad vault identity and missing accounts. Tests use generated account bytes and injected/mock fetch only; **they do not contact a Solana RPC endpoint or demonstrate real-source identity validation**.

Still open: verify this decoder against a real, owner-approved, read-only RPC endpoint and an independently sourced, known pool; confirm current deployed program/source compatibility; select an RPC/provider plan and approve quota, budget, retention/terms and fallback behavior. This candidate does not close Phase 6 by itself.
