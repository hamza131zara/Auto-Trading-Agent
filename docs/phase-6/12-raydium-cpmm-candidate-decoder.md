# Phase 6.12 — Raydium CPMM Candidate Pool Decoder and Identity Integration

**Status:** Implemented as a candidate decoder with synthetic account-bundle tests. It is not a production provider selection, a live-source validation result, a token-safety approval or trade authorization.

## Pinned protocol source

This decoder is based on the Raydium `raydium-cp-swap` source snapshot at commit `f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5`, rather than tracking a moving `master` branch at runtime:

- [PoolState layout](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/states/pool.rs), source blob `bc80829f58f8652bcffba9c559327dd37f63f507`.
- [Pool initialization/account constraints](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/instructions/initialize.rs), source blob `36f4301e186240eeedc1e829edf32b95b8fb2a2e`.
- [AMM config layout](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/states/config.rs), source blob `eaa966e7977315c4a5d3361c6b9bde0ce973515e`.
- [AMM config PDA construction](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/programs/cp-swap/src/instructions/admin/create_config.rs), source blob `236ad4db0eb6224d84d16aa7c70d9faca9f05447`.
- [PDA seed reference from Raydium's test utility](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/tests/utils/pda.ts), source blob `2ea7d89b3fee254486ee91617275757e25202316`.

The candidate program ID is `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`. The decoder is intentionally pinned to the published `PoolState` (637-byte) and `AmmConfig` (236-byte) layouts and their Anchor account discriminators. Any upstream layout revision requires explicit source review and a versioned decoder update.

## Decoded and checked accounts

The implementation parses the packed `PoolState` account using exact offsets, verifies its owner, non-executable state, `space`, byte length, Anchor discriminator, token mint ordering, state flags, boolean and creator-fee enum. U64 fields remain decimal strings; no floating-point conversion is used for token supply/fees.

It decodes the AMM config account (owner, discriminator, length, index, bump and fields), then recomputes the config PDA from `amm_config` and the config index in the upstream big-endian seed format. It derives and checks the LP-mint PDA, decodes the classic SPL Token LP mint and verifies initialization/decimals. It derives the observation PDA and verifies the pool's observation field points to an existing, non-executable account owned by the CPMM program.

The reader helper first discovers the pool layout, then rereads the complete nine-account set in one `getMultipleAccounts` response at a `minContextSlot` no lower than the discovery response. The returned bundle contains the pool, CPMM program, AMM config, LP mint, base/quote mints, base/quote vaults and observation account. It validates token0/token1 order, mint program IDs/decimals, authority bump, vault PDA derivations and the base-state decoders before passing a typed evidence bundle to the generic identity gate.

Raydium's initializer source allows a signer-created pool account as an alternative to the canonical pool PDA. Therefore `canonicalPoolPdaMatches` is retained as an explicit informational field; its mismatch alone is not silently treated as proof of an invalid pool. The AMM config, LP-mint, vault, authority and observation constraints are still checked.

## Fail-closed behavior

- Wrong program owner, malformed discriminator/layout, non-canonical token ordering, wrong config/LP-mint/vault/observation PDA or account state, incorrect token program/decimals, invalid authority bump, missing accounts, stale evidence, bad provenance or disagreement return a non-match/insufficient-evidence result.
- Token-2022 extension-bearing mints or vault accounts stay blocked by the extension inspector/policy; known types require Phase 7 review, unknown/future IDs and wrong account-kind use are blocked. The decoder does not treat parsed extension type codes as safety approval.
- The result `MATCH` can only advance to separate safety review. Any mock/injected-fetch run returns `SYNTHETIC_MATCH` and cannot advance. Every output carries `tradingAuthorized: false`.

## Controlled real-source validation

A dedicated [Phase 6.13 validation runner and runbook](13-live-source-validation-runner.md) now makes the required read-only mainnet identity check repeatable. It requires explicit local acknowledgements for RPC approval, indexed-source independence, and current provider terms/quota/budget review; rejects synthetic targets before networking; and emits a report without the RPC URL or raw account bytes. This is tooling only. **It does not mean the real-source check has run or passed.**

## Tests and remaining gates

`test/raydium-cpmm-decoder.test.mjs` uses constructed bytes and mocked RPC responses to check the Raydium authority PDA test vector, pool/config decoding, discriminator/owner/space failures, the two-stage common-slot request, AMM-config/LP-mint/vault/observation linkages, missing account blocking and a fail-closed synthetic identity result. CI performs no live RPC calls.

This closes the **protocol-decoder implementation item for this candidate** once the PR checks pass. It does not close Phase 6 overall. Still required before Phase 6 can be marked complete are: a real-source identity validation using an owner-approved RPC source, owner-approved production indexed/RPC provider and account plan, current provider terms/quota/retention and budget review, and verification of critical market fields against an independent source. No owner-approved production protocol/provider is inferred from this candidate.
