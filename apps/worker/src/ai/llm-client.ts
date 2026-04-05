import type { ZodType } from "zod";

export type Provider = "anthropic" | "openai" | "mock";

export interface LLMCallOptions<T> {
  provider?: Provider;
  model?: string;
  systemPrompt: string;
  userPrompt: string;
  responseSchema: ZodType<T>;
  maxTokens?: number;
}

export interface LLMCallResult<T> {
  parsed: T;
  inputTokens: number;
  outputTokens: number;
  model: string;
}

// Mock responder registry — tests set these to stub out LLM responses.
type MockResponder = (
  systemPrompt: string,
  userPrompt: string,
) => unknown;

let mockResponder: MockResponder | null = null;
export function setMockResponder(fn: MockResponder | null) {
  mockResponder = fn;
}

const DEFAULT_PROVIDER: Provider = (process.env.AI_PROVIDER as Provider) ?? "mock";
const DEFAULT_DECISION_MODEL =
  process.env.AI_DECISION_MODEL ??
  (DEFAULT_PROVIDER === "openai" ? "gpt-4o-mini" : "claude-haiku-4-5");
const DEFAULT_CREATIVE_MODEL =
  process.env.AI_CREATIVE_MODEL ??
  (DEFAULT_PROVIDER === "openai" ? "gpt-4o" : "claude-sonnet-4-6");

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function callLLM<T>(
  opts: LLMCallOptions<T>,
): Promise<LLMCallResult<T> | null> {
  const provider = opts.provider ?? DEFAULT_PROVIDER;
  const model = opts.model ?? DEFAULT_DECISION_MODEL;

  // Mock provider: used in tests & when no API key configured.
  if (provider === "mock" || mockResponder) {
    if (!mockResponder) {
      return null;
    }
    const raw = mockResponder(opts.systemPrompt, opts.userPrompt);
    const result = opts.responseSchema.safeParse(raw);
    if (!result.success) return null;
    const inputTokens = approxTokens(opts.systemPrompt + opts.userPrompt);
    const outputTokens = approxTokens(JSON.stringify(raw));
    return { parsed: result.data, inputTokens, outputTokens, model };
  }

  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { json, inputTokens, outputTokens } = await callProvider(
        provider,
        model,
        opts,
      );
      const result = opts.responseSchema.safeParse(json);
      if (!result.success) {
        lastErr = result.error;
        continue;
      }
      return { parsed: result.data, inputTokens, outputTokens, model };
    } catch (e) {
      lastErr = e;
      await sleep(1000 * Math.pow(2, attempt));
    }
  }
  console.warn("[llm] call failed after retries:", lastErr);
  return null;
}

async function callProvider<T>(
  provider: Provider,
  model: string,
  opts: LLMCallOptions<T>,
): Promise<{ json: unknown; inputTokens: number; outputTokens: number }> {
  if (provider === "anthropic") {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: opts.maxTokens ?? 1024,
        system: opts.systemPrompt,
        messages: [
          {
            role: "user",
            content:
              opts.userPrompt +
              "\n\nRespond ONLY with a valid JSON object matching the schema. No prose.",
          },
        ],
      }),
    });
    if (!res.ok) throw new Error(`anthropic ${res.status}`);
    const data = (await res.json()) as {
      content: { text: string }[];
      usage: { input_tokens: number; output_tokens: number };
    };
    const text = data.content?.[0]?.text ?? "";
    return {
      json: JSON.parse(extractJson(text)),
      inputTokens: data.usage.input_tokens,
      outputTokens: data.usage.output_tokens,
    };
  }

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("OPENAI_API_KEY not set");
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: opts.systemPrompt },
          { role: "user", content: opts.userPrompt },
        ],
      }),
    });
    if (!res.ok) throw new Error(`openai ${res.status}`);
    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage: { prompt_tokens: number; completion_tokens: number };
    };
    const text = data.choices[0]?.message.content ?? "";
    return {
      json: JSON.parse(text),
      inputTokens: data.usage.prompt_tokens,
      outputTokens: data.usage.completion_tokens,
    };
  }

  throw new Error(`unknown provider ${provider}`);
}

function extractJson(text: string): string {
  const m = text.match(/\{[\s\S]*\}/);
  return m ? m[0] : text;
}

function approxTokens(s: string): number {
  return Math.ceil(s.length / 4);
}

export const MODELS = {
  decision: DEFAULT_DECISION_MODEL,
  creative: DEFAULT_CREATIVE_MODEL,
};
