export interface Endpoint {
  path: string;
  method: string;
  source: {
    file: string;
    line: number;
    column?: number;
  };
  parameters?: EndpointParam[];
  headers?: string[];
  cookies?: string[];
  requestBody?: string;
  responseBody?: string;
  tags: string[];
  service: string;
  callees?: string[];
  aiContext?: AIContext;
  technology?: string;
  auth?: string;
}

export interface EndpointParam {
  name: string;
  type: "query" | "path" | "header" | "cookie" | "body" | "form" | "json";
  required?: boolean;
  defaultValue?: string;
}

export interface AIContext {
  guards: string[];
  sinks: string[];
  validators: string[];
  signals: string[];
  callee: string[];
  summary?: string;
  riskLevel?: "low" | "medium" | "high" | "critical";
}

export interface ServiceDef {
  name: string;
  type: "server" | "gateway" | "build-service" | "prover-service" | "cli" | "library" | "sdk" | "web-app" | "api-service" | "microservice";
  port?: number;
  endpoints: Endpoint[];
  sourceDir: string;
  technology?: string;
}

export interface CLIDef {
  name: string;
  binary: string;
  description: string;
  commands: CLICommand[];
}

export interface CLICommand {
  name: string;
  description: string;
  args: CLIArg[];
  subcommands?: CLICommand[];
}

export interface CLIArg {
  name: string;
  type: string;
  required: boolean;
  default?: string;
}

export interface ScanResult {
  projectName: string;
  projectVersion: string;
  scannedAt: string;
  services: ServiceDef[];
  clis: CLIDef[];
  totalEndpoints: number;
  tags: TagSummary;
  technologies?: string[];
  warnings?: string[];
}

export interface TagSummary {
  shadow: number;
  deprecated: number;
  authenticated: number;
  websocket: number;
  static: number;
  callee: number;
  aiContext: number;
  prover: number;
  verifier: number;
  health: number;
  graphql?: number;
  jwt?: number;
  fileUpload?: number;
}

export interface DetectorResult {
  language: string;
  framework: string;
  confidence: number;
  version?: string;
}

export interface UserAnalyzerDef {
  name: string;
  pattern: string;
  methodGroup: number;
  pathGroup: number;
  lineGroup?: number;
  technology?: string;
  service?: string;
  include?: string[];
  exclude?: string[];
}

export interface AnalyzerOptions {
  includeCallee?: boolean;
  aiContext?: boolean;
  excludePaths?: string[];
  verbose?: boolean;
  onlyTechs?: string[];
  excludeTechs?: string[];
  customAnalyzers?: UserAnalyzerDef[];
}
