# Gateway API

**Port:** 8080 (configurable via `GATEWAY_PORT` env)
**Base URL:** `http://localhost:8080`

## Endpoints

### GET /

Root endpoint with service information.

**Response:**
```json
{
  "service": "gateway",
  "version": "0.1.0",
  "endpoints": {
    "build": "http://localhost:8081",
    "prover": "http://localhost:8082"
  }
}
```

---

### GET /api/health

Aggregated health check across all services.

**Response:**
```json
{
  "service": "gateway",
  "status": "ok",
  "services": {
    "build_service": "up",
    "prover_service": "up"
  }
}
```

Each service reports one of: `"up"`, `"degraded"`, or `"down"`.

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | `8080` | Port to listen on |
| `BUILD_SERVICE_URL` | `http://localhost:8081` | Upstream build service URL |
| `PROVER_SERVICE_URL` | `http://localhost:8082` | Upstream prover service URL |
