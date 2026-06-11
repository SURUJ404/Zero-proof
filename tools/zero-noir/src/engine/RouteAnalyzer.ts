import { readFileSync } from "fs";
import { Endpoint, AnalyzerOptions } from "./types.js";
import { Analyzer } from "./Analyzer.js";

const FRAMEWORK_PATTERNS: Record<string, { detect: RegExp[]; routes: { re: RegExp; methodGroup: number | null; pathGroup: number; defaultMethod: string }[] }> = {
  axum: {
    detect: [/axum::/, /use axum/, /axum::routing/],
    routes: [
      { re: /\.route\(\s*["']([^"']+)["']\s*,\s*(?:get|post|put|delete|patch|head|options|any)\(/, methodGroup: 1, pathGroup: 1, defaultMethod: "ANY" },
      { re: /\.route\(\s*["']([^"']+)["']\s*,\s*(\w+)::(get|post|put|delete|patch|head|options|any)_service/, methodGroup: 3, pathGroup: 1, defaultMethod: "GET" },
    ],
  },
  actix: {
    detect: [/actix_web::/, /use actix_web/],
    routes: [
      { re: /#\[(get|post|put|delete|patch|head|options)\("([^"]+)"\)\]/, methodGroup: 1, pathGroup: 2, defaultMethod: "GET" },
      { re: /\.route\("([^"]+)",\s*web::\.(get|post|put|delete|patch)/, methodGroup: 2, pathGroup: 1, defaultMethod: "GET" },
      { re: /\.resource\("([^"]+)"/, methodGroup: null, pathGroup: 1, defaultMethod: "ANY" },
    ],
  },
  rocket: {
    detect: [/rocket::/, /#\[rocket::/, /use rocket/],
    routes: [
      { re: /#\[(get|post|put|delete|patch|head|options)\("([^"]*)"\)\]/, methodGroup: 1, pathGroup: 2, defaultMethod: "GET" },
    ],
  },
  warp: {
    detect: [/use warp/, /warp::(path|filter)/],
    routes: [
      { re: /\.and\(warp::path\(["']([^"']+)["']\)\)/, methodGroup: null, pathGroup: 1, defaultMethod: "ANY" },
      { re: /warp::path\(["']([^"']+)["']\)/, methodGroup: null, pathGroup: 1, defaultMethod: "ANY" },
    ],
  },
  generic: {
    detect: [],
    routes: [
      { re: /\.route\(\s*["']([^"']+)["']/, methodGroup: null, pathGroup: 1, defaultMethod: "ANY" },
      { re: /\.(get|post|put|delete|patch|head|options)\(\s*["']([^"']+)["']/, methodGroup: 1, pathGroup: 2, defaultMethod: "GET" },
      { re: /#\[(get|post|put|delete|patch|head|options)\("([^"]*)"\)\]/, methodGroup: 1, pathGroup: 2, defaultMethod: "GET" },
    ],
  },
};

const IGNORE_FILES = [
  "rzup", "xtask", "cargo-risczero",
  "bonsai/sdk",
  "risc0",
  "vendor",
  "target",
];

export class RouteAnalyzer implements Analyzer {
  readonly name = "route-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const raw: Endpoint[] = [];
    const rustFiles = files.filter((f) => f.endsWith(".rs"));
    if (!rustFiles.length) return [];

    const frameworks = this.detectFrameworks(rustFiles);

    for (const file of rustFiles) {
      if (IGNORE_FILES.some((ign) => file.includes(ign))) continue;
      try {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");
        const activePatterns = this.getActivePatterns(frameworks);

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
          if (line.startsWith("#[")) continue;
          const endpoints = this.extractLine(line, file, i + 1, activePatterns);
          raw.push(...endpoints);
        }
      } catch {
        continue;
      }
    }

    return this.dedup(raw);
  }

  private detectFrameworks(files: string[]): string[] {
    const detected: string[] = [];
    for (const [name, config] of Object.entries(FRAMEWORK_PATTERNS)) {
      if (name === "generic") continue;
      for (const file of files) {
        try {
          const content = readFileSync(file, "utf-8");
          if (config.detect.some((r) => r.test(content))) {
            detected.push(name);
            break;
          }
        } catch { continue; }
      }
    }
    return detected;
  }

  private getActivePatterns(frameworks: string[]): { re: RegExp; methodGroup: number | null; pathGroup: number; defaultMethod: string }[] {
    const patterns: { re: RegExp; methodGroup: number | null; pathGroup: number; defaultMethod: string }[] = [];
    for (const fw of frameworks) {
      const config = FRAMEWORK_PATTERNS[fw];
      if (config) patterns.push(...config.routes);
    }
    patterns.push(...FRAMEWORK_PATTERNS.generic.routes);
    return patterns;
  }

  private extractLine(line: string, file: string, lineNum: number, patterns: { re: RegExp; methodGroup: number | null; pathGroup: number; defaultMethod: string }[]): Endpoint[] {
    const results: Endpoint[] = [];

    for (const p of patterns) {
      const match = line.match(p.re);
      if (!match) continue;

      let method = p.defaultMethod;
      if (p.methodGroup) {
        const rawMethod = match[p.methodGroup].toUpperCase();
        if (["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(rawMethod)) {
          method = rawMethod;
        }
      }

      let path = match[p.pathGroup] || "/";
      if (path.startsWith("^")) path = path.slice(1);
      if (!path.startsWith("/") && !path.startsWith(".")) path = `/${path}`;

      results.push(this.makeEp(path, method, file, lineNum));
    }

    return results;
  }

  private makeEp(path: string, method: string, file: string, line: number): Endpoint {
    const tags: string[] = [];
    if (path.includes("health")) tags.push("health");
    if (path.includes("prove")) tags.push("prover");
    if (path.includes("verify")) tags.push("verifier");
    if (path.includes("build")) tags.push("build");
    if (path.includes("admin")) tags.push("shadow");
    if (path.includes("debug") || path.includes("metrics")) tags.push("shadow");
    return {
      path: this.normalizePath(path),
      method,
      source: { file, line },
      tags,
      technology: "rust",
      service: this.inferService(file),
    };
  }

  private normalizePath(path: string): string {
    return path
      .replace(/:(\w+)/g, "{$1}")
      .replace(/\{(\w+)\}/g, "{$1}")
      .replace(/<(\w+)>/g, "{$1}");
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
    if (file.includes("gateway")) return "gateway";
    if (file.includes("build-service")) return "build-service";
    if (file.includes("prover-service")) return "prover-service";
    if (file.includes("server") || file.includes("api")) return "api-service";
    if (file.includes("admin")) return "admin-panel";
    return "web-app";
  }
}
