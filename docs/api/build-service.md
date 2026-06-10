# Build Service API

**Port:** 8081 (configurable via `BUILD_SERVICE_PORT` env)
**Base URL:** `http://localhost:8081`

## Endpoints

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "service": "build-service",
  "status": "ok"
}
```

---

### POST /api/build

Compiles a RISC-V guest program into an ELF binary.

**Request Body:**
```json
{
  "guest_path": "/path/to/guest/crate",
  "guest_name": "my_guest"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `guest_path` | string | yes | Path to the guest crate directory |
| `guest_name` | string | no | Name for the output ELF (defaults to directory name) |

**Response (200):**
```json
{
  "success": true,
  "elf_path": "/data/elfs/my_guest.elf",
  "image_id": "abc123...",
  "message": "Build successful"
}
```

**Response (400/500):**
```json
{
  "success": false,
  "elf_path": null,
  "image_id": null,
  "message": "Guest path not found: /invalid/path"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `BUILD_SERVICE_PORT` | `8081` | Port to listen on |
| `ZP_DATA_DIR` | `./data` | Directory for build artifacts |
