import { readFileSync } from "fs";
import { Endpoint, CLIDef, CLICommand, AnalyzerOptions } from "./types.js";
import { Analyzer } from "./Analyzer.js";

const KNOWN_CLIS: CLIDef[] = [
  {
    name: "zp",
    binary: "zp",
    description: "Zero Proof unified CLI for build, prove, verify, and server management",
    commands: [
      { name: "build", description: "Build a guest program from source path", args: [{ name: "guest_path", type: "string", required: true }] },
      { name: "prove", description: "Prove execution of a guest program", args: [{ name: "elf_path", type: "string", required: true }] },
      { name: "verify", description: "Verify a receipt with its image ID", args: [{ name: "receipt_b64", type: "string", required: true }, { name: "image_id", type: "string", required: true }] },
      { name: "server", description: "Manage microservices (start/stop/status/logs)", args: [{ name: "action", type: "string", required: true }] },
      { name: "config", description: "Manage CLI configuration (show/set/reset)", args: [{ name: "action", type: "string", required: true }] },
    ],
  },
  {
    name: "rzup",
    binary: "rzup",
    description: "RISC Zero version manager — install, update, and manage toolchains",
    commands: [
      { name: "install", description: "Install and update components", args: [] },
      { name: "check", description: "Check for new component versions", args: [] },
      { name: "default", description: "Set a component version as default", args: [] },
      { name: "show", description: "Show installed components", args: [] },
      { name: "uninstall", description: "Uninstall a component", args: [] },
    ],
  },
  {
    name: "cargo-risczero",
    binary: "cargo-risczero",
    description: "RISC Zero cargo extension for building, baking, and verifying ZK guests",
    commands: [
      { name: "build", description: "Build guest code", args: [] },
      { name: "bake", description: "Bake guest code", args: [] },
      { name: "new", description: "Create a new RISC Zero starter project", args: [{ name: "name", type: "string", required: true }] },
      { name: "verify", description: "Verify if a receipt is valid", args: [] },
      { name: "install", description: "Install the riscv32im-risc0-zkvm-elf toolchain", args: [] },
    ],
  },
  {
    name: "xtask",
    binary: "xtask",
    description: "Development and build automation tasks",
    commands: [
      { name: "bootstrap", description: "Bootstrap build system", args: [] },
      { name: "gen-receipt", description: "Generate test receipt", args: [] },
      { name: "semver-checks", description: "Semver compliance checks", args: [] },
    ],
  },
];

export class CLIAnalyzer implements Analyzer {
  readonly name = "cli-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    return KNOWN_CLIS.map((cli) => ({
      path: `cli:${cli.binary}`,
      method: "CLI" as const,
      source: { file: "cli/src/main.rs", line: 0 },
      tags: ["cli", "command"],
      parameters: cli.commands.flatMap((c) =>
        c.args.map((a) => ({
          name: a.name,
          type: "query" as const,
          required: a.required,
          defaultValue: a.default,
        }))
      ),
      service: cli.binary,
    }));
  }

  extractCLIDefs(_files: string[]): CLIDef[] {
    return KNOWN_CLIS;
  }
}
