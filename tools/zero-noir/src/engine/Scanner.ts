import { readFileSync, existsSync } from "fs";
import { join, relative, basename } from "path";
import { globSync } from "glob";
import { Endpoint, ScanResult, AnalyzerOptions, ServiceDef, CLIDef } from "./types.js";
import { Detector } from "./Detector.js";
import { RouteAnalyzer } from "./RouteAnalyzer.js";
import { ServiceAnalyzer } from "./ServiceAnalyzer.js";
import { CLIAnalyzer } from "./CLIAnalyzer.js";
import { DockerAnalyzer } from "./DockerAnalyzer.js";
import { Tagger } from "./Tagger.js";

const EXCLUDE_DIRS = [
  "node_modules", "target", ".git", ".vercel", "build", "dist",
  ".docusaurus", "vendor", "external",
  "risc0/cargo-risczero",
  "risc0/build_kernel",
  "risc0/zkvm",
  "risc0/sys",
  "risc0/circuit",
  "risc0/r0vm",
  "risc0/taiko",
];

export class Scanner {
  private detector = new Detector();
  private routeAnalyzer = new RouteAnalyzer();
  private serviceAnalyzer = new ServiceAnalyzer();
  private cliAnalyzer = new CLIAnalyzer();
  private dockerAnalyzer = new DockerAnalyzer();
  private tagger = new Tagger();

  scan(rootDir: string, options: AnalyzerOptions = {}): ScanResult {
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

    const allRouteEp = this.routeAnalyzer.analyze(routeFiles, options);
    const allServiceEp = this.serviceAnalyzer.analyze(serviceFiles, options);
    const allDockerEp = this.dockerAnalyzer.analyze(dockerFiles, options);
    const allCliEp = this.cliAnalyzer.analyze([], options);

    let allEndpoints = [...allRouteEp, ...allServiceEp, ...allDockerEp, ...allCliEp];
    allEndpoints = this.tagger.tag(allEndpoints);

    const services = this.buildServices(allEndpoints);
    const clis = this.cliAnalyzer.extractCLIDefs([]);
    const tags = this.tagger.summarize(allEndpoints);

    return {
      projectName: projectMeta.name,
      projectVersion: projectMeta.version,
      scannedAt: new Date().toISOString(),
      services,
      clis,
      totalEndpoints: allEndpoints.length,
      tags,
    };
  }

  scanAndExport(rootDir: string, options: AnalyzerOptions = {}): ScanResult {
    return this.scan(rootDir, options);
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
      return { name: "zero-proof", version: "unknown" };
    }
  }

  private collectFiles(rootDir: string): string[] {
    const patterns = [
      join(rootDir, "server/src/**/*.rs"),
      join(rootDir, "services/**/src/**/*.rs"),
      join(rootDir, "docker-compose.yml"),
      join(rootDir, "docker-compose.yaml"),
      join(rootDir, "Dockerfile"),
    ];

    let files: string[] = [];
    for (const pattern of patterns) {
      try {
        const matched = globSync(pattern.replace(/\\/g, "/"), { nocase: true, dot: true });
        files.push(...matched);
      } catch {
        continue;
      }
    }

    files = files.filter((f) => !EXCLUDE_DIRS.some((d) => f.includes(d)));
    return [...new Set(files)];
  }

  private buildServices(endpoints: Endpoint[]): ServiceDef[] {
    const serviceMap = new Map<string, Endpoint[]>();
    const serviceOrder = ["zk-prover-server", "zp-gateway", "zp-build-service", "zp-prover-service", "zp", "rzup", "cargo-risczero", "xtask"];

    for (const ep of endpoints) {
      const svc = this.resolveServiceName(ep.service);
      if (!serviceMap.has(svc)) serviceMap.set(svc, []);
      serviceMap.get(svc)!.push(ep);
    }

    const services: ServiceDef[] = [];
    for (const name of serviceOrder) {
      if (!serviceMap.has(name)) continue;
      const eps = serviceMap.get(name)!;
      let type: ServiceDef["type"] = "server";
      let port = 0;

      if (name === "zk-prover-server") { type = "server"; port = 8080; }
      else if (name === "zp-gateway") { type = "gateway"; port = 8080; }
      else if (name === "zp-build-service") { type = "build-service"; port = 8081; }
      else if (name === "zp-prover-service") { type = "prover-service"; port = 8082; }
      else { type = "cli"; }

      services.push({ name, type, port, endpoints: eps, sourceDir: "" });
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
