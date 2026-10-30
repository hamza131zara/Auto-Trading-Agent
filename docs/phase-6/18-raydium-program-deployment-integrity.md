# Phase 6.18 — Raydium CPMM deployed-program integrity evidence

**Status:** The one-off read-only Mainnet ProgramData comparison completed with MATCH in [live validation run #4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41004294300), in addition to fixture-only CI [run #234](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40944936764). The live result verified byte equality to the independently reviewed Phase 6.19 reference ELF at finalized context slot 463153970; the live result is historical to that slot. The deployed program still has an upgrade authority, market-source freshness remains UNKNOWN, independent price comparison remains NOT_ASSESSED, and Phase 6 remains active. Production-provider approval and trading authorization remain false.

## Why this check is separate

The live identity runner previously checked that the Raydium program account was executable and owned by the upgradeable BPF loader. This confirms account shape and loader ownership but does not identify the deployed bytecode. With loader-v3, the 36-byte Program account points to a separate ProgramData account where executable ELF bytes are stored. See the official [Solana program deployment documentation](https://solana.com/docs/core/programs/program-deployment) and [account-reading guide](https://solana.com/docs/intro/quick-start/reading-from-network).

## Implemented path

The new market-data module strictly decodes the upgradeable-loader Program state and exact ProgramData address; validates the ProgramData address, loader owner, non-executable state, metadata tag, deployment slot, upgrade-authority option and ELF magic; and computes SHA-256 over the ELF payload after the 45-byte ProgramData metadata prefix. Raw bytecode is never included in reports.

The computed digest is compared to an operator-supplied lowercase SHA-256 reference and the exact byte length of that same locally built artifact. Both are required together. The verifier hashes exactly that many bytes after the 45-byte loader metadata prefix and requires every remaining allocated ProgramData byte to be zero. That handles loader accounts whose allocation is larger than the active ELF without either hashing padding as code or ignoring unexpected non-zero data. Missing hash/length returns insufficient evidence in the pure assessor and NOT_ASSESSED in the runner when no comparison was requested. Hash mismatch or invalid trailing data fails the manual runner. Synthetic fixtures can return only synthetic statuses, never operational MATCH. The Program account pointer and its ProgramData target are reread together in one getMultipleAccounts response at a shared finalized context slot no lower than the initial identity bundle slot. The report records context slots and response digests without raw account bytes or endpoint details.

The report also records whether an upgrade authority is present. A hash match describes the observed deployment only; an upgrade authority can change the code after that read.

## Establishing a valid reference hash

Do not guess a hash or use a source commit hash as the ELF hash. Use the exact pinned Raydium source revision recorded in [Phase 6.12](12-raydium-cpmm-candidate-decoder.md), review the toolchain and dependency lock state, and independently build the program. Compare the resulting raydium_cp_swap.so against a separately obtained on-chain dump from an owner-approved read-only RPC source. Use the digest of the exact ELF artifact as the reference and preserve source revision, toolchain versions, build command, dependency lock state and artifact digest in an operator-controlled evidence record. Raydium describes the dump/build/hash method in its [program and Anchor guide](https://docs.raydium.io/solana-fundamentals/programs-and-anchor). Do not assert a source match until the build provenance is reviewed.

The manual workflow inputs expected_program_elf_sha256 and expected_program_elf_bytes are blank by default and must be supplied as a pair. The byte-length value must equal the exact size of the reference .so file. When supplied, confirm_program_build_hash_review must be yes; workflow and script enforce both pair and approval before any provider request. No reference hash or additional ProgramData read is used by default.

## Tests and safety boundary

Synthetic unit tests cover ProgramData pointer decoding, hash match/mismatch, missing reference hash, synthetic-only evidence, wrong ProgramData address, malformed loader tags, context-slot ordering, zero-filled allocation padding and rejection of non-zero trailing bytes. The exact-length/padding regression passed in CI [#234](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40944936764). No real RPC request or transaction/signing capability was added.

A successful comparison verifies byte equality with the supplied reference hash only. It does not establish source-build trust, pool eligibility, token safety, economic safety or trade authorization. Phase 7 review and all provider/freshness/fallback gates remain separate.


## Next step: establish the reference artifact

Phase 6.19 adds a separate manual-only [pinned source build evidence workflow](19-raydium-reference-build-evidence.md). It is designed to create and compare two clean builds from the exact pinned source revision before a reference hash and byte length are entered into this ProgramData comparison. It does not perform the ProgramData read and does not imply that the source is the currently deployed revision.

## First live ProgramData comparison — 2026-10-30

[Manual GitHub Actions run #4](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/41004294300) completed the one-off read-only DEX Screener + Solana Mainnet RPC validation with top-level MATCH. The job completed successfully and all operator acknowledgement gates were affirmative.

| Evidence field | Observed value |
|---|---|
| Scope | READ_ONLY_SOLANA_MAINNET_ACCOUNT_IDENTITY |
| Top-level identity | MATCH; identityGatePassed: true; no mismatch fields |
| Program deployment comparison | MATCH; programDeploymentVerificationPassed: true |
| Reference ELF SHA-256 | 2a90c3302d1907dc9b8bd0b000e4620166e671316a440f10add0b4ba08f28b3d |
| Expected / observed ELF length | 722632 / 722632 bytes |
| Expected / observed ELF SHA-256 | Identical |
| ProgramData padding | 71192 bytes; all zero |
| RPC commitment / provider | finalized / solana-public-shared |
| Identity bundle / ProgramData context slot | 463153970 / 463153970 |
| Program deployment slot | 452376460 |
| Upgrade authority | Present; program remains upgradeable |
| Synthetic evidence | false |
| Phase 6 complete / production provider approved / trading authorized | false / false / false |

The live workflow read the Program account and its linked ProgramData account, decoded the loader metadata, hashed exactly the supplied ELF length after the loader prefix, and verified the remaining allocation bytes were zero. Raw account bytes were not included in the report. The run log records public pool/mint/vault identities and public-chain validation metadata; no wallet private key, signing credential, or API secret was used.

**Interpretation:** this is a successful byte-for-byte match between the reviewed reference build and the deployed Raydium CPMM ELF at finalized slot 463153970. It is not a guarantee that the code will remain unchanged: the upgrade authority is still present and can upgrade the program after this observation. Any future use must revalidate the deployment hash at the relevant time.

The associated DEX Screener response did not provide trusted source/event timestamps (sourceFreshness: UNKNOWN). The live indexed liquidity was approximately USD 569.56 and 24-hour volume approximately USD 430.90, far below the existing candidate-discovery thresholds. The on-chain reserve ratio is not an executable quote, and the independent reserve/price comparison remained NOT_ASSESSED. This pool remains a diagnostic target only, not a trading candidate.

No transaction was signed or submitted. The workflow performed only explicitly approved read-only GET/RPC requests. Phase 6 remains active; Phase 7 token-safety review, independent fresh price evidence, provider selection/terms/fallback, and an upgrade-authority decision remain separate gates.