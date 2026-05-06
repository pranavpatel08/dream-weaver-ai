# Investor Pivot — Mission Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Revamp the dream-weaver-ai frontend into an investor-only "Mission Control" command center with three jobs (Discover / Dossier / Connect), full transparency into agent + Apify actor activity, and a mock-data demo path.

**Architecture:** Keep the existing Coordinator → fan-out → Synthesizer pipeline and SSE streaming. Add a `RunJob` field that branches synthesis prompts and result shapes. Replace the run-page UI with a three-pane Mission Control shell (flow rail · agent grid · sources ticker) plus a job-aware bottom dock. Add a mock-mode replay path keyed off `prompt: "demo:*"` for the demo.

**Tech Stack:** React 19, TanStack Start, TanStack Router, shadcn/ui, Tailwind v4, Framer Motion (new), Lucide icons, Bun, Vite, Zod, OpenAI-compatible LLM client, Apify REST. SSE for live updates, in-memory `Map` for state.

**Spec:** `docs/superpowers/specs/2026-05-06-investor-pivot-mission-control-design.md`

---

## File Structure

### New files
- `src/server/types.ts` — extend with `RunJob`, `Synthesis` extras
- `src/server/mock/timelines.ts` — canned event timelines
- `src/server/mock/runner.ts` — mock orchestrator path
- `src/server/agents/investor-mapper.ts` — mock-data agent
- `src/server/agents/warm-path-mapper.ts` — mock-data agent
- `src/lib/agent-meta.ts` — extend with actor display metadata (existing file; new export)
- `src/components/run/MissionControl.tsx` — main shell
- `src/components/run/AgentPanel.tsx` — terminal-styled agent panel
- `src/components/run/ActorPill.tsx` — actor + elapsed time pill
- `src/components/run/LogStream.tsx` — fading log lines
- `src/components/run/FlowRail.tsx` — SVG mini-DAG
- `src/components/run/SourcesTicker.tsx` — live sources feed
- `src/components/run/SynthDock.tsx` — bottom dock with job-specific renderers
- `src/components/run/jobs/DossierDock.tsx`
- `src/components/run/jobs/DiscoverDock.tsx`
- `src/components/run/jobs/ConnectDock.tsx`
- `src/components/run/CapTableGraph.tsx` — small force-directed SVG for Connect
- `src/routes/discover.tsx` — discover prompt route
- `src/routes/dossier.tsx` — dossier prompt route
- `src/routes/connect.tsx` — connect prompt route

### Modified files
- `src/server/api.ts` — accept `job` field, branch to mock runner on `demo:` prefix
- `src/server/orchestrator.ts` — branch on `job` for prompts and synthesis shape
- `src/server/agents/registry.ts` — add new agents, mode-to-job mapping
- `src/lib/run-socket.ts` — extend reducer with `agent.log` capture (currently ignored)
- `src/routes/runs.$id.tsx` — replace content with `MissionControl`
- `src/routes/index.tsx` — investor landing with three job tiles
- `src/styles.css` — add scanline/CRT-glow utilities

### Removed files
- `src/routes/new.tsx` — leave file but redirect to `/dossier` to keep TanStack route tree happy (delete file as final step if clean)
- `src/components/run/AgentChip.tsx` — superseded by `AgentPanel`
- `src/components/run/AgentTimeline.tsx` — superseded by `MissionControl` layout
- `src/components/run/DashboardCard.tsx` — superseded by panel-internal card rendering
- `src/components/run/DashboardGrid.tsx` — superseded
- `src/components/run/SynthesisPanel.tsx` — superseded by `SynthDock`
- `src/components/run/SourceList.tsx` — superseded by `SourcesTicker`

---

## Task 0: Setup

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Framer Motion**

```bash
bun add framer-motion
```

- [ ] **Step 2: Verify install**

```bash
bun run lint && bunx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add package.json bun.lockb
git commit -m "deps: add framer-motion"
```

---

## Task 1: Type extensions + mock-mode plumbing (backend)

**Files:**
- Modify: `src/server/types.ts`
- Modify: `src/server/api.ts`
- Create: `src/server/mock/runner.ts`
- Create: `src/server/mock/timelines.ts`

- [ ] **Step 1: Extend types — add `RunJob` and synthesis extras**

In `src/server/types.ts`, add after the existing `RunMode` declaration:

```ts
export type RunJob = "discover" | "dossier" | "connect";

export type DiscoverEntry = {
  id: string;
  name: string;
  oneLiner: string;
  discoveryScore: number;
  pedigree: string;
  signal: string;
  url?: string;
};

export type WarmPath = {
  id: string;
  via: string;
  hops: { name: string; role: string }[];
  strength: number;
  rationale: string;
};

export type CapTableEntry = {
  id: string;
  name: string;
  kind: "lead" | "follow" | "angel" | "advisor";
  round?: string;
};
```

Extend the `Synthesis` type to add optional job-specific fields:

```ts
export type Synthesis = {
  summary: string;
  bullets: string[];
  verdict?: { label: string; confidence: number; reasoning: string };
  roadmap?: { phase: string; items: string[] }[];
  // Job-specific extras (only one populated per run):
  discover?: { entries: DiscoverEntry[] };
  connect?: { capTable: CapTableEntry[]; paths: WarmPath[] };
};
```

Add `job` to `RunSnapshot` (keep `mode` for back-compat through demo):

```ts
export type RunSnapshot = {
  id: string;
  mode: RunMode;
  job?: RunJob;
  prompt: string;
  status: RunStatus;
  createdAt: number;
  agents: AgentJob[];
  synthesis?: Synthesis;
};
```

- [ ] **Step 2: Update `run-store.ts` `createRun` signature**

In `src/server/run-store.ts`, change `createRun` to accept an optional `job`:

```ts
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
```

Update `toSnapshot` to include `job`:

```ts
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
```

Add `RunJob` to the imports at the top.

- [ ] **Step 3: Create `src/server/mock/timelines.ts`**

This file exports a registry of canned scenarios. Each scenario emits a sequence of `RunEvent`-like calls into the run-store with realistic delays.

```ts
import type { AgentId, AgentJob, Card, RunJob, Source } from "../types";

export type MockStep =
  | { delayMs: number; kind: "queue"; job: AgentJob }
  | { delayMs: number; kind: "start"; agentId: AgentId }
  | { delayMs: number; kind: "log"; agentId: AgentId; message: string }
  | { delayMs: number; kind: "card"; agentId: AgentId; card: Card }
  | { delayMs: number; kind: "source"; agentId: AgentId; source: Source }
  | { delayMs: number; kind: "finish"; agentId: AgentId };

export type MockScenario = {
  id: string;
  job: RunJob;
  prompt: string;
  steps: MockStep[];
  synthesis: import("../types").Synthesis;
};

export const SCENARIOS: Record<string, MockScenario> = {
  // Filled by helper files below — start with one for now.
};
```

In the same file, define the first scenario `dossier-cursor` inline so we have a working demo before any UI changes. Hand-author 5 agents, ~25 events:

