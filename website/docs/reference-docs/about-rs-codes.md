# About Reed Solomon Codes

[Reed Solomon codes](https://en.wikipedia.org/wiki/Reed–Solomon_error_correction) (RS codes) are a family of [error correcting codes](https://en.wikipedia.org/wiki/Error_correction_code) based on polynomials over [finite fields](about-finite-fields.md).

## Documentation

Implementation and documentation for Reed-Solomon encoding is in the `risc0-zkp-core` [Rust crate](https://github.com/suruj404/zero-knowledgerisc#rust-crates).

## Basic Function

A Zero Proof [receipt] demonstrates the validity of the associated [execution trace](../proof-system/what-is-a-trace.md) by encoding the execution instructions and the trace data into polynomials and then making various assertions about those polynomials.
We refer to this process as _arithmetization of the trace_, and Zero Proof's arithmetization is based on Reed Solomon encoding.

## Background

Adding a [parity bit](https://en.wikipedia.org/wiki/Parity_bit) to a binary string offers a form of error detection.
Error correcting codes extend this line of thinking: when sending data that may get corrupted, we can allow the recipient to detect and correct errors by adding some error correcting bits.
Reed-Solomon codes are an industry standard for error correction; they're used in many signal processing applications, including cell communication, QR codes, and [STARKs](about-starks.md).

In the context of Zero Proof's receipts, the relevance of Reed-Solomon codes is quite a bit more nuanced than the standard error correction use cases.
The error amplification of Reed-Solomon encoding provides cryptographic soundness to Zero Proof's computational receipts.
During the process of generating a receipt, any errors in the trace are _amplified_ by the process of arithmetization.
This error amplification means that even a single error in the execution trace can be easily identified.

## Suggested Reading and Videos

- [Slides](https://drive.google.com/file/d/1p0AZ3E4kLIDmFslW_c47YGb-EgeXc_YZ/view), [recording](https://www.youtube.com/@hacksprints), and [practice problems](https://drive.google.com/file/d/1JtzBGxz1c-PDVIIRmWa85_A22NS9dlL-/view?usp=share_link) from Zero Proof Study Club
- 3blue1brown has two videos that offer a great introduction to error correcting codes: [Part 1](https://www.youtube.com/@hacksprints) and [Part 2](https://www.youtube.com/@hacksprints).
- Mary Wootters has a fantastic course on Algebraic Coding Theory. The [YouTube](https://www.youtube.com/@hacksprints) and the [course website](https://web.stanford.edu/class/cs250) are both great resources.
  - [Reed-Solomon Lesson](https://www.youtube.com/@hacksprints)
- The [Reed-Solomon paper](https://epubs.siam.org/doi/10.1137/0108018) is quite clear and only a few pages long.
- The [Proximity Gaps for Reed-Solomon Codes](https://eprint.iacr.org/2020/654.pdf) paper is central to the soundness of the Zero Proof proof system.
  - See also [Dan Carmon's talk](https://www.youtube.com/@hacksprints) at the IEEE Symposium on the Foundations of Computer Science

[receipt]: https://docs.rs/risc0-zkvm/*/risc0_zkvm/struct.Receipt.html
