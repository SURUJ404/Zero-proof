import React from "react";
import Layout from "@theme/Layout";
import Link from "@docusaurus/Link";

const section = {
  marginBottom: "2.5rem",
};

const heading = {
  fontSize: "1.5rem",
  fontWeight: 700,
  color: "var(--ifm-color-primary)",
  marginBottom: "0.75rem",
  paddingBottom: "0.4rem",
  borderBottom: "1px solid var(--ifm-toc-border-color)",
};

const subheading = {
  fontSize: "1.1rem",
  fontWeight: 600,
  marginTop: "1.25rem",
  marginBottom: "0.5rem",
};

const paragraph = {
  fontSize: "0.9rem",
  lineHeight: 1.7,
  color: "var(--ifm-color-emphasis-700)",
  marginBottom: "0.75rem",
};

const code = {
  fontSize: "0.82rem",
  padding: "0.12rem 0.4rem",
  borderRadius: 4,
  background: "var(--ifm-background-surface-color)",
  border: "1px solid var(--ifm-toc-border-color)",
  fontFamily: "var(--ifm-font-family-monospace)",
};

const pre = {
  fontSize: "0.82rem",
  padding: "1rem",
  borderRadius: 8,
  background: "var(--ifm-background-surface-color)",
  border: "1px solid var(--ifm-toc-border-color)",
  overflow: "auto",
  lineHeight: 1.5,
  marginBottom: "0.75rem",
};

const list = {
  fontSize: "0.9rem",
  lineHeight: 1.8,
  color: "var(--ifm-color-emphasis-700)",
  paddingLeft: "1.5rem",
  marginBottom: "0.75rem",
};

const card = {
  background: "var(--ifm-background-surface-color)",
  border: "1px solid var(--ifm-toc-border-color)",
  borderRadius: 10,
  padding: "1.25rem",
  marginBottom: "1rem",
};

const cardTitle = {
  fontWeight: 600,
  fontSize: "0.95rem",
  marginBottom: "0.5rem",
  color: "var(--ifm-color-primary)",
};

const badge = {
  display: "inline-block",
  fontSize: "0.65rem",
  fontWeight: 700,
  padding: "0.15rem 0.5rem",
  borderRadius: 4,
  background: "color-mix(in srgb, var(--ifm-color-primary) 18%, transparent)",
  color: "var(--ifm-color-primary)",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  marginRight: "0.4rem",
};

const container = {
  maxWidth: 900,
  margin: "0 auto",
  padding: "2rem 1.5rem",
};

const hero = {
  textAlign: "center",
  padding: "2rem 0 1.5rem",
  borderBottom: "1px solid var(--ifm-toc-border-color)",
  marginBottom: "2rem",
};

function Code({ children }) {
  return <span style={code}>{children}</span>;
}

function Pre({ children }) {
  return <pre style={pre}>{children}</pre>;
}

