import { Endpoint, ScanResult } from "./types.js";

interface FilterExpr {
  field: string;
  values: string[];
}

const FILTER_FIELDS = ["method", "path", "tag", "service", "tech", "auth", "risk"] as const;
type FilterField = (typeof FILTER_FIELDS)[number];

export function parseFilters(raw: string[]): FilterExpr[] {
  return raw.map((f) => {
    const eqIdx = f.indexOf("=");
    if (eqIdx === -1) throw new Error(`Invalid filter: "${f}" — use field=value syntax`);
    const field = f.slice(0, eqIdx).trim().toLowerCase();
    const vals = f.slice(eqIdx + 1).split(",").map((v) => v.trim()).filter(Boolean);
    if (!vals.length) throw new Error(`Invalid filter: "${f}" — no values provided`);
    if (!(FILTER_FIELDS as readonly string[]).includes(field)) {
      throw new Error(`Unknown filter field: "${field}" — valid fields: ${FILTER_FIELDS.join(", ")}`);
    }
    return { field: field as FilterField, values: vals };
  });
}

function matchExpr(ep: Endpoint, expr: FilterExpr): boolean {
  switch (expr.field) {
    case "method":
      return expr.values.some((v) => ep.method.toLowerCase() === v.toLowerCase());
    case "path":
      return expr.values.some((v) => {
        const glob = v.replace(/\*\*/g, "(.+)").replace(/\*/g, "[^/]+").replace(/\?/g, ".");
        return new RegExp(`^${glob}$`, "i").test(ep.path);
      });
    case "tag":
      return expr.values.some((v) => ep.tags.some((t) => t.toLowerCase() === v.toLowerCase()));
    case "service":
      return expr.values.some((v) => ep.service.toLowerCase() === v.toLowerCase());
    case "tech":
      return expr.values.some((v) => (ep.technology || "").toLowerCase() === v.toLowerCase());
    case "auth":
      return expr.values.some((v) => (ep.auth || "").toLowerCase() === v.toLowerCase());
    case "risk":
      return expr.values.some((v) => (ep.aiContext?.riskLevel || "").toLowerCase() === v.toLowerCase());
    default:
      return false;
  }
}

export function applyFilters(result: ScanResult, exprs: FilterExpr[]): ScanResult {
  if (!exprs.length) return result;

  const filtered: Endpoint[] = [];
  for (const service of result.services) {
    for (const ep of service.endpoints) {
      if (exprs.every((e) => matchExpr(ep, e))) {
        filtered.push(ep);
      }
    }
  }

  const matched = new Set(filtered);

  const newServices = result.services
    .map((s) => ({
      ...s,
      endpoints: s.endpoints.filter((ep) => matched.has(ep)),
    }))
    .filter((s) => s.endpoints.length > 0);

  const tagCounts: Record<string, Set<string>> = {};
  for (const ep of filtered) {
    for (const t of ep.tags) {
      if (!tagCounts[t]) tagCounts[t] = new Set();
      tagCounts[t].add(ep.service);
    }
  }

  const newTags = {
    shadow: (tagCounts.shadow?.size ?? 0) > 0 ? (tagCounts.shadow?.size ?? 0) : 0,
    deprecated: (tagCounts.deprecated?.size ?? 0) > 0 ? (tagCounts.deprecated?.size ?? 0) : 0,
    authenticated: (tagCounts.authenticated?.size ?? 0) > 0 ? (tagCounts.authenticated?.size ?? 0) : 0,
    websocket: (tagCounts.websocket?.size ?? 0) > 0 ? (tagCounts.websocket?.size ?? 0) : 0,
    static: tagCounts.static?.size ?? 0,
    callee: tagCounts.callee?.size ?? 0,
    aiContext: tagCounts["ai-context"]?.size ?? 0,
    prover: tagCounts.prover?.size ?? 0,
    verifier: tagCounts.verifier?.size ?? 0,
    health: tagCounts.health?.size ?? 0,
    graphql: tagCounts.graphql?.size ?? 0,
    jwt: tagCounts.jwt?.size ?? 0,
    fileUpload: tagCounts["file-upload"]?.size ?? 0,
  };

  return {
    ...result,
    services: newServices,
    totalEndpoints: filtered.length,
    tags: newTags,
  };
}

export function listFilterFields(): string {
  const lines = FILTER_FIELDS.map((f) => {
    const descs: Record<string, string> = {
      method: "HTTP method (GET, POST, PUT, DELETE, PATCH, etc.)",
      path: "URL path pattern (supports * and ** glob)",
      tag: "Endpoint tag (shadow, deprecated, authenticated, health, etc.)",
      service: "Service name (api-service, web-app, etc.)",
      tech: "Technology (javascript:express, python:flask, etc.)",
      auth: "Auth type (jwt, basic, oauth, etc.)",
      risk: "Risk level (low, medium, high, critical)",
    };
    return `  ${f.padEnd(10)} ${descs[f]}`;
  });
  return [
    "Available filter fields for --filter:",
    "",
    "Syntax: --filter <field>=<value>[,<value>...]",
    "  Multiple --filter flags are ANDed together",
    "  Comma-separated values within a field are ORed",
    "",
    "Examples:",
    '  --filter "method=POST"',
    '  --filter "method=GET,POST"',
    '  --filter "tag=shadow"',
    '  --filter "path=/api/**"',
    '  --filter "method=POST" --filter "tag=shadow"',
    "",
    ...lines,
  ].join("\n");
}
