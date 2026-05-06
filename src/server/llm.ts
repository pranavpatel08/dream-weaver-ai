// OpenAI-compatible LLM client. Works against:
//   - Lovable AI Gateway (https://ai.gateway.lovable.dev/v1)
//   - NVIDIA NIM (https://integrate.api.nvidia.com/v1)
//   - OpenAI (https://api.openai.com/v1)
//   - Together, Groq, etc. — anything chat-completions compatible.
//
// Provides three modes:
//   complete()      — single non-streaming response
//   structured()    — single response forced to JSON, parsed via zod schema
//   streamComplete() — async iterator of token chunks (SSE)

import { z } from "zod";
import { getEnv } from "./env";

export type Role = "system" | "user" | "assistant";
export type Message = { role: Role; content: string };

export type LlmOpts = {
  model?: string;
  messages: Message[];
  temperature?: number;
  maxTokens?: number;
  tier?: "coordinator" | "worker";
};

class LlmError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
  ) {
    super(`LLM call failed: ${status} ${body.slice(0, 200)}`);
    this.name = "LlmError";
  }
}

function pickModel(opts: LlmOpts): string {
  if (opts.model) return opts.model;
  const env = getEnv();
  return opts.tier === "worker" ? env.llm.workerModel : env.llm.coordinatorModel;
}

async function callChat(opts: LlmOpts, body: Record<string, unknown>) {
  const env = getEnv();
  if (!env.llm.apiKey) {
    throw new Error("LLM_API_KEY is not set. Configure .env.local for your chosen provider.");
  }
  const res = await fetch(`${env.llm.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${env.llm.apiKey}`,
    },
    body: JSON.stringify({
      model: pickModel(opts),
      messages: opts.messages,
      temperature: opts.temperature ?? 0.4,
      max_tokens: opts.maxTokens ?? 1024,
      ...body,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new LlmError(res.status, text);
  }
  return res;
}

export async function complete(opts: LlmOpts): Promise<string> {
  const res = await callChat(opts, {});
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  return data.choices[0]?.message?.content ?? "";
}

/**
 * Asks the LLM to return a JSON object matching `schema` and parses it.
 * Uses `response_format: json_object` for providers that support it; falls
 * back to extracting the first JSON block from the response otherwise.
 */
export async function structured<T>(schema: z.ZodType<T>, opts: LlmOpts): Promise<T> {
  const env = getEnv();
  if (env.mockLlm) {
    throw new Error("structured() called with MOCK_LLM=1. Provide a mock or disable MOCK_LLM.");
  }

  const sys: Message = {
    role: "system",
    content:
      "Return ONLY a single valid JSON object that matches the schema described in the user message. No prose, no code fences.",
  };
  const messages = [
    sys,
    ...opts.messages.filter((m) => m.role !== "system"),
    ...opts.messages
      .filter((m) => m.role === "system")
      .map((m) => ({ role: "system" as const, content: m.content })),
  ];

  const res = await callChat(
    { ...opts, messages },
    {
      response_format: { type: "json_object" },
    },
  );
  const data = (await res.json()) as {
    choices: { message: { content: string } }[];
  };
  const raw = data.choices[0]?.message?.content ?? "{}";
  const parsed = parseFirstJsonObject(raw);
  return schema.parse(parsed);
}

function parseFirstJsonObject(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    // Tolerate code fences or stray prose.
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(raw.slice(start, end + 1));
    }
    throw new Error(`LLM did not return JSON: ${raw.slice(0, 200)}`);
  }
}

/** Streams text deltas from the LLM (OpenAI-style SSE). */
export async function* streamComplete(opts: LlmOpts): AsyncGenerator<string> {
  const res = await callChat(opts, { stream: true });
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const raw of lines) {
      const line = raw.trim();
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (payload === "[DONE]") return;
      try {
        const obj = JSON.parse(payload) as {
          choices?: { delta?: { content?: string } }[];
        };
        const delta = obj.choices?.[0]?.delta?.content;
        if (delta) yield delta;
      } catch {
        /* ignore keep-alive lines */
      }
    }
  }
}
