import { writeFileSync } from "fs";
import { ScanResult } from "../engine/types.js";
import { Output } from "./Output.js";

export class SARIFOutput implements Output {
  format(result: ScanResult): string {
    const results: any[] = [];
    let ruleIdx = 0;
    const rules: any[] = [];

    for (const service of result.services) {
      for (const ep of service.endpoints) {
        ruleIdx++;
        const ruleId = `ZP-${String(ruleIdx).padStart(4, "0")}`;
        const level = this.severityLevel(ep.tags);
        rules.push({
          id: ruleId,
          name: `${ep.method} ${ep.path}`,
          shortDescription: { text: `Endpoint: ${ep.method} ${ep.path}` },
          fullDescription: { text: `Discovered in ${ep.service} at ${ep.source.file}:${ep.source.line}\nTags: ${ep.tags.join(", ")}` },
          properties: { tags: ep.tags, service: ep.service, technology: ep.technology || "" },
        });

        results.push({
          ruleId,
          level,
          message: { text: `${ep.method} ${ep.path} [${ep.tags.join(", ")}]` },
          locations: [{
            physicalLocation: {
              artifactLocation: { uri: ep.source.file },
              region: {
                startLine: ep.source.line,
                startColumn: ep.source.column || 1,
              },
            },
          }],
          properties: {
            tags: ep.tags,
            service: ep.service,
            method: ep.method,
            path: ep.path,
          },
        });
      }
    }

    const sarif = {
      $schema: "https://docs.oasis-open.org/sarif/sarif/v2.1.0/errata01/os/schemas/sarif-2.1.0-errata01-os-schema.json",
      version: "2.1.0",
      runs: [{
        tool: {
          driver: {
            name: "ScanDog",
            version: "1.0.0",
            informationUri: "https://zero-proof-pearl.vercel.app",
            rules,
          },
        },
        results,
        properties: {
          projectName: result.projectName,
          projectVersion: result.projectVersion,
          totalEndpoints: result.totalEndpoints,
          scannedAt: result.scannedAt,
          technologies: result.technologies || [],
        },
      }],
    };

    return JSON.stringify(sarif, null, 2);
  }

  private severityLevel(tags: string[]): "error" | "warning" | "note" | "none" {
    if (tags.includes("shadow")) return "warning";
    if (tags.includes("deprecated")) return "note";
    if (tags.includes("prover") || tags.includes("verifier")) return "note";
    return "note";
  }

  write(result: ScanResult, path: string): void {
    writeFileSync(path, this.format(result), "utf-8");
  }
}
