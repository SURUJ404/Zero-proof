use clap::Args;

use crate::config::ZpConfig;

#[derive(Args)]
pub struct ConfigArgs {
    #[command(subcommand)]
    pub action: ConfigAction,
}

#[derive(clap::Subcommand)]
pub enum ConfigAction {
    Show,
    Set { key: String, value: String },
    Reset,
}

pub async fn run(args: ConfigArgs) -> anyhow::Result<()> {
    match args.action {
        ConfigAction::Show => {
            let config = ZpConfig::load();
            println!("{}", serde_json::to_string_pretty(&config)?);
        }
        ConfigAction::Set { key, value } => {
            let mut config = ZpConfig::load();
            match key.as_str() {
                "build_service_url" => config.build_service_url = value,
                "prover_service_url" => config.prover_service_url = value,
                "gateway_url" => config.gateway_url = value,
                "data_dir" => config.data_dir = value.into(),
                _ => anyhow::bail!("Unknown config key: {key}"),
            }
            config.save()?;
            println!("Config updated.");
        }
        ConfigAction::Reset => {
            let config = ZpConfig::default();
            config.save()?;
            println!("Config reset to defaults.");
        }
    }
    Ok(())
}
