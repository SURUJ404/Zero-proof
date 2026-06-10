# CLI: `zp` (Zero Proof)

A unified command-line interface for the Zero Proof microservice architecture.

## Installation

```bash
cargo build -p zp
```

## Usage

```
zp <COMMAND>

Commands:
  build    Build a guest program ELF
  prove    Generate a zero-knowledge proof
  verify   Verify a receipt
  server   Manage microservices
  config   View or modify CLI configuration
  help     Print help
```

## Commands

### zp build

Builds a guest program into a RISC-V ELF binary.

```
zp build <GUEST_PATH> [--guest-name <NAME>] [--local]
```

| Arg | Description |
|-----|-------------|
| `GUEST_PATH` | Path to the guest crate directory |
| `--guest-name` | Name for the output ELF |
| `--local` | Build locally (requires `--features local`) |

### zp prove

Executes a guest ELF and generates a zero-knowledge proof.

```
zp prove <ELF_PATH> [--input <JSON>] [--local]
```

| Arg | Description |
|-----|-------------|
| `ELF_PATH` | Path to the ELF binary |
| `--input` | JSON input as a string |
| `--local` | Prove locally (requires `--features local`) |

### zp verify

Verifies a zero-knowledge receipt against an image ID.

```
zp verify <RECEIPT_B64> <IMAGE_ID> [--local]
```

| Arg | Description |
|-----|-------------|
| `RECEIPT_B64` | Base64-encoded receipt |
| `IMAGE_ID` | Hex-encoded image ID |
| `--local` | Verify locally (requires `--features local`) |

### zp server

Manages the microservice lifecycle.

```
zp server <ACTION>

Actions:
  start    Start all services via docker-compose
  stop     Stop all services
  status   Check service health
  logs     Tail service logs
```

### zp config

View or modify CLI configuration.

```
zp config <ACTION>

Actions:
  show              Display current config
  set <KEY> <VALUE> Set a config value
  reset             Reset to defaults
```

**Configuration keys:**
- `build_service_url`
- `prover_service_url`
- `gateway_url`
- `data_dir`

## Routing

By default, all CLI commands route through the **Gateway** (`http://localhost:8080`) which proxies to the appropriate backend service. You can bypass the gateway and hit services directly by configuring:

```
zp config set build_service_url http://localhost:8081
zp config set prover_service_url http://localhost:8082
```

## Configuration File

Located at:
- Linux: `~/.config/zero-proof/config.json`
- macOS: `~/Library/Application Support/zero-proof/config.json`
- Windows: `C:\Users\<USER>\AppData\Roaming\zero-proof\config.json`
