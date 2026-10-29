# Phase 6.18 — Raydium CPMM deployed-program integrity evidence

**Status:** Implemented as an optional, read-only SHA-256 comparison path with deterministic synthetic tests. It is not yet a production verification result: no reviewed reference .so hash has been supplied, and no ProgramData read was made during CI. Phase 6 remains active.

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

Synthetic unit tests cover ProgramData pointer decoding, hash match/mismatch, missing reference hash, synthetic-only evidence, wrong ProgramData address, malformed loader tags, context-slot ordering, zero-filled allocation padding and rejection of non-zero trailing bytes. The latest exact-length/padding regression change is pending CI. No real RPC request or transaction/signing capability was added.

A successful comparison verifies byte equality with the supplied reference hash only. It does not establish source-build trust, pool eligibility, token safety, economic safety or trade authorization. Phase 7 review and all provider/freshness/fallback gates remain separate.