```ts
function makeJob(agentId: AgentId, intent: string, actorIds: string[]): AgentJob {
  return {
    id: `${agentId}-${Math.random().toString(36).slice(2, 8)}`,
    agentId,
    intent,
    status: "pending",
    cards: [],
    sources: [],
    actorIds,
  };
}

const cursorScenario: MockScenario = {
  id: "dossier-cursor",
  job: "dossier",
  prompt: "Cursor",
  steps: [
    { delayMs: 0, kind: "queue", job: makeJob("competitor-mapper", "Map AI coding agent landscape around Cursor", ["apify/google-search-scraper"]) },
    { delayMs: 50, kind: "queue", job: makeJob("linkedin-company-scout", "LinkedIn company snapshot of Anysphere/Cursor", ["harvestapi/linkedin-company-search"]) },
    { delayMs: 100, kind: "queue", job: makeJob("founder-profiler", "Profile Michael Truell + Aman Sanger", ["apidojo/tweet-scraper"]) },
    { delayMs: 150, kind: "queue", job: makeJob("funding-tracker", "Cursor funding history", ["complex_intricate_networks/fundraising-and-startup-funding-scraper"]) },
    { delayMs: 200, kind: "queue", job: makeJob("sentiment-scout", "Reddit + HN pulse on Cursor vs Copilot", ["parseforge/reddit-posts-scraper", "gentle_cloud/hacker-news-scraper"]) },

    { delayMs: 300, kind: "start", agentId: "competitor-mapper" },
    { delayMs: 350, kind: "start", agentId: "linkedin-company-scout" },
    { delayMs: 400, kind: "start", agentId: "founder-profiler" },
    { delayMs: 500, kind: "start", agentId: "funding-tracker" },
    { delayMs: 600, kind: "start", agentId: "sentiment-scout" },

    { delayMs: 800, kind: "log", agentId: "competitor-mapper", message: "Calling apify/google-search-scraper · query='AI coding agent Cursor competitor'" },
    { delayMs: 1100, kind: "log", agentId: "linkedin-company-scout", message: "Calling harvestapi/linkedin-company-search · searchQuery='Anysphere'" },
    { delayMs: 1500, kind: "source", agentId: "competitor-mapper", source: { id: "s1", url: "https://github.com/features/copilot", title: "GitHub Copilot — Your AI pair programmer", actorId: "apify/google-search-scraper", agentId: "competitor-mapper" } },
    { delayMs: 1900, kind: "card", agentId: "competitor-mapper", card: { id: "c1", kind: "competitor", title: "GitHub Copilot", subtitle: "Microsoft · $10/mo", body: "First-mover; lock-in via VS Code; weaker at agentic edits.", agentId: "competitor-mapper" } },
    { delayMs: 2200, kind: "source", agentId: "linkedin-company-scout", source: { id: "s2", url: "https://linkedin.com/company/anysphere", title: "Anysphere — 87 employees", actorId: "harvestapi/linkedin-company-search", agentId: "linkedin-company-scout" } },
    { delayMs: 2400, kind: "card", agentId: "linkedin-company-scout", card: { id: "c2", kind: "competitor", title: "Anysphere (Cursor)", subtitle: "87 employees · 3.2x YoY headcount", body: "Engineering-heavy team; SF based; 78% senior IC.", agentId: "linkedin-company-scout" } },
    { delayMs: 2700, kind: "source", agentId: "founder-profiler", source: { id: "s3", url: "https://x.com/mntruell", title: "Michael Truell on X", actorId: "apidojo/tweet-scraper", agentId: "founder-profiler" } },
    { delayMs: 2900, kind: "card", agentId: "founder-profiler", card: { id: "c3", kind: "founder", title: "Michael Truell, CEO", subtitle: "MIT '22 · ex-Google", body: "Builds in public; high-velocity tweets; product-led founder.", agentId: "founder-profiler" } },
    { delayMs: 3200, kind: "card", agentId: "funding-tracker", card: { id: "c4", kind: "funding", title: "Series C — $400M @ $9B", subtitle: "Dec 2024 · Thrive Capital lead", body: "Andreessen, Benchmark, Stripe co-investors. 3rd round in 18 months.", agentId: "funding-tracker" } },
    { delayMs: 3500, kind: "card", agentId: "sentiment-scout", card: { id: "c5", kind: "sentiment", title: "r/programming pulse", subtitle: "+412 sentiment score (last 30d)", body: "Devs migrate from Copilot for agentic edits; complaints on price.", agentId: "sentiment-scout" } },

    { delayMs: 3800, kind: "finish", agentId: "competitor-mapper" },
    { delayMs: 3900, kind: "finish", agentId: "linkedin-company-scout" },
    { delayMs: 4000, kind: "finish", agentId: "founder-profiler" },
    { delayMs: 4100, kind: "finish", agentId: "funding-tracker" },
    { delayMs: 4200, kind: "finish", agentId: "sentiment-scout" },
  ],
  synthesis: {
    summary: "Cursor (Anysphere) is the category-defining AI coding agent. Take the meeting.",
    bullets: [
      "Headcount up 3.2x YoY — execution velocity is real, not vapor.",
      "$400M Series C @ $9B (Dec 2024) — secondary likely available; primary is hard.",
      "Founder team is product-led, ships in public, low ego signal.",
      "Sentiment migration from Copilot is durable and growing.",
      "Pricing complaints are the only durable risk — TAM expansion via teams plan mitigates.",
      "Competitive moat: agentic refactor UX > raw model quality.",
    ],
    verdict: { label: "Take meeting", confidence: 88, reasoning: "Asymmetric upside on a category leader compounding faster than the rest of dev tools. Entry only available via secondary; primary closed." },
  },
};

SCENARIOS["dossier-cursor"] = cursorScenario;
```

- [ ] **Step 4: Create `src/server/mock/runner.ts`**

This is the alternative to `runOrchestrator`. It walks a scenario timeline and emits events through the existing run-store helpers.

```ts
import {
  appendCard,
  appendSource,
  finishAgent,
  logAgent,
  queueAgent,
  setRunStatus,
  setSynthesis,
  startAgent,
} from "../run-store";
import { SCENARIOS } from "./timelines";

export async function runMock(runId: string, scenarioId: string) {
  const scenario = SCENARIOS[scenarioId];
  if (!scenario) {
    setRunStatus(runId, "error");
    return;
  }
  setRunStatus(runId, "running");

  let last = 0;
  for (const step of scenario.steps) {
    const wait = step.delayMs - last;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = step.delayMs;

    switch (step.kind) {
      case "queue":
        queueAgent(runId, step.job);
        break;
      case "start":
        startAgent(runId, step.agentId);
        break;
      case "log":
        logAgent(runId, step.agentId, step.message);
        break;
      case "card":
        appendCard(runId, step.agentId, step.card);
        break;
      case "source":
        appendSource(runId, step.agentId, step.source);
        break;
      case "finish":
        finishAgent(runId, step.agentId, "done");
        break;
    }
  }

  setRunStatus(runId, "synthesizing");
  // Stream the summary text in chunks for nicer UI fill-in.
  const txt = scenario.synthesis.summary;
  const chunkSize = 12;
  for (let i = 0; i < txt.length; i += chunkSize) {
    const { emitSynthDelta } = await import("../run-store");
    emitSynthDelta(runId, txt.slice(i, i + chunkSize));
    await new Promise((r) => setTimeout(r, 80));
  }
  setSynthesis(runId, scenario.synthesis);
  setRunStatus(runId, "done");
}
```

- [ ] **Step 5: Wire mock-mode trigger into `src/server/api.ts`**

In `handleStart`, accept `job` and detect `demo:` prefix. Replace the existing function:

```ts
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

  // Demo mode: prompt prefix `demo:<scenario>` runs a canned timeline.
  if (prompt.startsWith("demo:")) {
    const scenarioId = prompt.slice("demo:".length);
    const { runMock } = await import("./mock/runner");
    void runMock(snap.id, scenarioId).catch((err) => {
      console.error(`[run ${snap.id}] mock runner threw`, err);
    });
    return json({ runId: snap.id, snapshot: snap }, 201);
  }

  void runOrchestrator(snap.id, prompt, mode).catch((err) => {
    console.error(`[run ${snap.id}] orchestrator threw`, err);
  });
  return json({ runId: snap.id, snapshot: snap }, 201);
}
```

