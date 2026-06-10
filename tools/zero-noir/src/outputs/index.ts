import { JSONOutput } from "./JSONOutput.js";
import { YAMLOutput } from "./YAMLOutput.js";
import { OpenAPIOutput } from "./OpenAPIOutput.js";
import { SARIFOutput } from "./SARIFOutput.js";
import { HTMLOutput } from "./HTMLOutput.js";
import { MermaidOutput } from "./MermaidOutput.js";

export type OutputFormat = "json" | "yaml" | "openapi" | "sarif" | "html" | "mermaid";

const registry: Record<OutputFormat, any> = {
  json: new JSONOutput(),
  yaml: new YAMLOutput(),
  openapi: new OpenAPIOutput(),
  sarif: new SARIFOutput(),
  html: new HTMLOutput(),
  mermaid: new MermaidOutput(),
};

export function getOutput(format: OutputFormat) {
  const out = registry[format];
  if (!out) throw new Error(`Unknown output format: ${format}`);
  return out;
}

export const OUTPUT_FORMATS: OutputFormat[] = ["json", "yaml", "openapi", "sarif", "html", "mermaid"];
