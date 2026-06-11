import { writeFileSync } from "fs";
import { ScanResult, Endpoint } from "../engine/types.js";
import { Output } from "./Output.js";

export class HTMLOutput implements Output {
  format(result: ScanResult): string {
    const servicesHtml = result.services
      .map(
        (s) => `
      <div class="service-card">
        <div class="service-header">
          <h2>${s.name}</h2>
          <span class="service-type">${s.type}</span>
          ${s.port ? `<span class="service-port">:${s.port}</span>` : ""}
          ${s.technology ? `<span class="service-tech">${s.technology}</span>` : ""}
        </div>
        <table>
          <thead><tr><th>Method</th><th>Path</th><th>Tags</th><th>Source</th></tr></thead>
          <tbody>
            ${s.endpoints
              .map(
                (ep) => `
              <tr>
                <td><span class="method method-${ep.method.toLowerCase()}">${ep.method}</span></td>
                <td><code>${ep.path}</code></td>
                <td>${ep.tags.map((t) => `<span class="tag ${t}">${t}</span>`).join(" ")}</td>
                <td class="source">${ep.source.file}:${ep.source.line}</td>
              </tr>`
              )
              .join("")}
          </tbody>
        </table>
      </div>`
      )
      .join("\n");

    const clisHtml = result.clis
      .map(
        (c) => `
      <div class="cli-card">
        <h3>${c.binary}</h3>
        <p class="cli-desc">${c.description}</p>
        <ul>
          ${c.commands.map((cmd) => `<li><code>${c.binary} ${cmd.name}</code> — ${cmd.description}</li>`).join("")}
        </ul>
      </div>`
      )
      .join("\n");

    const warningsHtml = result.warnings && result.warnings.length > 0
      ? `<div class="warnings">${result.warnings.map((w) => `<div class="warning">⚠ ${w}</div>`).join("")}</div>`
      : "";

    const techsHtml = result.technologies && result.technologies.length > 0
      ? `<div class="techs">${result.technologies.map((t) => `<span class="tech">${t}</span>`).join(" ")}</div>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${result.projectName} — API Surface Report</title>
  <style>
    :root {
      --bg: #0d1117; --surface: #161b22; --border: #30363d;
      --text: #c9d1d9; --text-muted: #8b949e; --primary: #db8b8b;
      --primary-dark: #8d4c4c; --get: #58a6ff; --post: #3fb950;
      --put: #d29922; --delete: #f85149; --any: #8b949e;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: var(--bg); color: var(--text); padding: 2rem; }
    .header { text-align: center; padding: 2rem 0; border-bottom: 1px solid var(--border); margin-bottom: 2rem; }
    .header h1 { font-size: 2rem; color: var(--primary); }
    .header .subtitle { color: var(--text-muted); margin-top: 0.5rem; }
    .warnings { margin: 1rem 0; }
    .warning { background: #3d1f1f; border: 1px solid #f85149; color: #f85149; padding: 0.5rem 1rem; border-radius: 6px; margin: 0.25rem 0; font-size: 0.85rem; }
    .techs { text-align: center; margin: 0.75rem 0; }
    .tech { display: inline-block; font-size: 0.7rem; padding: 0.15rem 0.5rem; background: var(--surface); border: 1px solid var(--border); border-radius: 4px; margin: 0.15rem; color: var(--text-muted); }
    .stats { display: flex; gap: 1rem; justify-content: center; margin: 1.5rem 0; flex-wrap: wrap; }
    .stat { background: var(--surface); padding: 1rem 1.5rem; border-radius: 8px; border: 1px solid var(--border); text-align: center; min-width: 100px; }
    .stat-value { font-size: 1.5rem; font-weight: 700; color: var(--primary); }
    .stat-label { font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; margin-top: 0.25rem; }
    .service-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin-bottom: 1.5rem; overflow: hidden; }
    .service-header { padding: 1rem; border-bottom: 1px solid var(--border); display: flex; gap: 0.75rem; align-items: center; }
    .service-header h2 { font-size: 1.1rem; }
    .service-type { font-size: 0.7rem; padding: 0.15rem 0.5rem; border-radius: 4px; background: var(--primary-dark); color: white; text-transform: uppercase; letter-spacing: 0.04em; }
    .service-port { font-size: 0.8rem; color: var(--text-muted); font-family: monospace; }
    .service-tech { font-size: 0.7rem; color: var(--text-muted); font-family: monospace; }
    table { width: 100%; border-collapse: collapse; }
    th { text-align: left; padding: 0.5rem 1rem; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; border-bottom: 1px solid var(--border); }
    td { padding: 0.5rem 1rem; border-bottom: 1px solid var(--border); font-size: 0.85rem; }
    .method { font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.4rem; border-radius: 3px; font-family: monospace; }
    .method-get { background: #1f3a5f; color: var(--get); }
    .method-post { background: #1f3f2a; color: var(--post); }
    .method-put { background: #3d2e0f; color: var(--put); }
    .method-delete { background: #3d1f1f; color: var(--delete); }
    .method-any { background: #2d2d2d; color: var(--any); }
    .method-cli { background: #2d2d2d; color: #c9d1d9; }
    .method-tcp { background: #1f2a3f; color: #79c0ff; }
    .method-config { background: #2d1f3d; color: #d2a8ff; }
    code { font-family: 'JetBrains Mono', 'Fira Code', monospace; font-size: 0.8rem; background: rgba(255,255,255,0.05); padding: 0.1rem 0.3rem; border-radius: 3px; }
    .tag { display: inline-block; font-size: 0.65rem; padding: 0.1rem 0.4rem; border-radius: 3px; background: rgba(255,255,255,0.08); margin: 0.1rem; }
    .tag.shadow { background: #3d1f1f; color: var(--delete); }
    .tag.prover { background: #1f3a5f; color: var(--get); }
    .tag.verifier { background: #2d1f3d; color: #d2a8ff; }
    .tag.health { background: #1f3f2a; color: var(--post); }
    .tag.config { background: #2d2d2d; color: #c9d1d9; }
    .tag.deprecated { background: #3d2e0f; color: var(--put); }
    .tag.authenticated { background: #1f3a5f; color: #79c0ff; }
    .source { font-size: 0.75rem; color: var(--text-muted); font-family: monospace; }
    .cli-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
    .cli-card h3 { font-size: 1rem; color: var(--primary); }
    .cli-desc { color: var(--text-muted); font-size: 0.85rem; margin: 0.25rem 0 0.5rem; }
    .cli-card li { margin: 0.25rem 0; font-size: 0.85rem; }
    .section-title { font-size: 1.25rem; margin: 1.5rem 0 0.75rem; color: var(--primary); }
    .footer { text-align: center; color: var(--text-muted); font-size: 0.75rem; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }
  </style>
</head>
<body>
  <div class="header">
    <h1>🔍 ${result.projectName}</h1>
    <p class="subtitle">API Surface Report · ${result.totalEndpoints} endpoints · ${result.services.length} services · ${result.clis.length} CLI tools</p>
    <p class="subtitle">${result.scannedAt}</p>
    ${techsHtml}
    <div class="stats">
      <div class="stat"><div class="stat-value">${result.totalEndpoints}</div><div class="stat-label">Endpoints</div></div>
      <div class="stat"><div class="stat-value">${result.services.length}</div><div class="stat-label">Services</div></div>
      <div class="stat"><div class="stat-value">${result.clis.length}</div><div class="stat-label">CLI Tools</div></div>
      <div class="stat"><div class="stat-value">${result.tags.shadow}</div><div class="stat-label">Shadow APIs</div></div>
      <div class="stat"><div class="stat-value">${result.tags.prover || 0}</div><div class="stat-label">Prover</div></div>
      <div class="stat"><div class="stat-value">${result.tags.verifier || 0}</div><div class="stat-label">Verifier</div></div>
    </div>
  </div>

  ${warningsHtml}

  <h2 class="section-title">📡 Services & Endpoints</h2>
  ${servicesHtml}

  <h2 class="section-title">🖥️ CLI Tools</h2>
  ${clisHtml}

  <div class="footer">
    Generated by <strong>API Scanner</strong> v1.0.0 — API surface scanner
  </div>
</body>
</html>`;
  }

  write(result: ScanResult, path: string): void {
    writeFileSync(path, this.format(result), "utf-8");
  }
}
