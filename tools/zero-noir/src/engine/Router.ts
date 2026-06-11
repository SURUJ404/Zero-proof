import { Endpoint, ScanResult, ServiceDef } from "./types.js";

export interface RouteMatch {
  methods?: string[];
  tags?: string[];
  path?: string;
  service?: string;
}

export type RouteAction =
  | { type: "deliver"; target: "zap" | "burp" | "webhook"; url?: string }
  | { type: "split"; format: string; file: string }
  | { type: "exclude" }
  | { type: "tag"; add: string[] }
  | { type: "reroute"; path: string; method?: string };

export interface RouteRule {
  name?: string;
  match: RouteMatch;
  action: RouteAction;
}

export interface RouteResult {
  matched: Endpoint[];
  excluded: Endpoint[];
  split: Record<string, Endpoint[]>;
  deliveries: { target: string; url?: string; endpoints: Endpoint[] }[];
  tagged: { add: string[]; endpoints: Endpoint[] }[];
  rerouted: { from: Endpoint; to: Endpoint }[];
}

export function parseRouteRule(input: string): RouteRule {
  const [matchPart, actionPart] = input.split("->").map((s) => s.trim());
  if (!matchPart || !actionPart) {
    throw new Error(`Invalid route rule: "${input}". Use format: field=value -> action:param`);
  }

  const match: RouteMatch = {};
  for (const clause of matchPart.split(",")) {
    const eqIdx = clause.indexOf("=");
    if (eqIdx === -1) throw new Error(`Invalid match clause: "${clause}" in rule "${input}"`);
    const key = clause.slice(0, eqIdx).trim();
    const val = clause.slice(eqIdx + 1).trim();
    if (key === "method") match.methods = val.split("|").map((s) => s.trim().toUpperCase());
    else if (key === "tag") match.tags = val.split("|").map((s) => s.trim());
    else if (key === "path") match.path = val;
    else if (key === "service") match.service = val;
    else throw new Error(`Unknown match field: "${key}" in rule "${input}"`);
  }

  const actionStr = actionPart.toLowerCase();
  if (actionStr === "exclude") {
    return { match, action: { type: "exclude" } };
  }

  if (actionStr.startsWith("deliver:")) {
    const target = actionStr.slice(8).trim() as "zap" | "burp" | "webhook";
    if (target !== "zap" && target !== "burp" && target !== "webhook") {
      throw new Error(`Invalid deliver target: "${target}". Use zap, burp, or webhook`);
    }
    return { match, action: { type: "deliver", target } };
  }

  if (actionStr.startsWith("split:")) {
    const params = actionStr.slice(6).trim();
    const fileMatch = params.match(/file=([^\s,]+)/);
    const fmtMatch = params.match(/format=([^\s,]+)/);
    return {
      match,
      action: {
        type: "split",
        file: fileMatch?.[1] || `${match.tags?.[0] || "routes"}.json`,
        format: fmtMatch?.[1] || "json",
      },
    };
  }

  if (actionStr.startsWith("tag:")) {
    const tags = actionStr.slice(4).split(",").map((s) => s.trim());
    return { match, action: { type: "tag", add: tags } };
  }

  if (actionStr.startsWith("reroute:")) {
    const params = actionStr.slice(8).trim();
    const pathMatch = params.match(/path=([^\s,]+)/);
    const methodMatch = params.match(/method=([^\s,]+)/);
    if (!pathMatch) throw new Error(`reroute requires path= parameter`);
    return {
      match,
      action: {
        type: "reroute",
        path: pathMatch[1],
        method: methodMatch?.[1],
      },
    };
  }

  throw new Error(`Unknown action: "${actionPart}". Use deliver:, split:, exclude, tag:, or reroute:`);
}

function pathMatches(pattern: string, actual: string): boolean {
  if (pattern === actual) return true;
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, ".");
  return new RegExp(`^${regexStr}$`).test(actual);
}

function endpointMatchesRule(ep: Endpoint, match: RouteMatch): boolean {
  if (match.methods && !match.methods.includes(ep.method)) return false;
  if (match.tags && !match.tags.some((t) => ep.tags.includes(t))) return false;
  if (match.path && !pathMatches(match.path, ep.path)) return false;
  if (match.service && ep.service !== match.service) return false;
  return true;
}

export class Router {
  private rules: RouteRule[];

  constructor(rules: RouteRule[] = []) {
    this.rules = rules;
  }

  apply(result: ScanResult): { routed: RouteResult; remaining: ScanResult } {
    const matched: Endpoint[] = [];
    const excluded: Endpoint[] = [];
    const split: Record<string, Endpoint[]> = {};
    const deliveries: { target: string; url?: string; endpoints: Endpoint[] }[] = [];
    const tagged: { add: string[]; endpoints: Endpoint[] }[] = [];
    const rerouted: { from: Endpoint; to: Endpoint }[] = [];
    const handled = new Set<Endpoint>();

    for (const rule of this.rules) {
      for (const service of result.services) {
        for (const ep of service.endpoints) {
          if (handled.has(ep)) continue;
          if (!endpointMatchesRule(ep, rule.match)) continue;

          const action = rule.action;

          if (action.type === "exclude") {
            excluded.push(ep);
            handled.add(ep);
          } else if (action.type === "deliver") {
            deliveries.push({ target: action.target, url: action.url, endpoints: [ep] });
            matched.push(ep);
            handled.add(ep);
          } else if (action.type === "split") {
            const key = action.file;
            if (!split[key]) split[key] = [];
            split[key].push(ep);
            matched.push(ep);
            handled.add(ep);
          } else if (action.type === "tag") {
            ep.tags.push(...action.add.filter((t) => !ep.tags.includes(t)));
            tagged.push({ add: action.add, endpoints: [ep] });
            matched.push(ep);
            handled.add(ep);
          } else if (action.type === "reroute") {
            const original = { ...ep };
            ep.path = action.path;
            if (action.method) ep.method = action.method;
            rerouted.push({ from: original, to: ep });
            matched.push(ep);
            handled.add(ep);
          }
        }
      }
    }

    const routed: RouteResult = { matched, excluded, split, deliveries, tagged, rerouted };

    const remainingEps = new Set<Endpoint>();
    for (const svc of result.services) {
      for (const ep of svc.endpoints) {
        if (!handled.has(ep)) remainingEps.add(ep);
      }
    }

    const remaining: ScanResult = {
      ...result,
      services: result.services
        .map((svc) => ({
          ...svc,
          endpoints: svc.endpoints.filter((ep) => remainingEps.has(ep)),
        }))
        .filter((svc) => svc.endpoints.length > 0),
      totalEndpoints: remainingEps.size,
    };

    return { routed, remaining };
  }
}
