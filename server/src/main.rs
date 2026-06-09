use std::sync::Arc;

use axum::{
    Router,
    extract::{Json, State},
    http::{
        Method,
        header::{AUTHORIZATION, CONTENT_TYPE},
        HeaderValue, StatusCode,
    },
    response::IntoResponse,
    routing::{get, post},
};
use risc0_binfmt::compute_image_id;
use risc0_zkvm::{ExecutorEnv, ProverOpts, Receipt, default_prover};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use tracing::info;

#[derive(Clone)]
struct AppState {
    start_time: std::time::Instant,
}

#[derive(Deserialize)]
struct ProveRequest {
    elf: String,
    input: serde_json::Value,
}

#[derive(Serialize)]
struct ProveResponse {
    receipt_b64: String,
    image_id: String,
    elapsed_ms: u64,
}

#[derive(Deserialize)]
struct VerifyRequest {
    receipt_b64: String,
    image_id: String,
}

#[derive(Serialize)]
struct VerifyResponse {
    verified: bool,
    message: String,
}

#[derive(Serialize)]
struct HealthResponse {
    status: String,
    uptime_secs: u64,
    dev_mode: bool,
    prover_type: String,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let dev_mode = std::env::var("RISC0_DEV_MODE")
        .map(|v| v == "true" || v == "1")
        .unwrap_or(true);
    let prover = std::env::var("RISC0_PROVER").unwrap_or_else(|_| "local".into());

    Json(HealthResponse {
        status: "ok".into(),
        uptime_secs: state.start_time.elapsed().as_secs(),
        dev_mode,
        prover_type: prover,
    })
}

async fn prove(Json(req): Json<ProveRequest>) -> Result<Json<ProveResponse>, AppError> {
    let start = std::time::Instant::now();

    let elf_bytes = base64_decode(&req.elf)?;

    let env = ExecutorEnv::builder()
        .write(&req.input)
        .map_err(|e| AppError::bad_request(format!("write input: {e}")))?
        .build()
        .map_err(|e| AppError::bad_request(format!("build env: {e}")))?;

    let prover = default_prover();
    info!("Proving with {}", prover.get_name());
    let prove_info = prover
        .prove_with_opts(env, &elf_bytes, &ProverOpts::default())
        .map_err(|e| AppError::internal(format!("proving failed: {e}")))?;

    let receipt = prove_info.receipt;
    let image_id = compute_image_id(&elf_bytes)
        .map_err(|e| AppError::internal(format!("compute image_id: {e}")))?;

    let receipt_bytes = bincode::serialize(&receipt)
        .map_err(|e| AppError::internal(format!("serialize receipt: {e}")))?;

    let elapsed = start.elapsed().as_millis() as u64;
    info!("Proving completed in {elapsed}ms");

    Ok(Json(ProveResponse {
        receipt_b64: base64_encode(&receipt_bytes),
        image_id: hex::encode(image_id.as_bytes()),
        elapsed_ms: elapsed,
    }))
}

async fn verify(Json(req): Json<VerifyRequest>) -> Result<Json<VerifyResponse>, AppError> {
    let receipt_bytes = base64_decode(&req.receipt_b64)?;
    let receipt: Receipt = bincode::deserialize(&receipt_bytes)
        .map_err(|e| AppError::bad_request(format!("deserialize receipt: {e}")))?;

    let image_id_bytes = hex::decode(&req.image_id)
        .map_err(|e| AppError::bad_request(format!("invalid image_id: {e}")))?;

    if image_id_bytes.len() != 32 {
        return Err(AppError::bad_request("image_id must be 32 bytes (64 hex chars)".into()));
    }

    let image_id: [u8; 32] = image_id_bytes
        .try_into()
        .map_err(|_| AppError::bad_request("image_id must be 32 bytes".into()))?;

    match receipt.verify(image_id) {
        Ok(()) => Ok(Json(VerifyResponse {
            verified: true,
            message: "Receipt verified successfully".into(),
        })),
        Err(e) => Ok(Json(VerifyResponse {
            verified: false,
            message: format!("Verification failed: {e}"),
        })),
    }
}

fn base64_encode(data: &[u8]) -> String {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD.encode(data)
}

fn base64_decode(s: &str) -> Result<Vec<u8>, AppError> {
    use base64::Engine;
    base64::engine::general_purpose::STANDARD
        .decode(s)
        .map_err(|e| AppError::bad_request(format!("invalid base64: {e}")))
}

struct AppError {
    status: StatusCode,
    message: String,
}

