import { describe, expect, it } from "vitest";
import { OpenAiResponsesGateway } from "./openai-gateway";

function responseWith(outputText: string, status = 200): Response {
  return new Response(JSON.stringify({ output_text: outputText }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("OpenAiResponsesGateway", () => {
  it("keeps the provider secret server-side and disables provider-side storage", async () => {
    const requests: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: typeof fetch = async (url, init) => {
      requests.push({ url: String(url), init });
      return responseWith("project_risk");
    };
    const gateway = new OpenAiResponsesGateway({
      apiKey: "server-secret",
      model: "configured-model",
      fetchImpl,
    });

    await expect(gateway.classifyIntent("What changed?")).resolves.toBe("project_risk");
    expect(requests).toHaveLength(1);
    expect(requests[0]?.url).toBe("https://api.openai.com/v1/responses");
    const headers = requests[0]?.init?.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer server-secret");
    const body = JSON.parse(String(requests[0]?.init?.body)) as { model: string; store: boolean; input: string };
    expect(body.model).toBe("configured-model");
    expect(body.store).toBe(false);
    expect(body.input).not.toContain("server-secret");
  });

  it("rejects a tool plan that asks for a tool the product did not authorize", async () => {
    const fetchImpl: typeof fetch = async () => responseWith('[{"tool":"unregistered_tool","args":{}}]');
    const gateway = new OpenAiResponsesGateway({ apiKey: "secret", model: "model", fetchImpl });

    await expect(gateway.plan({
      question: "Compare the finalists",
      intent: "compare_candidates",
      availableTools: ["compare_candidates"],
    })).rejects.toThrow(/unavailable tool/);
  });

  it("parses missing information without inventing a source reference", async () => {
    const fetchImpl: typeof fetch = async () => responseWith(JSON.stringify({
      intent: "utility_gap",
      sections: [{
        classification: "MISSING_INFORMATION",
        text: "Authoritative utility capacity is not available.",
        sourceRefs: [],
      }],
    }));
    const gateway = new OpenAiResponsesGateway({ apiKey: "secret", model: "model", fetchImpl });

    const answer = await gateway.answer({
      question: "Does Site A have enough electric capacity?",
      intent: "utility_gap",
      grounding: [],
    });
    expect(answer.sections[0]?.classification).toBe("MISSING_INFORMATION");
    expect(answer.sections[0]?.sourceRefs).toEqual([]);
  });

  it("returns a concise provider error without echoing response bodies", async () => {
    const fetchImpl: typeof fetch = async () => responseWith("sensitive provider body", 503);
    const gateway = new OpenAiResponsesGateway({ apiKey: "secret", model: "model", fetchImpl });

    await expect(gateway.classifyIntent("Question"))
      .rejects.toThrow("AI provider request failed with status 503");
  });
});
