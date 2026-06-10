use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    Json, Router,
    routing::{get, post},
};
use risc0_zkvm::{default_prover, ExecutorEnv, ProverOpts, VerifierOpts};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use tracing::{error, info};

#[derive(Clone)]
struct AppState {}

#[derive(Deserialize)]
struct ProveRequest {
    elf_b64: String,
    input_json: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct ProveResponse {
    success: bool,
    receipt_b64: Option<String>,
    image_id: Option<String>,
    elapsed_ms: Option<u64>,
    message: String,
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
    service: &'static str,
    status: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "prover-service",
        status: "ok",
    })
}

async fn prove_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<ProveRequest>,
) -> (StatusCode, Json<ProveResponse>) {
    info!("Prove request received");

    let elf_bytes = match BASE64_STANDARD.decode(&req.elf_b64) {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ProveResponse {
                    success: false,
                    receipt_b64: None,
                    image_id: None,
                    elapsed_ms: None,
                    message: format!("Invalid base64 ELF: {e}"),
                }),
            );
        }
    };

    let mut env_builder = ExecutorEnv::builder();
    if let Some(input) = &req.input_json {
        env_builder.write(&input).unwrap();
    }
    let env = env_builder.build().unwrap();

    let prover = default_prover();
    let start = std::time::Instant::now();

    match prover.prove_with_opts(env, &elf_bytes, &ProverOpts::default()) {
        Ok(receipt) => {
            let elapsed = start.elapsed().as_millis() as u64;
            let receipt_bytes = bincode::serialize(&receipt).unwrap();
            let receipt_b64 = BASE64_STANDARD.encode(&receipt_bytes);
            let image_id = hex::encode(receipt.inner.claim().unwrap().image_id.as_bytes());

            (StatusCode::OK, Json(ProveResponse {
                success: true,
                receipt_b64: Some(receipt_b64),
                image_id: Some(image_id),
                elapsed_ms: Some(elapsed),
                message: "Proof generated successfully".to_string(),
            }))
        }
        Err(e) => {
            error!("Proving failed: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(ProveResponse {
                success: false,
                receipt_b64: None,
                image_id: None,
                elapsed_ms: None,
                message: format!("Proving failed: {e}"),
            }))
        }
    }
}

async fn verify_handler(
    State(_state): State<Arc<AppState>>,
    Json(req): Json<VerifyRequest>,
) -> (StatusCode, Json<VerifyResponse>) {
    info!("Verify request received");

    let receipt_bytes = match BASE64_STANDARD.decode(&req.receipt_b64) {
        Ok(b) => b,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(VerifyResponse {
                    verified: false,
                    message: format!("Invalid base64 receipt: {e}"),
                }),
            );
        }
    };

    let receipt: risc0_zkvm::Receipt = match bincode::deserialize(&receipt_bytes) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(VerifyResponse {
                    verified: false,
                    message: format!("Invalid receipt data: {e}"),
                }),
            );
        }
    };

    let image_id = match hex::decode(&req.image_id) {
        Ok(id) => {
            let mut arr = [0u8; 32];
            arr.copy_from_slice(&id);
            arr
        }
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(VerifyResponse {
                    verified: false,
                    message: format!("Invalid image_id hex: {e}"),
                }),
            );
        }
    };

    match receipt.verify(image_id) {
        Ok(()) => (
            StatusCode::OK,
            Json(VerifyResponse {
                verified: true,
                message: "Receipt verified successfully".to_string(),
            }),
        ),
        Err(e) => (
            StatusCode::BAD_REQUEST,
            Json(VerifyResponse {
                verified: false,
                message: format!("Verification failed: {e}"),
            }),
        ),
    }
}

use base64::Engine as _;
use base64::engine::general_purpose::STANDARD as BASE64_STANDARD;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let port = std::env::var("PROVER_SERVICE_PORT").unwrap_or_else(|_| "8082".to_string());

    let state = Arc::new(AppState {});

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/prove", post(prove_handler))
        .route("/api/verify", post(verify_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = format!("0.0.0.0:{port}").parse().expect("Invalid address");
    info!("Prover service listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
