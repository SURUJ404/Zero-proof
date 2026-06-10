use clap::Args;

use crate::config::ZpConfig;

#[derive(Args)]
pub struct VerifyArgs {
    pub receipt_b64: String,
    pub image_id: String,
    #[arg(long, default_value_t = false)]
    pub local: bool,
}

pub async fn run(args: VerifyArgs) -> anyhow::Result<()> {
    let config = ZpConfig::load();

    if args.local {
        #[cfg(feature = "local")]
        {
            use base64::Engine as _;
            println!("Verifying locally...");
            let receipt_bytes =
                base64::engine::general_purpose::STANDARD.decode(&args.receipt_b64)?;
            let receipt: risc0_zkvm::Receipt = bincode::deserialize(&receipt_bytes)?;
            let image_id = hex::decode(&args.image_id)?;
            let mut image_id_arr = [0u8; 32];
            image_id_arr.copy_from_slice(&image_id);
            receipt.verify(image_id_arr)?;
            println!("Receipt verified successfully!");
            return Ok(());
        }
        #[cfg(not(feature = "local"))]
        anyhow::bail!("--local requires building with `--features local`");
    }

    let client = reqwest::Client::new();
    let body = serde_json::json!({
        "receipt_b64": args.receipt_b64,
        "image_id": args.image_id,
    });

    let resp = client
        .post(format!("{}/api/verify", config.prover_service_url))
        .json(&body)
        .send()
        .await?;

    let result: serde_json::Value = resp.json().await?;
    println!("{}", serde_json::to_string_pretty(&result)?);
    Ok(())
}
