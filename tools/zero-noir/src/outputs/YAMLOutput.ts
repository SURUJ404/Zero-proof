import { writeFileSync } from "fs";
import yaml from "js-yaml";
import { ScanResult } from "../engine/types.js";

export class YAMLOutput {
  format(result: ScanResult): string {
    return yaml.dump(JSON.parse(JSON.stringify(result)), {
      indent: 2,
      lineWidth: 120,
      noRefs: true,
    });
  }

  write(result: ScanResult, path: string): void {
    writeFileSync(path, this.format(result), "utf-8");
  }
}
