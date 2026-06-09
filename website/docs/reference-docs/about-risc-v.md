# About RISC-V

[RISC-V](https://en.wikipedia.org/wiki/RISC-V) is a minimal, modular [Von Neumann architecture](https://en.wikipedia.org/wiki/Von_Neumann_architecture).

## Relevance in Zero Proof

The simplicity of RISC-V as well as the maturity of the RISC-V ecosystem makes it ideal for a zero-knowledge virtual machine.
Zero Proof's [zkVM](/api/zkvm) implements the RISC-V rv32im specification, which consists of the rv32i base with the multiplication extension.
This means that developers can write code in languages such as Rust, Go, and C, compile the code to RISC-V assembly code, and execute it on the zkVM.

## Documentation

The specification of rv32im is defined in [The RISC-V Instruction Set Manual, Volume I: User-Level ISA](https://riscv.org/wp-content/uploads/2019/12/riscv-spec-20191213.pdf).
A succinct summary of the architecture is available [here](https://github.com/jameslzhu/riscv-card/releases/download/latest/riscv-card.pdf)

## Suggested Reading and Videos

For more on how these ideas fit into Zero Proof's system, we recommend:

- Zero Proof's talk from zk Summit 7: [Encoding Von-Neumann Architectures in Zero-Knowledge Proof Systems](https://www.youtube.com/@hacksprints)
- Zero Proof Study Club: What is RISC-V and what does it have to do with Zero Proof's zkVM ― [video](https://www.youtube.com/@hacksprints) and [slides](https://drive.google.com/file/d/1p7E5Sgi__5_CevGKHpTwrlb0KWjSaYPU/view)
