use clap::Args;

use crate::config::ZpConfig;

#[derive(Args)]
pub struct BuildArgs {
    pub guest_path: String,
    #[arg(long)]
    pub guest_name: Option<String>,
    #[arg(long, default_value_t = false)]
    pub local: bool,
}

pub async fn run(args: BuildArgs) -> anyhow::Result<()> {
    let config = ZpConfig::load();

    if args.local {
        #[cfg(feature = "local")]
        {
            println!("Building guest locally...");
            let out_dir = config.data_dir.join("elfs");
            std::fs::create_dir_all(&out_dir)?;
            let guest_path = std::path::Path::new(&args.guest_path);
            let artifacts = risc0_build::build_package(guest_path, &out_dir)?;
            println!("Build successful!");
            for (name, _) in &artifacts {
                println!("  ELF: {}", out_dir.join(format!("{name}.elf")).display());
            }
            return Ok(());
        }
        #[cfg(not(feature = "local"))]
        anyhow::bail!("--local requires building with `--features local`");
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "guest_path": args.guest_path,
        "guest_name": args.guest_name,
    });

    let resp = client
        .post(format!("{}/api/build", config.build_service_url))
        .json(&body)
        .send()
        .await?;

    let result: serde_json::Value = resp.json().await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
