import { readFileSync, existsSync } from "fs";
import { join, basename } from "path";
import { DetectorResult } from "./types.js";

export class Detector {
  detect(rootDir: string): DetectorResult[] {
    const results: DetectorResult[] = [];

    const cargoToml = this.tryRead(join(rootDir, "Cargo.toml"));
    if (cargoToml) {
      results.push({ language: "rust", framework: "cargo", confidence: 1.0 });

      if (cargoToml.includes('axum')) {
        results.push({ language: "rust", framework: "axum", confidence: 1.0 });
      }
      if (cargoToml.includes('clap')) {
        results.push({ language: "rust", framework: "clap", confidence: 0.9 });
      }
      if (cargoToml.includes('tokio')) {
        results.push({ language: "rust", framework: "tokio", confidence: 1.0 });
      }
      if (cargoToml.includes('risc0-zkvm')) {
        results.push({ language: "rust", framework: "risc0-zkvm", confidence: 1.0 });
      }
      if (cargoToml.includes('tower-http')) {
        results.push({ language: "rust", framework: "tower-http", confidence: 0.9 });
      }
      if (cargoToml.includes('serde')) {
        results.push({ language: "rust", framework: "serde", confidence: 0.8 });
      }
      if (cargoToml.includes('reqwest')) {
        results.push({ language: "rust", framework: "reqwest", confidence: 0.8 });
      }
    }

    const dockerCompose = this.tryRead(join(rootDir, "docker-compose.yml"))
      || this.tryRead(join(rootDir, "docker-compose.yaml"));
    if (dockerCompose) {
      results.push({ language: "yaml", framework: "docker-compose", confidence: 1.0 });
    }

    const packageJson = this.tryRead(join(rootDir, "package.json"));
    if (packageJson) {
      results.push({ language: "javascript", framework: "node", confidence: 0.9 });
    }

    return results;
  }

  private tryRead(path: string): string | null {
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return null;
    }
  }
}
