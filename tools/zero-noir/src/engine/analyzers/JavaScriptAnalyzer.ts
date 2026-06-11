import { readFileSync } from "fs";
import { join, dirname, basename, relative } from "path";
import { Endpoint, AnalyzerOptions } from "../types.js";
import { Analyzer } from "../Analyzer.js";

interface RoutePrefix {
  prefix: string;
  routerFile: string;
  routerVar: string;
}

const FRAMEWORK_PATTERNS: Record<string, { detect: RegExp[]; route: RegExp }> = {
  express: {
    detect: [/require\(['"]express['"]\)/, /from ['"]express['"]/],
    route: /\b(\w+)\.(get|post|put|delete|patch|head|options|all)\(?\s*['"]([^'"]+)['"]/,
  },
  fastify: {
    detect: [/require\(['"]fastify['"]\)/, /from ['"]fastify['"]/],
    route: /\b(\w+)\.(get|post|put|delete|patch|head|options)\(?\s*['"]([^'"]+)['"]/,
  },
};

const EXCLUDE_DIRS = [
  "node_modules", "dist", ".next", ".nuxt", "build", "coverage",
  "public", "static", "assets", "images", "fonts", "styles",
];

const FRONTEND_INDICATORS = [
  "react-dom", "react-router", "react-router-dom", "vue", "angular",
  "@angular/core", "svelte", "createRoot", "ReactDOM",
];

const IGNORE_PREFIXES = ["console", "process", "module", "require", "exports", "import", "export", "this", "res"];

export class JavaScriptAnalyzer implements Analyzer {
  readonly name = "javascript-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const raw: Endpoint[] = [];
    const allContent = new Map<string, string>();
    const isMainServer = new Map<string, boolean>();

    for (const file of files) {
      try {
        if (EXCLUDE_DIRS.some((d) => file.includes(d))) continue;
        const content = readFileSync(file, "utf-8");
        allContent.set(file, content);
        isMainServer.set(file, /app\.(get|post|put|delete|patch|use)\s*\(/.test(content));
      } catch { continue; }
    }

    const frameworks = this.detectExpress(allContent);
    if (!frameworks) return [];

    const prefixes = this.extractRoutePrefixes(allContent);

    for (const [file, content] of allContent) {
      const relFile = this.toRelPath(file, options);
      if (options.excludePaths?.some((p) => relFile.includes(p))) continue;
      if (this.isFrontendFile(content, relFile)) continue;

      const lines = content.split("\n");
      const filePrefix = this.findFilePrefix(prefixes, file);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("//") || line.startsWith("/*") || line.startsWith("*")) continue;

        const match = line.match(FRAMEWORK_PATTERNS.express.route);
        if (!match) continue;

        const routerVar = match[1];
        const method = match[2].toUpperCase();
        let rawPath = match[3] || "/";
        rawPath = rawPath.split(",")[0].trim();

        if (IGNORE_PREFIXES.includes(routerVar) && routerVar !== "app") continue;

        let fullPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
        let service = this.inferService(relFile);

        if (routerVar === "app" && isMainServer.get(file)) {
          service = "api-service";
        }

        if (filePrefix && routerVar !== "app") {
          fullPath = filePrefix + fullPath;
          service = "api-service";
        } else if (!filePrefix) {
          const varPrefix = this.resolvePrefix(prefixes, routerVar, file);
          if (varPrefix) {
            fullPath = varPrefix + fullPath;
            service = "api-service";
          }
        }

        if (method !== "ALL") {
          raw.push({
            path: fullPath,
            method: method === "ALL" ? "ANY" : method,
            source: { file: relFile, line: i + 1 },
            tags: ["express"],
            service,
            technology: "javascript:express",
          });
        }
      }
    }

    return this.dedup(raw);
  }

  private findFilePrefix(prefixes: RoutePrefix[], file: string): string | null {
    const normalized = file.replace(/\\/g, "/");
    for (const p of prefixes) {
      if (p.routerFile && normalized.includes(p.routerFile.replace(/\\/g, "/"))) {
        return p.prefix;
      }
    }
    return null;
  }

  private detectExpress(allContent: Map<string, string>): boolean {
    for (const [, content] of allContent) {
      if (FRAMEWORK_PATTERNS.express.detect.some((r) => r.test(content))) return true;
    }
    for (const [file] of allContent) {
      if (file.includes("server") || file.includes("routes") || file.includes("api")) return true;
    }
    return false;
  }

  private extractRoutePrefixes(allContent: Map<string, string>): RoutePrefix[] {
    const prefixes: RoutePrefix[] = [];
    const varToPath = new Map<string, string>();
    const normalizedFiles = new Map<string, string>();
    for (const key of allContent.keys()) {
      normalizedFiles.set(key.replace(/\\/g, "/").toLowerCase(), key);
    }

    for (const [file, content] of allContent) {
      const lines = content.split("\n");
      const baseDir = dirname(file);

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();

        const assignMatch = line.match(/(\w+)\s*=\s*require\(['"]([^'"]+)['"]\)/);
        if (assignMatch) {
          const varName = assignMatch[1];
          const reqPath = assignMatch[2];
          if (reqPath.startsWith(".")) {
            const resolved = this.resolveReqPath(baseDir, reqPath, normalizedFiles);
            if (resolved) varToPath.set(varName, resolved);
          }
        }

        const inlineMatch = line.match(/\.use\(?\s*['"]([^'"]+)['"]\s*,\s*require\(['"]([^'"]+)['"]\)/);
        if (inlineMatch) {
          const prefix = inlineMatch[1];
          const reqPath = inlineMatch[2];
          const resolved = this.resolveReqPath(baseDir, reqPath, normalizedFiles);
          if (resolved) {
            prefixes.push({ prefix: prefix.replace(/\/+$/, ""), routerFile: resolved, routerVar: "inline" });
          }
        }

        const varMatch = line.match(/\.use\(?\s*['"]([^'"]+)['"]\s*,\s*(\w+)/);
        if (varMatch) {
          const prefix = varMatch[1];
          const routerVar = varMatch[2];
          const routerFile = varToPath.get(routerVar) || "";
          prefixes.push({ prefix: prefix.replace(/\/+$/, ""), routerFile, routerVar });
        }
      }
    }

    return prefixes;
  }

  private resolveReqPath(baseDir: string, reqPath: string, normalizedFiles: Map<string, string>): string | null {
    const exts = [".js", ".ts", ".mjs", ".cjs", ".jsx", ".tsx", "/index.js", "/index.ts", ""];
    const base = join(baseDir, reqPath).replace(/\\/g, "/").toLowerCase();
    for (const ext of exts) {
      const candidate = base + ext;
      if (normalizedFiles.has(candidate)) return normalizedFiles.get(candidate)!;
    }
    const entries = [...normalizedFiles.keys()].filter((k) => k.includes(reqPath.toLowerCase().replace(/\.\//g, "").replace(/\\/g, "/")));
    if (entries.length > 0) return normalizedFiles.get(entries[0])!;
    return null;
  }

  private resolvePrefix(prefixes: RoutePrefix[], routerVar: string, currentFile: string): string | null {
    for (const p of prefixes) {
      if (p.routerVar === routerVar) return p.prefix;
      if (p.routerFile && currentFile.includes(p.routerFile.replace(/\\/g, "/"))) return p.prefix;
    }
    const baseName = basename(currentFile).replace(/\.(js|ts|mjs|cjs|jsx|tsx)$/, "");
    const prefixMap: Record<string, string> = {
      auth: "/api/auth", users: "/api/users", projects: "/api/projects",
      components: "/api/components", routes: "/api", api: "/api",
      webhook: "/api/webhook", webhooks: "/api/webhooks",
    };
    return prefixMap[baseName] || null;
  }

  private isFrontendFile(content: string, relFile: string): boolean {
    if (relFile.includes("frontend") || relFile.includes("client") || relFile.includes("ui")) return true;
    if (relFile.includes("/pages/") && !relFile.includes("api")) return true;
    if (relFile.includes("/components/") && !relFile.includes("routes")) return true;
    if (relFile.endsWith(".jsx") || relFile.endsWith(".tsx")) {
      if (content.includes("react") || content.includes("jsx")) return true;
    }
    for (const ind of FRONTEND_INDICATORS) {
      if (content.includes(ind)) {
        if (!content.includes("express") && !content.includes("router.")) return true;
      }
    }
    return false;
  }

  private toRelPath(file: string, options?: AnalyzerOptions): string {
    const idx = file.indexOf("zero-proof");
    if (idx >= 0) return file.slice(idx);
    if (options?.excludePaths) {
      for (const p of options.excludePaths) {
        const idx = file.indexOf(p);
        if (idx >= 0) return file.slice(idx);
      }
    }
    return file;
  }

  private inferService(relFile: string): string {
    if (relFile.includes("backend") || relFile.includes("server")) return "api-service";
    if (relFile.includes("api")) return "api-service";
    if (relFile.includes("routes")) return "api-service";
    if (relFile.includes("frontend") || relFile.includes("client")) return "web-app";
    return "api-service";
  }

  private dedup(endpoints: Endpoint[]): Endpoint[] {
    const seen = new Set<string>();
    return endpoints.filter((ep) => {
      const key = `${ep.service}:${ep.method}:${ep.path}:${ep.source.line}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
