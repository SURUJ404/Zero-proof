# Bevy Game Engine Example

This code demonstrates a minimal example of how to use the [bevy] game engine inside the Zero Proof [zkVM].

## Quick Start

First, follow the [examples guide] to install dependencies and check out the correct version of the example.

Then, run the example with:

```bash
cargo run --release
```

## Use Cases

By using this demo as part of a [Bonsai application], you could build an app where on-chain payment depends on off-chain gameplay.
To learn more about this use case, check out our blog post about using Bonsai as a [zk coprocessor].

To link gameplay to a particular player, you may want to pair this demo with the [ECDSA] demo, which would allow a player to sign their moves.

## Project Organization

zkVM applications are organized into a [host program] and a [guest program].
The host program can be found in [`src/main.rs`] and the guest program can be found in [`methods/guest/src/main.rs`].

The [host] first [executes] the guest program and then [proves the execution] to construct a [receipt].
The receipt can be passed to a third party, who can examine the [journal] to check the program's outputs and can [verify] the [receipt] to ensure the integrity of the [guest program]'s execution.

## More Resources

For more information about building, running, and testing zkVM applications, see our [developer docs].

[`methods/guest/src/main.rs`]: methods/guest/src/main.rs
[`src/main.rs`]: src/main.rs
[bevy]: https://bevyengine.org/
[Bonsai application]: https://dev.bonsai.xyz
[developer docs]: https://github.com/suruj404/zero-knowledgerisc/zkvm
[ECDSA]: https://github.com/suruj404/zero-knowledgerisc/tree/main/examples/ecdsa
[examples guide]: https://github.com/suruj404/zero-knowledgerisc/api/zkvm/examples/#running-the-examples
[executes]: https://github.com/suruj404/zero-knowledgerisc/terminology#execute
[guest program]: https://github.com/suruj404/zero-knowledgerisc/terminology#guest-program
[host]: https://github.com/suruj404/zero-knowledgerisc/terminology#host
[host program]: https://github.com/suruj404/zero-knowledgerisc/terminology#host-program
[journal]: https://github.com/suruj404/zero-knowledgerisc/terminology#journal
[proves the execution]: https://github.com/suruj404/zero-knowledgerisc/terminology#prove
[receipt]: https://github.com/suruj404/zero-knowledgerisc/terminology#receipt
[verify]: https://github.com/suruj404/zero-knowledgerisc/terminology#verify
[zk coprocessor]: https://www.github.com/SURUJ404/Zero-proof/blog/a-guide-to-zk-coprocessors-for-scalability
[zkVM]: https://github.com/suruj404/zero-knowledgerisc/zkvm
