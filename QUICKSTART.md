# Zero-Proof Quick Start

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (must be running)
- Rust toolchain (see `rust-toolchain.toml`)

## One-Command Setup

```powershell
.\start.ps1
```

This will start all microservices and build the hello-world example.

## Manual Steps

```powershell
# 1. Start microservices (Gateway :8080, Build :8081, Prover :8082)
zp server start

# 2. Build a guest program
zp build examples\hello-world\methods\guest

# 3. Prove execution
zp prove .\data\elfs\<guest-name>.elf --input '[17,23]'

# 4. Verify the receipt
zp verify <receipt> <image_id>

# 5. Stop services when done
zp server stop
```

## Build Without Docker

```powershell
zp build examples\hello-world\methods\guest --local
```

## Examples Compatible with `zp build`

Out of 25 example projects, **3** use the `zp build` CLI directly:

| Example | Guest Path |
|---|---|
| **hello-world** | `examples\hello-world\methods\guest` |
| **digital-signature** | `examples\digital-signature\methods\guest` |
| **voting-machine** (3 binaries) | `examples\voting-machine\methods\guest` |

The remaining 22 examples (chess, ecdsa, json, password-checker, sha, etc.) use the older `cargo run` + `build.rs` workflow instead of `zp build`.

## Useful Commands

| Command | Description |
|---|---|
| `zp server status` | Check service health |
| `zp server logs` | View service logs |
| `zp server stop` | Stop all services |
| `zp config show` | Show current configuration |
| `zp build <path> --local` | Build without Docker |

## Project Structure

```
├── cli/              # zp CLI tool
├── services/         # Microservices (gateway, build, prover)
├── examples/         # Example guest programs
│   └── hello-world/  # Minimal hello-world demo
├── risc0/            # zkVM implementation
├── server/           # Standalone prover server
└── start.ps1         # One-click startup script
```

For detailed docs, see [README.md](./README.md) and the [docs/](./docs/) folder.
