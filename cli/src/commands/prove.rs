use std::path::PathBuf;

use base64::Engine as _;
use clap::Args;

use crate::config::ZpConfig;

#[derive(Args)]
pub struct ProveArgs {
    pub elf_path: PathBuf,
    #[arg(long)]
    pub input: Option<String>,
    #[arg(long, default_value_t = false)]
    pub local: bool,
}

pub async fn run(args: ProveArgs) -> anyhow::Result<()> {
    let config = ZpConfig::load();

    let elf_bytes = tokio::fs::read(&args.elf_path).await?;
    let elf_b64 = base64::engine::general_purpose::STANDARD.encode(&elf_bytes);

    let input_json = args
        .input
        .as_deref()
        .map(|s| serde_json::from_str(s).unwrap_or(serde_json::Value::String(s.to_string())));

    if args.local {
        #[cfg(feature = "local")]
        {
            println!("Proving locally...");
            let mut env_builder = risc0_zkvm::ExecutorEnv::builder();
            if let Some(input) = &input_json {
                env_builder.write(input)?;
            }
            let env = env_builder.build()?;
            let prover = risc0_zkvm::default_prover();
            let receipt =
                prover.prove_with_opts(env, &elf_bytes, &risc0_zkvm::ProverOpts::default())?;
            let receipt_bytes = bincode::serialize(&receipt)?;
            let receipt_b64 = base64::engine::general_purpose::STANDARD.encode(&receipt_bytes);
            println!("Receipt: {receipt_b64}");
            return Ok(());
        }
        #[cfg(not(feature = "local"))]
        anyhow::bail!("--local requires building with `--features local`");
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "elf_b64": elf_b64,
        "input_json": input_json,
    });

    let resp = client
        .post(format!("{}/api/prove", config.prover_service_url))
        .json(&body)
        .send()
        .await?;

    let result: serde_json::Value = resp.json().await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