Add `RunJob` to the import at the top of `api.ts`.

- [ ] **Step 6: Verify backend**

```bash
bun run lint && bunx tsc --noEmit
```

Expected: 0 errors.

```bash
bun run dev > /tmp/dev.log 2>&1 &
sleep 6
RUN_ID=$(curl -sS -X POST http://localhost:8080/api/runs/start \
  -H 'content-type: application/json' \
  -d '{"prompt":"demo:dossier-cursor","mode":"investor","job":"dossier"}' | jq -r .runId)
sleep 6
curl -sS http://localhost:8080/api/runs/$RUN_ID/snapshot | jq '.status, (.agents|length), (.agents[0].cards|length)'
kill %1 2>/dev/null
```

Expected: `status` becomes `done` within ~5s, 5 agents queued, ≥1 card on the first agent.

- [ ] **Step 7: Commit**

```bash
git add src/server/types.ts src/server/run-store.ts src/server/api.ts src/server/mock/
git commit -m "server: add RunJob + mock-mode replay for demo scenarios"
```

---

## Task 2: Mission Control shell layout

**Files:**
- Create: `src/components/run/MissionControl.tsx`
- Modify: `src/routes/runs.$id.tsx`
- Modify: `src/styles.css` (add CRT/scanline utilities)

This task replaces the run-page UI with the new three-pane layout, **without** the new visual flair yet — we just want the structure mounted so subsequent tasks can fill it.

- [ ] **Step 1: Add CSS utilities in `src/styles.css`**

Append at the end of the file:

```css
@layer utilities {
  .scanlines {
    background-image: repeating-linear-gradient(
      0deg,
      transparent 0,
      transparent 2px,
      rgba(255, 255, 255, 0.02) 2px,
      rgba(255, 255, 255, 0.02) 3px
    );
  }
  .crt-glow {
    box-shadow:
      0 0 0 1px var(--glow, rgba(96, 165, 250, 0.4)),
      0 0 24px -4px var(--glow, rgba(96, 165, 250, 0.4));
  }
  .panel-accent {
    border-left: 2px solid var(--accent, hsl(var(--border)));
  }
}
```

- [ ] **Step 2: Create `src/components/run/MissionControl.tsx`**

```tsx
import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Activity } from "lucide-react";
import type { RunSnapshot } from "@/server/types";
import { Badge } from "@/components/ui/badge";

export function MissionControl({
  runId,
  snapshot,
  connected,
}: {
  runId: string;
  snapshot: RunSnapshot | null;
  connected: boolean;
}) {
  return (
    <div className="dark grid h-screen grid-rows-[auto_1fr_auto] bg-[#0a0e17] text-foreground">
      <TopBar runId={runId} snapshot={snapshot} connected={connected} />
      <div className="grid min-h-0 grid-cols-[208px_1fr_300px]">
        <aside className="border-r border-border/40 bg-[#0d1320]/60">
          {/* Task 6 fills FlowRail here */}
          <div className="p-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            Flow
          </div>
        </aside>
        <main className="min-w-0 overflow-y-auto p-4">
          {/* Task 3 fills agent grid here */}
          <div className="text-xs text-muted-foreground">Agent grid mounts here</div>
        </main>
        <aside className="border-l border-border/40 bg-[#0d1320]/60">
          {/* Task 4 fills SourcesTicker here */}
          <div className="p-3 text-[11px] uppercase tracking-wider text-muted-foreground">
            Sources
          </div>
        </aside>
      </div>
      <footer className="border-t border-border/40 bg-[#0d1320]/80 px-4 py-3">
        {/* Task 5 fills SynthDock here */}
        <div className="text-xs text-muted-foreground">Synthesis dock</div>
      </footer>
    </div>
  );
}

function TopBar({
  runId,
  snapshot,
  connected,
}: {
  runId: string;
  snapshot: RunSnapshot | null;
  connected: boolean;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border/40 bg-[#0d1320]/80 px-4 py-2.5 backdrop-blur">
      <Link to="/" className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
      </Link>
      <Sparkles className="size-4 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{snapshot?.prompt ?? "Loading…"}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          run {runId.slice(0, 8)} · {snapshot?.agents.length ?? 0} agents · {jobLabel(snapshot)}
        </div>
      </div>
      <RunTimer createdAt={snapshot?.createdAt} status={snapshot?.status} />
      <StatusBadge status={snapshot?.status} connected={connected} />
    </header>
  );
}

function jobLabel(snap: RunSnapshot | null): string {
  if (!snap) return "";
  if (snap.job === "discover") return "Discover";
  if (snap.job === "dossier") return "Dossier";
  if (snap.job === "connect") return "Connect";
  return snap.mode === "founder" ? "Founder" : "Investor";
}

function RunTimer({ createdAt, status }: { createdAt?: number; status?: string }) {
  // Simple ticking timer. Replace with effect+state in Task 10 polish.
  if (!createdAt) return null;
  const elapsed = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  const frozen = status === "done" || status === "error";
  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <Activity className={frozen ? "size-3" : "size-3 animate-pulse text-emerald-400"} />
      {elapsed}s
    </div>
  );
}

function StatusBadge({ status, connected }: { status?: string; connected: boolean }) {
  if (!connected) return <Badge variant="outline">disconnected</Badge>;
  if (!status) return <Badge variant="outline">connecting</Badge>;
  if (status === "running") return <Badge className="bg-blue-500 text-white">running</Badge>;
  if (status === "synthesizing")
    return <Badge className="bg-violet-500 text-white">synthesizing</Badge>;
  if (status === "done") return <Badge className="bg-emerald-500 text-white">done</Badge>;
  if (status === "error") return <Badge variant="destructive">error</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
```

- [ ] **Step 3: Replace `src/routes/runs.$id.tsx` with the new shell**

```tsx
import { createFileRoute } from "@tanstack/react-router";
import { useRunStream } from "@/lib/run-socket";
import { MissionControl } from "@/components/run/MissionControl";

export const Route = createFileRoute("/runs/$id")({
  component: RunPage,
});

function RunPage() {
  const { id } = Route.useParams();
  const { snapshot, connected } = useRunStream(id);
  return <MissionControl runId={id} snapshot={snapshot} connected={connected} />;
}
```

- [ ] **Step 4: Verify**

```bash
bun run lint && bunx tsc --noEmit
```

Expected: 0 errors.

Then start dev and trigger the mock scenario:

```bash
bun run dev > /tmp/dev.log 2>&1 &
sleep 6
curl -sS -X POST http://localhost:8080/api/runs/start \
  -H 'content-type: application/json' \
  -d '{"prompt":"demo:dossier-cursor","mode":"investor","job":"dossier"}' | jq -r .runId
# Visit http://localhost:8080/runs/<id> in a browser — confirm the three-pane shell
# renders with placeholder text in each region.
kill %1 2>/dev/null
```

- [ ] **Step 5: Commit**

```bash
git add src/components/run/MissionControl.tsx src/routes/runs.\$id.tsx src/styles.css
git commit -m "ui: Mission Control shell layout (three-pane + dock)"
```

---

## Task 3: AgentPanel + ActorPill + LogStream

