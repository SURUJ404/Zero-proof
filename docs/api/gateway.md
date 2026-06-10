# Gateway API

**Port:** 8080 (configurable via `GATEWAY_PORT` env)
**Base URL:** `http://localhost:8080`

The gateway is the **single entry point** for all microservices. It proxies requests to the appropriate backend.

| Client request | Gateway proxies to |
|---|---|
| `POST /api/build` | Build Service `POST /api/build` |
| `POST /api/prove` | Prover Service `POST /api/prove` |
| `POST /api/verify` | Prover Service `POST /api/verify` |
| `GET /api/health` | Aggregated (local) |

## Endpoints

### GET /

Root endpoint with service information.

**Response:**
```json
{
  "service": "gateway",
  "version": "0.1.0",
  "endpoints": {
    "build": "POST /api/build",
    "prove": "POST /api/prove",
    "verify": "POST /api/verify",
    "health": "GET /api/health"
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

---

### POST /api/build

Proxied to Build Service. See [Build Service API](build-service.md#post-apibuild).

---

### POST /api/prove

Proxied to Prover Service. See [Prover Service API](prover-service.md#post-apiprove).

---

### POST /api/verify

Proxied to Prover Service. See [Prover Service API](prover-service.md#post-apiverify).

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `GATEWAY_PORT` | `8080` | Port to listen on |
| `BUILD_SERVICE_URL` | `http://localhost:8081` | Upstream build service URL |
| `PROVER_SERVICE_URL` | `http://localhost:8082` | Upstream prover service URL |
