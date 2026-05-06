// Plain fetch-based API handlers. Mounted from src/server.ts ahead of the
// TanStack handler so we can stream SSE without TanStack Router taking over.
//
// Endpoints:
//   POST /api/runs/start                  → { runId }
//   GET  /api/runs/:id/snapshot           → RunSnapshot
//   GET  /api/runs/:id/stream             → text/event-stream of RunEvent
//   GET  /api/agents                      → AgentMeta[]

import { runOrchestrator } from "./orchestrator";
import { publicAgentMeta } from "./agents/registry";
import { createRun, getEventCount, getEventsSince, getSnapshot, subscribe } from "./run-store";
import type { RunEvent, RunJob, RunMode } from "./types";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

export function maybeHandleApi(req: Request): Promise<Response> | null {
  const url = new URL(req.url);
  const path = url.pathname;
  if (!path.startsWith("/api/")) return null;

  if (req.method === "POST" && path === "/api/runs/start") {
    return handleStart(req);
  }
  if (req.method === "GET" && path === "/api/agents") {
    return Promise.resolve(json(publicAgentMeta()));
  }

  const matchSnap = path.match(/^\/api\/runs\/([^/]+)\/snapshot$/);
  if (matchSnap && req.method === "GET") {
    return Promise.resolve(handleSnapshot(matchSnap[1]));
  }

  const matchStream = path.match(/^\/api\/runs\/([^/]+)\/stream$/);
  if (matchStream && req.method === "GET") {
    return Promise.resolve(handleStream(req, matchStream[1]));
  }

  return null;
}

async function handleStart(req: Request): Promise<Response> {
  let body: { prompt?: string; mode?: string; job?: string };
  try {
    body = (await req.json()) as { prompt?: string; mode?: string; job?: string };
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const prompt = (body.prompt ?? "").trim();
  const mode = (body.mode ?? "investor") as RunMode;
  const job = (body.job ?? undefined) as RunJob | undefined;
  if (!prompt) return json({ error: "prompt_required" }, 400);
  if (mode !== "founder" && mode !== "investor") {
    return json({ error: "invalid_mode" }, 400);
  }
  if (job && job !== "discover" && job !== "dossier" && job !== "connect") {
    return json({ error: "invalid_job" }, 400);
  }

  const snap = createRun(prompt, mode, job);

  // Mock-only mode: every run goes through the canned-or-synthesized
  // timeline replayer. `demo:<id>` prompts pick a polished scenario;
  // any other prompt gets a fresh synthetic scenario keyed off the
  // user's input. Real-orchestrator path is intentionally unused for
  // the demo (kept in src/server/orchestrator.ts for reference).
  const { runMock } = await import("./mock/runner");
  const { resolveScenario } = await import("./mock/timelines");
  const scenario = resolveScenario(prompt, job ?? "dossier");
  void runMock(snap.id, scenario).catch((err) => {
    console.error(`[run ${snap.id}] mock runner threw`, err);
  });

  return json({ runId: snap.id, snapshot: snap }, 201);
}

function handleSnapshot(id: string): Response {
  const snap = getSnapshot(id);
  if (!snap) return json({ error: "run_not_found" }, 404);
  return json(snap);
}

function handleStream(req: Request, id: string): Response {
  const snap = getSnapshot(id);
  if (!snap) return json({ error: "run_not_found" }, 404);

  // Replay-on-reconnect: client sends Last-Event-ID = events seen so far.
  const lastId = parseInt(req.headers.get("last-event-id") ?? "0", 10);
  const startCount = isFinite(lastId) ? Math.max(0, lastId) : 0;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const enc = new TextEncoder();
      let counter = startCount;

      const sendEvent = (ev: RunEvent) => {
        counter += 1;
        const chunk =
          `id: ${counter}\n` + `event: ${ev.type}\n` + `data: ${JSON.stringify(ev)}\n\n`;
        try {
          controller.enqueue(enc.encode(chunk));
        } catch {
          /* closed */
        }
      };

      // 1) Replay any missed events from the in-memory log.
      for (const ev of getEventsSince(id, startCount)) {
        sendEvent(ev);
      }
      counter = Math.max(counter, getEventCount(id));

      // 2) Subscribe for live updates.
      const unsub = subscribe(id, sendEvent);

      // 3) Heartbeat every 15s to keep the connection alive across proxies.
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(enc.encode(`: keep-alive\n\n`));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15_000);

      // 4) Close cleanly on client disconnect.
      const onAbort = () => {
        clearInterval(heartbeat);
        unsub();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };
      req.signal.addEventListener("abort", onAbort);
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
      connection: "keep-alive",
    },
  });
}

function json(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), { status, headers: JSON_HEADERS });
}
