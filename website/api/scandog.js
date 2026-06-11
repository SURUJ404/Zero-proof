export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { url } = req.body || {};
  if (!url) return res.status(400).json({ error: "Missing 'url' in request body" });

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const { owner, repo } = parseGitHubUrl(url);
    if (!owner || !repo) {
      clearTimeout(timeout);
      return res.status(400).json({ error: "Invalid GitHub URL. Use: https://github.com/owner/repo" });
    }
    const result = await new Scanner(owner, repo, controller.signal).run();
    clearTimeout(timeout);
    return res.status(200).json(result);
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") {
      return res.status(200).json(emptyResult("Scan timed out — repo may be too large"));
    }
    return res.status(500).json({ error: e.message });
  }
}

function parseGitHubUrl(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : {};
}

function emptyResult(warning) {
  return { projectName: "ScanDog", projectVersion: "web-scan", scannedAt: new Date().toISOString(), totalEndpoints: 0, services: [], clis: [], tags: {}, technologies: [], warnings: warning ? [warning] : [] };
}

// ── Scanner Orchestrator ─────────────────────────────────────────────

class Scanner {
  constructor(owner, repo, signal) {
    this.owner = owner;
    this.repo = repo;
    this.signal = signal;
    this.branch = "main";
    this.headers = { Accept: "application/vnd.github.v3+json", "User-Agent": "scandog-api" };
    if (process.env.GITHUB_TOKEN) this.headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;
  }

  async run() {
    const tree = await this.fetchTree();
    if (this.signal.aborted) throw new DOMException("Aborted", "AbortError");
    const files = tree.filter((n) => n.type === "blob");

    const techs = this.detectTechs(files);
    const contents = await this.fetchContents(files);
    if (this.signal.aborted) throw new DOMException("Aborted", "AbortError");

    const frameworks = this.detectFrameworks(contents);
    const endpoints = this.detectEndpoints(contents);

    const deduped = dedup(endpoints);
    const services = buildServices(groupBy(deduped));
    const tags = aggregateTags(deduped);
    const warnings = buildWarnings(deduped, services);
    const allTechs = [...new Set([...techs, ...frameworks])];

    return {
      projectName: `${this.owner}/${this.repo}`,
      projectVersion: "web-scan",
      scannedAt: new Date().toISOString(),
      totalEndpoints: deduped.length,
      services,
      clis: [],
      tags,
      technologies: allTechs.length > 0 ? allTechs : ["unknown"],
      warnings,
    };
  }

