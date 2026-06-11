import { writeFileSync } from "fs";
import yaml from "js-yaml";
import { ScanResult } from "../engine/types.js";
import { Output } from "./Output.js";

export class YAMLOutput implements Output {
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
