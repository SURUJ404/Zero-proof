import { writeFileSync } from "fs";
import { ScanResult } from "../engine/types.js";
import { Output } from "./Output.js";

export class MermaidOutput implements Output {
  format(result: ScanResult): string {
    const lines: string[] = [];
    lines.push("graph TB");
    lines.push(`  title[${result.projectName} Attack Surface]`);
    lines.push("  style title fill:#8d4c4c,color:#fff,font-size:16px");
    lines.push("");

    for (const service of result.services) {
      const nodeId = service.name.replace(/[^a-zA-Z0-9]/g, "_");
      const portStr = service.port ? `:${service.port}` : "";
      const techStr = service.technology ? ` [${service.technology}]` : "";
      lines.push(`  subgraph ${nodeId}["${service.name}${portStr}${techStr}"]`);

      for (const ep of service.endpoints) {
        const epId = `${nodeId}_${ep.method}_${ep.path.replace(/[^a-zA-Z0-9]/g, "_")}`;
        const label = `${ep.method} ${ep.path}`.substring(0, 50);
        let cssClass = "default";
        if (ep.tags.includes("shadow")) cssClass = "shadow";
        else if (ep.tags.includes("health")) cssClass = "health";
        else if (ep.tags.includes("prover")) cssClass = "prover";
        else if (ep.tags.includes("deprecated")) cssClass = "deprecated";
        lines.push(`    ${epId}["${label}"]:::${cssClass}`);
      }

      lines.push("  end");
      lines.push("");
    }

    if (result.services.length > 1) {
      for (let i = 0; i < result.services.length - 1; i++) {
        const a = result.services[i].name.replace(/[^a-zA-Z0-9]/g, "_");
        const b = result.services[i + 1].name.replace(/[^a-zA-Z0-9]/g, "_");
        lines.push(`  ${a} -.->|proxy| ${b}`);
      }
    }

    lines.push("");
    lines.push("  classDef default fill:#161b22,stroke:#30363d,color:#c9d1d9");
    lines.push("  classDef shadow fill:#3d1f1f,stroke:#f85149,color:#f85149");
    lines.push("  classDef health fill:#1f3f2a,stroke:#3fb950,color:#3fb950");
    lines.push("  classDef prover fill:#1f3a5f,stroke:#58a6ff,color:#58a6ff");
    lines.push("  classDef deprecated fill:#3d2e0f,stroke:#d29922,color:#d29922");

    return lines.join("\n");
  }

  write(result: ScanResult, path: string): void {
    writeFileSync(path, this.format(result), "utf-8");
  }
}
