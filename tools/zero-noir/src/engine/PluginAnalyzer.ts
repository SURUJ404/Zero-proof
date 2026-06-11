import { readFileSync } from "fs";
import { globSync } from "glob";
import { join } from "path";
import { Endpoint, AnalyzerOptions, UserAnalyzerDef } from "./types.js";
import { Analyzer } from "./Analyzer.js";

export class PluginAnalyzer implements Analyzer {
  readonly name = "plugin";

  analyze(files: string[], options: AnalyzerOptions): Endpoint[] {
    const defs = options.customAnalyzers;
    if (!defs?.length) return [];

    const eps: Endpoint[] = [];

    for (const def of defs) {
      const matchFiles = this.matchFiles(files, def);
      for (const file of matchFiles) {
        try {
          const content = readFileSync(file, "utf-8");
          const lines = content.split("\n");
          const regex = new RegExp(def.pattern, "g");

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            regex.lastIndex = 0;
            const m = regex.exec(line);
            if (!m) continue;

            let method = (m[def.methodGroup] || "GET").toUpperCase();
            if (!["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"].includes(method)) {
              method = "GET";
            }

            let path = m[def.pathGroup];
            if (!path.startsWith("/")) path = `/${path}`;

            eps.push({
              path,
              method,
              source: {
                file: this.toRelPath(file, options),
                line: def.lineGroup ? parseInt(m[def.lineGroup] || String(i + 1)) : i + 1,
              },
              tags: ["plugin", def.name],
              service: def.service || "api-service",
              technology: def.technology || "custom",
            });
          }
        } catch { continue; }
      }
    }

    return eps;
  }

  private matchFiles(allFiles: string[], def: UserAnalyzerDef): string[] {
    if (!def.include?.length) return allFiles;
    let matched = allFiles;
    if (def.include.length) {
      const inclPatterns = def.include;
      matched = matched.filter((f) =>
        inclPatterns.some((p) => {
          const normP = p.replace(/\\/g, "/");
          const normF = f.replace(/\\/g, "/");
          if (normP.includes("*")) {
            try { return new RegExp("^" + normP.replace(/\*/g, ".*").replace(/\?/g, ".") + "$").test(normF); }
            catch { return normF.includes(normP.replace(/\*/g, "")); }
          }
          return normF.includes(normP);
        })
      );
    }
    if (def.exclude?.length) {
      matched = matched.filter((f) =>
        !def.exclude!.some((p) => f.replace(/\\/g, "/").includes(p.replace(/\\/g, "/")))
      );
    }
    return matched;
  }

  private toRelPath(file: string, options?: AnalyzerOptions): string {
    const idx = file.indexOf("zero-proof");
    if (idx >= 0) return file.slice(idx);
    if (options?.excludePaths) {
      for (const p of options.excludePaths) {
        const idx = file.indexOf(p);
        if (idx >= 0) return file.slice(idx);
      }
    }
    return file;
  }
}
