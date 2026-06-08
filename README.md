# Zero Knowledge Prover

A zero-knowledge verifiable general computing platform based on
[zk-STARKs][zk-proof] and the [RISC-V] microarchitecture.

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
