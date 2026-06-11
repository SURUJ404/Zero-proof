import { readFileSync } from "fs";
import { Endpoint, AnalyzerOptions } from "../types.js";
import { Analyzer } from "../Analyzer.js";

const FRAMEWORK_CONFIGS = [
  {
    name: "flask",
    detect: [/from flask import/i, /import flask/i],
    routePattern: /@\w+\.route\(['"]([^'"]+)['"]\)/,
    methodPattern: /methods\s*=\s*\[['"](\w+)['"]\]/,
    defaultMethod: "GET",
    exclude: [/node_modules/, /__pycache__/, /\.venv/, /env\//],
  },
  {
    name: "fastapi",
    detect: [/from fastapi import/i, /import fastapi/i],
    routePattern: /@\w+\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]\)/,
    methodPattern: null,
    defaultMethod: null,
    exclude: [/node_modules/, /__pycache__/, /\.venv/],
  },
  {
    name: "django",
    detect: [/from django\./i, /django\.urls/i, /include\(/],
    routePattern: /path\(['"]([^'"]+)['"]/,
    methodPattern: null,
    defaultMethod: "ANY",
    exclude: [/node_modules/, /__pycache__/, /\.venv/, /migrations\//],
  },
  {
    name: "aiohttp",
    detect: [/from aiohttp import/i, /import aiohttp/i],
    routePattern: /\.(get|post|put|delete|patch)\(['"]([^'"]+)['"]\)/,
    methodPattern: null,
    defaultMethod: null,
    exclude: [/node_modules/, /__pycache__/, /\.venv/],
  },
  {
    name: "bottle",
    detect: [/from bottle import/i, /import bottle/i],
    routePattern: /@\w+\.route\(['"]([^'"]+)['"]\)/,
    methodPattern: /method\s*=\s*['"](\w+)['"]/,
    defaultMethod: "GET",
    exclude: [/node_modules/, /__pycache__/, /\.venv/],
  },
  {
    name: "starlette",
    detect: [/from starlette import/i, /import starlette/i],
    routePattern: /\.add_route\(['"]([^'"]+)['"]/,
    methodPattern: null,
    defaultMethod: "ANY",
    exclude: [/node_modules/, /__pycache__/, /\.venv/],
  },
];

export class PythonAnalyzer implements Analyzer {
  readonly name = "python-analyzer";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const raw: Endpoint[] = [];
    const frameworks = this.detectFrameworks(files);

    for (const file of files) {
      try {
        const relFile = this.toRelPath(file);
        if (options.excludePaths?.some((p) => relFile.includes(p))) continue;
        if (frameworks.length === 0) continue;
        const content = readFileSync(file, "utf-8");
        const lines = content.split("\n");

        for (const fw of frameworks) {
          const config = FRAMEWORK_CONFIGS.find((c) => c.name === fw);
          if (!config) continue;
          if (config.exclude.some((e) => e.test(file))) continue;

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const routeMatch = line.match(config.routePattern);
            if (!routeMatch) continue;

            let method = config.defaultMethod || "ANY";
            if (config.methodPattern) {
              const methodMatch = line.match(config.methodPattern);
              if (methodMatch) method = methodMatch[1].toUpperCase();
            } else if (config.name === "fastapi" || config.name === "aiohttp") {
              method = routeMatch[1].toUpperCase();
            }

            let path = config.name === "fastapi" || config.name === "aiohttp"
              ? routeMatch[2] || "/"
              : routeMatch[1] || "/";

            if (config.name === "django") {
              path = path.startsWith("/") ? path : `/${path}`;
            }

            raw.push({
              path,
              method: method === "ALL" ? "ANY" : method,
              source: { file: relFile, line: i + 1 },
              tags: [fw],
              service: this.inferService(file, relFile),
              technology: `python:${fw}`,
            });
          }
        }
      } catch { continue; }
    }

    return this.dedup(raw);
  }

  private detectFrameworks(files: string[]): string[] {
    const detected = new Set<string>();
    for (const file of files) {
      try {
        const content = readFileSync(file, "utf-8");
        for (const config of FRAMEWORK_CONFIGS) {
          if (!detected.has(config.name) && config.detect.some((r) => r.test(content))) {
            detected.add(config.name);
          }
        }
      } catch { continue; }
    }
    return [...detected];
  }

  private toRelPath(file: string): string {
    return file;
  }

  private inferService(file: string, relFile: string): string {
    if (relFile.includes("api") || relFile.includes("routes")) return "api-service";
    if (relFile.includes("server")) return "server";
    return "web-app";
  }

  private dedup(endpoints: Endpoint[]): Endpoint[] {
    const seen = new Set<string>();
    return endpoints.filter((ep) => {
      const key = `${ep.service}:${ep.method}:${ep.path}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
