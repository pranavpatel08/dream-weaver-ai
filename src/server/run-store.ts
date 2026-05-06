// In-memory store for runs + a per-run event bus that drives SSE.
// Single-process only; that's fine for vite dev and the demo.

import type {
  AgentJob,
  AgentStatus,
  Card,
  RunEvent,
  RunJob,
  RunMode,
  RunSnapshot,
  RunStatus,
  Source,
  Synthesis,
} from "./types";

type Subscriber = (event: RunEvent) => void;

type Run = RunSnapshot & {
  subscribers: Set<Subscriber>;
  // Event log so a late-joining SSE client can replay missed events.
  events: RunEvent[];
};

const RUNS = new Map<string, Run>();

export function createRun(prompt: string, mode: RunMode, job?: RunJob): RunSnapshot {
  const id = randomId();
  const run: Run = {
    id,
    mode,
    job,
    prompt,
    status: "pending",
    createdAt: Date.now(),
    agents: [],
    subscribers: new Set(),
    events: [],
  };
  RUNS.set(id, run);
  emit(id, { type: "run.started", runId: id, mode, prompt });
  return toSnapshot(run);
}

export function getSnapshot(id: string): RunSnapshot | undefined {
  const run = RUNS.get(id);
  if (!run) return undefined;
  return toSnapshot(run);
}

export function getEventsSince(id: string, count: number): RunEvent[] {
  const run = RUNS.get(id);
  if (!run) return [];
  return run.events.slice(count);
}

export function getEventCount(id: string): number {
  return RUNS.get(id)?.events.length ?? 0;
}

export function subscribe(id: string, fn: Subscriber): () => void {
  const run = RUNS.get(id);
  if (!run) return () => {};
  run.subscribers.add(fn);
  return () => run.subscribers.delete(fn);
}

export function setRunStatus(id: string, status: RunStatus) {
  const run = RUNS.get(id);
  if (!run) return;
  run.status = status;
  if (status === "done" || status === "error") {
    emit(id, { type: "run.finished", status });
  }
}

export function queueAgent(id: string, job: AgentJob) {
  const run = RUNS.get(id);
  if (!run) return;
  run.agents.push(job);
  emit(id, { type: "agent.queued", agent: job });
}

export function startAgent(runId: string, agentId: AgentJob["agentId"]) {
  const run = RUNS.get(runId);
  if (!run) return;
  const job = run.agents.find((a) => a.agentId === agentId);
  if (!job) return;
  job.status = "running";
  job.startedAt = Date.now();
  emit(runId, { type: "agent.started", agentId });
}

export function appendCard(runId: string, agentId: AgentJob["agentId"], card: Card) {
  const run = RUNS.get(runId);
  if (!run) return;
  const job = run.agents.find((a) => a.agentId === agentId);
  if (!job) return;
  job.cards.push(card);
  emit(runId, { type: "agent.card", agentId, card });
}

export function appendSource(runId: string, agentId: AgentJob["agentId"], source: Source) {
  const run = RUNS.get(runId);
  if (!run) return;
  const job = run.agents.find((a) => a.agentId === agentId);
  if (!job) return;
  job.sources.push(source);
  emit(runId, { type: "agent.source", agentId, source });
}

export function logAgent(runId: string, agentId: AgentJob["agentId"], message: string) {
  emit(runId, { type: "agent.log", agentId, message });
}

export function finishAgent(
  runId: string,
  agentId: AgentJob["agentId"],
  status: AgentStatus,
  error?: string,
) {
  const run = RUNS.get(runId);
  if (!run) return;
  const job = run.agents.find((a) => a.agentId === agentId);
  if (!job) return;
  job.status = status;
  job.finishedAt = Date.now();
  if (error) job.error = error;
  emit(runId, { type: "agent.finished", agentId, status, error });
}

export function setSynthesis(runId: string, synthesis: Synthesis) {
  const run = RUNS.get(runId);
  if (!run) return;
  run.synthesis = synthesis;
  emit(runId, { type: "synth.done", synthesis });
}

export function emitSynthDelta(runId: string, chunk: string) {
  emit(runId, { type: "synth.delta", chunk });
}

function emit(runId: string, event: RunEvent) {
  const run = RUNS.get(runId);
  if (!run) return;
  run.events.push(event);
  for (const s of run.subscribers) {
    try {
      s(event);
    } catch {
      // detached subscriber — keep going.
    }
  }
}

function toSnapshot(run: Run): RunSnapshot {
  return {
    id: run.id,
    mode: run.mode,
    job: run.job,
    prompt: run.prompt,
    status: run.status,
    createdAt: run.createdAt,
    agents: run.agents.map((a) => ({ ...a, cards: [...a.cards], sources: [...a.sources] })),
    synthesis: run.synthesis,
  };
}

function randomId(): string {
  // 12 hex chars is plenty for a hackathon URL slug.
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
