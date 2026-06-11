import { writeFileSync } from "fs";
import { ScanResult } from "../engine/types.js";
import { Output } from "./Output.js";

export class PostmanOutput implements Output {
  format(result: ScanResult): string {
    const items: any[] = [];

    for (const svc of result.services) {
      for (const ep of svc.endpoints) {
        if (ep.method === "CLI" || ep.method === "TCP" || ep.method === "CONFIG") continue;
        items.push({
          name: `${ep.method} ${ep.path}`,
          request: {
            method: ep.method,
            header: [{ key: "Content-Type", value: "application/json" }],
            url: {
              raw: `{{baseUrl}}${ep.path}`,
              host: ["{{baseUrl}}"],
              path: ep.path.split("/").filter(Boolean),
              query: ep.parameters?.filter((p) => p.type === "query").map((p) => ({
                key: p.name,
                value: p.defaultValue || "",
                disabled: !p.required,
              })) || [],
            },
            description: `Source: ${ep.source.file}:${ep.source.line}\nTags: ${ep.tags.join(", ")}`,
          },
        });
      }
    }

    const collection = {
      info: {
        name: `${result.projectName} API`,
        description: `Auto-discovered by ScanDog v1.0.0\nScanned: ${result.scannedAt}\nEndpoints: ${result.totalEndpoints}`,
        schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
      },
      item: items,
      variable: [
        { key: "baseUrl", value: "http://localhost:8080", type: "string" },
      ],
    };

    return JSON.stringify(collection, null, 2);
  }

  write(result: ScanResult, path: string): void {
    writeFileSync(path, this.format(result), "utf-8");
  }
}
