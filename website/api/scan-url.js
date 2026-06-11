/**
 * Scan a GitHub repository URL and return endpoint analysis.
 * POST /api/scan-url
 * Body: { url: "https://github.com/user/repo" }
 */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body || {};
  if (!url) {
    return res.status(400).json({ error: "Missing 'url' in request body" });
  }

  try {
    const { owner, repo } = parseGitHubUrl(url);
    if (!owner || !repo) {
      return res.status(400).json({ error: "Invalid GitHub URL. Use: https://github.com/owner/repo" });
    }

    const scanResult = await scanGitHubRepo(owner, repo);
    return res.status(200).json(scanResult);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function parseGitHubUrl(url) {
  const m = url.match(/github\.com\/([^/]+)\/([^/#?]+)/);
  return m ? { owner: m[1], repo: m[2].replace(/\.git$/, "") } : {};
}

async function scanGitHubRepo(owner, repo) {
  const headers = { Accept: "application/vnd.github.v3+json", "User-Agent": "scandog-api" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `token ${process.env.GITHUB_TOKEN}`;

  const contentsUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/main?recursive=1`;
  const treeRes = await fetch(contentsUrl, { headers });
  let branch = "main";
  let treeData;
  if (treeRes.status === 404) {
    const altUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
    const altRes = await fetch(altUrl, { headers });
    if (altRes.status !== 200) throw new Error("Repository not found or inaccessible");
    branch = "master";
    treeData = await altRes.json();
  } else {
    if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`);
    treeData = await treeRes.json();
  }
  return processTree(treeData.tree, owner, repo, branch, headers);
}

function rawUrl(owner, repo, branch, path) {
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

const TECH_PATTERNS = [
  { ext: [".rs"], tech: "rust" },
  { ext: [".js", ".jsx"], tech: "javascript" },
  { ext: [".ts", ".tsx"], tech: "typescript" },
  { ext: [".py"], tech: "python" },
  { ext: [".go"], tech: "go" },
  { ext: [".java"], tech: "java" },
  { ext: [".cs"], tech: "csharp" },
  { ext: [".rb"], tech: "ruby" },
  { ext: [".php"], tech: "php" },
  { ext: [".kt"], tech: "kotlin" },
  { ext: [".scala"], tech: "scala" },
  { ext: [".swift"], tech: "swift" },
  { ext: ["Dockerfile", "docker-compose.yml", "docker-compose.yaml"], tech: "docker" },
];

const FRAMEWORK_PATTERNS = [
  { file: "Cargo.toml", matchers: ["axum", "actix-web", "rocket", "warp", "tide"], framework: "rust" },
  { file: "package.json", matchers: ["express", "fastify", "next", "nuxt", "sveltekit"], framework: "node" },
  { file: "requirements.txt", matchers: ["flask", "django", "fastapi"], framework: "python" },
  { file: "go.mod", matchers: ["gin", "echo", "chi", "fiber", "mux"], framework: "go" },
  { file: "pom.xml", matchers: ["spring-boot", "spring"], framework: "java" },
];

const ENDPOINT_PATTERNS = [
  // Rust — Axum, Actix, Rocket, Warp
  { ext: ".rs", pattern: /\.route\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch)\s*\(/gi, methodGroup: 2, pathGroup: 1, tech: "rust/axum" },
  { ext: ".rs", pattern: /#\[(get|post|put|delete|patch|head|options)\("([^"]+)"\)\]/gi, methodGroup: 1, pathGroup: 2, tech: "rust/actix" },
  { ext: ".rs", pattern: /\.route\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch)\s*\(/gi, methodGroup: 2, pathGroup: 1, tech: "rust/axum" },

  // JavaScript — Express, Fastify, Hono, Koa
  { ext: ".js", pattern: /(?:app|router|server|api)\.(get|post|put|delete|patch|head|options|all)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/express" },
  { ext: ".js", pattern: /\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/fastify" },

  // TypeScript — Express, Hono, NestJS
  { ext: ".ts", pattern: /(?:app|router|server|api)\.(get|post|put|delete|patch|head|options|all)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/express" },
  { ext: ".ts", pattern: /@(Get|Post|Put|Delete|Patch|All)\((?:["'`]([^"'`]+)["'`])?\)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/nestjs" },
  { ext: ".ts", pattern: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/gi, methodGroup: 1, pathGroup: null, tech: "typescript/nextjs" },

  // Python — Flask, FastAPI, Django, Quart, Sanic, aiohttp
  { ext: ".py", pattern: /@\w+\.route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/flask" },
  { ext: ".py", pattern: /@\w+\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "python/fastapi" },
  { ext: ".py", pattern: /path\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/django" },
  { ext: ".py", pattern: /\.add_route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/starlette" },

  // Go — Gin, Echo, Chi, Fiber, net/http
  { ext: ".go", pattern: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Any)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/gin" },
  { ext: ".go", pattern: /http\.HandleFunc\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "go/nethttp" },
  { ext: ".go", pattern: /http\.Handle\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "go/nethttp" },
  { ext: ".go", pattern: /\.(Get|Post|Put|Delete|Patch|Route)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/chi" },

  // Java — Spring Boot, JAX-RS
  { ext: ".java", pattern: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "java/spring" },
  { ext: ".java", pattern: /@RequestMapping\([^)]*path\s*=\s*["'`]([^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "java/spring" },
  { ext: ".java", pattern: /@(GET|POST|PUT|DELETE|PATCH)\s*\n\s*@Path\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "java/jaxrs" },
  { ext: ".java", pattern: /@Path\(\s*["'`]([^"'`]+)["'`]\s*\)\s*\n\s*@(GET|POST|PUT|DELETE|PATCH)/gi, methodGroup: 2, pathGroup: 1, tech: "java/jaxrs" },

  // C# — ASP.NET Core
  { ext: ".cs", pattern: /\[Http(Get|Post|Put|Delete|Patch)\(["'`](\/[^"'`]+)["'`]?\)\]/gi, methodGroup: 1, pathGroup: 2, tech: "csharp/aspnet" },
  { ext: ".cs", pattern: /\[Route\(["'`](\/[^"'`]+)["'`]\)\]/gi, methodGroup: null, pathGroup: 1, tech: "csharp/aspnet" },
  { ext: ".cs", pattern: /app\.(?:MapGet|MapPost|MapPut|MapDelete)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "csharp/aspnet" },

  // Ruby — Rails, Sinatra
  { ext: ".rb", pattern: /(get|post|put|delete|patch)\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "ruby/rails" },
  { ext: ".rb", pattern: /match\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "ruby/rails" },

  // PHP — Laravel, Symfony
  { ext: ".php", pattern: /Route::(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "php/laravel" },
  { ext: ".php", pattern: /#[Route\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "php/symfony" },

  // Kotlin — Ktor, Spring
  { ext: ".kt", pattern: /@(Get|Post|Put|Delete|Patch)Mapping\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "kotlin/spring" },
  { ext: ".kt", pattern: /(get|post|put|delete|patch)\s*\{\s*path\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "kotlin/ktor" },
];

async function processTree(tree, owner, repo, branch, headers) {
  const files = tree.filter((n) => n.type === "blob");
  const techs = new Set();
  const frameworks = new Set();
  const endpoints = [];

  for (const file of files) {
    const ext = "." + file.path.split(".").pop();
    for (const tp of TECH_PATTERNS) {
      if (tp.ext.some((e) => file.path.endsWith(e) || file.path === e)) {
        techs.add(tp.tech);
      }
    }

    if (FRAMEWORK_PATTERNS.some((fp) => file.path.endsWith(fp.file))) {
      try {
        const rawRes = await fetch(rawUrl(owner, repo, branch, file.path));
        if (rawRes.ok) {
          const rawText = await rawRes.text();
          for (const fp of FRAMEWORK_PATTERNS) {
            if (file.path.endsWith(fp.file)) {
              for (const m of fp.matchers) {
                if (rawText.toLowerCase().includes(m.toLowerCase())) {
                  frameworks.add(`${fp.framework}/${m}`);
                }
              }
            }
          }
        }
      } catch {}
    }

    for (const ep of ENDPOINT_PATTERNS) {
      if (file.path.endsWith(ep.ext)) {
        try {
          const rawRes = await fetch(rawUrl(owner, repo, branch, file.path));
          if (rawRes.ok) {
            const rawText = await rawRes.text();
            ep.pattern.lastIndex = 0;
            let match;
            while ((match = ep.pattern.exec(rawText)) !== null) {
              // Next.js API route handler: path is derived from file path
              if (ep.pathGroup === null) {
                const method = ep.methodGroup ? match[ep.methodGroup].toUpperCase() : "ANY";
                const fileName = file.path.split("/").pop().replace(/\.[jt]sx?$/, "");
                const apiPath = fileName === "index" ? "/api" : `/api/${fileName}`;
                endpoints.push({
                  path: normalizePath(apiPath),
                  method,
                  source: { file: file.path, line: 0 },
                  tags: inferTags(apiPath),
                  service: detectService(file.path),
                  technology: ep.tech,
                });
                continue;
              }
              const path = match[ep.pathGroup] || "/";
              const method = ep.methodGroup ? match[ep.methodGroup].toUpperCase() : "ANY";
              const normalized = normalizePath(path);
              endpoints.push({
                path: normalized,
                method,
                source: { file: file.path, line: 0 },
                tags: inferTags(normalized),
                service: detectService(file.path),
                technology: ep.tech,
              });
            }
          }
        } catch {}
      }
    }
  }

  const deduped = dedupEndpoints(endpoints);
  const shadowEps = deduped.filter((e) => e.tags.includes("shadow"));
  const healthEps = deduped.filter((e) => e.tags.includes("health"));

  return {
    projectName: `${owner}/${repo}`,
    projectVersion: "web-scan",
    scannedAt: new Date().toISOString(),
    totalEndpoints: deduped.length,
    services: buildServices(deduped),
    clis: [],
    tags: {
      shadow: shadowEps.length,
      deprecated: deduped.filter((e) => e.tags.includes("deprecated")).length,
      authenticated: deduped.filter((e) => e.tags.includes("authenticated")).length,
      prover: 0, verifier: 0, health: healthEps.length,
      websocket: 0, static: 0, callee: 0, aiContext: 0,
    },
    technologies: [...new Set([...techs, ...frameworks])],
    warnings: shadowEps.length > 0 ? ["Shadow APIs detected — review access controls"] : [],
  };
}

function dedupEndpoints(endpoints) {
  const seen = new Set();
  return endpoints.filter((ep) => {
    const key = `${ep.method}:${ep.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function inferTags(path) {
  const tags = [];
  if (/admin|debug|internal|private|config/i.test(path)) tags.push("shadow");
  if (/health|ready|live|ping|status/i.test(path)) tags.push("health");
  if (/deprecated|legacy|old|v0/i.test(path)) tags.push("deprecated");
  if (/login|logout|auth|session|oauth/i.test(path)) tags.push("authenticated");
  if (!tags.length) tags.push("standard");
  return tags;
}

function normalizePath(path) {
  return path
    .replace(/:(\w+)/g, "{$1}")
    .replace(/<(\w+)>/g, "{$1}")
    .replace(/{(\w+):\w+}/g, "{$1}");
}

function detectService(filePath) {
  if (filePath.includes("gateway")) return "gateway";
  if (filePath.includes("server") || filePath.includes("api")) return "api-service";
  if (filePath.includes("admin")) return "admin-panel";
  if (filePath.includes("cli") || filePath.includes("cmd")) return "cli";
  return "web-app";
}

function buildServices(endpoints) {
  const map = {};
  for (const ep of endpoints) {
    if (!map[ep.service]) map[ep.service] = [];
    map[ep.service].push(ep);
  }
  return Object.entries(map).map(([name, eps]) => ({
    name,
    type: name === "gateway" ? "gateway" : name === "api-service" ? "server" : "web-app",
    endpoints: eps,
    sourceDir: "",
    technology: eps[0]?.technology || "",
  }));
}