**Files:**
- Create: `src/components/run/ActorPill.tsx`
- Create: `src/components/run/LogStream.tsx`
- Create: `src/components/run/AgentPanel.tsx`
- Modify: `src/components/run/MissionControl.tsx` (mount the agent grid)
- Modify: `src/lib/run-socket.ts` (capture log events)

- [ ] **Step 1: Capture `agent.log` events in `run-socket.ts`**

Add `logs: Record<AgentId, string[]>` to the snapshot client-side. Modify the reducer:

In `src/lib/run-socket.ts`, change the `applyEvent` function to keep a per-agent log buffer. We'll store it as `(snap as any).logs` to avoid mutating the server type. Actually do it cleanly — extend the client state:

```ts
type State = {
  snapshot: RunSnapshot | null;
  logs: Record<string, string[]>; // keyed by agentId
  connected: boolean;
  error: string | null;
};
```

Update reducer to thread `logs` through every action. For the `event` case, when `ev.type === "agent.log"`, append to `logs[ev.agentId]` (cap at 50 lines). Default state `logs: {}`. Return `state.logs` from the hook.

Final hook return:

```ts
return { snapshot: state.snapshot, logs: state.logs, connected: state.connected, error: state.error };
```

Also add `useRunStream` callsites: `MissionControl` will need `logs`. Update `runs.$id.tsx`:

```tsx
const { snapshot, logs, connected } = useRunStream(id);
return <MissionControl runId={id} snapshot={snapshot} logs={logs} connected={connected} />;
```

And add `logs` prop to `MissionControl`'s signature.

- [ ] **Step 2: Create `src/components/run/ActorPill.tsx`**

```tsx
import { useEffect, useState } from "react";

export function ActorPill({
  actorId,
  startedAt,
  active,
}: {
  actorId: string;
  startedAt?: number;
  active: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null;
  return (
    <div className="inline-flex items-center gap-1.5 rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[10px]">
      {active && (
        <span className="size-1.5 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_4px_currentColor]" />
      )}
      <span className="truncate text-muted-foreground">{actorId}</span>
      {elapsed !== null && <span className="text-muted-foreground/60">·</span>}
      {elapsed !== null && <span className="tabular-nums text-foreground/80">{elapsed}s</span>}
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/run/LogStream.tsx`**

```tsx
export function LogStream({ lines }: { lines: string[] }) {
  // Show last 4 lines, fading older.
  const recent = lines.slice(-4);
  return (
    <div className="space-y-0.5 font-mono text-[10.5px] leading-relaxed">
      {recent.length === 0 && (
        <div className="text-muted-foreground/40">▎ awaiting actor…</div>
      )}
      {recent.map((line, i) => {
        const opacity = 0.4 + (i / Math.max(1, recent.length - 1)) * 0.6;
        return (
          <div
            key={`${i}-${line.slice(0, 12)}`}
            className="truncate text-muted-foreground"
            style={{ opacity }}
          >
            <span className="text-emerald-400/80">▎</span> {line}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create `src/components/run/AgentPanel.tsx`**

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { metaFor } from "@/lib/agent-meta";
import type { AgentJob } from "@/server/types";
import { ActorPill } from "./ActorPill";
import { LogStream } from "./LogStream";

export function AgentPanel({ job, logs }: { job: AgentJob; logs: string[] }) {
  const meta = metaFor(job.agentId);
  const Icon = meta.icon;
  const running = job.status === "running";
  const done = job.status === "done";

  const cardsToShow = job.cards.slice(-3);
  const hidden = Math.max(0, job.cards.length - cardsToShow.length);

  return (
    <div
      className="panel-accent rounded-lg border border-border/50 bg-[#111827]/80 p-3 transition-shadow"
      style={
        {
          ["--accent" as string]: meta.color,
          ["--glow" as string]: `${meta.color}55`,
        } as React.CSSProperties
      }
    >
      <div className={running ? "crt-glow rounded-md" : undefined}>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded"
              style={{ backgroundColor: meta.color + "22", color: meta.color }}
            >
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium">{meta.label}</div>
              <div className="truncate text-[10.5px] text-muted-foreground">{job.intent}</div>
            </div>
          </div>
          <StatusDot status={job.status} color={meta.color} />
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1">
          {job.actorIds.map((aid) => (
            <ActorPill key={aid} actorId={aid} startedAt={job.startedAt} active={running} />
          ))}
        </div>

        <div className="mt-2 rounded border border-border/40 bg-black/30 p-2">
          <LogStream lines={logs} />
        </div>

        <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-foreground">
          <span>{job.cards.length} cards</span>
          <span>·</span>
          <span>{job.sources.length} sources</span>
          {done && job.startedAt && job.finishedAt && (
            <>
              <span>·</span>
              <span className="tabular-nums">
                {Math.max(0, Math.round((job.finishedAt - job.startedAt) / 100) / 10)}s
              </span>
            </>
          )}
        </div>

        <AnimatePresence initial={false}>
          {cardsToShow.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="mt-2 rounded border border-border/40 bg-black/20 p-2 text-[11.5px]"
            >
              <div className="line-clamp-1 font-medium">{c.title}</div>
              {c.subtitle && (
                <div className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground">
                  {c.subtitle}
                </div>
              )}
              {c.body && (
                <div className="mt-1 line-clamp-2 text-[11px] text-foreground/80">{c.body}</div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {hidden > 0 && (
          <div className="mt-1 text-[10.5px] text-muted-foreground">+{hidden} more cards</div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status, color }: { status: AgentJob["status"]; color: string }) {
  if (status === "pending") return <span className="size-2 rounded-full bg-muted-foreground/40" />;
  if (status === "running")
    return (
      <span
        className="size-2 animate-pulse rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}33` }}
      />
    );
  if (status === "error") return <span className="size-2 rounded-full bg-destructive" />;
  return <span className="size-2 rounded-full bg-emerald-500" />;
}
```

- [ ] **Step 5: Mount agent grid in `MissionControl.tsx`**

Replace the placeholder `main` content with:

```tsx
<main className="min-w-0 overflow-y-auto p-3">
  {snapshot && snapshot.agents.length > 0 ? (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
      {snapshot.agents.map((job) => (
        <AgentPanel key={job.id} job={job} logs={logs[job.agentId] ?? []} />
      ))}
    </div>
  ) : (
    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
      Waiting for the coordinator to dispatch agents…
    </div>
  )}
</main>
```

Add the `AgentPanel` import.

- [ ] **Step 6: Verify**

```bash
bun run lint && bunx tsc --noEmit
```

Trigger demo and confirm visually that 5 panels render with actor pills counting elapsed seconds, logs stream in, and cards slide in.

- [ ] **Step 7: Commit**

```bash
git add src/components/run/AgentPanel.tsx src/components/run/ActorPill.tsx src/components/run/LogStream.tsx src/components/run/MissionControl.tsx src/lib/run-socket.ts src/routes/runs.\$id.tsx
git commit -m "ui: agent terminal panels with actor pills + live log streams"
```

---

## Task 4: Sources ticker

**Files:**
- Create: `src/components/run/SourcesTicker.tsx`
- Modify: `src/components/run/MissionControl.tsx`

- [ ] **Step 1: Create `src/components/run/SourcesTicker.tsx`**

```tsx
import { motion, AnimatePresence } from "framer-motion";
import { metaFor } from "@/lib/agent-meta";
import type { AgentJob, Source } from "@/server/types";

type StampedSource = Source & { ts: number };

