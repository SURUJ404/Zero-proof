import { Endpoint, AIContext } from "../types.js";

export interface LLMProvider {
  name: string;
  analyzeEndpoint(endpoint: Endpoint, sourceCode: string): Promise<AIContext>;
  generateSummary(endpoints: Endpoint[]): Promise<string>;
  suggestTags(endpoint: Endpoint, sourceCode: string): Promise<string[]>;
}

export class OpenAIProvider implements LLMProvider {
  readonly name = "openai";
  private apiKey: string;
  private model: string;
  private baseUrl: string;

  constructor(options?: { apiKey?: string; model?: string; baseUrl?: string }) {
    this.apiKey = options?.apiKey || process.env.OPENAI_API_KEY || "";
    this.model = options?.model || process.env.OPENAI_MODEL || "gpt-4o-mini";
    this.baseUrl = options?.baseUrl || "https://api.openai.com/v1";
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  async analyzeEndpoint(endpoint: Endpoint, sourceCode: string): Promise<AIContext> {
    if (!this.isConfigured()) {
      return { guards: [], sinks: [], validators: [], signals: [], callee: [] };
    }

    const prompt = `Analyze this API endpoint for security context:

Endpoint: ${endpoint.method} ${endpoint.path}
Source file: ${endpoint.source.file}:${endpoint.source.line}

Source code context:
${sourceCode.slice(0, 3000)}

Respond with JSON:
{
  "guards": ["authorization checks, middleware"],
  "sinks": ["dangerous function calls (exec, eval, SQL)"],
  "validators": ["input validation functions"],
  "signals": ["security-relevant indicators"],
  "riskLevel": "low|medium|high|critical"
}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "You are a security-focused code analyzer. Return ONLY valid JSON." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) {
        return { guards: [], sinks: [], validators: [], signals: [], callee: [] };
      }

      const data = await response.json() as any;
      const result = JSON.parse(data.choices[0].message.content);
      return {
        guards: result.guards || [],
        sinks: result.sinks || [],
        validators: result.validators || [],
        signals: result.signals || [],
        callee: [],
        riskLevel: result.riskLevel || "low",
      };
    } catch {
      return { guards: [], sinks: [], validators: [], signals: [], callee: [] };
    }
  }

  async generateSummary(endpoints: Endpoint[]): Promise<string> {
    if (!this.isConfigured() || endpoints.length === 0) return "";

    const summary = endpoints.slice(0, 50).map(
      (e) => `${e.method} ${e.path} [${e.tags.join(", ")}]`
    ).join("\n");

    const prompt = `Summarize the attack surface from these endpoints in 2-3 sentences:

${summary}`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "You are a security engineer analyzing API attack surface." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
        }),
      });

      if (!response.ok) return "";
      const data = await response.json() as any;
      return data.choices[0].message.content || "";
    } catch {
      return "";
    }
  }

  async suggestTags(endpoint: Endpoint, sourceCode: string): Promise<string[]> {
    if (!this.isConfigured()) return [];

    const prompt = `Suggest security tags for this API endpoint:
${endpoint.method} ${endpoint.path}
Context: ${sourceCode.slice(0, 1000)}

Return JSON array of tags from: ["auth", "admin", "public", "internal", "file-upload", "graphql", "jwt", "websocket", "sensitive", "debug", "health"]`;

    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: "Return only a JSON array of strings." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
          response_format: { type: "json_object" },
        }),
      });

      if (!response.ok) return [];
      const data = await response.json() as any;
      const result = JSON.parse(data.choices[0].message.content);
      return Array.isArray(result.tags) ? result.tags : [];
    } catch {
      return [];
    }
  }
}

export class OllamaProvider implements LLMProvider {
  readonly name = "ollama";
  private baseUrl: string;
  private model: string;

  constructor(options?: { baseUrl?: string; model?: string }) {
    this.baseUrl = options?.baseUrl || process.env.OLLAMA_URL || "http://localhost:11434";
    this.model = options?.model || process.env.OLLAMA_MODEL || "llama3.2";
  }

  async analyzeEndpoint(endpoint: Endpoint, sourceCode: string): Promise<AIContext> {
    const prompt = `Analyze security context for ${endpoint.method} ${endpoint.path}.
Source: ${sourceCode.slice(0, 2000)}
Return JSON: {"guards":[],"sinks":[],"validators":[],"signals":[],"riskLevel":"low"}`;

    try {
      const response = await fetch(`${this.baseUrl}/api/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: this.model,
          prompt,
          stream: false,
        }),
      });

      if (!response.ok) return { guards: [], sinks: [], validators: [], signals: [], callee: [] };
      const data = await response.json() as any;
      try {
        return JSON.parse(data.response);
      } catch {
        return { guards: [], sinks: [], validators: [], signals: [], callee: [] };
      }
    } catch {
      return { guards: [], sinks: [], validators: [], signals: [], callee: [] };
    }
  }

  async generateSummary(endpoints: Endpoint[]): Promise<string> {
    return "";
  }

  async suggestTags(endpoint: Endpoint, sourceCode: string): Promise<string[]> {
    return [];
  }
}

export function createLLMProvider(type?: string): LLMProvider | null {
  const provider = type || process.env.AI_PROVIDER || "";
  const key = process.env.OPENAI_API_KEY;

  if (provider === "ollama") return new OllamaProvider();
  if (key) return new OpenAIProvider();

  const ollamaUrl = process.env.OLLAMA_URL;
  if (ollamaUrl) return new OllamaProvider();

  return null;
}
