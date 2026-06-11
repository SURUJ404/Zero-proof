#!/usr/bin/env node

import { Command } from "commander";
import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { registerScanCommand } from "./cli/commands/scan.js";
import { registerListCommand } from "./cli/commands/list.js";
import { registerCacheCommand } from "./cli/commands/cache.js";
import { registerConfigCommand } from "./cli/commands/config.js";
import { registerRulesCommand } from "./cli/commands/rules.js";
import { registerCompletionCommand } from "./cli/commands/completion.js";
import { registerTechCommand, printTechPortal } from "./cli/commands/tech.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgPath = join(__dirname, "..", "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));

const program = new Command();

program
  .name("apiscan")
  .description("API Surface Scanner — discover endpoints, expose shadow APIs, map the attack surface")
  .version(pkg.version, "-v, --version", "Show version")
  .option("--tech", "Show all available features and modules");

registerScanCommand(program);
registerListCommand(program);
registerCacheCommand(program);
registerConfigCommand(program);
registerRulesCommand(program);
registerCompletionCommand(program);
registerTechCommand(program);

program.on("option:tech", () => {
  printTechPortal(pkg.version);
  process.exit(0);
});

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  console.log(chalk.hex("#db8b8b")("\n  ⚡ API Surface Scanner"));
  console.log(chalk.gray(`  v${pkg.version}\n`));
  console.log(chalk.gray("  Usage: apiscan <command> [options]"));
  console.log(chalk.gray("\n  Commands:"));
  console.log(`    ${chalk.green("scan")}       Scan codebase for endpoints`);
  console.log(`    ${chalk.green("list")}       List built-in catalogs`);
  console.log(`    ${chalk.green("cache")}      Manage LLM response cache`);
  console.log(`    ${chalk.green("config")}     Manage configuration`);
  console.log(`    ${chalk.green("rules")}      Manage passive-scan rules`);
  console.log(`    ${chalk.green("tech")}       Show all available features and modules`);
  console.log(`    ${chalk.green("completion")} Generate shell completions`);
  console.log(`    ${chalk.green("help")}       Display help\n`);
  console.log(chalk.gray(`  Run ${chalk.white("apiscan <command> --help")} for detailed options\n`));
}
