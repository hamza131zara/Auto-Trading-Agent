# Phase 6.20 — Local review of pinned Raydium reference-build evidence

**Status:** Implemented on review branch; CI review pending. This tool is an offline consistency check for a completed Phase 6.19 build artifact. It does not generate the build or contact Solana RPC. Phase 6 remains active, and trading remains unauthorized.

## Purpose

The Phase 6.19 workflow emits a JSON manifest and two raydium_cp_swap.so files. Before a reviewer considers copying a candidate SHA-256 and exact byte length into the separate Phase 6.18 ProgramData workflow, the downloaded artifact should be checked for internal consistency. The script at scripts/review-raydium-build-evidence.mjs performs those checks locally using Node.js built-ins only.

## How to run

1. Run the manual-only [Phase 6.19 pinned source build](../../.github/workflows/phase6-raydium-reference-build.yml) on main, with the workflow input confirm_source_build deliberately set to yes. This approval authorizes only the offline-from-chain source build.
2. Download and extract the raydium-cpmm-reference-build-evidence artifact from that run. Preserve the original ZIP and workflow-run URL as operator-controlled provenance.
3. Inspect the manifest and build logs, then run the reviewer locally from the repository root, substituting the actual extracted paths:

\`\`\`sh
node scripts/review-raydium-build-evidence.mjs \\
  --manifest ./raydium-build-evidence/raydium-reference-build-evidence.json \\
  --artifact-a ./raydium-build-evidence/artifacts/raydium_cp_swap-build-a.so \\
  --artifact-b ./raydium-build-evidence/artifacts/raydium_cp_swap-build-b.so \\
  --output ./raydium-build-evidence/review-report.json
\`\`\`

4. Review the review-report.json, original CI logs, manifest, artifact checksums, source repository/commit/tree, pinned CLI digest, and build-input hashes before deciding whether the evidence is suitable for the next explicit gate. Preserve both the original build artifact and the review report.

The command exits 0 only when the manifest and both supplied ELF files are internally consistent. It exits 1 for blocked or incomplete evidence and 2 for invalid arguments or unreadable inputs. The output file uses restrictive local file permissions when supported.

## What it verifies

- Manifest schema, timestamp and build-only scope.
- Exact pinned Raydium source repository, commit, tree and expected CPMM program ID.
- Expected library name, declared Rust/Solana/Anchor toolchain metadata, solana-verify version, and the independently pinned CLI SHA-256.
- Exactly two successful build records, clean-worktree assertions and required source-build input SHA-256 fields.
- Agreement between the two build-input digest sets, both recorded artifact digests and exact byte lengths, and the claimed reproducibility summary.
- ELF magic, bounded artifact size, SHA-256 recomputed from each supplied .so, exact recomputed byte lengths, and consistency of the candidate reference digest/length.
- Fail-closed result flags for RPC requests, live-program comparison, submitted transactions and trading authorization.

## Security and provenance limitations

A successful result is named PASS_MANIFEST_AND_ARTIFACT_CONSISTENCY. It is **not** cryptographic attestation of the GitHub Actions run, not independent source retrieval, not cross-organization reproducibility, and not proof that the checked files came from the claimed workflow run. The manifest itself is not signed. Keep artifact origin and the workflow run under manual review; a digest recomputed from a downloaded file proves that file's content, not its provenance.

The reviewer does not populate Phase 6.18 inputs, does not call any RPC endpoint, does not inspect ProgramData, and does not deploy, sign or trade. A passing report only makes the local artifacts a candidate for human provenance review. The separate Phase 6.18 live ProgramData comparison requires its own explicit approval after the reference artifact's provenance is reviewed. A hash match, if eventually observed, only describes equality with that reference at that observation and cannot prevent a future program upgrade.

## Tests

Fixture-based Node tests cover consistent evidence, changed ELF bytes, unpinned source commit/tree, failed build commands, differing input hashes, wrong CLI checksum/toolchain/program ID, dirty source assertions, invalid ELF, incorrect artifact length, unsafe result flags and missing review inputs. All tests use synthetic bytes and must not contact external providers or Solana RPC.