export default function ScanDogSetup() {
  return (
    <Layout title="ScanDog Setup" description="How ScanDog works and how to set it up">
      <div style={container}>
        <div style={hero}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", background: "color-mix(in srgb, var(--ifm-color-primary) 15%, transparent)", color: "var(--ifm-color-primary)", fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", padding: "0.3rem 0.8rem", borderRadius: 20, marginBottom: "0.75rem" }}>
            ScanDog v1.0.0
          </div>
          <h1 style={{ fontSize: "2.2rem", fontWeight: 800, color: "var(--ifm-color-primary)", margin: 0, lineHeight: 1.2 }}>
            ScanDog Setup
          </h1>
          <p style={{ color: "var(--ifm-color-emphasis-600)", marginTop: "0.5rem", fontSize: "0.95rem" }}>
            How it works, installation, and everything you need to get started
          </p>
        </div>

        {/* Overview */}
        <div style={section}>
          <h2 style={heading}>What is ScanDog?</h2>
          <p style={paragraph}>
            <strong>ScanDog</strong> is an open-source <strong>attack surface detector</strong> for the Zero Proof
            ecosystem. It reads source code and extracts all API endpoints, service boundaries, CLI commands,
            and infrastructure configuration &mdash; exposing shadow APIs, undocumented routes, and the complete
            attack surface of your deployment.
          </p>
          <p style={paragraph}>
            ScanDog is purpose-built for Zero Proof&apos;s Rust/Axum microservice stack. It auto-detects route handlers, proxy
            boundaries, Docker compose configuration, and CLI command structures.
          </p>
        </div>

        {/* How It Works */}
        <div style={section}>
          <h2 style={heading}>How It Works</h2>

          <div style={card}>
            <div style={cardTitle}><span style={badge}>1</span> Tech Detection</div>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>
              ScanDog reads your <Code>Cargo.toml</Code> and project files to detect the tech stack
              (Rust, Axum, Tokio, RISC Zero, tower-http, serde, reqwest, Docker).
            </p>
          </div>

          <div style={card}>
            <div style={cardTitle}><span style={badge}>2</span> Source Analysis</div>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>
              Four analyzers scan the codebase in parallel:
            </p>
            <ul style={list}>
              <li><strong>RouteAnalyzer</strong> &mdash; extracts Axum route handlers (<Code>.route()</Code>, <Code>.get()</Code>, <Code>.post()</Code>, method routers)</li>
              <li><strong>ServiceAnalyzer</strong> &mdash; identifies service boundaries, proxy targets, environment variable configurations</li>
              <li><strong>CLIAnalyzer</strong> &mdash; discovers CLI tools (<Code>zp</Code>, <Code>rzup</Code>, <Code>cargo-risczero</Code>, <Code>xtask</Code>) and their command structures</li>
              <li><strong>DockerAnalyzer</strong> &mdash; parses <Code>docker-compose.yml</Code> for exposed ports, service links, and environment configuration</li>
            </ul>
          </div>

          <div style={card}>
            <div style={cardTitle}><span style={badge}>3</span> Tagging &amp; Enrichment</div>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>
              Every discovered endpoint is tagged with context: <Code>health</Code>, <Code>prover</Code>, <Code>verifier</Code>,
              <Code>build</Code>, <Code>shadow</Code>, <Code>config</Code>, <Code>docker</Code>. Shadow APIs (admin panels,
              debug endpoints, dev-mode config) are automatically flagged for security review.
            </p>
          </div>

          <div style={card}>
            <div style={cardTitle}><span style={badge}>4</span> Output &amp; Delivery</div>
            <p style={{ fontSize: "0.85rem", color: "var(--ifm-color-emphasis-600)", margin: 0 }}>
              Results are available in 6 formats: JSON, YAML, OpenAPI 3.1, SARIF (for CI/CD), HTML report,
              and Mermaid diagram. Endpoints can be delivered directly to ZAP, Burp Suite, or any webhook.
            </p>
          </div>
        </div>

        {/* Architecture Diagram */}
        <div style={section}>
          <h2 style={heading}>Architecture</h2>
          <Pre>{`Source Code
  |
  v
[Detector] ──> Tech detection (Rust, Axum, Tokio, RISC Zero, Docker)
  |
  v
[Analyzers]
  ├── RouteAnalyzer   ──> Axum .route(), .get(), .post() handlers
  ├── ServiceAnalyzer ──> Service boundaries, proxy routes, env vars
  ├── CLIAnalyzer     ──> zp, rzup, cargo-risczero, xtask commands
  └── DockerAnalyzer  ──> Port mappings, service config, env vars
  |
  v
[Tagger] ──> Tags shadow APIs, prover/verifier endpoints, config
  |
  v
[Output Builder]
  ├── JSON       ──> Full structured data
  ├── YAML       ──> Human-readable config
  ├── OpenAPI    ──> API specification
  ├── SARIF      ──> CI/CD integration
  ├── HTML       ──> Visual report
  └── Mermaid    ──> Architecture diagram
  |
  v
[Deliver] ──> ZAP | Burp Suite | Webhook`}</Pre>
        </div>

        {/* Installation */}
        <div style={section}>
          <h2 style={heading}>Installation</h2>

          <h3 style={subheading}>Prerequisites</h3>
          <ul style={list}>
            <li>Node.js 18+</li>
            <li>npm or yarn</li>
          </ul>

          <h3 style={subheading}>Quick Start</h3>
          <Pre>{`# Clone the Zero Proof repository
git clone https://github.com/SURUJ404/Zero-proof.git
cd Zero-proof

# Install ScanDog dependencies
cd tools/zero-noir
npm install

# Build
npm run build

# Scan
node dist/index.js scan ../../`}</Pre>

          <h3 style={subheading}>Install Globally (optional)</h3>
          <Pre>{`npm install -g .

# Then run from anywhere
zn scan /path/to/zero-proof
zn scan .`}</Pre>

          <h3 style={subheading}>Update Scan Data for Website</h3>
          <p style={paragraph}>
            The website&apos;s <Link to="/scandog">ScanDog page</Link> displays pre-baked scan results.
            To refresh them after code changes:
          </p>
          <Pre>{`zn scan . --format json > website/static/scandog-data.json

cd website
npm run build
vercel --prod`}</Pre>
        </div>

        {/* Usage */}
        <div style={section}>
          <h2 style={heading}>Usage</h2>

          <h3 style={subheading}>Basic Scan</h3>
          <Pre>{`zn scan .`}</Pre>

          <h3 style={subheading}>Output to Different Formats</h3>
          <Pre>{`zn scan . --format json
zn scan . --format yaml
zn scan . --format openapi -o spec.json
zn scan . --format sarif -o results.sarif
zn scan . --format html -o report.html
zn scan . --format mermaid -o diagram.md`}</Pre>

          <h3 style={subheading}>Enable Enrichment</h3>
          <Pre>{`# Include 1-hop callee functions
zn scan . --include-callee

# Include AI review context
zn scan . --ai-context`}</Pre>

          <h3 style={subheading}>Deliver to DAST Tools</h3>
          <Pre>{`# Deliver to ZAP
zn scan . --deliver-zap http://localhost:8090

# Deliver to Burp Suite
zn scan . --deliver-burp http://localhost:1337

# Deliver to webhook
zn scan . --deliver-webhook https://hooks.example.com/scan`}</Pre>

          <h3 style={subheading}>List Available Formats</h3>
          <Pre>{`zn list formats`}</Pre>
        </div>

        {/* Output Formats */}
        <div style={section}>
          <h2 style={heading}>Output Formats</h2>

          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--ifm-color-emphasis-600)" }}>Format</th>
                <th style={{ textAlign: "left", padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", textTransform: "uppercase", fontSize: "0.7rem", letterSpacing: "0.05em", color: "var(--ifm-color-emphasis-600)" }}>Use Case</th>
              </tr>
            </thead>
            <tbody>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}>JSON</td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Full structured data for programmatic consumption</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}>YAML</td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Human-readable config format</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}>OpenAPI 3.1</td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>API specification for documentation &amp; client generation</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}>SARIF</td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>CI/CD integration with GitHub Advanced Security</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}>HTML</td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Visual dark-mode report for manual review</td></tr>
              <tr><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)", fontWeight: 600 }}>Mermaid</td><td style={{ padding: "0.5rem", borderBottom: "1px solid var(--ifm-toc-border-color)" }}>Architecture diagram for documentation</td></tr>
            </tbody>
          </table>
        </div>

        {/* Integration */}
        <div style={section}>
          <h2 style={heading}>CI/CD Integration</h2>
          <p style={paragraph}>
            ScanDog integrates with your CI/CD pipeline via SARIF output and exit codes.
            SARIF results can be uploaded to GitHub Advanced Security for PR annotations.
          </p>
          <Pre>{`# Example GitHub Action step
- name: Scan endpoints
  run: zn scan . --format sarif -o results.sarif
- name: Upload SARIF
  uses: github/codeql-action/upload-sarif@v3
  with:
    sarif_file: results.sarif`}</Pre>
        </div>

        {/* Security Notes */}
        <div style={section}>
          <h2 style={heading}>Security Notes</h2>
          <ul style={list}>
            <li>Shadow API tags highlight endpoints that may expose internal functionality &mdash; review access controls</li>
            <li>Prover and verifier endpoints handle sensitive cryptographic material &mdash; ensure proper authentication</li>
            <li>Environment variables like <Code>RISC0_DEV_MODE</Code> are flagged as shadow config &mdash; disable in production</li>
            <li>Exposed Docker ports should be restricted to internal networks</li>
          </ul>
        </div>

        {/* Back link */}
        <div style={{ textAlign: "center", marginTop: "2rem", padding: "1rem 0", borderTop: "1px solid var(--ifm-toc-border-color)" }}>
          <Link to="/scandog" style={{ color: "var(--ifm-color-primary)", fontWeight: 600 }}>
            Back to ScanDog Dashboard
          </Link>
        </div>
      </div>
    </Layout>
  );
}
