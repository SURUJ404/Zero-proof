# Prover Service API

**Port:** 8082 (configurable via `PROVER_SERVICE_PORT` env)
**Base URL:** `http://localhost:8082`

## Endpoints

### GET /api/health

Health check endpoint.

**Response:**
```json
{
  "service": "prover-service",
  "status": "ok"
}
```

---

### POST /api/prove

Executes a guest ELF in the zkVM and produces a zero-knowledge receipt.

**Request Body:**
```json
{
  "elf_b64": "<base64-encoded ELF binary>",
  "input_json": {
    "data": "value"
  }
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `elf_b64` | string | yes | Base64-encoded RISC-V ELF binary |
| `input_json` | object | no | JSON input passed to the guest program |

**Response (200):**
```json
{
  "success": true,
  "receipt_b64": "<base64-encoded receipt>",
  "image_id": "abc123def456...",
  "elapsed_ms": 1234,
  "message": "Proof generated successfully"
}
```

**Response (400/500):**
```json
{
  "success": false,
  "receipt_b64": null,
  "image_id": null,
  "elapsed_ms": null,
  "message": "Invalid base64 ELF: ..."
}
```

---

### POST /api/verify

Verifies a zero-knowledge receipt against an image ID.

**Request Body:**
```json
{
  "receipt_b64": "<base64-encoded receipt>",
  "image_id": "abc123def456..."
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `receipt_b64` | string | yes | Base64-encoded receipt |
| `image_id` | string | yes | Hex-encoded image ID (32 bytes) |

**Response (200 - verified):**
```json
{
  "verified": true,
  "message": "Receipt verified successfully"
}
```

**Response (400 - not verified):**
```json
{
  "verified": false,
  "message": "Verification failed: ..."
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PROVER_SERVICE_PORT` | `8082` | Port to listen on |
