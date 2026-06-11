import { readFileSync } from "fs";
import { Endpoint, AnalyzerOptions } from "../types.js";
import { Analyzer } from "../Analyzer.js";

const FRAMEWORK_PATTERNS: Record<string, { detect: RegExp[]; route: RegExp; method: RegExp; exclude: RegExp[] }> = {
  express: {
    detect: [/require\(['"]express['"]\)/, /from ['"]express['"]/],
    route: /\.(get|post|put|delete|patch|head|options|all)\(?\s*['"]([^'"]+)['"]/,
    method: /\.(get|post|put|delete|patch|head|options|all)\(/,
    exclude: [/node_modules/, /\.test\./, /\.spec\./, /__tests__/],
  },
  fastify: {
    detect: [/require\(['"]fastify['"]\)/, /from ['"]fastify['"]/],
    route: /\.(get|post|put|delete|patch|head|options)\(?\s*['"]([^'"]+)['"]/,
    method: /\.(get|post|put|delete|patch|head|options)\(/,
    exclude: [/node_modules/, /\.test\./, /__tests__/],
  },
  nextjs: {
    detect: [/from ['"]next['"]/],
    route: /export\s+(async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/,
    method: /function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/,
    exclude: [/node_modules/, /\.test\./],
  },
  hapi: {
    detect: [/require\(['"]@hapi\/hapi['"]\)/, /from ['"]@hapi\/hapi['"]/],
    route: /\.route\(\{.*path\s*:\s*['"]([^'"]+)['"]/,
    method: /method\s*:\s*['"](\w+)['"]/,
    exclude: [/node_modules/, /\.test\./],
  },
  koa: {
    detect: [/require\(['"]koa['"]\)/, /from ['"]koa['"]/],
    route: /\.use\(?\s*['"]*([^'"]*)*['"]*\)/,
    method: /\.use\(/,
    exclude: [/node_modules/, /\.test\./],
  },
};

export class JavaScriptAnalyzer implements Analyzer {
  readonly name = "javascript-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const raw: Endpoint[] = [];
    const frameworks = this.detectFrameworks(files);

    for (const file of files) {
      try {
        const relFile = this.toRelPath(file);
        if (options.excludePaths?.some((p) => relFile.includes(p))) continue;
        if (/dist|node_modules|\.next|\.nuxt|build|coverage/.test(file)) continue;
        if (file.includes("test") && file.endsWith(".test.")) continue;
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (const [fw, patterns] of Object.entries(frameworks)) {
          const config = FRAMEWORK_PATTERNS[fw];
          if (!config) continue;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (config.exclude.some((e) => e.test(file))) continue;
            if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;
            if (line.includes("require(") && !line.match(/\.(get|post|put|delete|patch|head|options|all)\(/)) continue;
            const routeMatch = line.match(config.route);
            if (routeMatch) {
              const method = fw === "nextjs" ? routeMatch[2] : routeMatch[1].toUpperCase();
              const path = fw === "nextjs" ? this.nextjsPath(file) : routeMatch[2] || "/";
              const cleanPath = path.split(",")[0].trim();
              raw.push({
                path: cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`,
                method: method === "ALL" ? "ANY" : method,
                source: { file: relFile, line: i + 1 },
                tags: [fw],
                service: this.inferService(file, relFile),
                technology: `javascript:${fw}`,
              });
            }
          }
        }
      } catch { continue; }
    }

    return this.dedup(raw);
  }

  private detectFrameworks(files: string[]): Record<string, boolean> {
    const detected: Record<string, boolean> = {};
    for (const file of files) {
      try {
        const content = readFileSync(file, "utf-8");
        for (const [fw, patterns] of Object.entries(FRAMEWORK_PATTERNS)) {
          if (!detected[fw] && patterns.detect.some((r) => r.test(content))) {
            detected[fw] = true;
          }
        }
      } catch { continue; }
    }
    if (Object.keys(detected).length === 0) detected["express"] = true;
    return detected;
  }

  private nextjsPath(file: string): string {
    const match = file.match(/(?:app|pages)\\(.+?)\\(?:route|page)\.(tsx?|jsx?)/);
    if (!match) return "/api/unknown";
    return "/" + match[1].replace(/\\/g, "/").replace(/\[(\w+)\]/g, "{$1}").toLowerCase();
  }

  private toRelPath(file: string): string {
    const idx = file.indexOf("zero-proof");
    return idx >= 0 ? file.slice(idx) : file;
  }

  private inferService(file: string, relFile: string): string {
    if (relFile.includes("app") || relFile.includes("pages")) return "web-app";
    if (relFile.includes("api") || relFile.includes("server")) return "api-service";
    return "web-app";
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