export function SourcesTicker({ agents }: { agents: AgentJob[] }) {
  // Flatten + reverse so newest is on top. We approximate timestamps using
  // index ordering; the run-store appends in arrival order.
  const all: StampedSource[] = [];
  agents.forEach((a) => {
    a.sources.forEach((s, i) => {
      all.push({ ...s, ts: (a.startedAt ?? 0) + i });
    });
  });
  all.sort((a, b) => b.ts - a.ts);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Sources</span>
        <span className="tabular-nums">{all.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        <AnimatePresence initial={false}>
          {all.length === 0 && (
            <div className="px-1 py-2 text-[10.5px] text-muted-foreground/60">
              No sources yet.
            </div>
          )}
          {all.map((s) => {
            const meta = metaFor(s.agentId);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="border-b border-border/30 px-1 py-1.5 font-mono text-[10.5px] last:border-b-0"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className="size-1.5 rounded-full"
                    style={{ backgroundColor: meta.color }}
                  />
                  <span className="truncate text-muted-foreground/80">{s.actorId}</span>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-1 text-foreground hover:text-emerald-400"
                  title={s.title}
                >
                  {s.title}
                </a>
                <div className="truncate text-muted-foreground/60">{domainOf(s.url)}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
```

- [ ] **Step 2: Mount in `MissionControl.tsx`**

Replace the right-hand `aside` with:

```tsx
<aside className="border-l border-border/40 bg-[#0d1320]/60">
  <SourcesTicker agents={snapshot?.agents ?? []} />
</aside>
```

Add the import.

- [ ] **Step 3: Verify + commit**

```bash
bun run lint && bunx tsc --noEmit
```

```bash
git add src/components/run/SourcesTicker.tsx src/components/run/MissionControl.tsx
git commit -m "ui: live sources ticker (newest on top, actor-tagged)"
```

---

## Task 5: SynthDock with Dossier renderer (streaming verdict)

**Files:**
- Create: `src/components/run/SynthDock.tsx`
- Create: `src/components/run/jobs/DossierDock.tsx`
- Modify: `src/components/run/MissionControl.tsx`

- [ ] **Step 1: Create `DossierDock.tsx`**

```tsx
import type { Synthesis } from "@/server/types";
import { Badge } from "@/components/ui/badge";

export function DossierDock({
  synthesis,
  expanded,
}: {
  synthesis?: Synthesis;
  expanded: boolean;
}) {
  if (!synthesis?.summary) {
    return <div className="text-[11px] text-muted-foreground/60">Synthesizing verdict…</div>;
  }
  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        {synthesis.verdict && (
          <Badge className="bg-emerald-500 text-white">{synthesis.verdict.label}</Badge>
        )}
        <div className="line-clamp-1 text-[12.5px]">{synthesis.summary}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
      <div>
        {synthesis.verdict && (
          <>
            <Badge className="bg-emerald-500 text-white">{synthesis.verdict.label}</Badge>
            <div className="mt-2 font-mono text-[10.5px] text-muted-foreground">
              {synthesis.verdict.confidence}/100 confidence
            </div>
            <p className="mt-2 text-[12.5px] text-foreground/80">
              {synthesis.verdict.reasoning}
            </p>
          </>
        )}
      </div>
      <div>
        <p className="text-[12.5px] text-foreground/90">{synthesis.summary}</p>
        <ul className="mt-2 space-y-1">
          {synthesis.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-foreground/80">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `SynthDock.tsx`**

```tsx
import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RunSnapshot } from "@/server/types";
import { DossierDock } from "./jobs/DossierDock";

export function SynthDock({ snapshot }: { snapshot: RunSnapshot | null }) {
  const [expanded, setExpanded] = useState(false);
  const job = snapshot?.job ?? "dossier";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Synthesizer</span>
          <span>·</span>
          <span>{snapshot?.status ?? ""}</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 rounded border border-border/40 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <div className={expanded ? "mt-3 max-h-[40vh] overflow-y-auto" : "mt-2"}>
        {job === "dossier" && (
          <DossierDock synthesis={snapshot?.synthesis} expanded={expanded} />
        )}
        {job === "discover" && (
          <div className="text-[11px] text-muted-foreground">Discover dock — Task 7</div>
        )}
        {job === "connect" && (
          <div className="text-[11px] text-muted-foreground">Connect dock — Task 8</div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Mount in `MissionControl.tsx`**

Replace the footer placeholder:

```tsx
<footer className="border-t border-border/40 bg-[#0d1320]/80 px-4 py-3">
  <SynthDock snapshot={snapshot} />
</footer>
```

Add the import.

- [ ] **Step 4: Verify**

Trigger the demo. Run completes; collapsed dock shows "Take meeting" badge and the streamed summary on a single line. Click expand → bullets + confidence + reasoning.

- [ ] **Step 5: Commit**

```bash
git add src/components/run/SynthDock.tsx src/components/run/jobs/DossierDock.tsx src/components/run/MissionControl.tsx
git commit -m "ui: synthesizer dock with streaming Dossier verdict"
```

---

## Task 6: Flow rail mini-DAG

**Files:**
- Create: `src/components/run/FlowRail.tsx`
- Modify: `src/components/run/MissionControl.tsx`

- [ ] **Step 1: Create `FlowRail.tsx`**

Hand-drawn SVG. One row per agent, plus Coordinator at top and Synthesizer at bottom. Edges animate via `stroke-dasharray` keyframe when agent is running.

```tsx
import { Brain, Sparkles } from "lucide-react";
import { metaFor } from "@/lib/agent-meta";
import type { AgentJob, RunStatus } from "@/server/types";

const NODE_HEIGHT = 36;
const NODE_GAP = 6;
const SVG_WIDTH = 192;

export function FlowRail({
  agents,
  status,
}: {
  agents: AgentJob[];
  status: RunStatus | undefined;
}) {
  const total = agents.length;
  const middleHeight = total * NODE_HEIGHT + (total - 1) * NODE_GAP;
  const totalHeight = NODE_HEIGHT + 24 + middleHeight + 24 + NODE_HEIGHT;
  const synthesizing = status === "synthesizing" || status === "done";

  return (
    <div className="scanlines h-full overflow-y-auto p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Flow
      </div>
      <svg width={SVG_WIDTH} height={totalHeight} className="block">
        {/* Coordinator */}
        <FlowNode
          x={0}
          y={0}
          color="#c084fc"
          label="Coordinator"
          active={total === 0}
          done={total > 0}
          icon="brain"
        />
        {/* Edges from coordinator out to each agent */}
        {agents.map((a, i) => {
          const meta = metaFor(a.agentId);
          const yMid = NODE_HEIGHT + 24 + i * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT / 2;
          const animate = a.status === "running";
          return (
            <line
              key={`top-${a.id}`}
              x1={SVG_WIDTH / 2}
              y1={NODE_HEIGHT}
              x2={SVG_WIDTH / 2}
              y2={yMid}
              stroke={meta.color}
              strokeWidth={1}
              strokeDasharray={animate ? "4 4" : undefined}
              opacity={a.status === "pending" ? 0.3 : 0.7}
              className={animate ? "animate-pulse" : ""}
            />
          );
        })}
        {/* Agent nodes */}
        {agents.map((a, i) => {
          const meta = metaFor(a.agentId);
          const y = NODE_HEIGHT + 24 + i * (NODE_HEIGHT + NODE_GAP);
          return (
            <FlowNode
              key={a.id}
              x={0}
              y={y}
              color={meta.color}
              label={meta.label}
              active={a.status === "running"}
              done={a.status === "done"}
              error={a.status === "error"}
            />
          );
        })}
        {/* Edges from agents down to synthesizer */}
        {agents.map((a, i) => {
          const meta = metaFor(a.agentId);
          const yMid = NODE_HEIGHT + 24 + i * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT / 2;
          const yBottom = NODE_HEIGHT + 24 + middleHeight + 24;
          const done = a.status === "done";
          return (
            <line
              key={`bot-${a.id}`}
              x1={SVG_WIDTH / 2}
              y1={yMid}
              x2={SVG_WIDTH / 2}
              y2={yBottom}
              stroke={meta.color}
              strokeWidth={1}
              opacity={done ? 0.7 : 0.2}
            />
          );
        })}
        {/* Synthesizer */}
        <FlowNode
          x={0}
          y={NODE_HEIGHT + 24 + middleHeight + 24}
          color="#34d399"
          label="Synthesizer"
          active={synthesizing && status !== "done"}
          done={status === "done"}
          icon="sparkles"
        />
      </svg>
    </div>
  );
}

function FlowNode({
  x,
  y,
  color,
  label,
  active,
  done,
  error,
  icon,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  active?: boolean;
  done?: boolean;
  error?: boolean;
  icon?: "brain" | "sparkles";
}) {
  const fill = active ? color : done ? `${color}55` : `${color}22`;
  const stroke = error ? "#ef4444" : color;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={4}
        y={0}
        width={SVG_WIDTH - 8}
        height={NODE_HEIGHT}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeOpacity={0.6}
      />
      <text
        x={SVG_WIDTH / 2}
        y={NODE_HEIGHT / 2 + 4}
        textAnchor="middle"
        className="font-mono"
        fontSize={11}
        fill="white"
      >
        {label}
      </text>
      {active && (
        <circle cx={SVG_WIDTH - 14} cy={NODE_HEIGHT / 2} r={3} fill="#22c55e">
          <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}
```

(Lucide imports `Brain`/`Sparkles` are unused; remove from the file or wire them via the `icon` prop to render `<foreignObject>`. Simplest: drop the imports.)

- [ ] **Step 2: Mount in `MissionControl.tsx`**

Replace the left aside placeholder with `<FlowRail agents={snapshot?.agents ?? []} status={snapshot?.status} />`.

- [ ] **Step 3: Verify + commit**

```bash
bun run lint && bunx tsc --noEmit
git add src/components/run/FlowRail.tsx src/components/run/MissionControl.tsx
git commit -m "ui: flow rail mini-DAG (coordinator → agents → synthesizer)"
```

---

## Task 7: Discover route + dock

**Files:**
- Create: `src/routes/discover.tsx`
- Create: `src/components/run/jobs/DiscoverDock.tsx`
- Modify: `src/components/run/SynthDock.tsx`
- Modify: `src/server/mock/timelines.ts` (new scenario)

- [ ] **Step 1: Add a Discover scenario in `timelines.ts`**

`SCENARIOS["discover-vertical-ai-health"]` — thesis prompt, 4 agents (competitor-mapper, linkedin-company-scout, founder-profiler, funding-tracker). Synthesis populates `synthesis.discover.entries` with 6 ranked companies. Use the same `MockStep` patterns as Task 1.

```ts
const verticalAiHealthDiscover: MockScenario = {
  id: "discover-vertical-ai-health",
  job: "discover",
  prompt: "Vertical AI for healthcare back-office (claims, prior auth, RCM)",
  steps: [/* 4 queue + 4 start + ~12 logs/cards/sources + 4 finish */],
  synthesis: {
    summary: "Six companies match the thesis; two are pre-empt.",
    bullets: [
      "Top tier: Anterior, Latent — both compounding faster than peers.",
      "Pre-empt window closing on Anterior in next 8 weeks.",
      "Ignore: anything with EHR-integration as the wedge.",
      "Watch: founders with payer ops backgrounds (rare; high signal).",
      "Pricing: avoid % of recovery deals; CMS exposure is high beta.",
    ],
    discover: {
      entries: [
        { id: "anterior", name: "Anterior", oneLiner: "Prior auth automation for payers", discoveryScore: 92, pedigree: "ex-Stripe risk team, MIT EECS", signal: "+3 hires from UnitedHealth in last 30d", url: "https://anterior.com" },
        { id: "latent", name: "Latent", oneLiner: "RCM for ambulatory groups", discoveryScore: 88, pedigree: "ex-Athena, ex-Scale", signal: "Just closed seed; Sequoia term sheet rumor", url: "https://latent.com" },
        { id: "claimable", name: "Claimable", oneLiner: "Denials management agents", discoveryScore: 84, pedigree: "ex-Olive AI", signal: "30 logo customers; $2.4M ARR", url: "https://claimable.ai" },
        { id: "encoda", name: "Encoda", oneLiner: "Coding + audit for specialty practices", discoveryScore: 79, pedigree: "physician-founder", signal: "Reddit r/medicalcoding mentions trending up", url: "https://encoda.com" },
        { id: "vivian", name: "Vivian Health AI", oneLiner: "Staffing + clinical credentialing", discoveryScore: 73, pedigree: "ex-Vivian, ex-Trusted", signal: "Two hires from Forge", url: "https://vivian.ai" },
        { id: "pylon", name: "Pylon", oneLiner: "Provider data management", discoveryScore: 70, pedigree: "ex-Mirah", signal: "Quiet for 90 days; cash-strapped", url: "https://pylonhealth.com" },
      ],
    },
  },
};
SCENARIOS["discover-vertical-ai-health"] = verticalAiHealthDiscover;
```

(Fill the `steps` array with realistic queue/start/log/card/source/finish events, ~6s total runtime.)

- [ ] **Step 2: Create `src/components/run/jobs/DiscoverDock.tsx`**

```tsx
import type { Synthesis, DiscoverEntry } from "@/server/types";
import { Badge } from "@/components/ui/badge";

export function DiscoverDock({
  synthesis,
  expanded,
}: {
  synthesis?: Synthesis;
  expanded: boolean;
}) {
  const entries = synthesis?.discover?.entries ?? [];
  if (!synthesis?.summary) {
    return <div className="text-[11px] text-muted-foreground/60">Searching the field…</div>;
  }
  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <Badge className="bg-emerald-500 text-white">{entries.length} matches</Badge>
        <div className="line-clamp-1 text-[12.5px]">{synthesis.summary}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} />
      ))}
    </div>
  );
}

function EntryCard({ entry }: { entry: DiscoverEntry }) {
  return (
    <div className="rounded border border-border/40 bg-black/30 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold">{entry.name}</div>
          <div className="truncate text-[10.5px] text-muted-foreground">{entry.oneLiner}</div>
        </div>
        <div className="font-mono text-[11px] tabular-nums text-emerald-400">
          {entry.discoveryScore}
        </div>
      </div>
      <div className="mt-1.5 text-[10.5px] text-foreground/80">{entry.pedigree}</div>
      <div className="mt-0.5 text-[10.5px] text-amber-300/80">▎ {entry.signal}</div>
    </div>
  );
}
```

- [ ] **Step 3: Wire into `SynthDock.tsx`**

Replace the `discover` placeholder branch:

```tsx
{job === "discover" && (
  <DiscoverDock synthesis={snapshot?.synthesis} expanded={expanded} />
)}
```

Add the import.

- [ ] **Step 4: Create `src/routes/discover.tsx`**

```tsx
import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/discover")({
  component: DiscoverPage,
});

const EXAMPLES = [
  "Vertical AI for healthcare back-office (claims, prior auth, RCM)",
  "AI agents for legal due diligence — pre-seed and seed only",
  "Dev tools building on coding agents — picks-and-shovels plays",
];

function DiscoverPage() {
  const navigate = useNavigate();
  const [thesis, setThesis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(prompt: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/runs/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, mode: "investor", job: "discover" }),
      });
      if (!res.ok) {
        setError(`Failed to start (${res.status})`);
        setSubmitting(false);
        return;
      }
      const json = (await res.json()) as { runId: string };
      void navigate({ to: "/runs/$id", params: { id: json.runId } });
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <Search className="size-4 text-primary" />
        <div className="font-medium tracking-tight">Discover</div>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <label className="mb-2 block text-sm font-medium">Your thesis</label>
          <Textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            rows={4}
            placeholder="What space are you hunting in?"
            className="resize-none text-base"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Agents will fan out and surface companies matching your thesis with discovery scores.
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setThesis(e)}
                className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => start("demo:discover-vertical-ai-health")}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300"
            >
              ▶ Run demo (vertical AI in healthcare)
            </button>
          </div>
          {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
          <div className="mt-5 flex justify-end">
            <Button
              size="lg"
              onClick={() => start(thesis)}
              disabled={!thesis.trim() || submitting}
              className="gap-2"
            >
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              Surface deals
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify + commit**

```bash
bun run lint && bunx tsc --noEmit
git add src/routes/discover.tsx src/components/run/jobs/DiscoverDock.tsx src/components/run/SynthDock.tsx src/server/mock/timelines.ts
git commit -m "ui: Discover route + ranked deal feed dock"
```

---

## Task 8: Connect route + cap-table + warm-paths

**Files:**
- Create: `src/routes/connect.tsx`
- Create: `src/components/run/jobs/ConnectDock.tsx`
- Create: `src/components/run/CapTableGraph.tsx`
- Modify: `src/components/run/SynthDock.tsx`
- Modify: `src/server/mock/timelines.ts`

- [ ] **Step 1: Add Connect scenario to `timelines.ts`**

`SCENARIOS["connect-anthropic"]` — 3 agents (linkedin-company-scout, founder-profiler, news-scout). Synthesis populates `synthesis.connect.{capTable,paths}` with 6 cap-table entries and 4 ranked warm paths.

```ts
const connectAnthropic: MockScenario = {
  id: "connect-anthropic",
  job: "connect",
  prompt: "Anthropic",
  steps: [/* 3 queue + 3 start + ~9 events + 3 finish */],
  synthesis: {
    summary: "Three warm paths exist. Start with Sarah at Spark.",
    bullets: [
      "Cap-table: Spark, Lightspeed, Salesforce — 11 named investors total.",
      "Strongest path: Sarah Guo @ Conviction — 2nd-degree via your portfolio (Vellum).",
      "Founder is responsive to deeply technical inbound; signal-heavy outreach > volume.",
      "Avoid cold founder DM — they batch-ignore; route via portfolio CEO.",
    ],
    connect: {
      capTable: [
        { id: "spark", name: "Spark Capital", kind: "lead", round: "Series A" },
        { id: "lightspeed", name: "Lightspeed", kind: "lead", round: "Series B" },
        { id: "salesforce", name: "Salesforce Ventures", kind: "follow", round: "Series C" },
        { id: "google", name: "Google", kind: "follow", round: "Series D" },
        { id: "menlo", name: "Menlo Ventures", kind: "follow" },
        { id: "fidelity", name: "Fidelity", kind: "follow" },
      ],
      paths: [
        { id: "p1", via: "Spark Capital → Sarah Guo (Conviction)", hops: [{ name: "Sarah Guo", role: "ex-Spark partner" }, { name: "Dario Amodei", role: "CEO Anthropic" }], strength: 92, rationale: "Sarah co-led Anthropic's Series A while at Spark; warmest hop." },
        { id: "p2", via: "Vellum (your portfolio) → Anthropic Solutions Eng", hops: [{ name: "Akash Sharma", role: "CEO Vellum" }, { name: "Nicholas Joseph", role: "Engineering Lead" }], strength: 78, rationale: "Vellum is an Anthropic API ecosystem company; reciprocal dependency." },
        { id: "p3", via: "Stanford CS PhD network", hops: [{ name: "Chris Olah", role: "Co-founder" }], strength: 64, rationale: "Stanford alumni cluster — slower, less pointed." },
        { id: "p4", via: "Cold outreach (signal-heavy)", hops: [], strength: 35, rationale: "Last resort; only with a technical artifact attached." },
      ],
    },
  },
};
SCENARIOS["connect-anthropic"] = connectAnthropic;
```

- [ ] **Step 2: Create `CapTableGraph.tsx`**

A simple radial layout — center node = company, surrounding nodes = investors colored by `kind`. No physics; we hand-place around a circle.

```tsx
import type { CapTableEntry } from "@/server/types";

const KIND_COLOR: Record<CapTableEntry["kind"], string> = {
  lead: "#34d399",
  follow: "#60a5fa",
  angel: "#a78bfa",
  advisor: "#f59e0b",
};

export function CapTableGraph({
  company,
  entries,
}: {
  company: string;
  entries: CapTableEntry[];
}) {
  const r = 90;
  const cx = 130;
  const cy = 110;
  return (
    <svg viewBox="0 0 260 220" className="block w-full max-w-[320px]">
      {entries.map((e, i) => {
        const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        return (
          <g key={e.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={KIND_COLOR[e.kind]} strokeOpacity={0.4} />
            <circle cx={x} cy={y} r={6} fill={KIND_COLOR[e.kind]} />
            <text
              x={x}
              y={y - 10}
              textAnchor="middle"
              fontSize={9}
              fill="#cbd5e1"
              className="font-mono"
            >
              {e.name}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={18} fill="#0d1320" stroke="#34d399" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="white" fontWeight={600}>
        {company}
      </text>
    </svg>
  );
}
```

- [ ] **Step 3: Create `ConnectDock.tsx`**

```tsx
import type { Synthesis } from "@/server/types";
import { Badge } from "@/components/ui/badge";
import { CapTableGraph } from "../CapTableGraph";

export function ConnectDock({
  synthesis,
  expanded,
  company,
}: {
  synthesis?: Synthesis;
  expanded: boolean;
  company: string;
}) {
  const cap = synthesis?.connect?.capTable ?? [];
  const paths = synthesis?.connect?.paths ?? [];
  if (!synthesis?.summary) {
    return <div className="text-[11px] text-muted-foreground/60">Mapping the room…</div>;
  }
  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <Badge className="bg-emerald-500 text-white">{paths.length} warm paths</Badge>
        <div className="line-clamp-1 text-[12.5px]">{synthesis.summary}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Cap table
        </div>
        <CapTableGraph company={company} entries={cap} />
      </div>
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Warm paths
        </div>
        <ul className="space-y-2">
          {paths.map((p) => (
            <li key={p.id} className="rounded border border-border/40 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="line-clamp-1 text-[12px] font-medium">{p.via}</div>
                <div className="font-mono text-[11px] tabular-nums text-emerald-400">
                  {p.strength}
                </div>
              </div>
              <div className="mt-0.5 text-[10.5px] text-foreground/80">{p.rationale}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                {p.hops.map((h, i) => (
                  <span key={i}>
                    {h.name} <span className="text-muted-foreground/60">({h.role})</span>
                    {i < p.hops.length - 1 && " → "}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 rounded border border-border/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                Draft outreach
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire `ConnectDock` into `SynthDock.tsx`**

Pass the prompt/company through:

```tsx
{job === "connect" && (
  <ConnectDock
    synthesis={snapshot?.synthesis}
    expanded={expanded}
    company={snapshot?.prompt ?? ""}
  />
)}
```

Add the import.

- [ ] **Step 5: Create `src/routes/connect.tsx`**

Mirror `discover.tsx` structure with copy "Find a warm path to a deal." Include a demo button: `start("demo:connect-anthropic")`.

- [ ] **Step 6: Verify + commit**

```bash
bun run lint && bunx tsc --noEmit
git add src/routes/connect.tsx src/components/run/jobs/ConnectDock.tsx src/components/run/CapTableGraph.tsx src/components/run/SynthDock.tsx src/server/mock/timelines.ts
git commit -m "ui: Connect route + cap-table graph + warm-path list"
```

---

## Task 9: Dossier route + landing facelift

**Files:**
- Create: `src/routes/dossier.tsx`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/new.tsx` (delete or repurpose)

- [ ] **Step 1: Create `src/routes/dossier.tsx`**

Mirror `discover.tsx` with copy "Brief me on a company." Demo button: `start("demo:dossier-cursor")`.

- [ ] **Step 2: Rewrite `src/routes/index.tsx` for the investor-only landing**

Replace the file contents:

```tsx
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Sparkles, Search, FileSearch, Network, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="dark min-h-screen bg-[#0a0e17] text-foreground">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.32_0.18_265/.6)_0,transparent_70%)]" />
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-semibold tracking-tight">Dream Weaver</span>
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            For investors · Powered by Apify
          </div>
        </header>

        <section className="mx-auto max-w-4xl px-6 pb-12 pt-12 text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
            Where deals come from{" "}
            <span className="bg-gradient-to-br from-emerald-300 to-sky-400 bg-clip-text text-transparent">
              in the open
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            A transparent deal copilot. A swarm of agents fans out across LinkedIn, X, Reddit,
            Crunchbase, and YouTube. Every signal cites the Apify actor that fetched it. No
            black boxes — watch the work happen.
          </p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
          <JobTile
            to="/discover"
            icon={<Search className="size-5" />}
            title="Discover"
            body="Type a thesis. Get a ranked feed of companies you haven't seen yet."
            cta="Surface deals"
            accent="emerald"
          />
          <JobTile
            to="/dossier"
            icon={<FileSearch className="size-5" />}
            title="Dossier"
            body="Paste a company. Watch agents build a due-diligence brief in 90 seconds."
            cta="Brief me"
            accent="sky"
          />
          <JobTile
            to="/connect"
            icon={<Network className="size-5" />}
            title="Connect"
            body="Map the cap table. Find your warmest path to the founder."
            cta="Find a path"
            accent="violet"
          />
        </section>
      </div>
    </div>
  );
}

function JobTile({
  to,
  icon,
  title,
  body,
  cta,
  accent,
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  accent: "emerald" | "sky" | "violet";
}) {
  const accentMap = {
    emerald: "from-emerald-400/40 to-transparent text-emerald-400",
    sky: "from-sky-400/40 to-transparent text-sky-400",
    violet: "from-violet-400/40 to-transparent text-violet-400",
  } as const;
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur transition-colors hover:border-border"
    >
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${accentMap[accent]} opacity-30`} />
      <div className={accentMap[accent].split(" ").pop()}>{icon}</div>
      <div className="mt-3 text-lg font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Repurpose `src/routes/new.tsx` as a redirect**

