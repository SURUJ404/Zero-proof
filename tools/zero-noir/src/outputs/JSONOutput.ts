import { writeFileSync } from "fs";
import { ScanResult } from "../engine/types.js";
import { Output } from "./Output.js";

export class JSONOutput implements Output {
  format(result: ScanResult): string {
    return JSON.stringify(result, null, 2);
  }

  write(result: ScanResult, path: string): void {
    writeFileSync(path, this.format(result), "utf-8");
  }
}
