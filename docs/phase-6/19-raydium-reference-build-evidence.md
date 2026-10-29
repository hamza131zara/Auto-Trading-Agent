# Phase 6.19 — Pinned Raydium source build and reference hash evidence

**Status:** Implemented and covered by CI [#236](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40957968850): 213/213 tests, typecheck/build/repository validation, zero dependency vulnerabilities and Gitleaks passed. The manual build workflow has not yet been run; no reference ELF hash/length has been accepted and no live Solana RPC request is made by this step.

## Why a reproducible build comes first

The Phase 6.18 verifier compares the deployed ProgramData ELF bytes with an exact reference artifact length and SHA-256. Those values must come from a trustworthy build artifact, not an arbitrary hash string. Solana's official [verified-build guide](https://solana.com/docs/programs/verified-builds) recommends a controlled Docker build because program binaries may differ across systems; it describes `solana-verify build` and the executable-hash comparison process. Raydium's pinned [source README](https://github.com/raydium-io/raydium-cp-swap/blob/f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5/README.md) documents Rust 1.91.0, Solana 3.1.10 and Anchor 1.0.2, which the workflow manifest verifies against the pinned checkout's README/config.

## Workflow

Run [Phase 6 pinned Raydium CPMM reference build](../../.github/workflows/phase6-raydium-reference-build.yml) manually from `main`. The only input is a build-only acknowledgement and defaults to `no`. This workflow is separate from normal CI and does not run on a push.

The workflow downloads Solana Verify CLI v0.5.2 and checks its binary against the pinned SHA-256 before execution. It checks out Raydium source commit `f4b9b26342afe9122d5ff67cd7a4f19ded4ac0a5` and expected tree `060a556fc8b30bdaf04ada495819530b1dab6174`, makes two clean copies, and runs `solana-verify build --library-name raydium_cp_swap` against each. It doesn't invoke `solana program dump`, `solana-verify get-program-hash`, any RPC URL, a transaction, or a deploy command.

The workflow uploads a 30-day artifact containing the JSON manifest, build logs, and any generated ELF artifacts. The manifest records:
- Pinned source commit/tree, clean-worktree status, critical build-input SHA-256 values and declared toolchain versions.
- Solana Verify version and verified tool binary SHA-256.
- Both build exit codes, ELF magic checks, artifact lengths and SHA-256 values.
- A passing candidate reference SHA-256 and exact byte length only if both builds succeed from the exact same pinned source/input and the artifact hashes and lengths match.

If the build fails, source/input metadata does not match the pin, a binary is not a valid ELF, the CLI digest is wrong, or the two ELF outputs differ, the manifest is `BLOCKED` and the workflow fails. The artifact upload step is configured to preserve logs and failure evidence for diagnosis.

## What a pass means—and does not mean

A pass means the two builds were repeatable within this pinned workflow runner and verification toolchain, and the resulting artifact has a recorded SHA-256 and exact file byte length. It is not independent cross-organization reproducibility and does not prove that the on-chain program is this revision. Source legitimacy, the exact deployed account, any upgrade-authority status, and the ProgramData byte comparison remain separate checks.

Do not copy a hash/length into the Phase 6.18 manual workflow until the build manifest and source provenance have been reviewed. Even then, the separate ProgramData check requires its own explicit approvals. No production provider is approved and `tradingAuthorized` remains false.


## Failure diagnosis — first manual run

The first manually approved run [#1](https://github.com/hamza131zara/Auto-Trading-Agent/actions/runs/40960267237) completed both Docker builds successfully. Both artifacts were valid ELF files with the same SHA-256 and exact length, but the manifest was correctly blocked by the source metadata validator with PROGRAM_LIBRARY_NAME_MISMATCH. The validator's TOML [lib] section regex used the multiline dollar anchor as an alternative section terminator, so it stopped at the end of the [lib] header before reading the expected library name. This was a validator bug, not a Rust compile failure or artifact disagreement. The follow-up patch extracts the [lib] section without that multiline-anchor error and adds regression tests. The blocked manifest from run #1 must remain rejected; rerun this workflow after the patch is merged to main and review the new manifest rather than reusing the prior blocked result.
