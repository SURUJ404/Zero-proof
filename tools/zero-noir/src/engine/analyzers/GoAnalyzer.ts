import { readFileSync } from "fs";
import { Endpoint, AnalyzerOptions } from "../types.js";
import { Analyzer } from "../Analyzer.js";

const FRAMEWORK_CONFIGS = [
  {
    name: "gin",
    detect: [/gin\.Default\(\)/, /gin\.New\(\)/, /"github\.com\/gin-gonic\/gin"/],
    patterns: [
      { re: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Any)\(['"]([^'"]+)['"]/, methodGroup: 1, pathGroup: 2 },
      { re: /\.Handle\(['"]([^'"]+)['"].*,\s*['"](GET|POST|PUT|DELETE)['"]/, methodGroup: 2, pathGroup: 1 },
    ],
    defaultMethod: "ANY",
    exclude: [/vendor\//, /\.git\//],
  },
  {
    name: "echo",
    detect: [/echo\.New\(\)/, /"github\.com\/labstack\/echo"/],
    patterns: [
      { re: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Any)\(['"]([^'"]+)['"]/, methodGroup: 1, pathGroup: 2 },
    ],
    defaultMethod: "ANY",
    exclude: [/vendor\//, /\.git\//],
  },
  {
    name: "chi",
    detect: [/chi\.NewRouter\(\)/, /chi\.NewMux\(\)/, /"github\.com\/go-chi\/chi"/],
    patterns: [
      { re: /\.(Get|Post|Put|Delete|Patch|Head|Options|Any|Route)\(['"]([^'"]+)['"]/, methodGroup: 1, pathGroup: 2 },
    ],
    defaultMethod: "ANY",
    exclude: [/vendor\//, /\.git\//],
  },
  {
    name: "fiber",
    detect: [/fiber\.New\(\)/, /"github\.com\/gofiber\/fiber"/],
    patterns: [
      { re: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|All)\(['"]([^'"]+)['"]/, methodGroup: 1, pathGroup: 2 },
    ],
    defaultMethod: "ANY",
    exclude: [/vendor\//, /\.git\//],
  },
  {
    name: "nethttp",
    detect: [/http\.HandleFunc\(/, /http\.Handle\(/, /mux\.HandleFunc/],
    patterns: [
      { re: /http\.HandleFunc\(['"]([^'"]+)['"]/, pathGroup: 1, methodGroup: null },
      { re: /http\.Handle\(['"]([^'"]+)['"]/, pathGroup: 1, methodGroup: null },
    ],
    defaultMethod: "ANY",
    exclude: [/vendor\//, /\.git\//],
  },
];

export class GoAnalyzer implements Analyzer {
  readonly name = "go-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const raw: Endpoint[] = [];
    const frameworks = this.detectFrameworks(files);

    for (const file of files) {
      try {
        const relFile = this.toRelPath(file);
        if (options.excludePaths?.some((p) => relFile.includes(p))) continue;
        if (frameworks.length === 0) continue;
        if (!file.endsWith(".go")) continue;

        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (const fw of frameworks) {
          const config = FRAMEWORK_CONFIGS.find((c) => c.name === fw);
          if (!config) continue;
          if (config.exclude.some((e) => e.test(file))) continue;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            for (const pattern of config.patterns) {
              const match = line.match(pattern.re);
              if (!match) continue;

              let method = config.defaultMethod;
              if (pattern.methodGroup) {
                method = match[pattern.methodGroup].toUpperCase();
              }
              const path = match[pattern.pathGroup] || "/";

              raw.push({
                path: path.startsWith("/") ? path : `/${path}`,
                method: method === "ALL" || method === "ANY" ? "ANY" : method.toUpperCase(),
                source: { file: relFile, line: i + 1 },
                tags: [fw],
                service: this.inferService(file, relFile),
                technology: `go:${fw}`,
              });
            }
          }
        }
      } catch { continue; }
    }

    return this.dedup(raw);
  }

  private detectFrameworks(files: string[]): string[] {
    const detected = new Set<string>();
    for (const file of files) {
      if (!file.endsWith(".go")) continue;
      try {
        const content = readFileSync(file, "utf-8");
        for (const config of FRAMEWORK_CONFIGS) {
          if (!detected.has(config.name) && config.detect.some((r) => r.test(content))) {
            detected.add(config.name);
          }
        }
      } catch { continue; }
    }
    return [...detected];
  }

  private toRelPath(file: string): string {
    const idx = file.indexOf("zero-proof");
    return idx >= 0 ? file.slice(idx) : file;
  }

  private inferService(file: string, relFile: string): string {
    if (relFile.includes("api") || relFile.includes("handler")) return "api-service";
    if (relFile.includes("server")) return "server";
    if (relFile.includes("cmd")) return "cli";
    return "api-service";
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
}
