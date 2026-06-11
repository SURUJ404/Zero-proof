import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const s = { marginBottom: "2.5rem" };
const h2 = { fontSize: "1.5rem", fontWeight: 700, color: "var(--ifm-color-primary)", marginBottom: "0.75rem", paddingBottom: "0.4rem", borderBottom: "1px solid var(--ifm-toc-border-color)" };
const h3 = { fontSize: "1.1rem", fontWeight: 600, marginTop: "1.25rem", marginBottom: "0.5rem" };
const p = { fontSize: "0.9rem", lineHeight: 1.7, color: "var(--ifm-color-emphasis-700)", marginBottom: "0.75rem" };
const cd = { fontSize: "0.82rem", padding: "0.12rem 0.4rem", borderRadius: 4, background: "var(--ifm-background-surface-color)", border: "1px solid var(--ifm-toc-border-color)", fontFamily: "var(--ifm-font-family-monospace)" };
const pr = { fontSize: "0.82rem", padding: "1rem", borderRadius: 8, background: "var(--ifm-background-surface-color)", border: "1px solid var(--ifm-toc-border-color)", overflow: "auto", lineHeight: 1.5, marginBottom: "0.75rem" };
const li = { fontSize: "0.9rem", lineHeight: 1.8, color: "var(--ifm-color-emphasis-700)", paddingLeft: "1.5rem", marginBottom: "0.75rem" };
const card = { background: "var(--ifm-background-surface-color)", border: "1px solid var(--ifm-toc-border-color)", borderRadius: 10, padding: "1.25rem", marginBottom: "1rem" };
const ct = { fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.5rem", color: "var(--ifm-color-primary)" };
const bdg = { display: "inline-block", fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 4, background: "color-mix(in srgb, var(--ifm-color-primary) 18%, transparent)", color: "var(--ifm-color-primary)", textTransform: "uppercase", letterSpacing: "0.03em", marginRight: "0.4rem" };
const ctr = { maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" };
const hero = { textAlign: "center", padding: "2rem 0 1.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", marginBottom: "2rem" };
const td = { padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" };
const th = { textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--ifm-color-emphasis-600)" };

function C({ children }) { return <span style={cd}>{children}</span>; }
function P({ children }) { return <pre style={pr}>{children}</pre>; }

export default function ScanDogSetup() {
  return (
    <Layout title="ScanDog — Setup Guide" description="Complete step-by-step setup guide for ScanDog — install, scan, route, filter, and deliver results">
      <div style={ctr}>
        <div style={hero}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--ifm-color-primary)", margin: 0, lineHeight: 1.2 }}>
            ScanDog Setup Guide
          </h1>
          <p style={{ color: "var(--ifm-color-emphasis-600)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
            Complete reference — install, scan, route, filter, deliver, and automate
          </p>
        </div>

        {/* 1. Install */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 1</span> Install</h2>
          <p style={p}>
            Requires <strong>Node.js 18+</strong>. Install globally via npm:
          </p>
          <P>{`npm install -g zk-scandog`}</P>
          <p style={p}>
            After install, three commands are available: <C>apiscan</C>, <C>scandog</C>, and <C>zn</C> (all point to the same binary).
          </p>
          <P>{`apiscan --version   # 1.3.0
scandog --help      # same binary
zn --tech           # show all modules`}</P>
        </div>

        {/* 2. Scan */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 2</span> Scan a Project</h2>
          <p style={p}>
            Point at any codebase to discover API endpoints, services, and CLI tools:
          </p>
          <P>{`cd my-project
apiscan scan .`}</P>
          <p style={p}>
            ScanDog automatically detects frameworks (Express, Flask, Gin, Axum, Spring, etc.)
            and extracts every endpoint with its method, path, source location, and security tags.
          </p>
          <P>{`apiscan scan /path/to/project`}</P>
        </div>

        {/* 3. Output Formats */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 3</span> Output Formats</h2>
          <p style={p}>
            ScanDog supports <strong>10 output formats</strong>. Use <C>-f</C> / <C>--format</C> to choose:
          </p>
          <P>{`# Terminal (default) — human-readable
apiscan scan .

# JSON — structured data for automation
apiscan scan . -f json -o results.json

# HTML — visual dark-mode report
apiscan scan . -f html -o report.html

# OpenAPI 3.1 — import into API tools
apiscan scan . -f openapi -o spec.json

# SARIF 2.1 — upload to GitHub Code Scanning
apiscan scan . -f sarif -o results.sarif

# Mermaid — architecture diagram source
apiscan scan . -f mermaid -o diagram.mmd

# Postman Collection
apiscan scan . -f postman -o collection.json

# cURL Commands
apiscan scan . -f curl -o commands.sh

# TOML
apiscan scan . -f toml -o output.toml

# PowerShell
apiscan scan . -f powershell -o commands.ps1`}</P>
          <P>{`# List all formats
apiscan list formats`}</P>
        </div>

        {/* 4. Filter */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 4</span> Filter Results</h2>
          <p style={p}>
            Narrow results with Sysdig-inspired <C>--filter</C> expressions. Multiple filters act as AND;
            commas within a filter act as OR:
          </p>
          <P>{`# By HTTP method
apiscan scan . --filter "method=POST"
apiscan scan . --filter "method=GET,POST"

# By security tag
apiscan scan . --filter "tag=shadow"
apiscan scan . --filter "tag=health"
apiscan scan . --filter "tag=deprecated"

# By URL path pattern
apiscan scan . --filter "path=/api/**"
apiscan scan . --filter "path=/api/auth/*"

# By service name
apiscan scan . --filter "service=api-service"

# Combine (AND) — POST endpoints in /api/ that are shadow
apiscan scan . --filter "method=POST" --filter "path=/api/**" --filter "tag=shadow"`}</P>
          <P>{`# Show all available filter fields
apiscan list fields`}</P>
        </div>

        {/* 5. Route Results */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 5</span> Route Results</h2>
          <p style={p}>
            The <strong>Smart Router</strong> (inspired by OpenRouter's provider routing) lets you route
            matched endpoints to actions — exclude them, deliver to targets, split to files, add tags, or rewrite paths.
            Syntax: <C>--route "field=value->action:param"</C>
          </p>

          <h3 style={h3}>Exclude</h3>
          <p style={p}>Remove matching endpoints from results entirely:</p>
          <P>{`# Exclude health-check endpoints
apiscan scan . --route "tag=health->exclude"

# Exclude CLI commands
apiscan scan . --route "tag=cli->exclude"

# Exclude deprecated paths
apiscan scan . --route "tag=deprecated->exclude"`}</P>

          <h3 style={h3}>Deliver</h3>
          <p style={p}>Route matched endpoints directly to security tools. Requires the corresponding <C>--deliver-*</C> flag:</p>
          <P>{`# Route shadow APIs to ZAP
apiscan scan . --route "tag=shadow->deliver:zap" --deliver-zap http://localhost:8090

# Route POST endpoints to Burp Suite
apiscan scan . --route "method=POST->deliver:burp" --deliver-burp http://localhost:8081

# Route high-severity to webhook (Slack, Teams, etc.)
apiscan scan . --route "tag=shadow->deliver:webhook" --deliver-webhook https://hooks.example.com/alert`}</P>

          <h3 style={h3}>Split to File</h3>
          <p style={p}>Save matched endpoints to a separate file:</p>
          <P>{`# Split all shadow API endpoints to a file
apiscan scan . --route "tag=shadow->split:file=shadow-apis.json"

# Split all /api/ routes
apiscan scan . --route "path=/api/**->split:file=api-spec.json"

# Split by method
apiscan scan . --route "method=POST->split:file=post-endpoints.json"`}</P>

          <h3 style={h3}>Tag</h3>
          <p style={p}>Add extra tags to matched endpoints for downstream processing:</p>
          <P>{`# Tag shadow APIs as critical
apiscan scan . --route "tag=shadow->tag:critical"

# Tag all POST endpoints
apiscan scan . --route "method=POST->tag:write-operation"`}</P>

          <h3 style={h3}>Reroute</h3>
          <p style={p}>Rewrite matched endpoint paths and methods:</p>
          <P>{`# Rewrite old API paths to new version
apiscan scan . --route "path=/v1/**->reroute:path=/v2/**"

# Change method
apiscan scan . --route "path=/admin/**->reroute:path=/api/admin,method=GET"`}</P>

          <h3 style={h3}>Chain Multiple Rules</h3>
          <p style={p}>Pass multiple <C>--route</C> flags — they execute in order:</p>
          <P>{`# Exclude health, split shadow, deliver POST
apiscan scan . \\
  --route "tag=health->exclude" \\
  --route "tag=shadow->split:file=shadow.json" \\
  --route "method=POST->deliver:burp" \\
  --deliver-burp http://localhost:8081`}</P>
        </div>

        {/* 6. Delivery */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 6</span> Direct Delivery</h2>
          <p style={p}>
            Send scan results directly to security tools without saving files:
          </p>
          <P>{`# Deliver all results to ZAP
apiscan scan . --deliver-zap http://localhost:8090

# Deliver to Burp Suite
apiscan scan . --deliver-burp http://localhost:8081

# Deliver to custom webhook
apiscan scan . --deliver-webhook https://hooks.example.com/scan-results

# Deliver to all three at once
apiscan scan . \\
  --deliver-zap http://localhost:8090 \\
  --deliver-burp http://localhost:8081 \\
  --deliver-webhook https://hooks.example.com/scan-results`}</P>
        </div>

        {/* 7. Custom Analyzers */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 7</span> Custom Analyzers</h2>
          <p style={p}>
            Don't see your framework? Define your own with a YAML file and <C>--custom-analyzers</C>.
            Write regex patterns to extract endpoints from any language:
          </p>
          <P>{`# .analyzers.yml
analyzers:
  # Spring Boot @RequestMapping
  - name: spring-boot
    pattern: '@(Get|Post|Put|Delete)Mapping\\(["]([^"]+)["]\\)'
    methodGroup: 1
    pathGroup: 2
    technology: java:spring
    include: ["**/*.java"]

  # Flask @app.route decorators
  - name: flask
    pattern: '@app\\.route\\(["]([^"]+)["]\\)'
    methodGroup: 1
    pathGroup: 1
    technology: python:flask
    include: ["**/*.py"]`}</P>
          <P>{`# Run with custom analyzers
apiscan scan . --custom-analyzers .analyzers.yml`}</P>
          <p style={p}>
            Each analyzer needs: <C>name</C> (identifier), <C>pattern</C> (regex with capture groups),
            <C>methodGroup</C> (capture group index for HTTP method),
            <C>pathGroup</C> (capture group index for URL path).
            Optional: <C>include</C>/<C>exclude</C> (file globs), <C>technology</C> (label for output), <C>service</C> (default service name).
          </p>
        </div>

        {/* 8. AI Context */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 8</span> AI-Powered Analysis</h2>
          <p style={p}>
            ScanDog can enrich each endpoint with LLM-generated security context —
            guards, sinks, validators, signals, and risk level. Supports OpenAI and Ollama:
          </p>
          <P>{`# AI analysis with OpenAI (default)
apiscan scan . --ai-context

# Use local Ollama instead
apiscan scan . --ai-context --ai-provider ollama

# Include 1-hop callee functions
apiscan scan . --ai-context --include-callee

# JSON output with AI context
apiscan scan . --ai-context -f json -o enriched.json`}</P>
          <p style={p}>
            Requires <C>OPENAI_API_KEY</C> or <C>OLLAMA_BASE_URL</C> environment variable.
            The first 20 endpoints are analyzed (max 20 to manage cost/latency).
          </p>
        </div>

        {/* 9. Web URL Scanning */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 9</span> Web URL Scanning</h2>
          <p style={p}>
            Scan any public GitHub repository directly from the <Link to="/scandog">ScanDog Dashboard</Link> —
            no installation needed:
          </p>
          <ol style={li}>
            <li>Go to the <Link to="/scandog">ScanDog Dashboard</Link></li>
            <li>Paste a GitHub URL (e.g., <C>https://github.com/user/repo</C>)</li>
            <li>Click <strong>Scan</strong></li>
            <li>Results appear instantly in the dashboard</li>
          </ol>
          <p style={p}>
            The web scanner uses the GitHub API to fetch your repo structure, detect technologies,
            and extract endpoints — all in your browser. Results can be filtered, exported, and shared
            just like local scans.
          </p>
        </div>

        {/* 10. Tech Portal */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 10</span> Tech Portal</h2>
          <p style={p}>
            See every feature and module available in ScanDog:
          </p>
          <P>{`apiscan --tech

# or
apiscan tech`}</P>
          <p style={p}>
            Shows all 13 modules with descriptions and status:
            Scanner, Router, Filter, Analyzer, Plugin, Tagger, AI Context,
            Output (10 formats), Delivery (ZAP/Burp/Webhook), Rules, Cache, Config, Web API.
          </p>
        </div>

        {/* 11. Configuration */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 11</span> Configuration</h2>
          <p style={p}>
            ScanDog supports a user-level YAML config file for persistent settings:
          </p>
          <P>{`# Initialize default config
apiscan config init

# Show current config path and contents
apiscan config show

# Open in default editor
apiscan config edit

# Show config file path
apiscan config path`}</P>
        </div>

        {/* 12. Cache */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 12</span> Cache Management</h2>
          <p style={p}>
            AI context responses are cached locally. Manage the cache:
          </p>
          <P>{`# Show cache statistics
apiscan cache info

# Clear all cached responses
apiscan cache clear

# Remove entire cache directory
apiscan cache purge`}</P>
        </div>

        {/* 13. Passive Scan Rules */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 13</span> Passive Scan Rules</h2>
          <p style={p}>
            ScanDog includes built-in passive scan rules that flag endpoints by pattern
            (shadow APIs, deprecated paths, sensitive endpoints, etc.):
          </p>
          <P>{`# List installed rules
apiscan rules list

# Install or update built-in rules
apiscan rules update

# Show rules directory path
apiscan rules path`}</P>
        </div>

        {/* 14. Shell Completions */}
        <div style={s}>
          <h2 style={h2}><span style={bdg}>Step 14</span> Shell Completions</h2>
          <p style={p}>
            Enable tab-completion for your shell:
          </p>
          <P>{`# Bash
apiscan completion bash > /etc/bash_completion.d/apiscan

# Zsh
apiscan completion zsh > /usr/local/share/zsh/site-functions/_apiscan

# Fish
apiscan completion fish > ~/.config/fish/completions/apiscan.fish

# Elvish
apiscan completion elvish > ~/.elvish/completions/apiscan.elv`}</P>
        </div>

        {/* All Commands Reference */}
        <div style={s}>
          <h2 style={h2}>Complete Command Reference</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr><th style={th}>Command</th><th style={th}>Description</th></tr>
            </thead>
            <tbody>
              <tr><td style={td}><C>apiscan scan .</C></td><td style={td}>Scan current directory</td></tr>
              <tr><td style={td}><C>apiscan scan . -f json -o out.json</C></td><td style={td}>Scan, output JSON to file</td></tr>
              <tr><td style={td}><C>apiscan scan . --filter "method=POST"</C></td><td style={td}>Scan with filter</td></tr>
              <tr><td style={td}><C>apiscan scan . --route "tag=shadow->deliver:zap"</C></td><td style={td}>Scan with route rule</td></tr>
              <tr><td style={td}><C>apiscan scan . --ai-context</C></td><td style={td}>Scan with AI analysis</td></tr>
              <tr><td style={td}><C>apiscan scan . --custom-analyzers .analyzers.yml</C></td><td style={td}>Scan with custom analyzers</td></tr>
              <tr><td style={td}><C>apiscan scan . --deliver-zap http://localhost:8090</C></td><td style={td}>Scan and deliver to ZAP</td></tr>
              <tr><td style={td}><C>apiscan tech</C></td><td style={td}>Show all modules</td></tr>
              <tr><td style={td}><C>apiscan list formats</C></td><td style={td}>List output formats</td></tr>
              <tr><td style={td}><C>apiscan list fields</C></td><td style={td}>List filter fields</td></tr>
              <tr><td style={td}><C>apiscan list techs</C></td><td style={td}>List supported frameworks</td></tr>
              <tr><td style={td}><C>apiscan list taggers</C></td><td style={td}>List available tags</td></tr>
              <tr><td style={td}><C>apiscan cache info</C></td><td style={td}>Show cache stats</td></tr>
              <tr><td style={td}><C>apiscan config init</C></td><td style={td}>Create default config</td></tr>
              <tr><td style={td}><C>apiscan rules update</C></td><td style={td}>Update passive rules</td></tr>
              <tr><td style={td}><C>apiscan completion bash</C></td><td style={td}>Generate bash completions</td></tr>
              <tr><td style={td}><C>apiscan --tech</C></td><td style={td}>Tech portal overview</td></tr>
            </tbody>
          </table>
        </div>

        {/* Supported Languages */}
        <div style={s}>
          <h2 style={h2}>Supported Frameworks</h2>
          <p style={p}>ScanDog auto-detects these frameworks and extracts endpoints:</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={card}>
              <div style={ct}>Rust</div>
              <ul style={{ ...li, marginBottom: 0 }}>
                <li>Axum</li>
                <li>Actix-Web</li>
                <li>Rocket</li>
                <li>Warp</li>
                <li>Tokio/Tide</li>
              </ul>
            </div>
            <div style={card}>
              <div style={ct}>JavaScript / TypeScript</div>
              <ul style={{ ...li, marginBottom: 0 }}>
                <li>Express.js</li>
                <li>Fastify</li>
                <li>Next.js</li>
                <li>Koa</li>
                <li>Hapi</li>
              </ul>
            </div>
            <div style={card}>
              <div style={ct}>Python</div>
              <ul style={{ ...li, marginBottom: 0 }}>
                <li>Flask</li>
                <li>FastAPI</li>
                <li>Django</li>
                <li>aiohttp</li>
                <li>Bottle / Starlette</li>
              </ul>
            </div>
            <div style={card}>
              <div style={ct}>Go</div>
              <ul style={{ ...li, marginBottom: 0 }}>
                <li>Gin</li>
                <li>Echo</li>
                <li>Chi</li>
                <li>Fiber</li>
                <li>net/http</li>
              </ul>
            </div>
            <div style={card}>
              <div style={ct}>Java</div>
              <ul style={{ ...li, marginBottom: 0 }}>
                <li>Spring Boot</li>
                <li>JAX-RS</li>
              </ul>
            </div>
            <div style={card}>
              <div style={ct}>Infrastructure</div>
              <ul style={{ ...li, marginBottom: 0 }}>
                <li>Docker Compose</li>
                <li>CLI tool definitions</li>
                <li>Rust service configs</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Next Steps */}
        <div style={s}>
          <h2 style={h2}>Next Steps</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link to="/scandog" style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ ...card, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>📊</div>
                <div style={ct}>Dashboard</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>View live scan results</p>
              </div>
            </Link>
            <Link to="/scandog" style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ ...card, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>🌐</div>
                <div style={ct}>Scan a URL</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>Paste any GitHub repo URL</p>
              </div>
            </Link>
            <Link to="https://github.com/SURUJ404/Zero-proof/tree/main/tools/zero-noir" style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ ...card, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>🔧</div>
                <div style={ct}>GitHub</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>Source code & issues</p>
              </div>
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "2rem", padding: "1rem 0", borderTop: "1px solid var(--ifm-toc-border-color)" }}>
          <Link to="/scandog" style={{ color: "var(--ifm-color-primary)", fontWeight: 600 }}>
            ← Back to ScanDog Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  );
}
