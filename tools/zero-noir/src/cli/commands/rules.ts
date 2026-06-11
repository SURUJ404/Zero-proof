import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const RULES_DIR = join(homedir(), ".config", "zero-noir", "passive-rules");

const BUILTIN_RULES = `# API Scanner Passive Scan Rules
# Each rule defines a pattern to flag in endpoint paths/source

rules:
  - id: SCAN-SHADOW-001
    name: Shadow Admin Endpoint
    description: Detects hidden admin panels and debug endpoints
    pattern: (admin|debug|internal|private)
    severity: high
    tags: [shadow, admin]

  - id: SCAN-SHADOW-002
    name: Sensitive Information Exposure
    description: Detects endpoints exposing configuration or secrets
    pattern: (config|secret|token|key|cert|password)
    severity: high
    tags: [shadow, config]

  - id: SCAN-DEPRECATED-001
    name: Deprecated API
    description: Detects deprecated or legacy API versions
    pattern: (v0|legacy|old|deprecated)
    severity: low
    tags: [deprecated]

  - id: SCAN-PROVER-001
    name: Prover Endpoint
    description: Zero-knowledge proof generation endpoints
    pattern: (prove|proof|generate-proof)
    severity: medium
    tags: [prover, cryptographic]

  - id: SCAN-VERIFIER-001
    name: Verifier Endpoint
    description: Zero-knowledge proof verification endpoints
    pattern: (verify|validate|check-proof)
    severity: medium
    tags: [verifier, cryptographic]

  - id: SCAN-AUTH-001
    name: Authentication Required
    description: Endpoints that should require authentication
    pattern: (login|logout|auth|session|oauth)
    severity: medium
    tags: [auth, authenticated]

  - id: SCAN-AUTH-002
    name: Unauthenticated Sensitive
    description: Sensitive endpoints without visible auth
    pattern: (admin|dashboard|manage|control)
    severity: high
    tags: [shadow, auth]

  - id: SCAN-FILE-001
    name: File Upload
    description: File upload endpoints
    pattern: (upload|file|import|attach|media)
    severity: medium
    tags: [file-upload]

  - id: SCAN-WS-001
    name: WebSocket Endpoint
    description: WebSocket connection endpoints
    pattern: (ws://|wss://|socket|websocket|/ws)
    severity: low
    tags: [websocket]

  - id: SCAN-HEALTH-001
    name: Health Check
    description: Health and readiness check endpoints
    pattern: (health|ready|live|ping|status)
    severity: low
    tags: [health]
`;

function ensureRulesDir(): void {
  if (!existsSync(RULES_DIR)) mkdirSync(RULES_DIR, { recursive: true });
}

export function registerRulesCommand(program: Command): void {
  const rulesCmd = program
    .command("rules")
    .description("Manage passive-scan rules");

  rulesCmd
    .command("list")
    .description("List installed passive-scan rules")
    .action(() => {
      ensureRulesDir();
      const files = readdirSync(RULES_DIR).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));

      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Passive Scan Rules\n"));
      console.log(`  ${chalk.green("▸")} Rules directory: ${RULES_DIR}`);
      console.log(`  ${chalk.green("▸")} Rule files: ${files.length || "none (using built-in)"}`);
      console.log();

      if (files.length > 0) {
        for (const file of files) {
          console.log(`    ${chalk.green("●")} ${file}`);
        }
        console.log();
      }
    });

  rulesCmd
    .command("update")
    .description("Install or update built-in passive-scan rules")
    .action(() => {
      ensureRulesDir();
      const rulesFile = join(RULES_DIR, "builtin.yaml");
      writeFileSync(rulesFile, BUILTIN_RULES, "utf-8");
      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Rules Updated\n"));
      console.log(`  ${chalk.green("▸")} Installed ${RULES_DIR}\n`);
    });

  rulesCmd
    .command("path")
    .description("Show passive-rules directory path")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Rules Path\n"));
      console.log(`  ${chalk.green("▸")} ${RULES_DIR}\n`);
    });
}
