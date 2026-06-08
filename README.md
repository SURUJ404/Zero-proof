# Zero Knowledge Prover

A zero-knowledge verifiable general computing platform based on
[zk-STARKs][zk-proof] and the [RISC-V] microarchitecture. Forked and rebranded
from [RISC Zero](https://risczero.com).

## Changes from Upstream

This fork has been fully rebranded from RISC Zero to **Zero Knowledge Prover**.
All modifications are tracked below:

### Rebranding
- All 550+ copyright headers changed from `RISC Zero, Inc.` to `suruj404`
- README, Cargo.toml metadata, and package names updated
- All `risczero.com` / `github.com/risc0` URLs replaced with this repo
- SECURITY.md and CONTRIBUTING.md rewritten for this fork

### CI/CD
- 7 GitHub Actions workflows configured for standard GitHub runners
- Release workflow triggers on tags (`v*.*.*`) — builds binaries and uploads to GitHub Releases
- CI runs on `ubuntu-latest` / `macos-latest` (no self-hosted runners needed)
- Guest code builds skipped in CI (`RISC0_SKIP_BUILD=1`) since custom RISC-V toolchain is not bundled

### Repository
- Clean git history (no LFS dependencies from upstream)
- All LFS-tracked files converted to regular binary blobs
- Includes `server/` crate for a REST API proving service (Axum-based)

## Building

```bash
cargo build
```

## Releases

To create a release:

```bash
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build binaries for Linux (x86_64) and macOS (ARM64) and
upload them to the release page.

## Feature flags

| Feature | Target(s) | Implies | Description | Crates |
|---------|-----------|---------|-------------|--------|
| client | all | std | Enables the client API | zkvm |
| cuda | | prove, std | Enables CUDA GPU acceleration for the prover | circuit-recursion, circuit-rv32im, zkp, zkvm |
| disable-dev-mode | all | | Disables dev mode | zkvm |
| prove | all | std | Enables the prover | circuit-recursion, circuit-rv32im, zkp, zkvm |
| std | all | | Support for Rust stdlib | circuit-recursion, circuit-rv32im, zkp, zkvm |

## License

This project is dual-licensed under either:

- [Apache License, Version 2.0](LICENSE-APACHE)
- [MIT License](LICENSE-MIT)

[risc-v]: https://en.wikipedia.org/wiki/RISC-V
[zk-proof]: https://en.wikipedia.org/wiki/Non-interactive_zero-knowledge_proof
