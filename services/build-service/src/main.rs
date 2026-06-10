use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    Json, Router,
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use tower_http::cors::CorsLayer;
use tracing::{error, info};

#[derive(Clone)]
struct AppState {
    data_dir: PathBuf,
}

#[derive(Deserialize)]
struct BuildRequest {
    guest_path: String,
    guest_name: Option<String>,
}

#[derive(Serialize)]
struct BuildResponse {
    success: bool,
    elf_path: Option<String>,
    image_id: Option<String>,
    message: String,
}

#[derive(Serialize)]
struct HealthResponse {
    service: &'static str,
    status: &'static str,
}

async fn health() -> Json<HealthResponse> {
    Json(HealthResponse {
        service: "build-service",
        status: "ok",
    })
}

async fn build_handler(
    State(state): State<Arc<AppState>>,
    Json(req): Json<BuildRequest>,
) -> (StatusCode, Json<BuildResponse>) {
    info!("Build request: {}", req.guest_path);

    let guest_path = PathBuf::from(&req.guest_path);
    if !guest_path.exists() {
        return (
            StatusCode::BAD_REQUEST,
            Json(BuildResponse {
                success: false,
                elf_path: None,
                image_id: None,
                message: format!("Guest path not found: {}", req.guest_path),
            }),
        );
    }

    let out_dir = state.data_dir.join("elfs");
    if let Err(e) = std::fs::create_dir_all(&out_dir) {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(BuildResponse {
                success: false,
                elf_path: None,
                image_id: None,
                message: format!("Failed to create output dir: {e}"),
            }),
        );
    }

    let pkg_name = req.guest_name.unwrap_or_else(|| {
        guest_path
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "guest".to_string())
    });

    let pkg = risc0_build::get_package(&guest_path);
    match risc0_build::build_package(&pkg, &out_dir, Default::default()) {
        Ok(artifacts) => {
            let elf_path = out_dir.join(format!("{}.elf", &pkg_name));
            let image_id = artifacts
                .iter()
                .find(|a| a.name == pkg_name)
                .map(|a| hex::encode(a.image_id.as_bytes()));
            (StatusCode::OK, Json(BuildResponse {
                success: true,
                elf_path: Some(elf_path.to_string_lossy().to_string()),
                image_id,
                message: "Build successful".to_string(),
            }))
        }
        Err(e) => {
            error!("Build failed: {e}");
            (StatusCode::INTERNAL_SERVER_ERROR, Json(BuildResponse {
                success: false,
                elf_path: None,
                image_id: None,
                message: format!("Build failed: {e}"),
            }))
        }
    }
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let port = std::env::var("BUILD_SERVICE_PORT").unwrap_or_else(|_| "8081".to_string());
    let data_dir = std::env::var("ZP_DATA_DIR")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("./data"));

    let state = Arc::new(AppState { data_dir });

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/api/build", post(build_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = format!("0.0.0.0:{port}").parse().expect("Invalid address");
    info!("Build service listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
