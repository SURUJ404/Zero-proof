# Zero Proof API Documentation

This directory documents all APIs for the Zero Proof microservice architecture.

## Architecture

```
                    ┌─────────────────────┐
                    │   CLI (zp)          │
                    │   zp build/prove    │
                    └──────┬──────────────┘
                           │
                    ┌──────▼──────────────┐
                    │  Gateway (:8080)    │
                    │  /api/* health      │
                    └──┬─────────────┬────┘
                       │             │
              ┌────────▼──┐   ┌──────▼────────┐
              │ Build      │   │ Prover        │
              │ Service    │   │ Service       │
              │ (:8081)    │   │ (:8082)       │
              │ /api/build │   │ /api/prove    │
              │            │   │ /api/verify   │
              └────────────┘   └───────────────┘
```

## Services

| Service | Port | Description |
|---------|------|-------------|
| [Gateway](gateway.md) | 8080 | Unified entry point, routes requests |
| [Build Service](build-service.md) | 8081 | Compiles guest ELF programs |
| [Prover Service](prover-service.md) | 8082 | Generates and verifies ZK proofs |

## CLI

See [CLI Documentation](cli.md) for the `zp` command-line tool.

## Running

```bash
# Start all services
zp server start

# Check status
zp server status

# Build a guest
zp build ./path/to/guest

# Prove
zp prove ./path/to/guest.elf --input '{"data": "value"}'

# Verify
zp verify <receipt_b64> <image_id>

# Stop services
zp server stop
```
