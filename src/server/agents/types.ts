import type { AgentId, AgentJob, Card, Source } from "../types";

export type EmitFn = {
  card: (card: Card) => void;
  source: (source: Source) => void;
  log: (message: string) => void;
};

export type AgentRunCtx = {
  runId: string;
  intent: string;
  prompt: string;
  emit: EmitFn;
};

export type AgentModule = {
  id: AgentId;
  label: string;
  description: string;
  modes: ("founder" | "investor")[];
  color: string; // tailwind-friendly hex (used for UI dot/glow)
  icon: string; // lucide icon name (resolved on the client)
  actorIds: string[];
  /**
   * Runs the agent. Pure function of inputs; reports progress via emit.
   * Resolves when the agent is done (success or no-op). Throwing here
   * marks the AgentJob as `error` in the run store.
   */
  run: (ctx: AgentRunCtx) => Promise<void>;
};

export function makeJob(id: AgentId, intent: string, actorIds: string[]): AgentJob {
  return {
    id: `${id}-${Math.random().toString(36).slice(2, 8)}`,
    agentId: id,
    intent,
    status: "pending",
    cards: [],
    sources: [],
    actorIds,
  };
}

export function newCardId(): string {
  return Math.random().toString(36).slice(2, 10);
}