Replace contents:

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/new")({
  beforeLoad: () => {
    throw redirect({ to: "/dossier" });
  },
});
```

- [ ] **Step 4: Verify + commit**

```bash
bun run lint && bunx tsc --noEmit
git add src/routes/index.tsx src/routes/dossier.tsx src/routes/new.tsx
git commit -m "ui: investor-only landing + Dossier prompt route"
```

---

## Task 10: Polish pass

**Files:**
- Modify: `src/components/run/MissionControl.tsx` (auto-tick timer)
- Modify: `src/components/run/AgentPanel.tsx` (entry animation)
- Modify: `src/components/run/FlowRail.tsx` (highlight on click)
- Delete: `src/components/run/AgentChip.tsx`, `AgentTimeline.tsx`, `DashboardCard.tsx`, `DashboardGrid.tsx`, `SourceList.tsx`, `SynthesisPanel.tsx`

- [ ] **Step 1: Auto-tick timer in `MissionControl.tsx`**

Replace `RunTimer` with a stateful tick:

```tsx
function RunTimer({ createdAt, status }: { createdAt?: number; status?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (status === "done" || status === "error") return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [status]);
  if (!createdAt) return null;
  const elapsed = Math.max(0, Math.floor((now - createdAt) / 1000));
  const frozen = status === "done" || status === "error";
  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <Activity className={frozen ? "size-3" : "size-3 animate-pulse text-emerald-400"} />
      {elapsed}s
    </div>
  );
}
```

Add `useState`, `useEffect` imports.

- [ ] **Step 2: Stagger AgentPanel entry**

Wrap each panel in `motion.div` in `MissionControl.tsx` agent grid mount:

```tsx
{snapshot.agents.map((job, i) => (
  <motion.div
    key={job.id}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay: i * 0.04, type: "spring", stiffness: 200, damping: 22 }}
  >
    <AgentPanel job={job} logs={logs[job.agentId] ?? []} />
  </motion.div>
))}
```

Add the `motion` import.

- [ ] **Step 3: Delete dead components**

```bash
rm src/components/run/AgentChip.tsx \
   src/components/run/AgentTimeline.tsx \
   src/components/run/DashboardCard.tsx \
   src/components/run/DashboardGrid.tsx \
   src/components/run/SourceList.tsx \
   src/components/run/SynthesisPanel.tsx
