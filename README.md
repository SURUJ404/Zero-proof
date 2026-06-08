# Zero Knowledge Prover

A zero-knowledge verifiable general computing platform based on
[zk-STARKs][zk-proof] and the [RISC-V] microarchitecture.

A [zero knowledge proof][zk-proof] allows one party (the prover) to convince
another party (the verifier) that something is true without revealing all the
details. The prover can show that they correctly executed
some code (known to both parties), while only revealing to the verifier the
output of the code, not any of its inputs or any state during execution.

The code runs in a special virtual machine, called a _zkVM_. The zkVM
emulates a small [RISC-V] computer, allowing it to run arbitrary code in any
language, so long as a compiler toolchain exists that targets RISC-V. Currently,
SDK support exists for Rust, C, and C⁠+⁠+.

## Protocol overview and terminology

First, the code to be proven must be compiled from its implementation language
into a _method_. A method is represented by a RISC-V ELF file with a special
entry point that runs the code of the method. Additionally, one can compute for
a given method its _image ID_ which is a special type of cryptographic hash of
the ELF file, and is required for verification.

Next, the host program runs and proves the method inside the zkVM. The logical
RISC-V machine running inside the zkVM is called the _guest_ and the prover
running the zkVM is called the _host_. The guest and the host can communicate
with each other during the execution of the method, but the host cannot modify
the execution of the guest in any way, or the proof being generated will be
invalid. During execution, the guest code can write to a special append-only log
called the _journal_ which represents the official output of the computation.

Presuming the method terminated correctly, a _receipt_ is produced, which
provides the proof of correct execution. This receipt consists of 2 parts: the
journal written during execution and a blob of opaque cryptographic data called
the _seal_.

The verifier can then verify the receipt and examine the log. If any tampering
was done to the journal or the seal, the receipt will fail to verify.
Additionally, it is cryptographically infeasible to generate a valid receipt
unless the output of the journal is the exactly correct output for some valid
execution of the method whose image ID matches the receipt. In summary, the
receipt acts as a zero-knowledge proof of correct execution.

Because the protocol is zero-knowledge, the verifier cannot infer anything about
the details of the execution or any data passed between the host and the guest
(aside from what is implied by the data written to the journal and the correct
execution of the code).

## Security

This code implements a [three-layer recursive proof system][zksummit10-talk],
based on the well-studied zk-STARK protocol and Groth16 protocol. An overview of
the underlying cryptographic assumptions can be found in the [Security
Model][security-model] documentation. With default parameters, this system achieves
perfect zero-knowledgeness and 98 bits of conjectured security.

## Getting Started

### Prerequisites

- [Rust](https://rustup.rs/) (stable, managed via rustup)
- [Docker](https://docs.docker.com/get-docker/)

### Installation

Install the toolchain:

```bash
curl -L https://github.com/suruj404/zero-knowledgerisc/releases/latest/download/install.sh | bash
rzup install
```

### Building from source

```bash
cargo build
```

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
[security-model]: https://github.com/suruj404/zero-knowledgerisc/security/model
[zk-proof]: https://en.wikipedia.org/wiki/Non-interactive_zero-knowledge_proof
[zksummit10-talk]: https://www.youtube.com/watch?v=wkIBN2CGJdc
