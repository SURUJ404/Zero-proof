import { Command } from "commander";
import chalk from "chalk";
import { OUTPUT_FORMATS } from "../../outputs/index.js";

export function registerListCommand(program: Command): void {
  const listCmd = program
    .command("list")
    .description("List built-in catalogs");

  listCmd
    .command("formats")
    .description("List available output formats")
    .action(() => {
      console.log(chalk.hex("#db8b8b")("\n  Zero Noir — Available Output Formats\n"));
      for (const fmt of OUTPUT_FORMATS) {
        console.log(`  ${chalk.green("▸")} ${fmt}`);
      }
      console.log();
    });
}
