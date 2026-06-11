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

// ── Technology Detection ─────────────────────────────────────────────

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
  { ext: [".sql", ".prisma", ".db", ".sqlite"], tech: "database" },
  { ext: [".graphql", ".gql"], tech: "graphql" },
  { ext: [".proto"], tech: "grpc" },
  { ext: [".yaml", ".yml", ".toml", ".json5"], tech: "config" },
  { ext: ["Makefile", "CMakeLists.txt", "Cargo.toml", "go.mod", "build.gradle", "pom.xml"], tech: "build-system" },
  { ext: [".tf", ".tfvars"], tech: "terraform" },
  { ext: [".nginx.conf", "nginx.conf", "nginx."], tech: "nginx" },
  { ext: ["Caddyfile"], tech: "caddy" },
  { ext: ["haproxy.cfg"], tech: "haproxy" },
  { ext: [".traefik.yml", "traefik.yml", "traefik.yaml", "dynamic-conf.yml"], tech: "traefik" },
  { ext: [".env", ".envrc", ".env.example"], tech: "environment" },
  { ext: ["Jenkinsfile", ".gitlab-ci.yml", ".github/workflows/"], tech: "ci-cd" },
  { ext: [".sql"], tech: "sql" },
  { ext: ["package.json"], tech: "node.js" },
  { ext: ["requirements.txt", "Pipfile", "pyproject.toml", "setup.py"], tech: "python" },
  { ext: ["Cargo.toml"], tech: "rust" },
  { ext: ["go.mod", "go.sum"], tech: "go" },
  { ext: ["Gemfile", "Gemfile.lock"], tech: "ruby" },
  { ext: ["composer.json", "composer.lock"], tech: "php" },
  { ext: ["mix.exs"], tech: "elixir" },
  { ext: ["build.gradle", "build.gradle.kts", "pom.xml", "settings.gradle"], tech: "java" },
  { ext: ["*.nupkg", "*.csproj", "*.sln", "packages.config"], tech: "dotnet" },
  { ext: ["sh", "bash", "zsh"], tech: "shell" },
  { ext: ["Dockerfile"], tech: "dockerfile" },
];

// ── Framework Detection ──────────────────────────────────────────────

const FRAMEWORK_PATTERNS = [
  { file: "Cargo.toml", matchers: ["axum", "actix-web", "rocket", "warp", "tide", "poem", "salvo", "leptos", "dioxus", "viz", "gotham", "nickel", "iron", "thruster", "ntex", "may_minihttp", "h2", "hyper"], framework: "rust" },
  { file: "package.json", matchers: ["express", "fastify", "next", "nuxt", "sveltekit", "remix", "hono", "elysia", "solid-start", "fresh", "astro", "nest", "nestjs", "feathers", "sails", "meteor", "derby", "loopback", "restify", "koa", "hapi", "adonis", "sapper", "gatsby", "redwood", "blitz", "vite"], framework: "node" },
  { file: "requirements.txt", matchers: ["flask", "django", "fastapi", "litestar", "starlette", "sanic", "quart", "bottle", "tornado", "aiohttp", "web2py", "pyramid", "cherrypy", "hug", "robyn", "blacksheep", "falcon", "masonite", "molten"], framework: "python" },
  { file: "go.mod", matchers: ["gin", "echo", "chi", "fiber", "mux", "gorilla", "huma", "fuego", "hertz", "atreugo", "fastro", "goyave", "pocketbase", "bud", "goravel", "aero", "air"], framework: "go" },
  { file: "pom.xml", matchers: ["spring-boot", "spring", "micronaut", "quarkus", "helidon", "jooby", "javalin", "kumuluzee", "dropwizard", "spark"], framework: "java" },
  { file: "build.gradle", matchers: ["spring-boot", "spring", "micronaut", "quarkus", "helidon", "jooby", "javalin", "ktor", "http4k"], framework: "java" },
  { file: "mix.exs", matchers: ["phoenix", "plug"], framework: "elixir" },
  { file: "Gemfile", matchers: ["rails", "sinatra", "roda", "hanami", "grape", "cuba", "rack"], framework: "ruby" },
  { file: "composer.json", matchers: ["laravel", "symfony", "cakephp", "yii", "codeigniter", "slim", "fuelphp", "phalcon", "lumen", "zend", "mezzio", "spiral"], framework: "php" },
  { file: "*.csproj", matchers: ["mvc", "webapi", "minimal-api", "carter", "giraffe", "saturn", "falco", "fable"], framework: "dotnet" },
  { file: "Cargo.toml", matchers: ["axum", "actix-web", "rocket", "warp", "tide", "poem", "salvo", "leptos", "dioxus", "viz"], framework: "rust" },
  { file: "pyproject.toml", matchers: ["flask", "django", "fastapi", "litestar", "starlette", "sanic", "quart"], framework: "python" },
];

// ── Endpoint Detection Patterns ──────────────────────────────────────

