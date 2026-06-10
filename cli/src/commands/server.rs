use clap::Args;

use crate::config::ZpConfig;

#[derive(Args)]
pub struct ServerArgs {
    #[command(subcommand)]
    pub action: ServerAction,
}

#[derive(clap::Subcommand)]
pub enum ServerAction {
    Start,
    Stop,
    Status,
    Logs,
}

pub async fn run(args: ServerArgs) -> anyhow::Result<()> {
    let config = ZpConfig::load();

    match args.action {
        ServerAction::Start => {
            println!("Starting microservices...");
            let status = std::process::Command::new("docker-compose")
                .args(["up", "-d"])
                .status()?;
            if status.success() {
                println!("Services started:");
                println!("  Gateway:     {}", config.gateway_url);
                println!("  Build:       {}", config.build_service_url);
                println!("  Prover:      {}", config.prover_service_url);
            } else {
                anyhow::bail!("Failed to start services");
            }
        }
        ServerAction::Stop => {
            println!("Stopping microservices...");
            let status = std::process::Command::new("docker-compose")
                .args(["down"])
                .status()?;
            if !status.success() {
                anyhow::bail!("Failed to stop services");
            }
            println!("Services stopped.");
        }
        ServerAction::Status => {
            let client = reqwest::Client::new();
            for (name, url) in [
                ("Gateway", &config.gateway_url),
                ("Build", &config.build_service_url),
                ("Prover", &config.prover_service_url),
            ] {
                match client
                    .get(format!("{url}/api/health"))
                    .send()
                    .await
                {
                    Ok(resp) => {
                        let status = if resp.status().is_success() {
                            "UP"
                        } else {
                            "DEGRADED"
                        };
                        println!("  {name:8} [{status}] {url}");
                    }
                    Err(_) => {
                        println!("  {name:8} [DOWN]   {url}");
                    }
                }
            }
        }
        ServerAction::Logs => {
            let status = std::process::Command::new("docker-compose")
                .args(["logs", "-f"])
                .status()?;
            if !status.success() {
                anyhow::bail!("Failed to tail logs");
            }
        }
    }
    Ok(())
}
