#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { registerScanCommand } from "./cli/commands/scan.js";
import { registerListCommand } from "./cli/commands/list.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const program = new Command();

program
  .name("zn")
  .description("Zero Proof Attack Surface Detector — discover endpoints, expose shadow APIs, map the attack surface")
  .version(pkg.version, "-v, --version", "Show version");

registerScanCommand(program);
registerListCommand(program);

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