impl AppError {
    fn bad_request(msg: String) -> Self {
        Self { status: StatusCode::BAD_REQUEST, message: msg }
    }
    fn internal(msg: String) -> Self {
        Self { status: StatusCode::INTERNAL_SERVER_ERROR, message: msg }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> axum::response::Response {
        let body = Json(serde_json::json!({ "error": self.message }));
        (self.status, body).into_response()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::Request;
    use bytes::Bytes;
    use http_body_util::Full;
    use tower::ServiceExt;

    fn json_body<T: Serialize>(value: &T) -> Body {
        let json = serde_json::to_string(value).unwrap();
        Body::new(Full::new(Bytes::from(json)))
    }

    #[tokio::test]
    async fn test_health_ok() {
        let state = Arc::new(AppState {
            start_time: std::time::Instant::now(),
        });
        let app = Router::new()
            .route("/api/health", get(health))
            .with_state(state);
        let resp = app
            .oneshot(Request::builder().uri("/api/health").body(Body::empty()).unwrap())
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_prove_rejects_bad_base64() {
        let state = Arc::new(AppState {
            start_time: std::time::Instant::now(),
        });
        let app = Router::new()
            .route("/api/prove", post(prove))
            .with_state(state);
        let req = ProveRequest {
            elf: "!!!invalid".into(),
            input: serde_json::Value::Null,
        };
        let resp = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/prove")
                    .header(CONTENT_TYPE, "application/json")
                    .body(json_body(&req))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_verify_rejects_bad_base64() {
        let state = Arc::new(AppState {
            start_time: std::time::Instant::now(),
        });
        let app = Router::new()
            .route("/api/verify", post(verify))
            .with_state(state);
        let req = VerifyRequest {
            receipt_b64: "!!!invalid".into(),
            image_id: "abcd".into(),
        };
        let resp = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/verify")
                    .header(CONTENT_TYPE, "application/json")
                    .body(json_body(&req))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn test_verify_rejects_short_image_id() {
        let state = Arc::new(AppState {
            start_time: std::time::Instant::now(),
        });
        let app = Router::new()
            .route("/api/verify", post(verify))
            .with_state(state);
        let req = VerifyRequest {
            receipt_b64: base64_encode(b"some garbage bytes"),
            image_id: "a1b2".into(),
        };
        let resp = app
            .oneshot(
                Request::builder()
                    .method(Method::POST)
                    .uri("/api/verify")
                    .header(CONTENT_TYPE, "application/json")
                    .body(json_body(&req))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[test]
    fn test_base64_roundtrip() {
        let data = b"hello world";
        let encoded = base64_encode(data);
        let decoded = base64_decode(&encoded).unwrap();
        assert_eq!(decoded, data);
    }

    #[test]
    fn test_base64_decode_invalid() {
        assert!(base64_decode("!!!").is_err());
    }

    #[test]
    fn test_app_error_bad_request() {
        let err = AppError::bad_request("test".into());
        assert_eq!(err.status, StatusCode::BAD_REQUEST);
        assert_eq!(err.message, "test");
    }

    #[test]
    fn test_app_error_internal() {
        let err = AppError::internal("test".into());
        assert_eq!(err.status, StatusCode::INTERNAL_SERVER_ERROR);
        assert_eq!(err.message, "test");
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::from_default_env())
        .init();

    let dev_mode = std::env::var("RISC0_DEV_MODE").unwrap_or_else(|_| "true".into());
    info!("Starting ZK Prover Server");
    info!("RISC0_DEV_MODE={dev_mode}");

    let state = Arc::new(AppState {
        start_time: std::time::Instant::now(),
    });

    let cors_origin = std::env::var("CORS_ORIGIN").ok();
    let cors = match cors_origin {
        Some(origin) => CorsLayer::new()
            .allow_origin(origin.parse::<HeaderValue>().expect("Invalid CORS_ORIGIN"))
            .allow_methods([Method::GET, Method::POST])
            .allow_headers([AUTHORIZATION, CONTENT_TYPE]),
        None => CorsLayer::permissive(),
    };

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/prove", post(prove))
        .route("/api/verify", post(verify))
        .layer(cors)
        .with_state(state);

    let port = std::env::var("PORT").unwrap_or_else(|_| "8080".into());
    let addr = format!("0.0.0.0:{port}");
    let listener = tokio::net::TcpListener::bind(&addr).await.unwrap();
    info!("Listening on http://{addr}");

    axum::serve(listener, app).await.unwrap();
}