```

- [ ] **Step 4: Final verify**

```bash
bun run lint && bunx tsc --noEmit && bun run build
```

Expected: 0 errors, build succeeds.

Smoke-test all three demo scenarios manually:
1. Visit `/` → click each tile → click "Run demo" → watch the run page render and complete.

```bash
bun run dev > /tmp/dev.log 2>&1 &
sleep 6
for SCENARIO in dossier-cursor discover-vertical-ai-health connect-anthropic; do
  echo "=== $SCENARIO ==="
  RUN_ID=$(curl -sS -X POST http://localhost:8080/api/runs/start \
    -H 'content-type: application/json' \
    -d "{\"prompt\":\"demo:$SCENARIO\",\"mode\":\"investor\",\"job\":\"dossier\"}" | jq -r .runId)
  sleep 8
  curl -sS http://localhost:8080/api/runs/$RUN_ID/snapshot | jq '{status, agents: (.agents|length), cards: ([.agents[].cards|length]|add)}'
done
kill %1 2>/dev/null
```

Expected for each: `status: "done"`, agents > 0, cards > 0.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "polish: animations, ticking timer, dead-code cleanup"
```

---

## Self-review checklist (the executor must run before finishing)

Before declaring done:

- `bun run lint` clean (0 errors)
- `bunx tsc --noEmit` clean (0 errors)
- `bun run build` clean
- Each of the three demo scenarios completes end-to-end, status reaches `done`, and the synthesizer dock renders job-specific content
- For every visible card and source, the actor that produced it is visible in the panel actor pill or sources ticker line
- Founder-only routes/components are gone or redirect cleanly
- No console errors in the browser during a demo run

If any of those fail, fix inline and re-verify before finishing.

---

## Out of scope for this plan

- Real Harmonic API integration
- Real outreach sending (Connect's "Draft outreach" button is a no-op)
- Persistence beyond a run's lifetime
- Cloudflare Workers / Durable Object migration
- The custom `founder-pedigree-scorer` Apify actor (tracked as a separate stretch plan)
