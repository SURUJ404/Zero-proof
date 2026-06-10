use std::net::SocketAddr;
use std::sync::Arc;

use axum::{
    body::Body,
    extract::{Path, State},
    http::{Request, StatusCode},
    Json, Router,
    routing::{any, get},
};
use serde::Serialize;
use tower_http::cors::CorsLayer;
use tracing::{error, info};

#[derive(Clone)]
struct AppState {
    build_service_url: String,
    prover_service_url: String,
    client: reqwest::Client,
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

#[derive(Serialize)]
struct RootResponse {
    service: &'static str,
    version: &'static str,
    endpoints: serde_json::Value,
}

async fn health(State(state): State<Arc<AppState>>) -> Json<HealthResponse> {
    let build_status = state
        .client
        .get(format!("{}/api/health", state.build_service_url))
        .send()
        .await
        .map(|r| {
            if r.status().is_success() {
                "up"
            } else {
                "degraded"
            }
        })
        .unwrap_or("down")
        .to_string();

    let prover_status = state
        .client
        .get(format!("{}/api/health", state.prover_service_url))
        .send()
        .await
        .map(|r| {
            if r.status().is_success() {
                "up"
            } else {
                "degraded"
            }
        })
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

async fn root() -> Json<RootResponse> {
    Json(RootResponse {
        service: "gateway",
        version: "0.1.0",
        endpoints: serde_json::json!({
            "build": "POST /api/build",
            "prove": "POST /api/prove",
            "verify": "POST /api/verify",
            "health": "GET /api/health",
        }),
    })
}

async fn proxy_handler(
    State(state): State<Arc<AppState>>,
    Path(path): Path<String>,
    req: Request<Body>,
) -> Result<axum::response::Response, StatusCode> {
    let upstream = if path.starts_with("build") {
        &state.build_service_url
    } else if path.starts_with("prove") || path.starts_with("verify") {
        &state.prover_service_url
    } else {
        return Err(StatusCode::NOT_FOUND);
    };

    let upstream_uri = format!("{}/api/{path}", upstream.trim_end_matches('/'));
    let method = req.method().clone();
    let body = axum::body::to_bytes(req.into_body(), usize::MAX)
        .await
        .map_err(|_| StatusCode::BAD_REQUEST)?;

    let upstream_req = state
        .client
        .request(method, &upstream_uri)
        .body(body)
        .header("content-type", "application/json");

    match upstream_req.send().await {
        Ok(resp) => {
            let status = resp.status();
            let body = resp.bytes().await.unwrap_or_default();
            let mut response = axum::response::Response::new(Body::from(body));
            *response.status_mut() = status;
            Ok(response)
        }
        Err(e) => {
            error!("Upstream request failed: {e}");
            Err(StatusCode::BAD_GATEWAY)
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

    let port = std::env::var("GATEWAY_PORT").unwrap_or_else(|_| "8080".to_string());
    let build_service_url = std::env::var("BUILD_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8081".to_string());
    let prover_service_url = std::env::var("PROVER_SERVICE_URL")
        .unwrap_or_else(|_| "http://localhost:8082".to_string());

    let state = Arc::new(AppState {
        build_service_url,
        prover_service_url,
        client: reqwest::Client::new(),
    });

    let app = Router::new()
        .route("/", get(root))
        .route("/api/health", get(health))
        .route("/api/*path", any(proxy_handler))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = format!("0.0.0.0:{port}").parse().expect("Invalid address");
    info!("Gateway listening on {addr}");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
