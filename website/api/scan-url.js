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
  if (treeRes.status === 404) {
    const altUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`;
    const altRes = await fetch(altUrl, { headers });
    if (altRes.status !== 200) throw new Error("Repository not found or inaccessible");
    const altData = await altRes.json();
    return processTree(altData.tree, owner, repo, headers);
  }
  if (!treeRes.ok) throw new Error(`GitHub API error: ${treeRes.status}`);
  const data = await treeRes.json();
  return processTree(data.tree, owner, repo, headers);
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
  { ext: ".rs", pattern: /\.route\([^)]*"(\/[^"]+)"/g, methodGroup: null, pathGroup: 1, tech: "rust/axum" },
  { ext: ".js", pattern: /(?:app|router)\.(get|post|put|delete|patch)\(["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "javascript/express" },
  { ext: ".ts", pattern: /(?:app|router)\.(get|post|put|delete|patch)\(["'`](\/[^"'`]+)/gi, methodGroup: 1, pathGroup: 2, tech: "typescript/express" },
  { ext: ".py", pattern: /@(?:app|router)\.(?:get|post|put|delete|patch)\s*\(["'`](\/[^"'`]+)/gi, methodGroup: null, pathGroup: 1, tech: "python/flask" },
  { ext: ".go", pattern: /\.(?:GET|POST|PUT|DELETE)\(["'`](\/[^"'`]+)/gi, methodGroup: null, pathGroup: 1, tech: "go/gin" },
  { ext: ".java", pattern: /@(?:GetMapping|PostMapping|PutMapping|DeleteMapping|RequestMapping)\(["'`](\/[^"'`]+)/gi, methodGroup: null, pathGroup: 1, tech: "java/spring" },
];

async function processTree(tree, owner, repo, headers) {
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
        const rawRes = await fetch(file.url, { headers });
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
          const rawRes = await fetch(file.url, { headers });
          if (rawRes.ok) {
            const rawText = await rawRes.text();
            let match;
            while ((match = ep.pattern.exec(rawText)) !== null) {
              const path = ep.pathGroup ? match[ep.pathGroup] : match[0];
              const method = ep.methodGroup ? match[ep.methodGroup].toUpperCase() : "ANY";
              endpoints.push({
                path,
                method,
                source: { file: file.path, line: 0 },
                tags: inferTags(path),
                service: detectService(file.path),
                technology: ep.tech,
              });
            }
          }
        } catch {}
      }
    }
  }

  const shadowEps = endpoints.filter((e) => e.tags.includes("shadow"));
  const healthEps = endpoints.filter((e) => e.tags.includes("health"));

  return {
    projectName: `${owner}/${repo}`,
    projectVersion: "web-scan",
    scannedAt: new Date().toISOString(),
    totalEndpoints: endpoints.length,
    services: buildServices(endpoints),
    clis: [],
    tags: {
      shadow: shadowEps.length,
      deprecated: endpoints.filter((e) => e.tags.includes("deprecated")).length,
      authenticated: endpoints.filter((e) => e.tags.includes("authenticated")).length,
      prover: 0, verifier: 0, health: healthEps.length,
      websocket: 0, static: 0, callee: 0, aiContext: 0,
    },
    technologies: [...new Set([...techs, ...frameworks])],
    warnings: shadowEps.length > 0 ? ["Shadow APIs detected — review access controls"] : [],
  };
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
