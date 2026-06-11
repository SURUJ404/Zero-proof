import { readFileSync, existsSync } from "fs";
import { join, relative, basename, extname } from "path";
import { globSync } from "glob";
import { Endpoint, ScanResult, AnalyzerOptions, ServiceDef, CLIDef, DetectorResult } from "./types.js";
import { Detector } from "./Detector.js";
import { RouteAnalyzer } from "./RouteAnalyzer.js";
import { ServiceAnalyzer } from "./ServiceAnalyzer.js";
import { CLIAnalyzer } from "./CLIAnalyzer.js";
import { DockerAnalyzer } from "./DockerAnalyzer.js";
import { Tagger } from "./Tagger.js";
import { JavaScriptAnalyzer } from "./analyzers/JavaScriptAnalyzer.js";
import { PythonAnalyzer } from "./analyzers/PythonAnalyzer.js";
import { GoAnalyzer } from "./analyzers/GoAnalyzer.js";
import { createLLMProvider, LLMProvider } from "./llm/LLMProvider.js";

const EXCLUDE_DIRS = [
  "node_modules", "target", ".git", ".vercel", "build", "dist",
  ".docusaurus", "vendor", "external", "__pycache__", ".venv",
  "risc0/cargo-risczero", "risc0/build_kernel", "risc0/zkvm",
  "risc0/sys", "risc0/circuit", "risc0/r0vm", "risc0/taiko",
  ".next", ".nuxt", ".svelte-kit",
];

export class Scanner {
  private detector = new Detector();
  private routeAnalyzer = new RouteAnalyzer();
  private serviceAnalyzer = new ServiceAnalyzer();
  private cliAnalyzer = new CLIAnalyzer();
  private dockerAnalyzer = new DockerAnalyzer();
  private jsAnalyzer = new JavaScriptAnalyzer();
  private pyAnalyzer = new PythonAnalyzer();
  private goAnalyzer = new GoAnalyzer();
  private tagger = new Tagger();
  private llmProvider: LLMProvider | null = null;

  scan(rootDir: string, options: AnalyzerOptions = {}): ScanResult {
    this.llmProvider = options.aiContext ? createLLMProvider() : null;

    const projectMeta = this.readProjectMeta(rootDir);
    const detectors = this.detector.detect(rootDir);
    const files = this.collectFiles(rootDir);

    const routeFiles = files.filter((f) =>
      (f.endsWith("main.rs") || f.endsWith("lib.rs")) &&
      (f.includes("server") || f.includes("gateway") || f.includes("build-service") || f.includes("prover-service"))
    );

    const serviceFiles = files.filter((f) =>
      f.endsWith("main.rs") &&
      (f.includes("server") || f.includes("gateway") || f.includes("build-service") || f.includes("prover-service"))
    );

    const dockerFiles = files.filter((f) => f.includes("docker-compose"));
    const jsFiles = files.filter((f) => f.endsWith(".js") || f.endsWith(".jsx") || f.endsWith(".ts") || f.endsWith(".tsx"));
    const pyFiles = files.filter((f) => f.endsWith(".py"));
    const goFiles = files.filter((f) => f.endsWith(".go") && !f.includes("vendor"));

    const allRouteEp = this.routeAnalyzer.analyze(routeFiles, options);
    const allServiceEp = this.serviceAnalyzer.analyze(serviceFiles, options);
    const allDockerEp = this.dockerAnalyzer.analyze(dockerFiles, options);
    const allCliEp = this.cliAnalyzer.analyze([], options);

    const jsEndpoints = this.jsAnalyzer.analyze(jsFiles, options);
    const pyEndpoints = this.pyAnalyzer.analyze(pyFiles, options);
    const goEndpoints = this.goAnalyzer.analyze(goFiles, options);

    let allEndpoints = [...allRouteEp, ...allServiceEp, ...allDockerEp, ...allCliEp, ...jsEndpoints, ...pyEndpoints, ...goEndpoints];
    allEndpoints = this.tagger.tag(allEndpoints);

    if (options.aiContext && this.llmProvider) {
      this.enrichWithAI(allEndpoints, rootDir);
    }

    const services = this.buildServices(allEndpoints, detectors);
    const clis = this.cliAnalyzer.extractCLIDefs([]);
    const tags = this.tagger.summarize(allEndpoints);

    const techs = [...new Set(detectors.map((d) => d.framework))];

    return {
      projectName: projectMeta.name,
      projectVersion: projectMeta.version,
      scannedAt: new Date().toISOString(),
      services,
      clis,
      totalEndpoints: allEndpoints.length,
      tags,
      technologies: techs,
      warnings: this.generateWarnings(allEndpoints, detectors),
    };
  }

  scanAndExport(rootDir: string, options: AnalyzerOptions = {}): ScanResult {
    return this.scan(rootDir, options);
  }

