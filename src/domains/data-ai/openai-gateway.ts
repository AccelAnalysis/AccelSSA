import type {
  AiAnswer,
  AiAnswerSection,
  AiModelGateway,
  AiStatementClass,
  AiToolCall,
} from "@accelssa/data-ai-automation";

export interface OpenAiResponsesGatewayConfig {
  apiKey: string;
  model: string;
  fetchImpl?: typeof fetch;
}

type ResponsePayload = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
};

const statementClasses = new Set<AiStatementClass>([
  "KNOWN_FACT",
  "CALCULATED_RESULT",
  "CONSULTANT_JUDGMENT",
  "AI_INFERENCE",
  "MISSING_INFORMATION",
]);

function extractResponseText(payload: ResponsePayload): string {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  const parts = payload.output
    ?.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text" && typeof item.text === "string")
    .map((item) => item.text!.trim())
    .filter(Boolean) ?? [];
  if (parts.length === 0) throw new Error("AI provider returned no text output");
  return parts.join("\n");
}

function parseJson<T>(text: string): T {
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(trimmed) as T;
}

export class OpenAiResponsesGateway implements AiModelGateway {
  readonly #apiKey: string;
  readonly #model: string;
  readonly #fetch: typeof fetch;

  constructor(config: OpenAiResponsesGatewayConfig) {
    if (!config.apiKey.trim()) throw new Error("AI provider API key is required");
    if (!config.model.trim()) throw new Error("AI provider model is required");
    this.#apiKey = config.apiKey;
    this.#model = config.model;
    this.#fetch = config.fetchImpl ?? fetch;
  }

  async classifyIntent(question: string): Promise<string> {
    const text = await this.#request([
      "Classify this AccelSSA project question into a short snake_case intent.",
      "Return only the intent token. Do not answer the question.",
      `Question: ${question}`,
    ].join("\n"));
    const intent = text.trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_").replace(/^_+|_+$/g, "");
    return intent || "project_question";
  }

  async plan(input: {
    question: string;
    intent: string;
    availableTools: readonly string[];
  }): Promise<readonly AiToolCall[]> {
    const text = await this.#request([
      "Plan grounded AccelSSA data retrieval for the question below.",
      "Use only the tool names provided. Do not invent data or answer the question.",
      "Return only JSON: [{\"tool\":\"tool_name\",\"args\":{...}}]. Return [] when no tool is appropriate.",
      `Intent: ${input.intent}`,
      `Available tools: ${JSON.stringify(input.availableTools)}`,
      `Question: ${input.question}`,
    ].join("\n"));
    const calls = parseJson<unknown>(text);
    if (!Array.isArray(calls)) throw new Error("AI provider returned an invalid tool plan");
    return calls.map((call) => {
      if (!call || typeof call !== "object") throw new Error("AI provider returned an invalid tool call");
      const candidate = call as { tool?: unknown; args?: unknown };
      if (typeof candidate.tool !== "string" || !input.availableTools.includes(candidate.tool)) {
        throw new Error("AI provider requested an unavailable tool");
      }
      return { tool: candidate.tool, args: candidate.args ?? {} };
    });
  }

  async answer(input: {
    question: string;
    intent: string;
    grounding: readonly { call: AiToolCall; result: { data: unknown; sourceRefs: readonly string[] } }[];
  }): Promise<AiAnswer> {
    const text = await this.#request([
      "Answer the AccelSSA project question using only the supplied authorized grounding.",
      "Never create project facts, provider values, scores, risks, consultant judgments or source references that are not in grounding.",
      "If grounding cannot answer a point, classify that section as MISSING_INFORMATION and say what is missing.",
      "Return only JSON with this shape:",
      '{"intent":"...","sections":[{"classification":"KNOWN_FACT|CALCULATED_RESULT|CONSULTANT_JUDGMENT|AI_INFERENCE|MISSING_INFORMATION","text":"...","sourceRefs":["..."]}]}',
      "Every section except MISSING_INFORMATION must cite one or more sourceRefs present in grounding.",
      `Intent: ${input.intent}`,
      `Question: ${input.question}`,
      `Grounding: ${JSON.stringify(input.grounding)}`,
    ].join("\n"));

    const parsed = parseJson<{ intent?: unknown; sections?: unknown }>(text);
    if (!Array.isArray(parsed.sections)) throw new Error("AI provider returned an invalid grounded answer");
    const sections: AiAnswerSection[] = parsed.sections.map((raw) => {
      if (!raw || typeof raw !== "object") throw new Error("AI provider returned an invalid answer section");
      const section = raw as { classification?: unknown; text?: unknown; sourceRefs?: unknown };
      if (typeof section.classification !== "string" || !statementClasses.has(section.classification as AiStatementClass)) {
        throw new Error("AI provider returned an invalid answer classification");
      }
      if (typeof section.text !== "string" || !section.text.trim()) {
        throw new Error("AI provider returned an empty answer section");
      }
      if (!Array.isArray(section.sourceRefs) || !section.sourceRefs.every((ref) => typeof ref === "string")) {
        throw new Error("AI provider returned invalid source references");
      }
      return {
        classification: section.classification as AiStatementClass,
        text: section.text.trim(),
        sourceRefs: section.sourceRefs as string[],
      };
    });
    return { intent: typeof parsed.intent === "string" ? parsed.intent : input.intent, sections };
  }

  async #request(input: string): Promise<string> {
    const response = await this.#fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.#apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: this.#model, input, store: false }),
    });
    if (!response.ok) throw new Error(`AI provider request failed with status ${response.status}`);
    return extractResponseText(await response.json() as ResponsePayload);
  }
}

export function createConfiguredAiGateway(
  environment: Readonly<Record<string, string | undefined>> = process.env,
): OpenAiResponsesGateway | null {
  if (environment.ACCELSSA_AI_PROVIDER?.trim().toLowerCase() !== "openai") return null;
  const apiKey = environment.OPENAI_API_KEY?.trim();
  const model = environment.ACCELSSA_AI_MODEL?.trim();
  if (!apiKey || !model) return null;
  return new OpenAiResponsesGateway({ apiKey, model });
}
