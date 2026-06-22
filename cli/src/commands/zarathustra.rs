use std::path::PathBuf;
use std::process::Command;

use clap::{Args, Subcommand};

use crate::config::ZpConfig;

#[derive(Args)]
pub struct ZarathustraArgs {
    #[command(subcommand)]
    pub action: ZarathustraAction,
}

#[derive(Subcommand)]
pub enum ZarathustraAction {
    /// Compile a .zarathustra file into a constraint system
    Compile(CompileArgs),
    /// Execute the program to compute a witness
    ComputeWitness(ComputeWitnessArgs),
    /// Generate a proving/verification key setup
    Setup(SetupArgs),
    /// Generate a proof
    Prove(ProveArgs),
    /// Verify a proof
    Verify(VerifyArgs),
    /// Export a Solidity verifier contract
    ExportVerifier(ExportVerifierArgs),
}

#[derive(Args)]
pub struct CompileArgs {
    pub input: PathBuf,
    #[arg(long, default_value = "bn128")]
    pub curve: String,
}

#[derive(Args)]
pub struct ComputeWitnessArgs {
    pub input: PathBuf,
    #[arg(long)]
    pub abi: Option<PathBuf>,
}

#[derive(Args)]
pub struct SetupArgs {
    pub input: PathBuf,
}

#[derive(Args)]
pub struct ProveArgs {
    pub input: PathBuf,
    pub witness: PathBuf,
    pub pk: PathBuf,
}

#[derive(Args)]
pub struct VerifyArgs {
    pub vk: PathBuf,
    pub proof: PathBuf,
}

#[derive(Args)]
pub struct ExportVerifierArgs {
    pub vk: PathBuf,
}

fn project_root() -> PathBuf {
    let mut dir = std::env::current_dir().unwrap_or_default();
    loop {
        if dir.join("Cargo.toml").exists() {
            return dir;
        }
        if !dir.pop() {
            break;
        }
    }
    PathBuf::from(".")
}

fn zarathustra_bin() -> PathBuf {
    let local = project_root().join("zarathustra").join("zarathustra");
    if local.exists() {
        return local;
    }
    let config = ZpConfig::load();
    config.data_dir.join("zarathustra").join("zarathustra")
}

fn stdlib_dir() -> PathBuf {
    let local = project_root().join("zarathustra").join("stdlib");
    if local.exists() {
        return local;
    }
    let config = ZpConfig::load();
    config.data_dir.join("zarathustra").join("stdlib")
}

fn run_zarathustra(args: &[&str]) -> anyhow::Result<String> {
    let bin = zarathustra_bin();
    let stdlib = stdlib_dir();

    if !bin.exists() {
        anyhow::bail!(
            "Zarathustra binary not found at {}. Run `zp zarathustra install` first.",
            bin.display()
        );
    }

    let output = Command::new(&bin)
        .args(args)
        .env("ZOKRATES_STDLIB", stdlib.to_str().unwrap())
        .output()?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        anyhow::bail!("zarathustra failed: {}", stderr);
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

pub async fn run(args: ZarathustraArgs) -> anyhow::Result<()> {
    match args.action {
        ZarathustraAction::Compile(ca) => {
            let out = run_zarathustra(&[
                "compile",
                "-i",
                ca.input.to_str().unwrap(),
                "--curve",
                &ca.curve,
            ])?;
            println!("{}", out);
        }
        ZarathustraAction::ComputeWitness(cw) => {
            let mut args = vec!["compute-witness", "-i", cw.input.to_str().unwrap()];
            if let Some(abi) = &cw.abi {
                args.push("--abi");
                args.push(abi.to_str().unwrap());
            }
            let out = run_zarathustra(&args)?;
            println!("{}", out);
        }
        ZarathustraAction::Setup(sa) => {
            let out =
                run_zarathustra(&["setup", "-i", sa.input.to_str().unwrap()])?;
            println!("{}", out);
        }
        ZarathustraAction::Prove(pa) => {
            let out = run_zarathustra(&[
                "generate-proof",
                "--input",
                pa.input.to_str().unwrap(),
                "--witness",
                pa.witness.to_str().unwrap(),
                "--proving-key-path",
                pa.pk.to_str().unwrap(),
            ])?;
            println!("{}", out);
        }
        ZarathustraAction::Verify(va) => {
            let out = run_zarathustra(&[
                "verify",
                "-v",
                va.vk.to_str().unwrap(),
                "-j",
                va.proof.to_str().unwrap(),
            ])?;
            println!("{}", out);
        }
        ZarathustraAction::ExportVerifier(ev) => {
            let out = run_zarathustra(&[
                "export-verifier",
                "-i",
                ev.vk.to_str().unwrap(),
            ])?;
            println!("{}", out);
        }
    }
    Ok(())
}
