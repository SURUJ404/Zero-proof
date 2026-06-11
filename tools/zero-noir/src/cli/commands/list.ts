import { Command } from "commander";
import chalk from "chalk";
import { OUTPUT_FORMATS } from "../../outputs/index.js";
import { listFilterFields } from "../../engine/Filter.js";

const KNOWN_TECHS = [
  { name: "rust/axum", desc: "Rust Axum web framework" },
  { name: "rust/actix-web", desc: "Rust Actix Web framework" },
  { name: "rust/rocket", desc: "Rust Rocket framework" },
  { name: "rust/warp", desc: "Rust Warp framework" },
  { name: "javascript/express", desc: "Node.js Express framework" },
  { name: "javascript/fastify", desc: "Node.js Fastify framework" },
  { name: "javascript/next", desc: "Next.js React framework" },
  { name: "typescript/next", desc: "Next.js with TypeScript" },
  { name: "python/flask", desc: "Python Flask microframework" },
  { name: "python/fastapi", desc: "Python FastAPI framework" },
  { name: "python/django", desc: "Python Django framework" },
  { name: "go/gin", desc: "Go Gin web framework" },
  { name: "go/echo", desc: "Go Echo web framework" },
  { name: "go/chi", desc: "Go Chi router" },
  { name: "go/fiber", desc: "Go Fiber web framework" },
  { name: "java/spring", desc: "Java Spring Boot" },
  { name: "docker", desc: "Docker container configuration" },
];

const KNOWN_TAGGERS = [
  { name: "shadow", desc: "Flags internal/admin/debug endpoints" },
  { name: "deprecated", desc: "Flags deprecated/legacy endpoints" },
  { name: "authenticated", desc: "Flags endpoints with auth headers" },
  { name: "config", desc: "Flags config/settings endpoints" },
  { name: "prover", desc: "Flags proof generation endpoints" },
  { name: "verifier", desc: "Flags proof verification endpoints" },
  { name: "health", desc: "Flags health/readiness endpoints" },
  { name: "graphql", desc: "Flags GraphQL endpoints" },
  { name: "jwt", desc: "Flags JWT-authenticated endpoints" },
  { name: "file-upload", desc: "Flags file upload endpoints" },
  { name: "websocket", desc: "Flags WebSocket endpoints" },
];

export function registerListCommand(program: Command): void {
  const listCmd = program
    .command("list")
    .description("List built-in catalogs");

  listCmd
    .command("formats")
    .description("List available output formats")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Available Output Formats\n"));
      for (const fmt of OUTPUT_FORMATS) {
        const desc = formatDescriptions[fmt] || "";
        console.log(`  ${chalk.green("▸")} ${fmt.padEnd(10)} ${chalk.gray(desc)}`);
      }
      console.log();
    });

  listCmd
    .command("techs")
    .description("List supported technologies and frameworks")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Supported Technologies\n"));
      for (const tech of KNOWN_TECHS) {
        console.log(`  ${chalk.green("▸")} ${tech.name.padEnd(25)} ${chalk.gray(tech.desc)}`);
      }
      console.log();
    });

  listCmd
    .command("taggers")
    .description("List available taggers")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Available Taggers\n"));
      for (const t of KNOWN_TAGGERS) {
        console.log(`  ${chalk.green("▸")} ${t.name.padEnd(18)} ${chalk.gray(t.desc)}`);
      }
      console.log();
    });

  listCmd
    .command("fields")
    .description("List available filter fields for --filter")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Filter Fields\n"));
      console.log(listFilterFields());
      console.log();
    });
}

const formatDescriptions: Record<string, string> = {
  json: "Full structured data",
  yaml: "Human-readable config format",
  openapi: "OpenAPI 3.1 specification",
  sarif: "SARIF 2.1 for CI/CD integration",
  html: "Visual dark-mode report",
  mermaid: "Architecture diagram",
};
