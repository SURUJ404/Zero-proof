import { readFileSync, existsSync } from "fs";
import { join, basename, extname } from "path";
import { DetectorResult } from "./types.js";

interface FrameworkRule {
  name: string;
  language: string;
  indicator: string | RegExp;
  confidence: number;
  kind?: string;
}

const FRAMEWORK_RULES: FrameworkRule[] = [
  { name: "cargo", language: "rust", indicator: "[package]", confidence: 1.0 },
  { name: "axum", language: "rust", indicator: "axum", confidence: 1.0 },
  { name: "actix-web", language: "rust", indicator: "actix-web", confidence: 1.0 },
  { name: "rocket", language: "rust", indicator: "rocket", confidence: 0.95 },
  { name: "warp", language: "rust", indicator: "warp", confidence: 0.9 },
  { name: "tide", language: "rust", indicator: "tide", confidence: 0.85 },
  { name: "tokio", language: "rust", indicator: "tokio", confidence: 1.0 },
  { name: "clap", language: "rust", indicator: "clap", confidence: 0.9 },
  { name: "serde", language: "rust", indicator: "serde", confidence: 0.8 },
  { name: "reqwest", language: "rust", indicator: "reqwest", confidence: 0.8 },
  { name: "tower-http", language: "rust", indicator: "tower-http", confidence: 0.9 },
  { name: "risc0-zkvm", language: "rust", indicator: "risc0-zkvm", confidence: 1.0 },
];

const FILE_BASED_DETECTORS = [
  { name: "node", language: "javascript", files: ["package.json"], confidence: 0.9 },
  { name: "express", language: "javascript", files: ["package.json"], indicator: "express", confidence: 0.95 },
  { name: "fastify", language: "javascript", files: ["package.json"], indicator: "fastify", confidence: 0.95 },
  { name: "next", language: "typescript", files: ["next.config.js", "next.config.mjs"], confidence: 0.95 },
  { name: "nuxt", language: "javascript", files: ["nuxt.config.js", "nuxt.config.ts"], confidence: 0.9 },
  { name: "sveltekit", language: "typescript", files: ["svelte.config.js"], confidence: 0.9 },
  { name: "remix", language: "typescript", files: ["remix.config.js"], confidence: 0.9 },
  { name: "python", language: "python", files: ["requirements.txt", "setup.py", "Pipfile"], confidence: 0.9 },
  { name: "flask", language: "python", files: ["requirements.txt"], indicator: "flask", confidence: 0.95 },
  { name: "fastapi", language: "python", files: ["requirements.txt"], indicator: "fastapi", confidence: 0.95 },
  { name: "django", language: "python", files: ["manage.py"], confidence: 0.95 },
  { name: "go", language: "go", files: ["go.mod"], confidence: 0.95 },
  { name: "gin", language: "go", files: ["go.mod"], indicator: "gin", confidence: 0.9 },
  { name: "echo", language: "go", files: ["go.mod"], indicator: "echo", confidence: 0.9 },
  { name: "chi", language: "go", files: ["go.mod"], indicator: "chi", confidence: 0.85 },
  { name: "fiber", language: "go", files: ["go.mod"], indicator: "fiber", confidence: 0.85 },
  { name: "java", language: "java", files: ["pom.xml", "build.gradle"], confidence: 0.9 },
  { name: "spring", language: "java", files: ["pom.xml"], indicator: "spring-boot", confidence: 0.95 },
  { name: "csharp", language: "csharp", files: ["*.csproj"], confidence: 0.85 },
  { name: "docker-compose", language: "yaml", files: ["docker-compose.yml", "docker-compose.yaml"], confidence: 1.0 },
  { name: "terraform", language: "hcl", files: ["*.tf"], confidence: 0.8 },
  { name: "kubernetes", language: "yaml", files: ["*.k8s.yaml", "kustomization.yaml"], confidence: 0.8 },
];

export class Detector {
  detect(rootDir: string): DetectorResult[] {
    const results: DetectorResult[] = [];

    const cargoToml = this.tryRead(join(rootDir, "Cargo.toml"));
    if (cargoToml) {
      for (const rule of FRAMEWORK_RULES.filter((r) => r.language === "rust")) {
        if (typeof rule.indicator === "string" && cargoToml.includes(rule.indicator)) {
          results.push({ language: "rust", framework: rule.name, confidence: rule.confidence });
        } else if (rule.indicator instanceof RegExp && rule.indicator.test(cargoToml)) {
          results.push({ language: "rust", framework: rule.name, confidence: rule.confidence });
        }
      }
    }

    for (const detector of FILE_BASED_DETECTORS) {
      if (detector.files.some((f) => f.includes("*"))) continue;
      const content = detector.files
        .map((f) => this.tryRead(join(rootDir, f)))
        .find(Boolean);
      if (content) {
        if (detector.indicator && !content.includes(detector.indicator)) continue;
        const lang = detector.language === "typescript" ? "typescript" : detector.language;
        results.push({ language: lang, framework: detector.name, confidence: detector.confidence });
      }
    }

    const packageJson = this.tryRead(join(rootDir, "package.json"));
    if (packageJson) {
      try {
        const pkg = JSON.parse(packageJson);
        const deps = { ...pkg.dependencies, ...pkg.devDependencies } as Record<string, string>;
        const jsFrameworks: Record<string, string> = {
          express: "express", fastify: "fastify", next: "next",
          nuxt: "nuxt", sveltekit: "sveltekit", remix: "remix",
          hapi: "hapi", koa: "koa", "@nestjs/core": "nestjs",
          hono: "hono", elysia: "elysia", "adonisjs/framework": "adonis",
        };
        for (const [pkgName, fw] of Object.entries(jsFrameworks)) {
          if (deps[pkgName]) {
            results.push({ language: "javascript", framework: fw, confidence: 0.95 });
          }
        }
      } catch { }
    }

    return this.dedup(results);
  }

  private tryRead(path: string): string | null {
    try {
      return readFileSync(path, "utf-8");
    } catch {
      return null;
    }
  }

  private dedup(results: DetectorResult[]): DetectorResult[] {
    const seen = new Set<string>();
    return results.filter((r) => {
      const key = `${r.language}:${r.framework}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
