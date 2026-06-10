import { readFileSync } from "fs";
import { Endpoint, AnalyzerOptions } from "./types.js";
import { Analyzer } from "./Analyzer.js";

const KNOWN_PORTS: Record<string, { service: string; env: string[] }> = {
  "8080": { service: "gateway", env: ["GATEWAY_PORT", "BUILD_SERVICE_URL", "PROVER_SERVICE_URL"] },
  "8081": { service: "build-service", env: ["BUILD_SERVICE_PORT", "ZP_DATA_DIR"] },
  "8082": { service: "prover-service", env: ["PROVER_SERVICE_PORT", "RISC0_DEV_MODE"] },
};

export class DockerAnalyzer implements Analyzer {
  readonly name = "docker-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const eps: Endpoint[] = [];

    for (const file of files) {
      if (!file.includes("docker-compose") && !file.includes("Dockerfile")) continue;
      try {
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          const portMatch = line.match(/["']?(\d+):(\d+)["']?/);
          if (portMatch) {
            const containerPort = portMatch[2];
            const known = KNOWN_PORTS[containerPort];
            if (known) {
              eps.push({
                path: `port:${containerPort}`,
                method: "TCP",
                source: { file, line: i + 1 },
                tags: ["docker", "exposed"],
                service: known.service,
              });
            }
          }

          const envMatch = line.match(/^\s{2,}-?\s*(\w+)=/);
          if (envMatch) {
            const envVar = envMatch[1];
            for (const [port, known] of Object.entries(KNOWN_PORTS)) {
              if (known.env.includes(envVar)) {
                const tags = ["docker", "config", "environment"];
                if (envVar.includes("DEV_MODE")) tags.push("shadow");
                if (envVar.includes("PROVER")) tags.push("prover");
                eps.push({
                  path: `env:${envVar}`,
                  method: "CONFIG",
                  source: { file, line: i + 1 },
                  tags,
                  service: known.service,
                });
              }
            }
          }
        }
      } catch {
        continue;
      }
    }

    return this.dedup(eps);
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
}
