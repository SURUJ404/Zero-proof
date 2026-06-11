import chalk from "chalk";
import { Command } from "commander";
import { Scanner } from "../../engine/Scanner.js";
import { OUTPUT_FORMATS, getOutput, OutputFormat } from "../../outputs/index.js";
import { Deliver } from "../../deliver/Deliver.js";
import { writeFileSync } from "fs";
import { join } from "path";

export function registerScanCommand(program: Command): void {
  program
    .command("scan")
    .description("Scan a codebase for endpoints and attack surface")
    .argument("[path]", "Path to scan", ".")
    .option("-f, --format <format>", `Output format (${OUTPUT_FORMATS.join(", ")})`, "terminal")
    .option("-o, --output <file>", "Write output to file")
    .option("--include-callee", "Include 1-hop callee functions")
    .option("--ai-context", "Include per-endpoint AI review context")
    .option("--exclude-path <patterns...>", "Exclude paths matching patterns")
    .option("--verbose", "Verbose output")
    .option("--deliver-zap <url>", "Deliver to ZAP instance")
    .option("--deliver-burp <url>", "Deliver to Burp Suite")
    .option("--deliver-webhook <url>", "Deliver to webhook URL")
    .option("--ai-provider <provider>", "AI provider (openai, ollama)")
    .option("--only-techs <techs...>", "Only detect specified technologies")
    .option("--exclude-techs <techs...>", "Exclude specified technologies")
    .action(async (path, options) => {
      const scanner = new Scanner();

      console.log(chalk.hex("#db8b8b")("\n  ⚡ ScanDog — Attack Surface Detector"));
      console.log(chalk.gray(`  Scanning: ${path}\n`));
      if (options.verbose) {
        console.log(chalk.gray(`  Options: ${JSON.stringify(options, null, 2)}\n`));
      }

      if (options.aiProvider) {
        process.env.AI_PROVIDER = options.aiProvider;
      }

      const result = scanner.scan(path, {
        includeCallee: options.includeCallee,
        aiContext: options.aiContext,
        excludePaths: options.excludePath,
        verbose: options.verbose,
        onlyTechs: options.onlyTechs,
        excludeTechs: options.excludeTechs,
      });

      const format = options.format as OutputFormat | "terminal";

      if (format === "terminal") {
        printTerminal(result, path);
      } else {
        const output = getOutput(format);
        const content = output.format(result);

        if (options.output) {
          output.write(result, options.output);
          console.log(chalk.green(`  ✓ Written to ${options.output}\n`));
        } else {
          process.stdout.write(content + "\n");
        }
      }

      if (options.deliverZap) {
        try {
          await new Deliver().toZAP(result, options.deliverZap);
          console.log(chalk.green("  ✓ Delivered to ZAP"));
        } catch (e: any) {
          console.log(chalk.red(`  ✗ ZAP delivery failed: ${e.message}`));
        }
      }

      if (options.deliverBurp) {
        try {
          await new Deliver().toBurp(result, options.deliverBurp);
          console.log(chalk.green("  ✓ Delivered to Burp Suite"));
        } catch (e: any) {
          console.log(chalk.red(`  ✗ Burp delivery failed: ${e.message}`));
        }
      }

      if (options.deliverWebhook) {
        try {
          await new Deliver().toWebhook(result, options.deliverWebhook);
          console.log(chalk.green("  ✓ Delivered to webhook"));
        } catch (e: any) {
          console.log(chalk.red(`  ✗ Webhook delivery failed: ${e.message}`));
        }
      }

      if (result.technologies && result.technologies.length > 0 && options.verbose) {
        console.log(chalk.gray(`  Technologies detected: ${result.technologies.join(", ")}`));
      }

      if (result.warnings && result.warnings.length > 0) {
        for (const w of result.warnings) {
          console.log(chalk.yellow(`  ⚠ ${w}`));
        }
      }

      if (result.totalEndpoints === 0) {
        console.log(chalk.yellow("  ⚠ No endpoints found.\n"));
      }
    });
}

function printTerminal(result: any, path: string): void {
  const t = chalk.hex("#db8b8b");
  const m = chalk.gray;
  const h = chalk.hex("#58a6ff");
  const g = chalk.green;
  const r = chalk.red;

  console.log(t(`  ${result.projectName} v${result.projectVersion}`));
  console.log(m(`  Scanned: ${result.scannedAt}`));
  console.log(m(`  Root: ${path}\n`));
  if (result.technologies?.length > 0) {
    console.log(m(`  Tech:  ${result.technologies.join(", ")}\n`));
  }

  console.log(t("  ┌─ Attack Surface Summary ─────────────────────────────┐"));

  const printRow = (label: string, value: string, color: string) => {
    console.log(`  │ ${m(label.padEnd(20))} ${color}${m("     │")}`);
  };

  printRow("Total Endpoints", String(result.totalEndpoints), t(String(result.totalEndpoints).padStart(8)));
  printRow("Services", String(result.services.length), h(String(result.services.length).padStart(8)));
  printRow("CLI Tools", String(result.clis.length), h(String(result.clis.length).padStart(8)));
  printRow("Shadow APIs", String(result.tags.shadow), (result.tags.shadow > 0 ? r : m)(String(result.tags.shadow).padStart(8)));
  printRow("Prover Endpoints", String(result.tags.prover || 0), g(String(result.tags.prover || 0).padStart(8)));
  printRow("Verifier Endpoints", String(result.tags.verifier || 0), g(String(result.tags.verifier || 0).padStart(8)));
  printRow("Health Endpoints", String(result.tags.health || 0), g(String(result.tags.health || 0).padStart(8)));
  if (result.tags.graphql) {
    printRow("GraphQL", String(result.tags.graphql), h(String(result.tags.graphql).padStart(8)));
  }
  console.log(t("  └───────────────────────────────────────────────────────┘\n"));

  for (const service of result.services) {
    const tag = service.type === "gateway" ? h : service.type === "build-service" ? t : service.type === "web-app" ? chalk.cyan : g;
    const tech = service.technology ? ` ${m(`[${service.technology}]`)}` : "";
    console.log(`  ${tag("●")} ${service.name} ${m(`(${service.type}${service.port ? ` :${service.port}` : ""})`)}${tech}`);

    for (const ep of service.endpoints) {
      const methodColor =
        ep.method === "GET" ? h :
        ep.method === "POST" ? g :
        ep.method === "DELETE" ? r :
        ep.method === "PUT" ? chalk.yellow : m;
      const tags = ep.tags.length > 0 ? m(` [${ep.tags.join(", ")}]`) : "";
      console.log(`    ${methodColor(ep.method.padEnd(7))} ${ep.path}${tags}`);
    }
    console.log();
  }

  if (result.clis.length > 0) {
    console.log(t("  CLI Tools:"));
    for (const cli of result.clis) {
      console.log(`    ${h("●")} ${cli.binary} ${m(`— ${cli.description}`)}`);
      for (const cmd of cli.commands) {
        console.log(`      ${g("▸")} ${cli.binary} ${cmd.name}`);
      }
    }
    console.log();
  }

  console.log(m(`  Tip: use --format ${OUTPUT_FORMATS.join("|")} for structured output\n`));
}