  async fetchTree() {
    for (const branch of ["main", "master"]) {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/git/trees/${branch}?recursive=1`;
      const res = await fetch(url, { headers: this.headers, signal: this.signal });
      if (res.ok) { this.branch = branch; return (await res.json()).tree; }
      if (res.status !== 404) throw new Error(`GitHub API error: ${res.status}`);
    }
    throw new Error("Repository not found or inaccessible");
  }

  detectTechs(files) {
    const techs = new Set();
    for (const file of files) {
      const ext = "." + file.path.split(".").pop();
      const fileName = file.path.split("/").pop();
      for (const tp of TECH_PATTERNS) {
        if (tp.ext.some((e) => file.path.endsWith(e) || file.path === e || (e.startsWith("*.") && fileName === e.slice(2)) || file.path.includes(e))) {
          techs.add(tp.tech);
        }
      }
    }
    return techs;
  }

  async fetchContents(files) {
    const sourceExts = new Set([".rs", ".js", ".jsx", ".ts", ".tsx", ".py", ".go", ".java", ".kt", ".kts", ".cs", ".rb", ".php", ".swift", ".scala", ".ex", ".exs", ".cr", ".zig", ".mjs", ".cjs", ".mts", ".cts"]);
    const configFiles = new Set(["package.json", "Cargo.toml", "requirements.txt", "go.mod", "pom.xml", "build.gradle", "Gemfile", "composer.json", "pyproject.toml", "mix.exs"]);

    const candidates = [];
    for (const f of files) {
      const ext = "." + f.path.split(".").pop().toLowerCase();
      const fileName = f.path.split("/").pop();
      if (sourceExts.has(ext) || configFiles.has(fileName)) candidates.push(f);
    }

    const toFetch = candidates.slice(0, 120);
    const contents = [];

    for (let i = 0; i < toFetch.length; i += 20) {
      if (this.signal.aborted) break;
      const batch = toFetch.slice(i, i + 20);
      const results = await Promise.allSettled(
        batch.map(async (f) => {
          const res = await fetch(`https://raw.githubusercontent.com/${this.owner}/${this.repo}/${this.branch}/${f.path}`, { signal: this.signal });
          if (!res.ok) return null;
          return { path: f.path, content: await res.text() };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) contents.push(r.value);
      }
    }

    return contents;
  }

  detectFrameworks(contents) {
    const frameworks = new Set();
    for (const { path, content } of contents) {
      const fileName = path.split("/").pop();
      for (const fp of FRAMEWORK_PATTERNS) {
        const target = fp.file.replace("*", "");
        if (!fileName.endsWith(target) && !path.endsWith(fp.file)) continue;
        for (const m of fp.matchers) {
          if (content.toLowerCase().includes(m.toLowerCase())) frameworks.add(fp.framework);
        }
      }
    }
    return frameworks;
  }

  detectEndpoints(contents) {
    const endpoints = [];
    for (const { path, content } of contents) {
      const ext = "." + path.split(".").pop();
      // regex detectors
      for (const d of DETECTORS) {
        if (!d.matches(ext, path)) continue;
        for (const ep of d.scan(path, content)) {
          endpoints.push(ep);
        }
      }
      // file-based router detectors
      for (const rd of ROUTER_DETECTORS) {
        if (!rd.matches(path)) continue;
        for (const ep of rd.scan(path, content)) {
          endpoints.push(ep);
        }
      }
    }
    return endpoints;
  }
}

// ── Detector Registry ────────────────────────────────────────────────

class EndpointDetector {
  constructor(ext, techs, patterns) {
    this.ext = ext;
    this.techs = techs;
    this.patterns = patterns;
  }
  matches(ext) { return ext === this.ext; }
  scan(path, content) {
    const eps = [];
    for (const p of this.patterns) {
      const { methodGroup, pathGroup, tech } = p;
      p.re.lastIndex = 0;
      let m;
      while ((m = p.re.exec(content)) !== null) {
        const method = methodGroup ? m[methodGroup].toUpperCase() : "ANY";
        const routePath = pathGroup ? m[pathGroup] : (() => { const ex = extractFilePathRoute(path, method); return ex ? ex.path : null; })();
        if (!routePath) continue;
        const normalized = routePath === "/" ? "/" : normalizePath(routePath);
        eps.push({ path: normalized, method, source: { file: path, line: getLine(content, m.index) }, tags: inferTags(normalized), service: classify(path), technology: tech || this.techs[0] });
      }
    }
    return eps;
  }
}

class FileRouterDetector {
  constructor(pattern, pathFn, methodFn, tech) {
    this.re = pattern;
    this.pathFn = pathFn;
    this.methodFn = methodFn;
    this.tech = tech;
  }
  matches(path) { return this.re.test(path); }
  scan(path, content) {
    const eps = [];
    const apiPath = this.pathFn(path);
    if (!apiPath) return eps;
    const methods = this.methodFn(path, content);
    for (const method of methods) {
      eps.push({ path: apiPath, method, source: { file: path, line: 0 }, tags: inferTags(apiPath), service: classify(path), technology: this.tech });
    }
    return eps;
  }
}

// ── Register Detectors ───────────────────────────────────────────────

