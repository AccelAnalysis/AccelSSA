import type { Principal } from "./types.js";

export type AiStatementClass =
  | "KNOWN_FACT"
  | "CALCULATED_RESULT"
  | "CONSULTANT_JUDGMENT"
  | "AI_INFERENCE"
  | "MISSING_INFORMATION";

export interface AiToolContext {
  principal: Principal;
  projectId: string;
  correlationId: string;
}

export interface AiToolResult {
  data: unknown;
  sourceRefs: readonly string[];
}

export interface AiTool {
  name: string;
  authorize(context: AiToolContext, args: unknown): Promise<boolean> | boolean;
  execute(context: AiToolContext, args: unknown): Promise<AiToolResult>;
}

export interface AiToolCall {
  tool: string;
  args: unknown;
}

export interface AiAnswerSection {
  classification: AiStatementClass;
  text: string;
  sourceRefs: readonly string[];
}

export interface AiAnswer {
  intent: string;
  sections: readonly AiAnswerSection[];
}

export interface AiModelGateway {
  classifyIntent(question: string): Promise<string>;
  plan(input: { question: string; intent: string; availableTools: readonly string[] }): Promise<readonly AiToolCall[]>;
  answer(input: {
    question: string;
    intent: string;
    grounding: readonly { call: AiToolCall; result: AiToolResult }[];
  }): Promise<AiAnswer>;
}

export class AiToolRegistry {
  readonly #tools = new Map<string, AiTool>();

  register(tool: AiTool): void {
    if (this.#tools.has(tool.name)) throw new Error(`AI tool already registered: ${tool.name}`);
    this.#tools.set(tool.name, tool);
  }

  names(): string[] {
    return [...this.#tools.keys()];
  }

  async invoke(name: string, context: AiToolContext, args: unknown): Promise<AiToolResult> {
    const tool = this.#tools.get(name);
    if (!tool) throw new Error(`Unknown AI tool: ${name}`);
    if (!(await tool.authorize(context, args))) throw new Error(`AI tool access denied: ${name}`);
    return tool.execute(context, args);
  }
}

export class GroundedAiService {
  constructor(
    private readonly tools: AiToolRegistry,
    private readonly gateway: AiModelGateway,
  ) {}

  async ask(input: {
    question: string;
    context: AiToolContext;
  }): Promise<AiAnswer> {
    if (!input.context.principal.projectIds.has(input.context.projectId)) {
      throw new Error("AI project access denied");
    }

    const intent = await this.gateway.classifyIntent(input.question);
    const calls = await this.gateway.plan({
      question: input.question,
      intent,
      availableTools: this.tools.names(),
    });

    const grounding: { call: AiToolCall; result: AiToolResult }[] = [];
    for (const call of calls) {
      grounding.push({ call, result: await this.tools.invoke(call.tool, input.context, call.args) });
    }

    const answer = await this.gateway.answer({ question: input.question, intent, grounding });
    validateGroundedAnswer(answer, grounding.flatMap((item) => item.result.sourceRefs));
    return answer;
  }
}

export function validateGroundedAnswer(answer: AiAnswer, availableSourceRefs: readonly string[]): void {
  const available = new Set(availableSourceRefs);
  for (const section of answer.sections) {
    if (section.classification !== "MISSING_INFORMATION" && section.sourceRefs.length === 0) {
      throw new Error(`${section.classification} sections require at least one source reference`);
    }
    for (const sourceRef of section.sourceRefs) {
      if (!available.has(sourceRef)) {
        throw new Error(`AI answer cited a source that was not retrieved: ${sourceRef}`);
      }
    }
  }
}
