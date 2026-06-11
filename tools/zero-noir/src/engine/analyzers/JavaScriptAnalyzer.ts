import { readFileSync } from "fs";
import { join, dirname, basename, relative } from "path";
import { Endpoint, AnalyzerOptions } from "../types.js";
import { Analyzer } from "../Analyzer.js";

interface RoutePrefix {
  prefix: string;
  routerFile: string;
  routerVar: string;
}

const FRAMEWORK_PATTERNS: Record<string, { detect: RegExp[]; route: RegExp; methodGroup: number | null; pathGroup: number | null; routerVarGroup: number | null }> = {
  express: {
    detect: [/require\(['"]express['"]\)/, /from ['"]express['"]/],
    route: /\b(\w+)\.(get|post|put|delete|patch|head|options|all)\(\s*['"`]([^'"`]+)['"`]/,
    methodGroup: 2,
    pathGroup: 3,
    routerVarGroup: 1,
  },
  fastify: {
    detect: [/require\(['"]fastify['"]\)/, /from ['"]fastify['"]/],
    route: /\b(\w+)\.(get|post|put|delete|patch|head|options)\(\s*['"`]([^'"`]+)['"`]/,
    methodGroup: 2,
    pathGroup: 3,
    routerVarGroup: 1,
  },
  hono: {
    detect: [/from ['"]hono['"]/, /require\(['"]hono['"]\)/, /new Hono\(\)/],
    route: /\b(\w+)\.(get|post|put|delete|patch|on)\(\s*['"`]([^'"`]+)['"`]/,
    methodGroup: 2,
    pathGroup: 3,
    routerVarGroup: 1,
  },
  koa: {
    detect: [/require\(['"]koa['"]\)/, /from ['"]koa['"]/],
    route: /\b(\w+)\.(use)\(\s*['"`]?(\/[^'"`)]+)['"`]?/,
    methodGroup: null,
    pathGroup: 3,
    routerVarGroup: 1,
  },
  nextjs: {
    detect: [/next\//, /from ['"]next/, /require\(['"]next/],
    route: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(/,
    methodGroup: 1,
    pathGroup: null,
    routerVarGroup: null,
  },
  nestjs: {
    detect: [/@nestjs\//, /from ['"]@nestjs/, /@(Get|Post|Put|Delete|Patch|Controller)\(/],
    route: /@(Get|Post|Put|Delete|Patch|All)\((?:['"]([^'"]+)['"]\s*)?\)/,
    methodGroup: 1,
    pathGroup: 2,
    routerVarGroup: null,
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

    for (const file of files) {
      try {
        if (EXCLUDE_DIRS.some((d) => file.includes(d))) continue;
        const content = readFileSync(file, "utf-8");
        allContent.set(file, content);
      } catch { continue; }
    }

    const frameworks = this.detectFrameworks(allContent);
    if (!frameworks.length) return [];

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

        for (const [fwName, config] of Object.entries(FRAMEWORK_PATTERNS)) {
          if (!frameworks.includes(fwName) && fwName !== "nextjs" && fwName !== "nestjs") continue;

          if (fwName === "nextjs") {
            const nextMatch = line.match(config.route);
            if (!nextMatch) continue;
            const method = nextMatch[1].toUpperCase();
            const fileName = basename(file).replace(/\.[jt]sx?$/, "");
            const fullPath = fileName === "index" ? "/api" : `/api/${fileName}`;
            raw.push({
              path: this.normalizePath(fullPath),
              method,
              source: { file: relFile, line: i + 1 },
              tags: ["nextjs"],
              service: "api-service",
              technology: "typescript:nextjs",
            });
            continue;
          }

          if (fwName === "nestjs") {
            const nestMatch = line.match(config.route);
            if (!nestMatch) continue;
            const method = nestMatch[1]?.toUpperCase();
            const rawPath = nestMatch[2] || "/";
            if (!method || !["GET", "POST", "PUT", "DELETE", "PATCH", "ALL"].includes(method)) continue;
            raw.push({
              path: this.normalizePath(rawPath.startsWith("/") ? rawPath : `/${rawPath}`),
              method: method === "ALL" ? "ANY" : method,
              source: { file: relFile, line: i + 1 },
              tags: ["nestjs"],
              service: this.inferService(relFile),
              technology: `typescript:nestjs`,
            });
            continue;
          }

          const match = line.match(config.route);
          if (!match) continue;

          const routerVar = config.routerVarGroup != null ? (match[config.routerVarGroup] || "") : "";
          let method = "ANY";
          if (config.methodGroup != null) {
            const rawMethod = match[config.methodGroup].toUpperCase();
            if (["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "ALL"].includes(rawMethod)) {
              method = rawMethod;
            }
          }

          let rawPath = config.pathGroup != null ? (match[config.pathGroup] || "/") : "/";
          if (rawPath.startsWith("'") || rawPath.startsWith('"') || rawPath.startsWith("`")) rawPath = rawPath.slice(1);
          rawPath = rawPath.split(",")[0].trim();

          if (IGNORE_PREFIXES.includes(routerVar) && !["app", "server", "router", "api"].includes(routerVar)) continue;
          if (rawPath.includes(":")) continue;

          let fullPath = rawPath.startsWith("/") ? rawPath : `/${rawPath}`;
          let service = this.inferService(relFile);

          if (filePrefix && routerVar !== "app" && routerVar !== "server") {
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
              path: this.normalizePath(fullPath),
              method: method === "ALL" ? "ANY" : method,
              source: { file: relFile, line: i + 1 },
              tags: [fwName],
              service,
              technology: `javascript:${fwName}`,
            });
          }
        }
      }
    }

    return this.dedup(raw);
  }

  private normalizePath(path: string): string {
    return path
      .replace(/:(\w+)/g, "{$1}")
      .replace(/<(\w+)>/g, "{$1}");
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

  private detectFrameworks(allContent: Map<string, string>): string[] {
    const detected = new Set<string>();
    for (const [, content] of allContent) {
      for (const [name, config] of Object.entries(FRAMEWORK_PATTERNS)) {
        if (!detected.has(name) && config.detect.some((r) => r.test(content))) {
          detected.add(name);
        }
      }
    }
    if (detected.size === 0) {
      for (const [file] of allContent) {
        if (file.includes("server") || file.includes("routes") || file.includes("api")) {
          detected.add("express");
          break;
        }
      }
    }
    return [...detected];
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