  private enrichWithAI(endpoints: Endpoint[], rootDir: string): void {
    if (!this.llmProvider) return;
    for (const ep of endpoints.slice(0, 20)) {
      try {
        const filePath = join(rootDir, ep.source.file);
        const source = readFileSync(filePath, "utf-8");
        const lines = source.split("\n");
        const contextLines = lines.slice(
          Math.max(0, ep.source.line - 5),
          ep.source.line + 5
        ).join("\n");

        this.llmProvider.analyzeEndpoint(ep, contextLines).then((ctx) => {
          ep.aiContext = ctx;
        }).catch(() => {});
      } catch { }
    }
  }

  private generateWarnings(endpoints: Endpoint[], detectors: DetectorResult[]): string[] {
    const warnings: string[] = [];
    if (endpoints.filter((e) => e.tags.includes("shadow")).length > 0) {
      warnings.push("Shadow APIs detected — review access controls");
    }
    if (!detectors.some((d) => d.language === "rust")) {
      warnings.push("No Rust/Cargo project detected — some analyzers may be inactive");
    }
    return warnings;
  }

  private readProjectMeta(rootDir: string): { name: string; version: string } {
    const cargoToml = join(rootDir, "Cargo.toml");
    try {
      const content = readFileSync(cargoToml, "utf-8");
      const nameMatch = content.match(/name\s*=\s*["']([^"']+)["']/);
      const versionMatch = content.match(/version\s*=\s*["']([^"']+)["']/);
      return {
        name: nameMatch ? nameMatch[1] : "zero-proof",
        version: versionMatch ? versionMatch[1] : "unknown",
      };
    } catch {
      const packageJson = join(rootDir, "package.json");
      try {
        const pkg = JSON.parse(readFileSync(packageJson, "utf-8"));
        return { name: pkg.name || "unknown", version: pkg.version || "unknown" };
      } catch {
        return { name: "zero-proof", version: "unknown" };
      }
    }
  }

  private collectFiles(rootDir: string): string[] {
    const patterns = [
      join(rootDir, "server/src/**/*.rs"),
      join(rootDir, "services/**/src/**/*.rs"),
      join(rootDir, "docker-compose.yml"),
      join(rootDir, "docker-compose.yaml"),
      join(rootDir, "Dockerfile"),
      join(rootDir, "**/*.js"), join(rootDir, "**/*.jsx"),
      join(rootDir, "**/*.ts"), join(rootDir, "**/*.tsx"),
      join(rootDir, "**/*.py"),
      join(rootDir, "**/*.go"),
      join(rootDir, "**/*.java"),
      join(rootDir, "**/*.cs"),
      join(rootDir, "**/*.rb"),
      join(rootDir, "**/*.php"),
    ];

    let files: string[] = [];
    for (const pattern of patterns) {
      try {
        const matched = globSync(pattern.replace(/\\/g, "/"), { nocase: true, dot: true });
        files.push(...matched);
      } catch { continue; }
    }

    files = files.filter((f) => !EXCLUDE_DIRS.some((d) => f.includes(d)));
    return [...new Set(files)];
  }

  private buildServices(endpoints: Endpoint[], detectors: DetectorResult[]): ServiceDef[] {
    const serviceMap = new Map<string, Endpoint[]>();

    for (const ep of endpoints) {
      const svc = this.resolveServiceName(ep.service);
      if (!serviceMap.has(svc)) serviceMap.set(svc, []);
      serviceMap.get(svc)!.push(ep);
    }

    const services: ServiceDef[] = [];
    const serviceOrder = [
      "zk-prover-server", "zp-gateway", "zp-build-service", "zp-prover-service",
      "web-app", "api-service", "server",
      "zp", "rzup", "cargo-risczero", "xtask",
    ];

    const existing = new Set(serviceMap.keys());
    const ordered = [...serviceOrder.filter((s) => existing.has(s)), ...[...existing].filter((s) => !serviceOrder.includes(s))];

    for (const name of ordered) {
      if (!serviceMap.has(name)) continue;
      const eps = serviceMap.get(name)!;
      let type: ServiceDef["type"] = "server";
      let port = 0;

      if (name === "zk-prover-server") { type = "server"; port = 8080; }
      else if (name === "zp-gateway") { type = "gateway"; port = 8080; }
      else if (name === "zp-build-service") { type = "build-service"; port = 8081; }
      else if (name === "zp-prover-service") { type = "prover-service"; port = 8082; }
      else if (name === "web-app") { type = "web-app"; port = 3000; }
      else if (name === "api-service") { type = "api-service"; }
      else { type = "server"; }

      const tech = eps.find((e) => e.technology)?.technology;
      services.push({ name, type, port, endpoints: eps, sourceDir: "", technology: tech });
    }

    return services;
  }

  private resolveServiceName(name: string): string {
    if (name.includes("prover-service")) return "zp-prover-service";
    if (name.includes("build-service")) return "zp-build-service";
    if (name.includes("gateway")) return "zp-gateway";
    if (name.includes("server")) return "zk-prover-server";
    if (name === "zp" || name === "rzup" || name === "cargo-risczero" || name === "xtask") return name;
    return name;
  }
}
