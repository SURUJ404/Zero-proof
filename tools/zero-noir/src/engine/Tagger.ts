import { Endpoint, TagSummary } from "./types.js";

export class Tagger {
  tag(endpoints: Endpoint[]): Endpoint[] {
    for (const ep of endpoints) {
      if (!this.hasTag(ep, "shadow") && this.isShadow(ep)) {
        ep.tags.push("shadow");
      }
      if (!this.hasTag(ep, "deprecated") && this.isDeprecated(ep)) {
        ep.tags.push("deprecated");
      }
      if (this.isAuthenticated(ep) && !this.hasTag(ep, "authenticated")) {
        ep.tags.push("authenticated");
      }
      if (this.isConfigEndpoint(ep) && !this.hasTag(ep, "config")) {
        ep.tags.push("config");
      }
      if (this.isProverEndpoint(ep) && !this.hasTag(ep, "prover")) {
        ep.tags.push("prover");
      }
      if (this.isVerifierEndpoint(ep) && !this.hasTag(ep, "verifier")) {
        ep.tags.push("verifier");
      }
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
    };
  }

  private hasTag(ep: Endpoint, tag: string): boolean {
    return ep.tags.includes(tag);
  }

  private isShadow(ep: Endpoint): boolean {
    const path = ep.path.toLowerCase();
    return (
      path.includes("admin") ||
      path.includes("internal") ||
      path.includes("debug") ||
      path.includes("private") ||
      path.includes("test") ||
      path.includes("dev") ||
      path.includes("shadow") ||
      path.includes("hidden") ||
      path.includes("staging")
    );
  }

  private isDeprecated(ep: Endpoint): boolean {
    return (
      ep.path.toLowerCase().includes("deprecated") ||
      ep.path.toLowerCase().includes("v0") ||
      ep.path.toLowerCase().includes("old") ||
      ep.path.toLowerCase().includes("legacy")
    );
  }

  private isAuthenticated(ep: Endpoint): boolean {
    const headers = ep.headers || [];
    return (
      ep.tags.includes("auth") ||
      headers.some((h) => h.toLowerCase().includes("authorization")) ||
      headers.some((h) => h.toLowerCase().includes("api-key")) ||
      headers.some((h) => h.toLowerCase().includes("token"))
    );
  }

  private isConfigEndpoint(ep: Endpoint): boolean {
    const path = ep.path.toLowerCase();
    return path.includes("config") || path.includes("settings");
  }

  private isProverEndpoint(ep: Endpoint): boolean {
    return ep.path.toLowerCase().includes("prove");
  }

  private isVerifierEndpoint(ep: Endpoint): boolean {
    return ep.path.toLowerCase().includes("verify");
  }
}
