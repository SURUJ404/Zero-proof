import { ScanResult } from "../engine/types.js";

export interface Output {
  format(result: ScanResult): string;
  write(result: ScanResult, path: string): void;
}
