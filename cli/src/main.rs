mod commands;
mod config;

use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "zp", version, about = "Zero Proof unified CLI")]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

#[derive(Subcommand)]
enum Command {
    Build(commands::build::BuildArgs),
    Prove(commands::prove::ProveArgs),
    Verify(commands::verify::VerifyArgs),
    Server(commands::server::ServerArgs),
    Config(commands::config::ConfigArgs),
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt::init();

    let cli = Cli::parse();

    match cli.command {
        Command::Build(args) => commands::build::run(args).await,
        Command::Prove(args) => commands::prove::run(args).await,
        Command::Verify(args) => commands::verify::run(args).await,
        Command::Server(args) => commands::server::run(args).await,
        Command::Config(args) => commands::config::run(args).await,
    }
}
