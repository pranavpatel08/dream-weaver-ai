// Client hook: subscribes to /api/runs/:id/stream (SSE), maintains a live
// snapshot, and reconnects on disconnect.

import { useEffect, useReducer, useRef } from "react";
import type { AgentJob, AgentStatus, RunEvent, RunSnapshot, Synthesis } from "@/server/types";

const LOG_CAP = 50;

type State = {
  snapshot: RunSnapshot | null;
  logs: Record<string, string[]>;
  connected: boolean;
  error: string | null;
};

type Action =
  | { type: "hydrate"; snapshot: RunSnapshot }
  | { type: "connected" }
  | { type: "disconnected"; error?: string }
  | { type: "event"; event: RunEvent };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "hydrate":
      return { ...state, snapshot: action.snapshot };
    case "connected":
      return { ...state, connected: true, error: null };
    case "disconnected":
      return { ...state, connected: false, error: action.error ?? null };
    case "event": {
      const ev = action.event;
      // Logs are kept regardless of snapshot presence.
      let nextLogs = state.logs;
      if (ev.type === "agent.log") {
        const prev = state.logs[ev.agentId] ?? [];
        const next = [...prev, ev.message];
        if (next.length > LOG_CAP) next.splice(0, next.length - LOG_CAP);
        nextLogs = { ...state.logs, [ev.agentId]: next };
      }
      if (!state.snapshot) return { ...state, logs: nextLogs };
      const nextSnap = applyEvent(state.snapshot, ev);
      return { ...state, snapshot: nextSnap, logs: nextLogs };
    }
  }
}

function applyEvent(snap: RunSnapshot, ev: RunEvent): RunSnapshot {
  switch (ev.type) {
    case "run.started":
      return snap;
    case "agent.queued": {
      if (snap.agents.some((a) => a.agentId === ev.agent.agentId)) return snap;
      return { ...snap, agents: [...snap.agents, ev.agent] };
    }
    case "agent.started":
      return mapAgent(snap, ev.agentId, (a) => ({
        ...a,
        status: "running",
        startedAt: Date.now(),
      }));
    case "agent.card":
      return mapAgent(snap, ev.agentId, (a) => ({ ...a, cards: [...a.cards, ev.card] }));
    case "agent.source":
      return mapAgent(snap, ev.agentId, (a) => ({ ...a, sources: [...a.sources, ev.source] }));
    case "agent.log":
      return snap;
    case "agent.finished":
      return mapAgent(snap, ev.agentId, (a) => ({
        ...a,
        status: ev.status as AgentStatus,
        error: ev.error,
        finishedAt: Date.now(),
      }));
    case "synth.delta":
      return {
        ...snap,
        synthesis: {
          ...(snap.synthesis ?? { summary: "", bullets: [] as string[] }),
          summary: (snap.synthesis?.summary ?? "") + ev.chunk,
          bullets: snap.synthesis?.bullets ?? [],
        },
      };
    case "synth.done":
      return { ...snap, synthesis: ev.synthesis as Synthesis };
    case "run.finished":
      return { ...snap, status: ev.status };
    default:
      return snap;
  }
}

function mapAgent(
  snap: RunSnapshot,
  agentId: AgentJob["agentId"],
  fn: (a: AgentJob) => AgentJob,
): RunSnapshot {
  return {
    ...snap,
    agents: snap.agents.map((a) => (a.agentId === agentId ? fn(a) : a)),
  };
}

export function useRunStream(runId: string | undefined) {
  const [state, dispatch] = useReducer(reducer, {
    snapshot: null,
    logs: {},
    connected: false,
    error: null,
  });
  const sseRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!runId) return;
    let cancelled = false;
    fetch(`/api/runs/${runId}/snapshot`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((snap: RunSnapshot) => {
        if (!cancelled) dispatch({ type: "hydrate", snapshot: snap });
      })
      .catch((err) => {
        if (!cancelled) dispatch({ type: "disconnected", error: String(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [runId]);

  useEffect(() => {
    if (!runId) return;
    const sse = new EventSource(`/api/runs/${runId}/stream`);
    sseRef.current = sse;
    sse.onopen = () => dispatch({ type: "connected" });
    sse.onerror = () => dispatch({ type: "disconnected", error: "stream error" });

    const handler = (e: MessageEvent) => {
      try {
        const ev = JSON.parse(e.data) as RunEvent;
        dispatch({ type: "event", event: ev });
      } catch {
        /* keep-alive */
      }
    };

    const types: RunEvent["type"][] = [
      "run.started",
      "agent.queued",
      "agent.started",
      "agent.card",
      "agent.source",
      "agent.log",
      "agent.finished",
      "synth.delta",
      "synth.done",
      "run.finished",
    ];
    for (const t of types) sse.addEventListener(t, handler as EventListener);

    return () => {
      sse.close();
      sseRef.current = null;
    };
  }, [runId]);

  return {
    snapshot: state.snapshot,
    logs: state.logs,
    connected: state.connected,
    error: state.error,
  };
}
