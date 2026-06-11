import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const section = { marginBottom: "2.5rem" };
const heading = { fontSize: "1.5rem", fontWeight: 700, color: "var(--ifm-color-primary)", marginBottom: "0.75rem", paddingBottom: "0.4rem", borderBottom: "1px solid var(--ifm-toc-border-color)" };
const subheading = { fontSize: "1.1rem", fontWeight: 600, marginTop: "1.25rem", marginBottom: "0.5rem" };
const paragraph = { fontSize: "0.9rem", lineHeight: 1.7, color: "var(--ifm-color-emphasis-700)", marginBottom: "0.75rem" };
const code = { fontSize: "0.82rem", padding: "0.12rem 0.4rem", borderRadius: 4, background: "var(--ifm-background-surface-color)", border: "1px solid var(--ifm-toc-border-color)", fontFamily: "var(--ifm-font-family-monospace)" };
const pre = { fontSize: "0.82rem", padding: "1rem", borderRadius: 8, background: "var(--ifm-background-surface-color)", border: "1px solid var(--ifm-toc-border-color)", overflow: "auto", lineHeight: 1.5, marginBottom: "0.75rem" };
const list = { fontSize: "0.9rem", lineHeight: 1.8, color: "var(--ifm-color-emphasis-700)", paddingLeft: "1.5rem", marginBottom: "0.75rem" };
const card = { background: "var(--ifm-background-surface-color)", border: "1px solid var(--ifm-toc-border-color)", borderRadius: 10, padding: "1.25rem", marginBottom: "1rem" };
const cardTitle = { fontWeight: 600, fontSize: "0.95rem", marginBottom: "0.5rem", color: "var(--ifm-color-primary)" };
const badge = { display: "inline-block", fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.5rem", borderRadius: 4, background: "color-mix(in srgb, var(--ifm-color-primary) 18%, transparent)", color: "var(--ifm-color-primary)", textTransform: "uppercase", letterSpacing: "0.03em", marginRight: "0.4rem" };
const container = { maxWidth: 900, margin: "0 auto", padding: "2rem 1.5rem" };
const hero = { textAlign: "center", padding: "2rem 0 1.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", marginBottom: "2rem" };

function Code({ children }) { return <span style={code}>{children}</span>; }
function Pre({ children }) { return <pre style={pre}>{children}</pre>; }

export default function ScanDogSetup() {
  return (
    <Layout title="ScanDog — Getting Started" description="Simple guide to install, scan, and understand your API attack surface with ScanDog">
      <div style={container}>
        <div style={hero}>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--ifm-color-primary)", margin: 0, lineHeight: 1.2 }}>
            Getting Started with ScanDog
          </h1>
          <p style={{ color: "var(--ifm-color-emphasis-600)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
            Install, scan your project, and see your API attack surface in under a minute
          </p>
        </div>

        {/* 1. Install */}
        <div style={section}>
          <h2 style={heading}><span style={badge}>Step 1</span> Install</h2>
          <p style={paragraph}>
            You need <strong>Node.js 18+</strong> (it's free). Then open a terminal and run:
          </p>
          <Pre>{`npm install -g @suruj/scan-dog`}</Pre>
          <p style={paragraph}>
            That's it. Now the <Code>scandog</Code> command is available anywhere on your machine.
          </p>
        </div>

        {/* 2. Scan */}
        <div style={section}>
          <h2 style={heading}><span style={badge}>Step 2</span> Scan a Project</h2>
          <p style={paragraph}>
            Point ScanDog at any codebase to discover all API endpoints:
          </p>
          <Pre>{`cd my-project
scandog scan .`}</Pre>
          <p style={paragraph}>
            ScanDog reads your source code and prints a report showing:
          </p>
          <ul style={list}>
            <li><strong>All API endpoints</strong> — HTTP methods and paths (GET, POST, etc.)</li>
            <li><strong>Services</strong> — groups of related endpoints</li>
            <li><strong>CLI tools</strong> — command-line tools found in the project</li>
            <li><strong>Tags</strong> — security context like <Code>shadow</Code>, <Code>health</Code>, <Code>authenticated</Code></li>
          </ul>
        </div>

        {/* 3. See what was found */}
        <div style={section}>
          <h2 style={heading}><span style={badge}>Step 3</span> Understand the Results</h2>
          <p style={paragraph}>
            Here's what a scan looks like in practice. Running against a typical web app might show:
          </p>
          <Pre>{`● api-service (api-service) [javascript:express]
  GET     /api/health
  POST    /api/auth/register
  POST    /api/auth/login
  GET     /api/auth/me
  GET     /api/projects/
  POST    /api/projects/
  GET     /api/projects/:id
  PUT     /api/projects/:id
  DELETE  /api/projects/:id
  GET     /api/components/`}</Pre>
          <p style={paragraph}>
            Each line is an <strong>endpoint</strong> — a URL that your application responds to.
            ScanDog tells you the <strong>method</strong> (GET/POST/etc.), the <strong>path</strong> (URL pattern),
            and what <strong>service</strong> it belongs to.
          </p>
        </div>

        {/* 4. Filter results */}
        <div style={section}>
          <h2 style={heading}><span style={badge}>Step 4</span> Filter Results</h2>
          <p style={paragraph}>
            Too many results? Narrow down with <Code>--filter</Code>. Sysdig-style field=value expressions:
          </p>
          <Pre>{`# Only POST endpoints
scandog scan . --filter "method=POST"

# Only GET and POST
scandog scan . --filter "method=GET,POST"

# Only shadow APIs (admin panels, debug routes)
scandog scan . --filter "tag=shadow"

# Endpoints under /api/auth/
scandog scan . --filter "path=/api/auth/*"

# Combined: POST endpoints with shadow tag
scandog scan . --filter "method=POST" --filter "tag=shadow"`}</Pre>
          <p style={paragraph}>
            Available fields: <Code>method</Code>, <Code>path</Code>, <Code>tag</Code>, <Code>service</Code>, <Code>tech</Code>, <Code>auth</Code>, <Code>risk</Code>.
            See all with <Code>scandog list fields</Code>.
          </p>
        </div>

        {/* 5. Save output */}
        <div style={section}>
          <h2 style={heading}><span style={badge}>Step 5</span> Save &amp; Share Results</h2>
          <p style={paragraph}>
            ScanDog supports <strong>10 output formats</strong> for different use cases:
          </p>
          <Pre>{`# Terminal (default) — human-readable
scandog scan .

# JSON — for tools and automation
scandog scan . --format json -o results.json

# HTML report — share with your team
scandog scan . --format html -o report.html

# OpenAPI spec — import into API tools
scandog scan . --format openapi -o spec.yaml

# SARIF — upload to GitHub Code Scanning
scandog scan . --format sarif -o results.sarif`}</Pre>
          <p style={paragraph}>
            List all formats: <Code>scandog list formats</Code>
          </p>
        </div>

        {/* All commands reference */}
        <div style={section}>
          <h2 style={heading}>All Commands</h2>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--ifm-color-emphasis-600)" }}>Command</th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--ifm-color-emphasis-600)" }}>What it does</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog scan .</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Scan current directory</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog scan . --format json</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Output as JSON</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog scan . -o report.html</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Save to file (use with -f)</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog list formats</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>List all output formats</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog list fields</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>List filter fields</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog list techs</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>List supported frameworks</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog completion bash</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Generate shell autocomplete</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}><Code>scandog --help</Code></td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Show all commands and options</td></tr>
            </tbody>
          </table>
        </div>

        {/* Supported languages */}
        <div style={section}>
          <h2 style={heading}>What ScanDog Can Scan</h2>
          <p style={paragraph}>ScanDog automatically detects the framework and extracts endpoints. Currently supports:</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div style={card}>
              <div style={cardTitle}>JavaScript / TypeScript</div>
              <ul style={{ ...list, marginBottom: 0 }}>
                <li>Express.js</li>
                <li>Fastify</li>
                <li>Next.js</li>
                <li>Koa</li>
                <li>Hapi</li>
              </ul>
            </div>
            <div style={card}>
              <div style={cardTitle}>Python</div>
              <ul style={{ ...list, marginBottom: 0 }}>
                <li>Flask</li>
                <li>FastAPI</li>
                <li>Django</li>
                <li>aiohttp</li>
                <li>Bottle / Starlette</li>
              </ul>
            </div>
            <div style={card}>
              <div style={cardTitle}>Go</div>
              <ul style={{ ...list, marginBottom: 0 }}>
                <li>Gin</li>
                <li>Echo</li>
                <li>Chi</li>
                <li>Fiber</li>
                <li>net/http</li>
              </ul>
            </div>
            <div style={card}>
              <div style={cardTitle}>Infrastructure</div>
              <ul style={{ ...list, marginBottom: 0 }}>
                <li>Docker Compose</li>
                <li>CLI tool definitions</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Next steps */}
        <div style={section}>
          <h2 style={heading}>Next Steps</h2>
          <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
            <Link to="/scandog" style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ ...card, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>📊</div>
                <div style={cardTitle}>View the Dashboard</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>See a live scan result example</p>
              </div>
            </Link>
            <Link to="https://github.com/SURUJ404/Zero-proof/tree/main/tools/zero-noir" style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ ...card, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>🔧</div>
                <div style={cardTitle}>View on GitHub</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>Read the source, report issues</p>
              </div>
            </Link>
            <Link to="https://www.npmjs.com/package/@suruj/scan-dog" style={{ flex: 1, textDecoration: "none" }}>
              <div style={{ ...card, cursor: "pointer", textAlign: "center" }}>
                <div style={{ fontSize: "1.5rem", marginBottom: "0.3rem" }}>📦</div>
                <div style={cardTitle}>npm Package</div>
                <p style={{ fontSize: "0.8rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>@suruj/scan-dog@1.2.0</p>
              </div>
            </Link>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: "2rem", padding: "1rem 0", borderTop: "1px solid var(--ifm-toc-border-color)" }}>
          <Link to="/scandog" style={{ color: "var(--ifm-color-primary)", fontWeight: 600 }}>
            Back to ScanDog Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  );
}
