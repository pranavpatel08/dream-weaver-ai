// Orchestrator: coordinator picks agents → fan-out → synthesizer.
// All progress streams through run-store to anyone subscribed.

import { z } from "zod";
import { getEnv } from "./env";
import { complete, structured } from "./llm";
import {
  appendCard,
  appendSource,
  emitSynthDelta,
  finishAgent,
  logAgent,
  queueAgent,
  setRunStatus,
  setSynthesis,
  startAgent,
} from "./run-store";
import { AGENT_BY_ID, agentsForMode, publicAgentMeta } from "./agents/registry";
import { makeJob } from "./agents/types";
import type { AgentId, AgentPlan, RunMode, Synthesis } from "./types";

const PER_AGENT_TIMEOUT_MS = 90_000;

const planSchema = z.object({
  rationale: z.string().default(""),
  items: z
    .array(
      z.object({
        agentId: z.string(),
        intent: z.string(),
      }),
    )
    .min(1)
    .max(8),
});

export async function runOrchestrator(runId: string, prompt: string, mode: RunMode) {
  setRunStatus(runId, "running");
  try {
    const plan = await pickPlan(prompt, mode);

    // Materialize jobs in the store so the UI shows them up front.
    for (const item of plan.items) {
      const mod = AGENT_BY_ID[item.agentId as AgentId];
      if (!mod) continue;
      queueAgent(runId, makeJob(mod.id, item.intent, mod.actorIds));
    }

    // Fan out — every agent runs in parallel, isolated failures.
    await Promise.all(
      plan.items.map(async (item) => {
        const mod = AGENT_BY_ID[item.agentId as AgentId];
        if (!mod) return;

        startAgent(runId, mod.id);
        try {
          await withTimeout(
            mod.run({
              runId,
              intent: item.intent,
              prompt,
              emit: {
                card: (c) => appendCard(runId, mod.id, c),
                source: (s) => appendSource(runId, mod.id, s),
                log: (m) => logAgent(runId, mod.id, m),
              },
            }),
            PER_AGENT_TIMEOUT_MS,
          );
          finishAgent(runId, mod.id, "done");
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          finishAgent(runId, mod.id, "error", msg.slice(0, 240));
        }
      }),
    );

    // Synthesis pass.
    setRunStatus(runId, "synthesizing");
    const synthesis = await synthesize(runId, prompt, mode);
    setSynthesis(runId, synthesis);
    setRunStatus(runId, "done");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logAgent(runId, "synthesizer" as AgentId, `Run failed: ${msg.slice(0, 200)}`);
    setRunStatus(runId, "error");
  }
}

async function pickPlan(prompt: string, mode: RunMode): Promise<AgentPlan> {
  const env = getEnv();
  const available = agentsForMode(mode);
  const fallback: AgentPlan = {
    rationale: "Default fan-out (no LLM key).",
    items: available.map((a) => ({
      agentId: a.id,
      intent: defaultIntent(a.id, prompt, mode),
    })),
  };
  if (!env.llm.apiKey || env.mockLlm) return fallback;

  try {
    const meta = publicAgentMeta()
      .filter((m) => available.some((a) => a.id === m.id))
      .map((m) => `- ${m.id}: ${m.label} — ${m.description} (Apify: ${m.actorIds.join(", ")})`)
      .join("\n");

    const plan = await structured(planSchema, {
      tier: "coordinator",
      temperature: 0.2,
      maxTokens: 600,
      messages: [
        {
          role: "system",
          content:
            "You are the coordinator for a Silicon Valley research swarm. Pick 4–6 agents from the available list to investigate the user's prompt. Each item must specify the exact agent id and a one-sentence intent. Respond as a single JSON object with keys: rationale, items[].",
        },
        {
          role: "user",
          content: `Mode: ${mode}\nPrompt: ${prompt}\n\nAvailable agents:\n${meta}\n\nReturn JSON: {"rationale": "...", "items": [{"agentId":"competitor-mapper","intent":"..."}, ...]}`,
        },
      ],
    });

    // Validate agent ids; drop unknowns.
    const filtered = plan.items.filter((i) =>
      available.some((a) => a.id === i.agentId),
    ) as AgentPlan["items"];
    if (!filtered.length) return fallback;
    return { rationale: plan.rationale ?? "", items: filtered };
  } catch {
    return fallback;
  }
}

function defaultIntent(id: AgentId, prompt: string, mode: RunMode): string {
  const topic = prompt.replace(/[?.!]+$/, "");
  switch (id) {
    case "competitor-mapper":
      return `Map competitive landscape for: ${topic}`;
    case "linkedin-company-scout":
      return `Find LinkedIn companies in: ${topic}`;
    case "founder-profiler":
      return `Surface founders/operators in: ${topic}`;
    case "funding-tracker":
      return `Recent funding rounds for: ${topic}`;
    case "youtube-listener":
      return `Find what podcasters/VCs say about: ${topic}`;
    case "sentiment-scout":
      return `Reddit + HN pulse on: ${topic}`;
    case "news-scout":
      return `Recent news in: ${topic}`;
    default:
      return mode === "founder" ? `Help build: ${topic}` : `Evaluate investment in: ${topic}`;
  }
}

async function synthesize(runId: string, prompt: string, mode: RunMode): Promise<Synthesis> {
  const env = getEnv();
  const empty: Synthesis = {
    summary:
      mode === "founder"
        ? "We mapped the space; review the cards on the right to plan your wedge."
        : "We mapped the space; review the cards on the right to form your thesis.",
    bullets: [
      "Competitor landscape mapped via Google + LinkedIn.",
      "Founder voices pulled from X/Twitter.",
      "Funding signal collected from public news.",
      "Sentiment sampled from Reddit + Hacker News.",
    ],
  };
  if (!env.llm.apiKey || env.mockLlm) return empty;

  // Stream the summary so the UI can show it filling in.
  const sys = `You are the synthesizer. Given the prompt and a JSON snapshot of all agent outputs, produce a tight ${
    mode === "founder" ? "founder-focused" : "investor-focused"
  } verdict in 5–8 bullets, each ≤140 chars. Then ${
    mode === "founder"
      ? "list a 3-phase roadmap (Now / Next / Later) of 2 items each"
      : "give a verdict (label one of: 'Strong yes' | 'Yes with caveats' | 'Lean no' | 'Pass'), a 0–100 confidence, and a 2-sentence reasoning"
  }. Respond as JSON: ${
    mode === "founder"
      ? '{"summary":"...","bullets":["..."],"roadmap":[{"phase":"Now","items":["..."]}, ...]}'
      : '{"summary":"...","bullets":["..."],"verdict":{"label":"...","confidence":75,"reasoning":"..."}}'
  }.`;

  // Stream summary text first for the UI delta animation.
  try {
    const text = await complete({
      tier: "coordinator",
      temperature: 0.3,
      maxTokens: 800,
      messages: [
        { role: "system", content: sys },
        {
          role: "user",
          content: `Prompt: ${prompt}\nMode: ${mode}\n(Agent outputs summarized in the dashboard.)`,
        },
      ],
    });
    emitSynthDelta(runId, text.slice(0, 400));

    const parsed = parseJson(text) as Partial<Synthesis> | null;
    if (parsed && parsed.summary && parsed.bullets) {
      return {
        summary: parsed.summary,
        bullets: parsed.bullets,
        verdict: parsed.verdict,
        roadmap: parsed.roadmap,
      };
    }
  } catch {
    /* fall through to empty */
  }
  return empty;
}

function parseJson(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    const start = s.indexOf("{");
    const end = s.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(s.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`Timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
