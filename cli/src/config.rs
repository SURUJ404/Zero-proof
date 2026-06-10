use std::path::PathBuf;

use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ZpConfig {
    pub build_service_url: String,
    pub prover_service_url: String,
    pub gateway_url: String,
    pub data_dir: PathBuf,
}

impl Default for ZpConfig {
    fn default() -> Self {
        Self {
            build_service_url: "http://localhost:8080".to_string(),
            prover_service_url: "http://localhost:8080".to_string(),
            gateway_url: "http://localhost:8080".to_string(),
            data_dir: dirs::data_dir()
                .unwrap_or_else(|| PathBuf::from("."))
                .join("zero-proof"),
        }
    }
}

impl ZpConfig {
    pub fn load() -> Self {
        let path = Self::path();
        if path.exists() {
            let content = std::fs::read_to_string(&path).unwrap_or_default();
            serde_json::from_str(&content).unwrap_or_default()
        } else {
            let config = ZpConfig::default();
            let _ = config.save();
            config
        }
    }

    pub fn save(&self) -> anyhow::Result<()> {
        let path = Self::path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)?;
        }
        let content = serde_json::to_string_pretty(self)?;
        std::fs::write(&path, content)?;
        Ok(())
    }

    fn path() -> PathBuf {
        dirs::config_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("zero-proof")
            .join("config.json")
    }
}
