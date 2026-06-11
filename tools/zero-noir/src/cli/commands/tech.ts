import { Command } from "commander";
import chalk from "chalk";

const FEATURES = [
  { module: "Scanner", desc: "Multi-language codebase scanner (Rust, JS, Python, Go, Java, Docker)", status: "✓" },
  { module: "Router", desc: "Endpoint routing engine — exclude, deliver (ZAP/Burp/Webhook), split, tag, reroute", status: "✓" },
  { module: "Filter", desc: "Sysdig-inspired filter expressions — method=POST, tag=shadow, path=/api/**", status: "✓" },
  { module: "Analyzer", desc: "15+ framework analyzers — Axum, Express, Flask, Gin, Spring, Fastify, Next.js", status: "✓" },
  { module: "Plugin", desc: "YAML-defined custom analyzers — zero-code endpoint detection", status: "✓" },
  { module: "Tagger", desc: "Auto-tagging engine — shadow, deprecated, health, prover, verifier, auth", status: "✓" },
  { module: "AI Context", desc: "Per-endpoint LLM security analysis — OpenAI, Ollama", status: "✓" },
  { module: "Output", desc: "10 output formats — JSON, YAML, OpenAPI, SARIF, HTML, Mermaid, Postman, cURL, TOML, PowerShell", status: "✓" },
  { module: "Delivery", desc: "Direct integration — ZAP, Burp Suite, custom webhooks", status: "✓" },
  { module: "Rules", desc: "Passive-scan rule engine — detect shadow APIs, deprecated endpoints, sensitive paths", status: "✓" },
  { module: "Cache", desc: "LLM response cache manager — info, clear, purge", status: "✓" },
  { module: "Config", desc: "User-level YAML configuration — show, edit, init, path", status: "✓" },
  { module: "Web API", desc: "Cloud scanning via URL — paste a GitHub URL, get results on the web", status: "✓" },
];

export function printTechPortal(version: string): void {
  console.log(chalk.hex("#db8b8b")("\n  ⚡ zk-scandog — Tech Portal"));
  console.log(chalk.gray(`  v${version}\n`));
  for (const f of FEATURES) {
    const color = f.status === "✓" ? chalk.green : chalk.yellow;
    console.log(`  ${chalk.white(f.module.padEnd(18))} ${chalk.gray(f.desc.padEnd(60))} ${color(f.status)}`);
  }
  console.log(`\n  ${chalk.gray("Run")} ${chalk.white("apiscan <command> --help")} ${chalk.gray("for detailed options on each module")}\n`);
}

export function registerTechCommand(program: Command): void {
  program
    .command("tech")
    .description("Show all available features and modules")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  ⚡ zk-scandog — Tech Portal"));
      console.log(chalk.gray("  All available features and modules\n"));
      console.log(`  ${chalk.gray("Module".padEnd(18))} ${chalk.gray("Description".padEnd(60))} ${chalk.gray("Status")}`);
      console.log(`  ${chalk.gray("─".repeat(96))}`);
      for (const f of FEATURES) {
        const color = f.status === "✓" ? chalk.green : chalk.yellow;
        console.log(`  ${chalk.white(f.module.padEnd(18))} ${chalk.gray(f.desc.padEnd(60))} ${color(f.status)}`);
      }
      console.log(`\n  ${chalk.gray("Run")} ${chalk.white("apiscan <command> --help")} ${chalk.gray("for detailed options on each module")}\n`);
    });
}
