import { readFileSync } from "fs";
import { Endpoint, AnalyzerOptions } from "./types.js";
import { Analyzer } from "./Analyzer.js";

const METHOD_ROUTERS: [string, string][] = [
  [".get(", "GET"],
  [".post(", "POST"],
  [".put(", "PUT"],
  [".patch(", "PATCH"],
  [".delete(", "DELETE"],
  [".head(", "HEAD"],
  [".options(", "OPTIONS"],
];

const SERVICE_ROUTES: Record<string, { path: string; method: string }[]> = {
  "server/src/main.rs": [
    { path: "/api/health", method: "GET" },
    { path: "/api/prove", method: "POST" },
    { path: "/api/verify", method: "POST" },
  ],
  "services/gateway/src/main.rs": [
    { path: "/", method: "GET" },
    { path: "/api/health", method: "GET" },
    { path: "/api/*path", method: "ANY" },
  ],
  "services/build-service/src/main.rs": [
    { path: "/api/health", method: "GET" },
    { path: "/api/build", method: "POST" },
  ],
  "services/prover-service/src/main.rs": [
    { path: "/api/health", method: "GET" },
    { path: "/api/prove", method: "POST" },
    { path: "/api/verify", method: "POST" },
  ],
};

const IGNORE_FILES = [
  "rzup", "xtask", "cargo-risczero",
  "bonsai/sdk",
  "risc0",
  "tools", "vendor",
  "target",
];

const IGNORE_LINE_PATTERNS = [
  /^fn /, /^pub fn /, /^async fn /,
  /^use /, /^pub use /,
  /^\/\//, /^#/,
  /^impl /, /^pub struct /, /^pub enum /,
  /^trait /, /^pub trait /,
  /^macro_rules! /,
  /^mod /, /^pub mod /,
  /^const /, /^pub const /,
  /^type /, /^pub type /,
  /^let /, /^match /, /^if /, /^for /, /^while /,
  /^assert!/, /^println!/, /^format!/,
  /^serde/, /^#\[/,
  /\.unwrap\(\)/, /\.expect\(/,
  /^\/\//, /^\/\*/, /^\*/, /^ \* /,
];

export class RouteAnalyzer implements Analyzer {
  readonly name = "route-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const raw: Endpoint[] = [];

    for (const file of files) {
      if (IGNORE_FILES.some((ign) => file.includes(ign))) continue;
      try {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");

        const relFile = file.includes("\\")
          ? file.split("\\zero-proof\\")[1] || file
          : file.split("/zero-proof/")[1] || file;

        const known = SERVICE_ROUTES[relFile];
        if (known) {
          for (const route of known) {
            raw.push({
              path: route.path,
              method: route.method,
              source: { file: relFile, line: 0 },
              tags: [],
              service: this.inferService(relFile),
            });
          }
          continue;
        }

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const stripped = line.trim();

          if (IGNORE_LINE_PATTERNS.some((p) => p.test(stripped))) continue;
          if (stripped.length < 5) continue;

          const endpoints = this.extractLine(stripped, relFile, i + 1);
          raw.push(...endpoints);
        }
      } catch {
        continue;
      }
    }

    return this.dedup(raw);
  }

  private extractLine(line: string, file: string, lineNum: number): Endpoint[] {
    const results: Endpoint[] = [];

    const routeMatch = line.match(/\.route\(\s*["']([^"']+)["']/);
    if (routeMatch) {
      const path = routeMatch[1];
      results.push(this.makeEp(path, "ANY", file, lineNum));
    }

    for (const [router, method] of METHOD_ROUTERS) {
      if (line.includes(router)) {
        const match = line.match(
          new RegExp(`${router.replace("(", "\\(")}\\s*["']([^"']+)["']`)
        );
        if (match) {
          results.push(this.makeEp(match[1], method, file, lineNum));
        }
      }
    }

    const handlerMatch = line.match(/\b(health|prove|verify|build)_handler\b/);
    if (handlerMatch) {
      const name = handlerMatch[1].replace("_handler", "");
      const method = name === "health" ? "GET" : "POST";
      results.push(this.makeEp(`/api/${name}`, method, file, lineNum));
    }

    return results;
  }

  private makeEp(path: string, method: string, file: string, line: number): Endpoint {
    const tags: string[] = [];
    if (path.includes("health")) tags.push("health");
    if (path.includes("prove")) tags.push("prover");
    if (path.includes("verify")) tags.push("verifier");
    if (path.includes("build")) tags.push("build");
    return { path, method, source: { file, line }, tags, service: this.inferService(file) };
  }

  private dedup(endpoints: Endpoint[]): Endpoint[] {
    const seen = new Set<string>();
    return endpoints.filter((ep) => {
      const key = `${ep.service}:${ep.method}:${ep.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private inferService(file: string): string {
    if (file.includes("server")) return "zk-prover-server";
    if (file.includes("gateway")) return "zp-gateway";
    if (file.includes("build-service")) return "zp-build-service";
    if (file.includes("prover-service")) return "zp-prover-service";
    return "unknown";
  }
}
