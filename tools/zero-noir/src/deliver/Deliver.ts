import { ScanResult } from "../engine/types.js";
import { JSONOutput } from "../outputs/JSONOutput.js";

export class Deliver {
  async toZAP(result: ScanResult, zapUrl: string): Promise<void> {
    const openapi = new (await import("../outputs/OpenAPIOutput.js")).OpenAPIOutput();
    const spec = openapi.format(result);
    const response = await fetch(`${zapUrl}/JSON/openapi/action/importUrl/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: `data:application/json;base64,${Buffer.from(spec).toString("base64")}` }),
    });
    if (!response.ok) throw new Error(`ZAP import failed: ${response.status}`);
  }

  async toBurp(result: ScanResult, burpUrl: string): Promise<void> {
    const json = new JSONOutput();
    const data = json.format(result);
    const response = await fetch(`${burpUrl}/burp/scanner/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
    });
    if (!response.ok) throw new Error(`Burp import failed: ${response.status}`);
  }

  async toCaido(result: ScanResult, caidoUrl: string): Promise<void> {
    const json = new JSONOutput();
    const data = json.format(result);
    const response = await fetch(`${caidoUrl}/api/routes/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
    });
    if (!response.ok) throw new Error(`Caido import failed: ${response.status}`);
  }

  async toWebhook(result: ScanResult, url: string): Promise<void> {
    const json = new JSONOutput();
    const data = json.format(result);
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: data,
    });
    if (!response.ok) throw new Error(`Webhook delivery failed: ${response.status}`);
  }

  describe(result: ScanResult): string {
    return [
      `📡 ${result.totalEndpoints} endpoints across ${result.services.length} services`,
      ...result.services.map(
        (s) => `   ${s.name} (${s.type}${s.port ? ` :${s.port}` : ""}): ${s.endpoints.length} endpoints`
      ),
      `🖥️  ${result.clis.length} CLI tools: ${result.clis.map((c) => c.binary).join(", ")}`,
      `🏷️  Tags: ${result.tags.shadow} shadow, ${result.tags.deprecated || 0} deprecated, ${result.tags.prover || 0} prover`,
      result.technologies ? `🔧  Tech: ${result.technologies.join(", ")}` : "",
    ].filter(Boolean).join("\n");
  }
}
