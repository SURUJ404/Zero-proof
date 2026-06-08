# Hello World for the Zero Proof zkVM

Welcome!

This `hello-world` example is a minimal application for the Zero Proof [zkVM],
designed to help you get started building zkVM applications.

For a step-by-step guide to building your first zkVM application, we recommend
[this tutorial][tutorial].

## Quick Start

First, follow the [examples guide] to install dependencies and check out the correct version of the example.

Then, run the example with:

```bash
cargo run --release
```

Congratulations! You just constructed a zero-knowledge proof that you know the
factors of 391.

## Use Cases

Writing an application for the Zero Proof [zkVM] is the easiest way for software
developers to produce zero-knowledge proofs. Whether you're building for
blockchains or not, Zero Proof offers the most flexible and mature
ecosystem for developing applications that involve ZKPs.

You can run the zkVM locally and your secrets will never leave your own machine,
or you can upload your program & inputs to [Bonsai] for remote proving.

## Project Organization

zkVM applications are organized into a [host program] and a [guest program]. The
host program can be found in [`src/main.rs`] and the guest program can be found
in [`methods/guest/src/main.rs`].

The [host] first [executes] the guest program and then [proves the
execution][prove] to construct a [receipt]. The receipt can be passed to a third
party, who can examine the [journal] to check the program's outputs and can
[verify] the [receipt] to ensure the integrity of the [guest program]'s
execution.

### What gets proven?

The [receipt] proves that the [guest program] was executed correctly, and that
the contents of `receipt.journal` match what was written by `env::commit()`
during the execution of the guest program.

By running the demo, Alice demonstrates that she knows two integers that
multiply to give the number written in `receipt.journal`. Thus, Alice proves
that the number written in `receipt.journal` is composite — and that she knows
the factors — without revealing any further information.

## Tutorial: Building your first zkVM Application

For a step-by-step guide to building your first zkVM application, we recommend [this
tutorial][tutorial]. For more materials, check out the [developer docs].

[`methods/guest/src/main.rs`]: ./methods/guest/src/main.rs
[`src/main.rs`]: ./src/main.rs
[Bonsai]: https://dev.bonsai.xyz
[developer docs]: https://github.com/suruj404/zero-knowledgerisc/zkvm
[examples guide]: https://github.com/suruj404/zero-knowledgerisc/api/zkvm/examples/#running-the-examples
[executes]: https://github.com/suruj404/zero-knowledgerisc/terminology#execute
[guest program]: https://github.com/suruj404/zero-knowledgerisc/terminology#guest-program
[host]: https://github.com/suruj404/zero-knowledgerisc/terminology#host
[host program]: https://github.com/suruj404/zero-knowledgerisc/terminology#host-program
[journal]: https://github.com/suruj404/zero-knowledgerisc/terminology#journal
[prove]: https://github.com/suruj404/zero-knowledgerisc/terminology#prove
[receipt]: https://github.com/suruj404/zero-knowledgerisc/terminology#receipt
[tutorial]: https://github.com/suruj404/zero-knowledgerisc/api/zkvm/tutorials/hello-world
[verify]: https://github.com/suruj404/zero-knowledgerisc/terminology#verify
[zkVM]: https://github.com/suruj404/zero-knowledgerisc/zkvm