const DETECTORS = [
  // Rust
  new EndpointDetector(".rs", ["rust/axum"], [
    { re: /\.route\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch|head|options|any|trace|connect)\s*\(/gi, methodGroup: 2, pathGroup: 1, tech: "rust/axum" },
    { re: /#\[(get|post|put|delete|patch|head|options)\(?["']?([^"'\]]+)["']?\)?\]/gi, methodGroup: 1, pathGroup: 2, tech: "rust/actix" },
    { re: /\.on\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch|head|options)/gi, methodGroup: 2, pathGroup: 1, tech: "rust/poem" },
    { re: /Router::(get|post|put|delete|patch|head|options)\(\s*["'](\/[^"']+)["']/gi, methodGroup: 1, pathGroup: 2, tech: "rust/salvo" },
  ]),

  // JavaScript
  new EndpointDetector(".js", ["javascript/express"], [
    { re: /(?:app|router|server|api|route)\.(get|post|put|delete|patch|head|options|all|trace|connect)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/express" },
    { re: /\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/fastify" },
    { re: /app\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/hono" },
    { re: /server\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/elysia" },
  ]),

  // TypeScript
  new EndpointDetector(".ts", ["typescript/express"], [
    { re: /(?:app|router|server|api|route)\.(get|post|put|delete|patch|head|options|all)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/express" },
    { re: /\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/fastify" },
    { re: /@(Get|Post|Put|Delete|Patch|All)\((?:["'`]([^"'`]+)["'`])?\)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/nestjs" },
    { re: /app\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/hono" },
  ]),

  // Python
  new EndpointDetector(".py", ["python/flask"], [
    { re: /@\w+\.route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/flask" },
    { re: /@\w+\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "python/fastapi" },
    { re: /path\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/django" },
    { re: /\.add_route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/starlette" },
    { re: /@\w+\.(get|post|put|delete|patch)\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "python/sanic" },
  ]),

  // Go
  new EndpointDetector(".go", ["go/gin"], [
    { re: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Any|any)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/gin" },
    { re: /\.(Get|Post|Put|Delete|Patch|Route)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/chi" },
    { re: /http\.HandleFunc\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "go/nethttp" },
    { re: /http\.Handle\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "go/nethttp" },
    { re: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/echo" },
    { re: /\.(Get|Post|Put|Delete|Patch|Head|Options)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/fiber" },
  ]),

  // Java
  new EndpointDetector(".java", ["java/spring"], [
    { re: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "java/spring" },
    { re: /@RequestMapping\([^)]*(?:path|value)\s*=\s*["'`]([^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "java/spring" },
    { re: /@(GET|POST|PUT|DELETE|PATCH)\s*\n\s*@Path\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "java/jaxrs" },
    { re: /@Path\(\s*["'`]([^"'`]+)["'`]\s*\)\s*\n\s*@(GET|POST|PUT|DELETE|PATCH)/gi, methodGroup: 2, pathGroup: 1, tech: "java/jaxrs" },
  ]),

  // Kotlin
  new EndpointDetector(".kt", ["kotlin/spring"], [
    { re: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "kotlin/spring" },
    { re: /(get|post|put|delete|patch)\s*\{\s*path\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "kotlin/ktor" },
  ]),

  // C#
  new EndpointDetector(".cs", ["csharp/aspnet"], [
    { re: /\[Http(Get|Post|Put|Delete|Patch)\(["'`](\/[^"'`]+)["'`]?\)\]/gi, methodGroup: 1, pathGroup: 2, tech: "csharp/aspnet" },
    { re: /app\.(MapGet|MapPost|MapPut|MapDelete|MapPatch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "csharp/minimal-api" },
  ]),

  // Ruby
  new EndpointDetector(".rb", ["ruby/rails"], [
    { re: /(get|post|put|delete|patch)\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "ruby/rails" },
    { re: /match\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "ruby/rails" },
  ]),

  // PHP
  new EndpointDetector(".php", ["php/laravel"], [
    { re: /Route::(get|post|put|delete|patch|any|match|resource|view|redirect)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "php/laravel" },
    { re: /#[Route\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "php/symfony" },
    { re: /\$app->(get|post|put|delete|patch|map)\s*\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "php/slim" },
  ]),

  // API specs
  new EndpointDetector(".json", ["openapi"], [
    { re: /"(get|post|put|delete|patch|head|options|trace)"\s*:\s*\{/gi, methodGroup: null, pathGroup: null, tech: "openapi" },
  ]),
  new EndpointDetector(".graphql", ["graphql"], []),
  new EndpointDetector(".gql", ["graphql"], []),
  new EndpointDetector(".proto", ["grpc"], [
    { re: /service\s+(\w+)\s*\{/gi, methodGroup: null, pathGroup: 1, tech: "grpc" },
    { re: /rpc\s+(\w+)\(\s*(\w+)\s*\)\s*returns\s*\(\s*(\w+)\s*\)/gi, methodGroup: null, pathGroup: 1, tech: "grpc" },
  ]),
];

const ROUTER_DETECTORS = [
  // Next.js App Router
  new FileRouterDetector(/\/api\/(.+)\/route\.[jt]sx?$/, 
    (p) => { const m = p.match(/\/api\/(.+)\/route\.[jt]sx?$/); return m ? "/api/" + m[1].replace(/\/$/, "") : null; },
    (p, c) => { const methods = ["GET","POST","PUT","DELETE","PATCH"]; return methods.filter(m => new RegExp("export\\s+(?:async\\s+)?function\\s+"+m+"\\s*\\(").test(c)); },
    "typescript/nextjs-app"),

  // Next.js Pages Router
  new FileRouterDetector(/\/pages\/api\/(.+)\.tsx?$/,
    (p) => { const m = p.match(/\/pages\/api\/(.+)\.tsx?$/); if (!m) return null; let path = "/" + m[1].replace(/\.(get|post|put|delete|patch)$/,""); path = path.replace(/\/index$/,"").replace(/\[(\w+)\]/g,"{$1}"); return path; },
    (p, c) => { const fm = p.match(/\.(get|post|put|delete|patch)\.tsx?$/); if (fm) return [fm[1].toUpperCase()]; const methods = ["GET","POST","PUT","DELETE","PATCH"]; const found = methods.filter(m => c.includes('case "'+m+'"') || c.includes('req.method === "'+m+'"')); return found.length > 0 ? found : ["ANY"]; },
    "typescript/nextjs-pages"),

  // SvelteKit
  new FileRouterDetector(/\/routes\/(.+)\.tsx?$/,
    (p) => { const m = p.match(/\/routes\/(.+)\.tsx?$/); if (!m) return null; let path = m[1]; path = path.replace(/^index$/,"/").replace(/\/index$/,"").replace(/\[(\w+)\]/g,"{$1}"); return "/"+path; },
    (p, c) => { const methods = ["GET","POST","PUT","DELETE","PATCH"]; return methods.filter(m => new RegExp("export\\s+(?:const|async\\s+function)\\s+"+m).test(c)); },
    "typescript/sveltekit"),

  // Next.js catch-all (export function GET/POST)
  new FileRouterDetector(/\/api\/(.+)\.(?:get|post|put|delete|patch)\.ts$/,
    (p) => { const m = p.match(/\/api\/(.+)\./); if (!m) return null; let path = "/api/"+m[1].replace(/\/index$/,"").replace(/\[(\w+)\]/g,"{$1}"); return path; },
    (p) => { const fm = p.match(/\.(get|post|put|delete|patch)\.ts$/); return fm ? [fm[1].toUpperCase()] : ["GET"]; },
    "typescript/nextjs-pages"),
];

// ── Framework Detection Patterns ────────────────────────────────────

const TECH_PATTERNS = [
  { ext: [".rs"], tech: "rust" },
  { ext: [".js", ".jsx", ".mjs", ".cjs"], tech: "javascript" },
  { ext: [".ts", ".tsx", ".mts", ".cts"], tech: "typescript" },
  { ext: [".py"], tech: "python" },
  { ext: [".go"], tech: "go" },
  { ext: [".java", ".kt", ".kts"], tech: "jvm" },
  { ext: [".cs", ".vb"], tech: "dotnet" },
  { ext: [".rb"], tech: "ruby" },
  { ext: [".php"], tech: "php" },
  { ext: [".swift"], tech: "swift" },
  { ext: [".scala"], tech: "scala" },
  { ext: [".ex", ".exs"], tech: "elixir" },
  { ext: [".cr"], tech: "crystal" },
  { ext: [".zig"], tech: "zig" },
  { ext: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml", "compose.yml", "compose.yaml"], tech: "docker" },
  { ext: [".graphql", ".gql"], tech: "graphql" },
  { ext: [".proto"], tech: "grpc" },
  { ext: [".sql"], tech: "sql" },
];

const FRAMEWORK_PATTERNS = [
  { file: "Cargo.toml", matchers: ["axum", "actix-web", "rocket", "warp", "tide", "poem", "salvo", "leptos", "dioxus"], framework: "rust" },
  { file: "package.json", matchers: ["express", "fastify", "next", "nuxt", "sveltekit", "remix", "hono", "elysia", "solid-start", "fresh", "astro", "nestjs", "koa", "hapi", "adonis"], framework: "node" },
  { file: "requirements.txt", matchers: ["flask", "django", "fastapi", "litestar", "starlette", "sanic", "quart", "bottle", "tornado", "aiohttp"], framework: "python" },
  { file: "go.mod", matchers: ["gin", "echo", "chi", "fiber", "mux", "gorilla", "huma", "hertz"], framework: "go" },
  { file: "pom.xml", matchers: ["spring-boot", "spring", "micronaut", "quarkus", "helidon"], framework: "java" },
  { file: "Gemfile", matchers: ["rails", "sinatra", "roda", "hanami"], framework: "ruby" },
  { file: "composer.json", matchers: ["laravel", "symfony", "cakephp", "yii", "codeigniter", "slim"], framework: "php" },
  { file: "mix.exs", matchers: ["phoenix", "plug"], framework: "elixir" },
];

// ── Service Classification ──────────────────────────────────────────

function classify(path) {
  const seg = path.toLowerCase().split("/");
  if (seg.some(s => ["gateway","proxy","ingress","reverse-proxy"].includes(s))) return "gateway";
  if (seg.some(s => ["auth","login","oauth","sso","identity"].includes(s))) return "auth-service";
  if (seg.some(s => ["admin","dashboard","management","operator"].includes(s))) return "admin-panel";
  if (seg.some(s => ["payment","billing","checkout","invoice","subscription"].includes(s))) return "payment-service";
  if (seg.some(s => ["user","users","profile","account","member"].includes(s))) return "user-service";
  if (seg.some(s => ["order","orders","cart"].includes(s))) return "order-service";
  if (seg.some(s => ["notification","notify","email","sms","push","alert"].includes(s))) return "notification-service";
  if (seg.some(s => ["search","index","elastic","algolia"].includes(s))) return "search-service";
  if (seg.some(s => ["upload","file","media","asset","image","storage","cdn"].includes(s))) return "media-service";
  if (seg.some(s => ["analytics","tracking","event","metric","monitor"].includes(s))) return "analytics-service";
  if (seg.some(s => ["webhook","hook","callback","event-bus"].includes(s))) return "webhook-service";
  if (seg.some(s => ["chat","message","messaging","realtime","websocket","ws"].includes(s))) return "messaging-service";
  if (seg.some(s => ["report","reporting","export","csv","pdf"].includes(s))) return "reporting-service";
  if (seg.some(s => ["config","configuration","settings","feature-flag"].includes(s))) return "config-service";
  if (seg.includes("server") || seg.includes("api") || seg.includes("backend") || seg.includes("rest")) return "api-service";
  if (seg.includes("cli") || seg.includes("cmd") || seg.includes("command")) return "cli";
  if (seg.includes("controllers") || seg.includes("routes") || seg.includes("handlers")) return "web-app";
  if (seg.includes("services") || seg.includes("models") || seg.includes("repositories")) return "backend-service";
  if (seg.includes("middleware") || seg.includes("plugins")) return "middleware";
  if (seg.includes("web") || seg.includes("public") || seg.includes("static") || seg.includes("frontend") || seg.includes("ui")) return "web-app";
  if (seg.includes("docker") || seg.includes("deploy") || seg.includes("kubernetes") || seg.includes("k8s") || seg.includes("helm")) return "infrastructure";
  return "web-app";
}

// ── Tag Inference ───────────────────────────────────────────────────

function inferTags(path) {
  const t = [];
  const l = path.toLowerCase();
  if (/admin|dashboard|manage|control|operator|super|root/i.test(l)) t.push("admin");
  if (/debug|dev|test|staging|sandbox|internal|private|hidden|config|raw/i.test(l)) t.push("shadow");
  if (/health|ready|live|ping|pong|status|heartbeat|alive|healthz|readyz|livez/i.test(l)) t.push("health");
  if (/deprecated|legacy|old|v0|v1_old|retired|archived/i.test(l)) t.push("deprecated");
  if (/login|logout|auth|session|oauth|sso|signin|signup|register|token|password|reset|forgot|verify|2fa|mfa|otp|totp|authenticate|authorize/i.test(l)) t.push("authenticated");
  if (/upload|file|image|document|attachment|media|blob|storage/i.test(l)) t.push("file-upload");
  if (/download|export|csv|pdf|report|xl|spreadsheet/i.test(l)) t.push("file-download");
  if (/search|query|lookup|find|suggest|autocomplete/i.test(l)) t.push("search");
  if (/graphql|gql|query|mutation|subscription/i.test(l)) t.push("graphql");
  if (/ws|websocket|socket|stream|events|sse|realtime|live/i.test(l)) t.push("websocket");
  if (/webhook|hook|callback|event/i.test(l)) t.push("webhook");
  if (/cron|schedule|job|task|background|worker/i.test(l)) t.push("background-job");
  if (/api\/v\d|\/v\d\//i.test(l)) t.push("versioned");
  if (/swagger|docs|openapi|redoc|api-docs|spec/i.test(l)) t.push("documentation");
  if (/proxy|forward|relay|tunnel|redirect/i.test(l)) t.push("proxy");
  if (/payment|checkout|billing|invoice|charge|refund|subscription|pricing|purchase|wallet|credit|debit|transaction/i.test(l)) t.push("financial");
  if (/email|mail|smtp|send|newsletter|notification|alert/i.test(l)) t.push("notification");
  if (/user|users|profile|account|member|customer/i.test(l)) t.push("user-data");
  if (!t.length) t.push("standard");
  return t;
}

// ── Aggregation ─────────────────────────────────────────────────────

function groupBy(endpoints) {
  const m = {};
  for (const ep of endpoints) { if (!m[ep.service]) m[ep.service] = []; m[ep.service].push(ep); }
  return m;
}

function buildServices(grouped) {
  return Object.entries(grouped).map(([name, eps]) => ({ name, type: name.includes("gateway") ? "gateway" : name.includes("auth")||name.includes("user")||name.includes("payment")||name.includes("order")||name.includes("notification")||name.includes("search")||name.includes("media")||name.includes("analytics")||name.includes("webhook")||name.includes("messaging")||name.includes("reporting")||name.includes("config") ? "microservice" : name.includes("admin")||name.includes("dashboard") ? "admin-panel" : name.includes("api")||name.includes("backend") ? "server" : name.includes("data")||name.includes("database") ? "data-service" : name.includes("infrastructure") ? "infrastructure" : name.includes("cli") ? "cli" : "web-app", endpoints: eps, sourceDir: "", technology: [...new Set(eps.map(e => e.technology).filter(Boolean))].join(", ") }));
}

function aggregateTags(endpoints) {
  const tags = { shadow:0, deprecated:0, authenticated:0, health:0, prover:0, verifier:0, websocket:0, static:0, callee:0, aiContext:0, graphql:0, jwt:0, fileUpload:0, admin:0, search:0, financial:0, notification:0, webhook:0, backgroundJob:0, versioned:0, documentation:0, proxy:0, configuration:0, cache:0, rateLimited:0 };
  for (const ep of endpoints) {
    if (ep.tags.includes("shadow")) tags.shadow++;
    if (ep.tags.includes("deprecated")) tags.deprecated++;
    if (ep.tags.includes("authenticated")) tags.authenticated++;
    if (ep.tags.includes("health")) tags.health++;
    if (ep.tags.includes("websocket")) tags.websocket++;
    if (ep.tags.includes("graphql")) tags.graphql++;
    if (ep.tags.includes("file-upload")) tags.fileUpload++;
    if (ep.tags.includes("admin")) tags.admin++;
    if (ep.tags.includes("search")) tags.search++;
    if (ep.tags.includes("financial")) tags.financial++;
    if (ep.tags.includes("notification")) tags.notification++;
    if (ep.tags.includes("webhook")) tags.webhook++;
    if (ep.tags.includes("background-job")) tags.backgroundJob++;
    if (ep.tags.includes("versioned")) tags.versioned++;
    if (ep.tags.includes("documentation")) tags.documentation++;
    if (ep.tags.includes("proxy")) tags.proxy++;
  }
  return tags;
}

function buildWarnings(endpoints, services) {
  const w = [];
  const sc = endpoints.filter(e => e.tags.includes("shadow")).length;
  if (sc > 0) w.push(`${sc} shadow API${sc !== 1 ? "s" : ""} detected — may expose internal functionality`);
  const dc = endpoints.filter(e => e.tags.includes("deprecated")).length;
  if (dc > 0) w.push(`${dc} deprecated endpoint${dc !== 1 ? "s" : ""} found — recommend removal or migration`);
  const fc = endpoints.filter(e => e.tags.includes("file-upload")).length;
  if (fc > 0) w.push(`${fc} file upload endpoint${fc !== 1 ? "s" : ""} — review for unrestricted upload vulnerabilities`);
  const wsc = endpoints.filter(e => e.tags.includes("websocket")).length;
  if (wsc > 0) w.push(`${wsc} WebSocket endpoint${wsc !== 1 ? "s" : ""} — review for missing origin validation`);
  const ms = services.filter(s => !s.endpoints.some(e => e.tags.includes("health")));
  if (ms.length > 0) w.push(`${ms.length} service${ms.length !== 1 ? "s" : ""} without health check endpoint`);
  return w;
}

// ── Utilities ───────────────────────────────────────────────────────

function dedup(endpoints) {
  const seen = new Set();
  return endpoints.filter(ep => { const k = `${ep.method}:${ep.path}:${ep.service}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

function normalizePath(p) {
  return p.replace(/:(\w+)/g, "{$1}").replace(/<(\w+)>/g, "{$1}").replace(/{(\w+):\w+}/g, "{$1}").replace(/\/\//g, "/").replace(/\/$/, "") || "/";
}

function getLine(text, index) {
  if (!text || index < 0) return 0;
  return text.substring(0, index).split("\n").length;
}

function extractFilePathRoute(filePath, method) {
  const m = filePath.match(/\/api\/(.+\.\w+)$/);
  if (!m) return null;
  let path = "/api/" + m[1].replace(/\.[jt]sx?$/, "").replace(/\/index$/, "").replace(/\[(\w+)\]/g, "{$1}");
  return { path, method: method || "GET" };
}
