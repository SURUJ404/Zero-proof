import { writeFileSync } from "fs";
import { ScanResult } from "../engine/types.js";

export class MermaidOutput {
  format(result: ScanResult): string {
    const lines: string[] = [];
    lines.push("graph TB");
    lines.push("  title[Zero Proof Attack Surface]");
    lines.push("  style title fill:#8d4c4c,color:#fff,font-size:16px");
    lines.push("");

    for (const service of result.services) {
      const nodeId = service.name.replace(/[^a-zA-Z0-9]/g, "_");
      const portStr = service.port ? `:${service.port}` : "";
      lines.push(`  subgraph ${nodeId}["${service.name}${portStr}"]`);

      for (const ep of service.endpoints) {
        const epId = `${nodeId}_${ep.method}_${ep.path.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const label = `${ep.method} ${ep.path}`.substring(0, 50);
        const tagClass = ep.tags.includes("shadow") ? "shadow" : ep.tags.includes("health") ? "health" : "default";
        lines.push(`    ${epId}["${label}"]:::${tagClass}`);
      }

      lines.push("  end");
      lines.push("");
    }

    if (result.services.length > 1) {
      for (let i = 0; i < result.services.length - 1; i++) {
        const a = result.services[i].name.replace(/[^a-zA-Z0-9]/g, "_");
        const b = result.services[i + 1].name.replace(/[^a-zA-Z0-9]/g, "_");
        lines.push(`  ${a} -->|proxies| ${b}`);
      }
    }

    lines.push("");
    lines.push("  classDef default fill:#161b22,stroke:#30363d,color:#c9d1d9");
    lines.push("  classDef shadow fill:#3d1f1f,stroke:#f85149,color:#f85149");
    lines.push("  classDef health fill:#1f3f2a,stroke:#3fb950,color:#3fb950");

    return lines.join("\n");
  }

  write(result: ScanResult, path: string): void {
    writeFileSync(path, this.format(result), "utf-8");
  }
}
