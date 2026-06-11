import { Endpoint, TagSummary } from "./types.js";

const SHADOW_PATTERNS = [
  "admin", "internal", "debug", "private", "test", "dev",
  "shadow", "hidden", "staging", "sandbox", "playground",
  "swagger", "api-doc", "graphql", "healthz", "metrics",
  "prometheus", "pprof", "debug/pprof", "actuator",
];

const DEPRECATED_PATTERNS = ["deprecated", "v0", "old", "legacy", "removed", "sunset"];

const GRAPHQL_PATTERNS = ["graphql", "gql", "graphiql"];
const WEBSOCKET_PATTERNS = ["ws", "wss", "socket", "websocket", "/ws"];
const FILE_UPLOAD_PATTERNS = ["upload", "file", "import", "attach", "media"];
const JWT_PATTERNS = ["jwt", "token", "bearer"];
const AUTH_HEADERS = ["authorization", "api-key", "token", "x-api-key", "bearer"];
const HEALTH_PATTERNS = ["health", "ready", "live", "ping", "status", "heartbeat", "healthz"];

export class Tagger {
  tag(endpoints: Endpoint[]): Endpoint[] {
    for (const ep of endpoints) {
      if (!this.hasTag(ep, "shadow") && this.isShadow(ep)) ep.tags.push("shadow");
      if (!this.hasTag(ep, "deprecated") && this.isDeprecated(ep)) ep.tags.push("deprecated");
      if (this.isAuthenticated(ep) && !this.hasTag(ep, "authenticated")) ep.tags.push("authenticated");
      if (this.isConfigEndpoint(ep) && !this.hasTag(ep, "config")) ep.tags.push("config");
      if (this.isProverEndpoint(ep) && !this.hasTag(ep, "prover")) ep.tags.push("prover");
      if (this.isVerifierEndpoint(ep) && !this.hasTag(ep, "verifier")) ep.tags.push("verifier");
      if (this.isHealthEndpoint(ep) && !this.hasTag(ep, "health")) ep.tags.push("health");
      if (this.isWebSocket(ep) && !this.hasTag(ep, "websocket")) ep.tags.push("websocket");
      if (this.isGraphQL(ep) && !this.hasTag(ep, "graphql")) ep.tags.push("graphql");
      if (this.isFileUpload(ep) && !this.hasTag(ep, "file-upload")) ep.tags.push("file-upload");
      if (this.isJWT(ep) && !this.hasTag(ep, "jwt")) ep.tags.push("jwt");
      if (!this.hasTag(ep, "static") && this.isStatic(ep)) ep.tags.push("static");
    }
    return endpoints;
  }

  summarize(endpoints: Endpoint[]): TagSummary {
    return {
      shadow: endpoints.filter((e) => e.tags.includes("shadow")).length,
      deprecated: endpoints.filter((e) => e.tags.includes("deprecated")).length,
      authenticated: endpoints.filter((e) => e.tags.includes("authenticated")).length,
      prover: endpoints.filter((e) => e.tags.includes("prover")).length,
      verifier: endpoints.filter((e) => e.tags.includes("verifier")).length,
      health: endpoints.filter((e) => e.tags.includes("health")).length,
      websocket: endpoints.filter((e) => e.tags.includes("websocket")).length,
      static: endpoints.filter((e) => e.tags.includes("static")).length,
      callee: endpoints.filter((e) => e.callees && e.callees.length > 0).length,
      aiContext: endpoints.filter((e) => e.aiContext).length,
      graphql: endpoints.filter((e) => e.tags.includes("graphql")).length,
      jwt: endpoints.filter((e) => e.tags.includes("jwt")).length,
      fileUpload: endpoints.filter((e) => e.tags.includes("file-upload")).length,
    };
  }

  private hasTag(ep: Endpoint, tag: string): boolean {
    return ep.tags.includes(tag);
  }

  private isShadow(ep: Endpoint): boolean {
    const path = ep.path.toLowerCase();
    return SHADOW_PATTERNS.some((p) => path.includes(p));
  }

  private isDeprecated(ep: Endpoint): boolean {
    return DEPRECATED_PATTERNS.some((p) => ep.path.toLowerCase().includes(p));
  }

  private isAuthenticated(ep: Endpoint): boolean {
    const headers = ep.headers || [];
    if (ep.tags.includes("auth")) return true;
    if (headers.some((h) => AUTH_HEADERS.some((a) => h.toLowerCase().includes(a)))) return true;
    const path = ep.path.toLowerCase();
    if (path.includes("/auth") || path.includes("/login") || path.includes("/logout") || path.includes("/oauth") || path.includes("/token") || path.includes("/session")) return true;
    return false;
  }

  private isConfigEndpoint(ep: Endpoint): boolean {
    return ep.path.toLowerCase().includes("config") || ep.path.toLowerCase().includes("settings");
  }

  private isProverEndpoint(ep: Endpoint): boolean {
    return ep.path.toLowerCase().includes("prove");
  }

  private isVerifierEndpoint(ep: Endpoint): boolean {
    return ep.path.toLowerCase().includes("verify");
  }

  private isHealthEndpoint(ep: Endpoint): boolean {
    return HEALTH_PATTERNS.some((p) => {
      const path = ep.path.toLowerCase();
      const last = path.split("/").pop() || "";
      return last === p || path.includes(`/${p}`);
    });
  }

  private isWebSocket(ep: Endpoint): boolean {
    return WEBSOCKET_PATTERNS.some((p) => ep.path.toLowerCase().includes(p));
  }

  private isGraphQL(ep: Endpoint): boolean {
    return GRAPHQL_PATTERNS.some((p) => ep.path.toLowerCase().includes(p));
  }

  private isFileUpload(ep: Endpoint): boolean {
    return FILE_UPLOAD_PATTERNS.some((p) => ep.path.toLowerCase().includes(p));
  }

  private isJWT(ep: Endpoint): boolean {
    const headers = ep.headers || [];
    return JWT_PATTERNS.some((p) => ep.path.toLowerCase().includes(p) || headers.some((h) => h.toLowerCase().includes(p)));
  }

  private isStatic(ep: Endpoint): boolean {
    const staticExts = [".html", ".css", ".js", ".png", ".jpg", ".svg", ".ico", ".woff", ".json"];
    return staticExts.some((ext) => ep.path.endsWith(ext));
  }
}
