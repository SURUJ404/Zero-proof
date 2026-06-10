use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    extract::State,
    http::StatusCode,
    Json, Router,
    routing::get,
};
use serde::Serialize;
use tower_http::cors::CorsLayer;
use tracing::info;

#[derive(Clone)]
struct AppState {
    build_service_url: String,
    prover_service_url: String,
}

#[derive(Serialize)]
struct HealthResponse {
    service: &'static str,
    status: &'static str,
    services: HealthSummary,
}

#[derive(Serialize)]
struct HealthSummary {
    build_service: String,
    prover_service: String,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let build_status = reqwest::get(format!("{}/api/health", state.build_service_url))
        .await
        .map(|r| if r.status().is_success() { "up" } else { "degraded" })
        .unwrap_or("down")
        .to_string();

    let prover_status = reqwest::get(format!("{}/api/health", state.prover_service_url))
        .await
        .map(|r| if r.status().is_success() { "up" } else { "degraded" })
        .unwrap_or("down")
        .to_string();

    Json(HealthResponse {
        service: "gateway",
        status: "ok",
        services: HealthSummary {
            build_service: build_status,
            prover_service: prover_status,
        },
    })
}

async fn proxy_health() -> Json<serde_json::Value> {
    Json(serde_json::json!({
        "service": "gateway",
        "version": "0.1.0",
        "endpoints": {
            "build": "http://localhost:8081",
            "prover": "http://localhost:8082",
        }
    }))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::from_default_env()
                .add_directive(tracing::Level::INFO.into()),
        )
        .init();

    let port = std::env::var("GATEWAY_PORT").unwrap_or_else(|_| "8080".to_string());
    let build_service_url = std::env::var("BUILD_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8081".to_string());
    let prover_service_url = std::env::var("PROVER_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8082".to_string());

    let state = Arc::new(AppState {
        build_service_url,
        prover_service_url,
    });

    let app = Router::new()
        .route("/api/health", get(health))
        .route("/", get(proxy_health))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = format!("0.0.0.0:{port}").parse().expect("Invalid address");
    info!("Gateway listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
