import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CONFIG_DIR = join(homedir(), ".config", "zero-noir");
const CONFIG_PATH = join(CONFIG_DIR, "config.yaml");

const DEFAULT_CONFIG = `# ScanDog Configuration
# Path: ${CONFIG_PATH}

# AI Provider settings
ai:
  provider: openai          # openai | ollama
  model: gpt-4o-mini        # model name
  # api_key: sk-...         # set via OPENAI_API_KEY env var instead

# Scan defaults
scan:
  format: terminal          # default output format
  exclude_paths: []         # default exclusion patterns
  include_callee: false     # include 1-hop callee functions
  ai_context: false         # include AI review context

# Custom analyzers — define regex-based endpoint detectors
# Run with: scandog scan . --custom-analyzers .analyzers.yml
analyzers:
  # Example: detect Spring Boot @RequestMapping endpoints
  # - name: spring
  #   pattern: '@(Get|Post|Put|Delete)Mapping\\(["']([^"']+)["']\\)'
  #   methodGroup: 1
  #   pathGroup: 2
  #   technology: java:spring
  #   include: ["**/*.java"]

  # Example: detect Flask @app.route decorators
  # - name: flask
  #   pattern: '@app\\.route\\(["']([^"']+)["']\\)'
  #   methodGroup: 1
  #   pathGroup: 1
  #   method: GET
  #   technology: python:flask
  #   include: ["**/*.py"]

# Delivery targets
deliver:
  zap: ""                   # ZAP instance URL
  burp: ""                  # Burp Suite URL
  webhook: ""               # Webhook URL

# Output preferences
output:
  color: true               # enable/disable colored output
`;

export function registerConfigCommand(program: Command): void {
  const configCmd = program
    .command("config")
    .description("Manage user-level YAML configuration");

  configCmd
    .command("show")
    .description("Display current configuration")
    .action(() => {
      if (!existsSync(CONFIG_PATH)) {
        console.log(chalk.yellow("\n  No configuration file found. Run `zn config init` to create one.\n"));
        return;
      }
      const content = readFileSync(CONFIG_PATH, "utf-8");
      console.log(chalk.hex("#db8b8b")("\n  ScanDog — Configuration\n"));
      console.log(content);
    });

  configCmd
    .command("edit")
    .description("Open configuration in default editor")
    .action(() => {
      if (!existsSync(CONFIG_PATH)) {
        console.log(chalk.yellow("\n  No configuration file found. Run `zn config init` first.\n"));
        return;
      }
      const editor = process.env.EDITOR || "notepad";
      const { execSync } = require("child_process");
      try {
        execSync(`${editor} "${CONFIG_PATH}"`, { stdio: "inherit" });
      } catch {
        console.log(chalk.red(`  ✗ Could not open editor. Edit manually: ${CONFIG_PATH}\n`));
      }
    });

  configCmd
    .command("init")
    .description("Create default configuration file")
    .action(() => {
      if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
      if (existsSync(CONFIG_PATH)) {
        console.log(chalk.yellow(`\n  Configuration already exists at ${CONFIG_PATH}\n`));
        return;
      }
      writeFileSync(CONFIG_PATH, DEFAULT_CONFIG, "utf-8");
      console.log(chalk.hex("#db8b8b")("\n  ScanDog — Configuration Created\n"));
      console.log(`  ${chalk.green("▸")} Path: ${CONFIG_PATH}\n`);
    });

  configCmd
    .command("path")
    .description("Show configuration file path")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  ScanDog — Config Path\n"));
      console.log(`  ${chalk.green("▸")} ${CONFIG_PATH}\n`);
    });
}
