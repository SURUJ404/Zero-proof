import { Command } from "commander";
import chalk from "chalk";
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";

const CACHE_DIR = join(homedir(), ".config", "zero-noir", "cache");

function ensureCacheDir(): void {
  if (!existsSync(CACHE_DIR)) mkdirSync(CACHE_DIR, { recursive: true });
}

export function registerCacheCommand(program: Command): void {
  const cacheCmd = program
    .command("cache")
    .description("Manage on-disk LLM response cache");

  cacheCmd
    .command("info")
    .description("Show cache statistics")
    .action(() => {
      ensureCacheDir();
      const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
      const size = files.reduce((acc, f) => {
        try { return acc + readFileSync(join(CACHE_DIR, f)).length; } catch { return acc; }
      }, 0);

      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Cache Info\n"));
      console.log(`  ${chalk.green("▸")} Location: ${CACHE_DIR}`);
      console.log(`  ${chalk.green("▸")} Files:    ${files.length}`);
      console.log(`  ${chalk.green("▸")} Size:     ${(size / 1024).toFixed(1)} KB`);
      console.log();
    });

  cacheCmd
    .command("clear")
    .description("Clear all cached responses")
    .action(() => {
      ensureCacheDir();
      const files = readdirSync(CACHE_DIR).filter((f) => f.endsWith(".json"));
      let deleted = 0;
      let failed = 0;
      for (const f of files) {
        try { unlinkSync(join(CACHE_DIR, f)); deleted++; }
        catch { failed++; }
      }
      console.log(chalk.hex("#db8b8b")("\n  API Scanner — Cache Cleared\n"));
      console.log(`  ${chalk.green("▸")} Deleted: ${deleted} files`);
      if (failed > 0) console.log(`  ${chalk.red("▸")} Failed:  ${failed} files`);
      console.log();
    });

  cacheCmd
    .command("purge")
    .description("Remove entire cache directory")
    .action(() => {
      if (!existsSync(CACHE_DIR)) {
        console.log(chalk.yellow("\n  Cache directory does not exist.\n"));
        return;
      }
      try {
        const files = readdirSync(CACHE_DIR);
        for (const f of files) {
          try { unlinkSync(join(CACHE_DIR, f)); } catch { }
        }
        console.log(chalk.hex("#db8b8b")("\n  API Scanner — Cache Purged\n"));
        console.log(`  ${chalk.green("▸")} Removed ${files.length} files\n`);
      } catch (e: any) {
        console.log(chalk.red(`  ✗ Failed to purge cache: ${e.message}\n`));
      }
    });
}
