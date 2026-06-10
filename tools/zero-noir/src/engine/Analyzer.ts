import { Endpoint, AnalyzerOptions } from "./types.js";

export interface Analyzer {
  readonly name: string;
  analyze(files: string[], options: AnalyzerOptions): Endpoint[];
}