const ENDPOINT_PATTERNS = [
  // ── Rust ──────────────────────────────────────────────────────────
  { ext: ".rs", pattern: /\.route\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch|head|options|any|trace|connect)\s*\(/gi, methodGroup: 2, pathGroup: 1, tech: "rust/axum" },
  { ext: ".rs", pattern: /#\[(get|post|put|delete|patch|head|options)\(?["']?([^"'\]]+)["']?\)?\]/gi, methodGroup: 1, pathGroup: 2, tech: "rust/actix" },
  { ext: ".rs", pattern: /\.route\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch)\s*\(/gi, methodGroup: 2, pathGroup: 1, tech: "rust/axum" },
  { ext: ".rs", pattern: /#[derive\(Deserialize\)\]\s*\n\s*struct\s+(\w+)\s*\{/gi, methodGroup: null, pathGroup: 1, tech: "rust/serde" },
  { ext: ".rs", pattern: /\.on\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch|head|options)/gi, methodGroup: 2, pathGroup: 1, tech: "rust/poem" },
  { ext: ".rs", pattern: /Router::(get|post|put|delete|patch|head|options)\(\s*["'](\/[^"']+)["']/gi, methodGroup: 1, pathGroup: 2, tech: "rust/salvo" },
  { ext: ".rs", pattern: /#[debug_handler\]\s*\n\s*async\s+fn\s+\w+\s*\(/gi, methodGroup: null, pathGroup: null, tech: "rust/leptos" },
  { ext: ".rs", pattern: /\.with\(\s*path!\s*\(\s*["'](\/[^"']+)["']/gi, methodGroup: null, pathGroup: 1, tech: "rust/dioxus" },
  { ext: ".rs", pattern: /server_fn\s*\(\s*["']?(\/[^"']+)["']?\s*\)/gi, methodGroup: null, pathGroup: 1, tech: "rust/leptos-server-fn" },

  // ── JavaScript / TypeScript ───────────────────────────────────────
  { ext: ".js", pattern: /(?:app|router|server|api|route)\.(get|post|put|delete|patch|head|options|all|trace|connect)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/express" },
  { ext: ".js", pattern: /\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/fastify" },
  { ext: ".js", pattern: /app\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/hono" },
  { ext: ".js", pattern: /server\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/elysia" },
  { ext: ".js", pattern: /\.on\(\s*["'](\/[^"']+)["']\s*,\s*(get|post|put|delete|patch)/gi, methodGroup: 2, pathGroup: 1, tech: "javascript/restify" },
  { ext: ".js", pattern: /router\.(get|post|put|delete|patch|all)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/koa" },
  { ext: ".js", pattern: /addRoute\(\s*["'`](\/[^"'`]+)["'`]\s*,\s*["'`](get|post|put|delete|patch)["'`]/gi, methodGroup: 2, pathGroup: 1, tech: "javascript/hapi" },
  { ext: ".js", pattern: /@(Get|Post|Put|Delete|Patch|All)\(\s*["'`](\/[^"'`]+)?["'`]?\s*\)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/nestjs" },

  // ── TypeScript ────────────────────────────────────────────────────
  { ext: ".ts", pattern: /(?:app|router|server|api|route)\.(get|post|put|delete|patch|head|options|all)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/express" },
  { ext: ".ts", pattern: /\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/fastify" },
  { ext: ".ts", pattern: /@(Get|Post|Put|Delete|Patch|All)\((?:["'`]([^"'`]+)["'`])?\)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/nestjs" },
  { ext: ".ts", pattern: /app\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/hono" },
  { ext: ".ts", pattern: /server\.(get|post|put|delete|patch|all)\s*\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/elysia" },
  { ext: ".ts", pattern: /router\.(get|post|put|delete|patch|all)\(\s*["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/trpc" },
  { ext: ".ts", pattern: /@hono\/(\w+)\-route/gi, methodGroup: null, pathGroup: null, tech: "typescript/hono-file-based" },
  { ext: ".ts", pattern: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/gi, methodGroup: 1, pathGroup: null, tech: "typescript/nextjs-pages" },
  { ext: ".ts", pattern: /export\s+(?:async\s+)?function\s+(GET|POST|PUT|DELETE|PATCH)\s*\(/gi, methodGroup: 1, pathGroup: null, tech: "typescript/nextjs-pages" },

  // ── Python ────────────────────────────────────────────────────────
  { ext: ".py", pattern: /@\w+\.route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/flask" },
  { ext: ".py", pattern: /@\w+\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "python/fastapi" },
  { ext: ".py", pattern: /path\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/django" },
  { ext: ".py", pattern: /@\w+\.(get|post|put|delete|patch|head|options)\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "python/flask" },
  { ext: ".py", pattern: /\.add_route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/starlette" },
  { ext: ".py", pattern: /\.route\(\s*["'`](\/[^"'`]+)["'`]\s*,\s*methods?\s*=\s*\[/gi, methodGroup: null, pathGroup: 1, tech: "python/flask-methods" },
  { ext: ".py", pattern: /@\w+\.(get|post|put|delete|patch|head|options)\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "python/sanic" },
  { ext: ".py", pattern: /@\w+\.(get|post|put|delete|patch)\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "python/quart" },
  { ext: ".py", pattern: /\.route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "python/litestar" },
  { ext: ".py", pattern: /@app\.(?:before_request|after_request|errorhandler)/gi, methodGroup: null, pathGroup: null, tech: "python/flask-middleware" },

  // ── Go ────────────────────────────────────────────────────────────
  { ext: ".go", pattern: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS|Any|any)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/gin" },
  { ext: ".go", pattern: /\.(Get|Post|Put|Delete|Patch|Route)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/chi" },
  { ext: ".go", pattern: /http\.HandleFunc\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "go/nethttp" },
  { ext: ".go", pattern: /http\.Handle\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "go/nethttp" },
  { ext: ".go", pattern: /\.(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s*\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/echo" },
  { ext: ".go", pattern: /\.(Get|Post|Put|Delete|Patch|Head|Options)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/fiber" },
  { ext: ".go", pattern: /\.HandleFunc\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "go/gorilla" },
  { ext: ".go", pattern: /huma\.(Get|Post|Put|Delete|Patch|Head|Options)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/huma" },
  { ext: ".go", pattern: /mux\.(Get|Post|Put|Delete|Patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "go/goyave" },

  // ── Java / Kotlin ─────────────────────────────────────────────────
  { ext: ".java", pattern: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "java/spring" },
  { ext: ".java", pattern: /@RequestMapping\([^)]*path\s*=\s*["'`]([^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "java/spring" },
  { ext: ".java", pattern: /@RequestMapping\([^)]*value\s*=\s*["'`]([^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "java/spring" },
  { ext: ".java", pattern: /@(GET|POST|PUT|DELETE|PATCH)\s*\n\s*@Path\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "java/jaxrs" },
  { ext: ".java", pattern: /@Path\(\s*["'`]([^"'`]+)["'`]\s*\)\s*\n\s*@(GET|POST|PUT|DELETE|PATCH)/gi, methodGroup: 2, pathGroup: 1, tech: "java/jaxrs" },
  { ext: ".java", pattern: /\.path\(\s*["'`](\/[^"'`]+)["'`]\)/gi, methodGroup: null, pathGroup: 1, tech: "java/micronaut" },
  { ext: ".java", pattern: /@\w+\s*\(\s*resource\s*=\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "java/quarkus" },
  { ext: ".java", pattern: /\.get\(\s*["'`](\/[^"'`]+)["'`]\)/gi, methodGroup: null, pathGroup: 1, tech: "java/javalin" },
  { ext: ".kt", pattern: /@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping)\(\s*["'`]([^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "kotlin/spring" },
  { ext: ".kt", pattern: /(get|post|put|delete|patch)\s*\{\s*path\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "kotlin/ktor" },
  { ext: ".kt", pattern: /route\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "kotlin/ktor" },

  // ── C# ────────────────────────────────────────────────────────────
  { ext: ".cs", pattern: /\[Http(Get|Post|Put|Delete|Patch)\(["'`](\/[^"'`]+)["'`]?\)\]/gi, methodGroup: 1, pathGroup: 2, tech: "csharp/aspnet" },
  { ext: ".cs", pattern: /\[Route\(["'`](\/[^"'`]+)["'`]\)\]/gi, methodGroup: null, pathGroup: 1, tech: "csharp/aspnet" },
  { ext: ".cs", pattern: /app\.(?:MapGet|MapPost|MapPut|MapDelete|MapPatch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "csharp/minimal-api" },
  { ext: ".cs", pattern: /\.(?:Get|Post|Put|Delete|Patch)\s*<[^>]+>\s*\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "csharp/carter" },

  // ── Ruby ──────────────────────────────────────────────────────────
  { ext: ".rb", pattern: /(get|post|put|delete|patch)\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "ruby/rails" },
  { ext: ".rb", pattern: /match\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "ruby/rails" },
  { ext: ".rb", pattern: /resources\s+:(\w+)/gi, methodGroup: null, pathGroup: 1, tech: "ruby/rails-resources" },
  { ext: ".rb", pattern: /resource\s+:(\w+)/gi, methodGroup: null, pathGroup: 1, tech: "ruby/rails-resource" },
  { ext: ".rb", pattern: /namespace\s+(?::(\w+)|\s*["'`]([^"'`]+)["'`])/gi, methodGroup: null, pathGroup: null, tech: "ruby/rails-namespace" },

  // ── PHP ───────────────────────────────────────────────────────────
  { ext: ".php", pattern: /Route::(get|post|put|delete|patch|any|match|resource|view|redirect)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "php/laravel" },
  { ext: ".php", pattern: /#[Route\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "php/symfony" },
  { ext: ".php", pattern: /#[Route\(["'`](\/[^"'`]+)["'`]\s*,\s*(?:name|methods)\s*=\s*["'`]([^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "php/symfony-attr" },
  { ext: ".php", pattern: /\$app->(get|post|put|delete|patch|map)\s*\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "php/slim" },
  { ext: ".php", pattern: /#[Route\(["'`](\/[^"'`]+)["'`]\s*\)\]/gi, methodGroup: null, pathGroup: 1, tech: "php/spiral" },

  // ── Elixir ────────────────────────────────────────────────────────
  { ext: ".ex", pattern: /get\s+["'`](\/[^"'`]+)["'`]\s*,\s*\w+/gi, methodGroup: null, pathGroup: 1, tech: "elixir/phoenix" },
  { ext: ".ex", pattern: /resources\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "elixir/phoenix-resources" },
  { ext: ".ex", pattern: /scope\s+["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "elixir/phoenix-scope" },
  { ext: ".exs", pattern: /get\s+["'`](\/[^"'`]+)["'`]\s*,\s*\w+/gi, methodGroup: null, pathGroup: 1, tech: "elixir/phoenix" },

  // ── Swift ─────────────────────────────────────────────────────────
  { ext: ".swift", pattern: /router\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "swift/vapor" },
  { ext: ".swift", pattern: /app\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "swift/kitura" },
  { ext: ".swift", pattern: /@(Get|Post|Put|Delete|Patch)\(["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "swift/hummingbird" },

  // ── Scala ─────────────────────────────────────────────────────────
  { ext: ".scala", pattern: /path\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "scala/http4s" },
  { ext: ".scala", pattern: /(get|post|put|delete|patch)\s*\{\s*path\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "scala/cask" },
  { ext: ".scala", pattern: /@Endpoint\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: null, pathGroup: 1, tech: "scala/tapir" },

  // ── Zig ───────────────────────────────────────────────────────────
  { ext: ".zig", pattern: /\.(get|post|put|delete|patch|head|options)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "zig/zap" },
  { ext: ".zig", pattern: /router\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "zig/zig-http" },

  // ── Crystal ───────────────────────────────────────────────────────
  { ext: ".cr", pattern: /(get|post|put|delete|patch)\s+["'`](\/[^"'`]+)["'`]\s+do/gi, methodGroup: 1, pathGroup: 2, tech: "crystal/amber" },
  { ext: ".cr", pattern: /\.(get|post|put|delete|patch)\(\s*["'`](\/[^"'`]+)["'`]/gi, methodGroup: 1, pathGroup: 2, tech: "crystal/lucky" },

  // ── API Specs ─────────────────────────────────────────────────────
  { ext: ".json", pattern: /"(get|post|put|delete|patch|head|options|trace)"\s*:\s*\{/gi, methodGroup: null, pathGroup: null, tech: "openapi" },
  { ext: ".yaml", pattern: /(get|post|put|delete|patch|head|options|trace):\s*\n\s*(?:operationId|summary|tags|parameters|responses)/gi, methodGroup: null, pathGroup: null, tech: "openapi" },
  { ext: ".yml", pattern: /(get|post|put|delete|patch|head|options|trace):\s*\n\s*(?:operationId|summary|tags|parameters|responses)/gi, methodGroup: null, pathGroup: null, tech: "openapi" },
  { ext: ".graphql", pattern: /type\s+\w+\s*\{/gi, methodGroup: null, pathGroup: null, tech: "graphql" },
  { ext: ".gql", pattern: /type\s+\w+\s*\{/gi, methodGroup: null, pathGroup: null, tech: "graphql" },
  { ext: ".graphqls", pattern: /type\s+\w+\s*\{/gi, methodGroup: null, pathGroup: null, tech: "graphql" },
  { ext: ".proto", pattern: /service\s+(\w+)\s*\{/gi, methodGroup: null, pathGroup: 1, tech: "grpc" },
  { ext: ".proto", pattern: /rpc\s+(\w+)\(\s*(\w+)\s*\)\s*returns\s*\(\s*(\w+)\s*\)/gi, methodGroup: null, pathGroup: 1, tech: "grpc" },
];

// ── File-Based Router Detection ────────────────────────────────────

const FILE_ROUTER_PATTERNS = [
  {
    pattern: /\/api\/(.+)\/route\.[jt]sx?$/,
    methodExtractor: (filePath) => {
      const content = filePath.content || "";
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      return methods.filter((m) => new RegExp(`export\\s+(?:async\\s+)?function\\s+${m}\\s*\\(`).test(content));
    },
    pathExtractor: (filePath) => {
      const match = filePath.match(/\/api\/(.+)\/route\.[jt]sx?$/);
      if (!match) return null;
      return "/api/" + match[1].replace(/\/$/, "");
    },
    tech: "typescript/nextjs-app",
  },
  {
    pattern: /\/api\/(.+)\.(?:get|post|put|delete|patch|ts|js)$/,
    pathExtractor: (filePath) => {
      const match = filePath.match(/\/api\/(.+)\./);
      if (!match) return null;
      let path = "/api/" + match[1];
      path = path.replace(/\/index$/, "");
      path = path.replace(/\[\.\.\.(\w+)\]/g, "{$1}");
      path = path.replace(/\[(\w+)\]/g, "{$1}");
      return path;
    },
    methodExtractor: (filePath) => {
      const m = filePath.match(/\.(get|post|put|delete|patch)(?:\.[jt]sx?)?$/);
      return m ? [m[1].toUpperCase()] : ["GET"];
    },
    tech: "typescript/nextjs-pages",
  },
  {
    pattern: /\/server\/api\/(.+)\.ts$/,
    pathExtractor: (filePath) => {
      const match = filePath.match(/\/server\/api\/(.+)\.ts$/);
      if (!match) return null;
      let path = "/api/" + match[1];
      path = path.replace(/\/index$/, "");
      path = path.replace(/\[(\w+)\]/g, "{$1}");
      return path;
    },
    methodExtractor: () => ["GET"],
    tech: "typescript/remix",
  },
  {
    pattern: /\/routes\/(.+)\.tsx?$/,
    pathExtractor: (filePath) => {
      const match = filePath.match(/\/routes\/(.+)\.tsx?$/);
      if (!match) return null;
      let path = match[1];
      path = path.replace(/^index$/, "/");
      path = path.replace(/\/index$/, "");
      path = path.replace(/\[(\w+)\]/g, "{$1}");
      path = "/" + path;
      return path;
    },
    methodExtractor: (filePath, content) => {
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      if (!content) return ["GET"];
      return methods.filter((m) => new RegExp(`export\\s+(?:const|async\\s+function)\\s+${m}`).test(content));
    },
    tech: "typescript/sveltekit",
  },
  {
    pattern: /\/pages\/api\/(.+)\.tsx?$/,
    pathExtractor: (filePath) => {
      const match = filePath.match(/\/pages\/api\/(.+)\.tsx?$/);
      if (!match) return null;
      let path = "/" + match[1].replace(/\.(get|post|put|delete|patch)$/, "");
      path = path.replace(/\/index$/, "");
      path = path.replace(/\[(\w+)\]/g, "{$1}");
      return path;
    },
    methodExtractor: (filePath, content) => {
      const m = filePath.match(/\.(get|post|put|delete|patch)\.tsx?$/);
      if (m) return [m[1].toUpperCase()];
      if (!content) return ["ANY"];
      const methods = ["GET", "POST", "PUT", "DELETE", "PATCH"];
      const found = methods.filter((method) => content.includes(`case "${method}"`) || content.includes(`req.method === "${method}"`));
      return found.length > 0 ? found : ["ANY"];
    },
    tech: "typescript/nextjs-pages-api",
  },
];

// ── Main Processing ─────────────────────────────────────────────────

async function processTree(tree, owner, repo, branch, headers) {
  const files = tree.filter((n) => n.type === "blob");
  const techs = new Set();
  const frameworks = new Set();
  const endpoints = [];
  const configFiles = {};
  let hasDockerCompose = false;
  let hasServerlessConfig = false;

  for (const file of files) {
    const ext = "." + file.path.split(".").pop();
    const fileName = file.path.split("/").pop();

    for (const tp of TECH_PATTERNS) {
      if (tp.ext.some((e) => file.path.endsWith(e) || file.path === e || (e.startsWith("*.") && fileName === e.slice(2)) || file.path.includes(e))) {
        techs.add(tp.tech);
      }
    }

    if (file.path === "docker-compose.yml" || file.path === "docker-compose.yaml" || file.path === "compose.yml" || file.path === "compose.yaml") {
      hasDockerCompose = true;
    }

    if (file.path === "serverless.yml" || file.path === "serverless.yaml" || file.path === ".serverless" || file.path === "wrangler.toml") {
      hasServerlessConfig = true;
    }

    let rawText = null;

    if (FRAMEWORK_PATTERNS.some((fp) => file.path.endsWith(fp.file) || file.path.endsWith(fp.file.replace("*", "")))) {
      try {
        const rawRes = await fetch(rawUrl(owner, repo, branch, file.path));
        if (rawRes.ok) {
          rawText = await rawRes.text();
          configFiles[fileName] = rawText;
          for (const fp of FRAMEWORK_PATTERNS) {
            if (file.path.endsWith(fp.file.replace("*", ""))) {
              for (const m of fp.matchers) {
                const re = new RegExp(m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
                if (re.test(rawText)) {
                  frameworks.add(fp.framework);
                }
              }
            }
          }
        }
      } catch {}
    }

    // ── Endpoint pattern matching ──────────────────────────────────
    for (const ep of ENDPOINT_PATTERNS) {
      if (file.path.endsWith(ep.ext)) {
        try {
          if (rawText === null) {
            const rawRes = await fetch(rawUrl(owner, repo, branch, file.path));
            if (!rawRes.ok) continue;
            rawText = await rawRes.text();
          }
          ep.pattern.lastIndex = 0;
          let match;
          while ((match = ep.pattern.exec(rawText)) !== null) {
            if (ep.pathGroup === null && ep.methodGroup === null) {
              if (ep.tech.startsWith("rust/leptos")) {
                endpoints.push({
                  path: "/",
                  method: "ANY",
                  source: { file: file.path, line: getLineNumber(rawText, match.index) },
                  tags: ["frontend", "ssr"],
                  service: detectService(file.path),
                  technology: ep.tech,
                });
              }
              continue;
            }
            if (ep.pathGroup === null) {
              const method = ep.methodGroup ? match[ep.methodGroup].toUpperCase() : "ANY";
              const extracted = extractFilePathRoute(file.path, method);
              if (extracted) {
                endpoints.push({
                  path: extracted.path,
                  method: extracted.method,
                  source: { file: file.path, line: getLineNumber(rawText, match.index) },
                  tags: inferTags(extracted.path),
                  service: detectService(file.path),
                  technology: ep.tech,
                });
              }
              continue;
            }
            const path = match[ep.pathGroup] || "/";
            const method = ep.methodGroup ? match[ep.methodGroup].toUpperCase() : "ANY";
            const normalized = normalizePath(path);
            endpoints.push({
              path: normalized,
              method: method === "ANY" ? normalizeMethod(method) : method,
              source: { file: file.path, line: getLineNumber(rawText, match.index) },
              tags: inferTags(normalized),
              service: detectService(file.path),
              technology: ep.tech,
            });
          }
        } catch {}
      }
    }

    // ── File-based router detection (Next.js, SvelteKit, Remix, etc.) ──
    for (const fr of FILE_ROUTER_PATTERNS) {
      if (fr.pattern.test(file.path)) {
        try {
          if (rawText === null) {
            const rawRes = await fetch(rawUrl(owner, repo, branch, file.path));
            if (!rawRes.ok) continue;
            rawText = await rawRes.text();
          }
          const apiPath = fr.pathExtractor(file.path);
          if (!apiPath) continue;
          const methods = fr.methodExtractor(file.path, rawText);
          for (const method of methods) {
            endpoints.push({
              path: apiPath,
              method,
              source: { file: file.path, line: 0 },
              tags: inferTags(apiPath),
              service: detectService(file.path),
              technology: fr.tech,
            });
          }
        } catch {}
      }
    }
  }

  const deduped = dedupEndpoints(endpoints);
  const grouped = groupByService(deduped);
  const services = buildServices(grouped, configFiles);
  const tags = aggregateTags(deduped);
  const warnings = buildWarnings(deduped, services);
  const allTechs = [...new Set([...techs, ...frameworks])];

  return {
    projectName: `${owner}/${repo}`,
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

// ── Service Detection ───────────────────────────────────────────────

function detectService(filePath) {
  const path = filePath.toLowerCase();
  const segments = path.split("/");

  if (segments.some((s) => ["gateway", "proxy", "ingress", "reverse-proxy"].includes(s))) return "gateway";
  if (segments.some((s) => ["auth", "login", "oauth", "sso", "identity"].includes(s))) return "auth-service";
  if (segments.some((s) => ["admin", "admin-panel", "dashboard", "management"].includes(s))) return "admin-panel";
  if (segments.some((s) => ["payment", "billing", "checkout", "invoice", "subscription"].includes(s))) return "payment-service";
  if (segments.some((s) => ["user", "users", "profile", "account", "member"].includes(s))) return "user-service";
  if (segments.some((s) => ["order", "orders", "cart", "cart-service"].includes(s))) return "order-service";
  if (segments.some((s) => ["notification", "notify", "email", "sms", "push", "alert"].includes(s))) return "notification-service";
  if (segments.some((s) => ["search", "index", "elastic", "algolia"].includes(s))) return "search-service";
  if (segments.some((s) => ["upload", "file", "media", "asset", "image", "storage", "cdn"].includes(s))) return "media-service";
  if (segments.some((s) => ["analytics", "tracking", "event", "metric", "monitor", "telemetry"].includes(s))) return "analytics-service";
  if (segments.some((s) => ["webhook", "hook", "callback", "event-bus"].includes(s))) return "webhook-service";
  if (segments.some((s) => ["chat", "message", "messaging", "realtime", "websocket", "ws"].includes(s))) return "messaging-service";
  if (segments.some((s) => ["report", "reporting", "export", "csv", "pdf"].includes(s))) return "reporting-service";
  if (segments.some((s) => ["review", "rating", "feedback"].includes(s))) return "review-service";
  if (segments.some((s) => ["config", "configuration", "settings", "feature-flag"].includes(s))) return "config-service";

  if (segments.includes("server") || segments.includes("api") || segments.includes("backend") || segments.includes("rest")) return "api-service";
  if (segments.includes("cli") || segments.includes("cmd") || segments.includes("command")) return "cli";

  // Architecture-based detection from directory structure
  if (segments.includes("controllers") || segments.includes("routes") || segments.includes("handlers")) return "web-app";
  if (segments.includes("services") || segments.includes("models") || segments.includes("repositories")) return "backend-service";
  if (segments.includes("middleware") || segments.includes("plugins") || segments.includes("extensions")) return "middleware";
  if (segments.includes("migrations") || segments.includes("seeds") || segments.includes("database")) return "data-layer";
  if (segments.includes("tests") || segments.includes("spec") || segments.includes("__tests__")) return "test-suite";
  if (segments.includes("docs") || segments.includes("documentation") || segments.includes("wiki")) return "documentation";
  if (segments.includes("scripts") || segments.includes("bin") || segments.includes("tasks")) return "scripts";
  if (segments.includes("web") || segments.includes("public") || segments.includes("static") || segments.includes("frontend") || segments.includes("ui")) return "web-app";
  if (segments.includes("docker") || segments.includes("deploy") || segments.includes("kubernetes") || segments.includes("k8s") || segments.includes("helm")) return "infrastructure";

  return "web-app";
}

function groupByService(endpoints) {
  const map = {};
  for (const ep of endpoints) {
    if (!map[ep.service]) map[ep.service] = [];
    map[ep.service].push(ep);
  }
  return map;
}

function buildServices(grouped, configFiles) {
  return Object.entries(grouped).map(([name, eps]) => {
    const techs = [...new Set(eps.map((e) => e.technology).filter(Boolean))];
    return {
      name,
      type: name.includes("gateway") ? "gateway" :
            name.includes("auth") || name.includes("user") || name.includes("payment") || name.includes("order") || name.includes("notification") || name.includes("search") || name.includes("media") || name.includes("analytics") || name.includes("webhook") || name.includes("messaging") || name.includes("reporting") || name.includes("review") || name.includes("config") ? "microservice" :
            name.includes("admin") || name.includes("dashboard") ? "admin-panel" :
            name.includes("api") || name.includes("backend") ? "server" :
            name.includes("data") || name.includes("database") ? "data-service" :
            name.includes("middleware") ? "middleware" :
            name.includes("infrastructure") ? "infrastructure" :
            name.includes("cli") ? "cli" :
            "web-app",
      endpoints: eps,
      sourceDir: "",
      technology: techs.join(", "),
    };
  });
}

// ── Tag Inference ───────────────────────────────────────────────────

function inferTags(path) {
  const tags = [];
  const lower = path.toLowerCase();

  if (/admin|dashboard|manage|control|operator|super|root/i.test(path)) tags.push("admin");
  if (/debug|dev|test|staging|sandbox|internal|private|hidden|config|raw/i.test(path)) tags.push("shadow");
  if (/health|ready|live|ping|pong|status|heartbeat|alive|healthz|readyz|livez/i.test(path)) tags.push("health");
  if (/deprecated|legacy|old|v0|v1_old|retired|archived/i.test(path)) tags.push("deprecated");
  if (/login|logout|auth|session|oauth|sso|signin|signup|register|token|password|reset|forgot|verify|2fa|mfa|otp|totp|authenticate|authorize/i.test(path)) tags.push("authenticated");
  if (/login|signin|register|signup/i.test(path)) tags.push("auth");
  if (/upload|file|image|document|attachment|media|blob|storage/i.test(path)) tags.push("file-upload");
  if (/download|export|csv|pdf|report|xl|spreadsheet/i.test(path)) tags.push("file-download");
  if (/search|query|lookup|find|suggest|autocomplete/i.test(path)) tags.push("search");
  if (/graphql|gql|query|mutation|subscription/i.test(path)) tags.push("graphql");
  if (/ws|websocket|socket|stream|events|sse|realtime|live/i.test(path)) tags.push("websocket");
  if (/webhook|hook|callback|event/i.test(path)) tags.push("webhook");
  if (/cron|schedule|job|task|background|worker/i.test(path)) tags.push("background-job");
  if (/api\/v\d|\/v\d\//i.test(path)) tags.push("versioned");
  if (/swagger|docs|openapi|redoc|api-docs|spec/i.test(path)) tags.push("documentation");
  if (/proxy|forward|relay|tunnel|redirect/i.test(path)) tags.push("proxy");
  if (/\bconfig\b|\bsettings\b|\bpreferences\b|\boptions\b/i.test(path)) tags.push("configuration");
  if (/cache|redis|memcached|invalidate|flush|purge/i.test(path)) tags.push("cache");
  if (/rate|limit|throttle|quota/i.test(path)) tags.push("rate-limited");
  if (/payment|checkout|billing|invoice|charge|refund|subscription|pricing|purchase|wallet|credit|debit|transaction/i.test(path)) tags.push("financial");
  if (/email|mail|smtp|send|newsletter|notification|alert/i.test(path)) tags.push("notification");
  if (/user|users|profile|account|member|customer/i.test(path)) tags.push("user-data");

  if (!tags.length) tags.push("standard");
  return tags;
}

// ── Aggregation ─────────────────────────────────────────────────────

function aggregateTags(endpoints) {
  const agg = {
    shadow: 0, deprecated: 0, authenticated: 0, health: 0,
    prover: 0, verifier: 0, websocket: 0, static: 0,
    callee: 0, aiContext: 0, graphql: 0, jwt: 0, fileUpload: 0,
    admin: 0, search: 0, financial: 0, notification: 0,
    webhook: 0, backgroundJob: 0, versioned: 0, documentation: 0,
    proxy: 0, configuration: 0, cache: 0, rateLimited: 0,
  };
  for (const ep of endpoints) {
    if (ep.tags.includes("shadow")) agg.shadow++;
    if (ep.tags.includes("deprecated")) agg.deprecated++;
    if (ep.tags.includes("authenticated")) agg.authenticated++;
    if (ep.tags.includes("health")) agg.health++;
    if (ep.tags.includes("websocket")) agg.websocket++;
    if (ep.tags.includes("graphql")) agg.graphql++;
    if (ep.tags.includes("file-upload")) agg.fileUpload++;
    if (ep.tags.includes("admin")) agg.admin++;
    if (ep.tags.includes("search")) agg.search++;
    if (ep.tags.includes("financial")) agg.financial++;
    if (ep.tags.includes("notification")) agg.notification++;
    if (ep.tags.includes("webhook")) agg.webhook++;
    if (ep.tags.includes("background-job")) agg.backgroundJob++;
    if (ep.tags.includes("versioned")) agg.versioned++;
    if (ep.tags.includes("documentation")) agg.documentation++;
    if (ep.tags.includes("proxy")) agg.proxy++;
    if (ep.tags.includes("configuration")) agg.configuration++;
    if (ep.tags.includes("cache")) agg.cache++;
    if (ep.tags.includes("rate-limited")) agg.rateLimited++;
    if (ep.tags.includes("user-data")) agg.userData = (agg.userData || 0) + 1;
  }
  return agg;
}

function buildWarnings(endpoints, services) {
  const warnings = [];
  const shadowCount = endpoints.filter((e) => e.tags.includes("shadow")).length;
  if (shadowCount > 0) warnings.push(`${shadowCount} shadow API${shadowCount !== 1 ? "s" : ""} detected — may expose internal functionality`);
  const deprecatedCount = endpoints.filter((e) => e.tags.includes("deprecated")).length;
  if (deprecatedCount > 0) warnings.push(`${deprecatedCount} deprecated endpoint${deprecatedCount !== 1 ? "s" : ""} found — recommend removal or migration`);
  const fileUploadCount = endpoints.filter((e) => e.tags.includes("file-upload")).length;
  if (fileUploadCount > 0) warnings.push(`${fileUploadCount} file upload endpoint${fileUploadCount !== 1 ? "s" : ""} — review for unrestricted upload vulnerabilities`);
  const wsCount = endpoints.filter((e) => e.tags.includes("websocket")).length;
  if (wsCount > 0) warnings.push(`${wsCount} WebSocket endpoint${wsCount !== 1 ? "s" : ""} — review for missing origin validation`);
  const financialCount = endpoints.filter((e) => e.tags.includes("financial")).length;
  if (financialCount > 0) warnings.push(`Financial endpoints detected — ensure proper access controls and audit logging`);
  const unversionedApis = services.filter((s) => s.endpoints.every((e) => !e.tags.includes("versioned")));
  if (unversionedApis.length > 0 && endpoints.length > 5) warnings.push(`API versioning not detected — consider versioning strategy for backward compatibility`);
  const missingHealth = services.filter((s) => !s.endpoints.some((e) => e.tags.includes("health")));
  if (missingHealth.length > 0) warnings.push(`${missingHealth.length} service${missingHealth.length !== 1 ? "s" : ""} without health check endpoint`);
  const adminEndpoints = endpoints.filter((e) => e.tags.includes("admin"));
  if (adminEndpoints.length > 0 && !adminEndpoints.some((e) => e.tags.includes("authenticated"))) {
    warnings.push(`Admin endpoints detected without authentication — potential privilege escalation`);
  }
  return warnings;
}

// ── Utilities ───────────────────────────────────────────────────────

function dedupEndpoints(endpoints) {
  const seen = new Set();
  return endpoints.filter((ep) => {
    const key = `${ep.method}:${ep.path}:${ep.service}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizePath(path) {
  return path
    .replace(/:(\w+)/g, "{$1}")
    .replace(/<(\w+)>/g, "{$1}")
    .replace(/{(\w+):\w+}/g, "{$1}")
    .replace(/\/\//g, "/")
    .replace(/\/$/, "") || "/";
}

function normalizeMethod(method) {
  const m = method.toUpperCase();
  if (["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS", "TRACE", "CONNECT", "ANY"].includes(m)) return m;
  return "ANY";
}

function getLineNumber(text, index) {
  if (!text || index < 0) return 0;
  return text.substring(0, index).split("\n").length;
}

function extractFilePathRoute(filePath, method) {
  const match = filePath.match(/\/api\/(.+)\.\w+$/);
  if (!match) return null;
  let path = "/api/" + match[1];
  path = path.replace(/\/index$/, "");
  path = path.replace(/\[\.\.\.(\w+)\]/g, "{$1}");
  path = path.replace(/\[(\w+)\]/g, "{$1}");
  return { path, method: method || "GET" };
}
