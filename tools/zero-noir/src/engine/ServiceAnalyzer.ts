import { readFileSync } from "fs";
import { Endpoint, AnalyzerOptions } from "./types.js";
import { Analyzer } from "./Analyzer.js";

const IGNORE_FILES = ["rzup", "xtask", "cargo-risczero", "risc0", "tools", "vendor", "target"];

export class ServiceAnalyzer implements Analyzer {
  readonly name = "service-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const raw: Endpoint[] = [];

    for (const file of files) {
      if (IGNORE_FILES.some((ign) => file.includes(ign))) continue;
      const relFile = file.includes("\\")
        ? file.split("\\zero-proof\\")[1] || file
        : file.split("/zero-proof/")[1] || file;

      try {
        const content = readFileSync(file, "utf-8");
        raw.push(...this.parseEnvEndpoints(content, relFile));
      } catch {
        continue;
      }
    }

    return this.dedup(raw);
  }

  private parseEnvEndpoints(content: string, file: string): Endpoint[] {
    const eps: Endpoint[] = [];
    const service = this.inferService(file);
    if (service === "unknown") return eps;

    const seen = new Set<string>();
    const configVarMatch = content.match(
      /(BUILD_SERVICE_URL|PROVER_SERVICE_URL|GATEWAY_URL|BONSAI_API_URL)/g
    );
    if (configVarMatch) {
      for (const env of configVarMatch) {
        if (seen.has(env)) continue;
        seen.add(env);
        const target = env.replace("_URL", "").replace("_SERVICE", "").toLowerCase();
        eps.push({
          path: `env:${env}`,
          method: "CONFIG",
          source: { file, line: 0 },
          tags: ["config", "upstream"],
          service: `${service} -> ${target}`,
        });
      }
    }

    return eps;
  }

  private dedup(endpoints: Endpoint[]): Endpoint[] {
    const seen = new Set<string>();
    return endpoints.filter((ep) => {
      const key = `${ep.service}:${ep.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  private inferService(file: string): string {
    if (file.includes("server")) return "zk-prover-server";
    if (file.includes("gateway")) return "zp-gateway";
    if (file.includes("build-service")) return "zp-build-service";
    if (file.includes("prover-service")) return "zp-prover-service";
    return "unknown";
  }
}
