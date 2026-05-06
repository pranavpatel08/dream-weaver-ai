# Investor Pivot — Mission Control Design

**Date:** 2026-05-06
**Status:** Draft, pending review
**Branch target:** `main`

## 1. Pivot summary

Suspend Founder Studio. Reframe the product around the *investor's* job: discovering, prepping for, and winning deals. The pitch:

> **Harmonic for the rest of us — a transparent deal copilot that shows its work.**

Harmonic charges $30k+/yr and is a black box. We are an open, agentic version that runs on Apify scrapers — every signal cites the actor that fetched it. Transparency is the differentiator vs. Harmonic *and* vs. ChatGPT-style "trust me" research.

## 2. Three investor jobs (replace Founder mode)

Each job becomes its own route, each backed by the same Coordinator → fan-out → Synthesizer pipeline already built. Different jobs prime different agents and different synthesis prompts.

| Job | Route | Investor problem | What the user sees |
|---|---|---|---|
| **Discover** | `/discover` | "I have a thesis, surface companies I haven't seen." | Thesis prompt → live agent grid finds candidate companies → ranked feed of company cards with discovery scores (founder pedigree, funding signal, traction velocity). |
| **Dossier** | `/dossier` (then `/runs/:id`) | "I have a meeting in 30 min, prep me." | Company name/URL → Mission Control runs full DD → streaming verdict (`pass / track / take meeting`) + bullets. **Hero demo flow.** |
| **Connect** | `/connect` (then `/runs/:id`) | "I want this deal, find a warm path." | Company name → cap-table map + investor graph + ranked warm-intro paths (2nd-degree LinkedIn, ex-employees, university links, shared portfolio). |

All three share the Mission Control UI shell. They differ in:
- Coordinator system prompt + chosen agent set
- Final synthesis shape (feed vs. verdict vs. path list)
- A mode-specific "results panel" rendered alongside the shared agent grid

## 3. Mission Control UI (the hybrid layout)

Single-screen layout for `/runs/:id` (~1440p target, 1280p degrades gracefully):

```
┌──────────────────────────────────────────────────────────────────────┐
│  Top bar: prompt · job pill · run timer · status · share btn        │
├────────┬─────────────────────────────────────────────────┬───────────┤
│        │  AGENT GRID (main pane)                          │  SOURCES  │
│  FLOW  │  ┌──────────────┐  ┌──────────────┐             │  TICKER   │
│  RAIL  │  │ Competitor   │  │ LinkedIn     │  …          │  (live    │
│ (mini  │  │ Mapper       │  │ Scout        │             │  feed,    │
│  DAG)  │  │ ▎actor pill  │  │ ▎actor pill  │             │  newest   │
│        │  │ ▎live log    │  │ ▎live log    │             │  on top)  │
│        │  │ ▎n cards     │  │ ▎n cards     │             │           │
│        │  └──────────────┘  └──────────────┘             │           │
├────────┴─────────────────────────────────────────────────┴───────────┤
│  SYNTHESIZER DOCK — streaming verdict + bullets, expandable          │
└──────────────────────────────────────────────────────────────────────┘
```

### Regions

- **Flow rail (left, ~200px)** — vertical mini-DAG. Coordinator at top → agent nodes (per-agent color, pulsing when running) → Synthesizer at bottom. Edges animate as data flows. Click a node = scroll/highlight that panel in the agent grid. Hand-drawn SVG, no `react-flow` dependency.
- **Agent grid (center)** — one terminal-styled panel per agent. Per panel:
  - Header: agent icon + name + status dot
  - **Actor pill**: monospace, e.g. `apify/google-search-scraper · 12s`, dot-pulses while running
  - **Live log**: 4 most recent log lines, JetBrains Mono, fading older lines
  - Card count + source count chips
  - Cards slide in below the log (Framer Motion spring), collapse to "+N more" when >3
- **Sources ticker (right, ~280px, collapsible)** — every URL pulled by every agent, newest on top, line format: `[hh:mm:ss] [agent-color] actor-id · domain · title`. Bloomberg-style monospace feed.
- **Synthesizer dock (bottom, expandable)** — collapsed: status + token-streaming verdict line. Expanded: full bullets, verdict pill, mode-specific extras (Discover: ranked company list; Connect: warm-path list; Dossier: bullets + roadmap).

### Job-specific results in the dock

- **Discover** dock = ranked feed of company cards, sortable by discovery score
- **Dossier** dock = verdict pill + bullets + risks + recommendation
- **Connect** dock = cap-table mini-graph + ranked warm-intro paths with a "draft outreach" button (no real send — just shows the draft)

### Visual language

- Page `#0a0e17`, panels `#111827`, borders `#1e293b`. Existing dark tokens stay.
- Per-agent color (already in `agent-meta.ts`) drives panel left-border, log highlights, flow node, badges.
- JetBrains Mono for actor pills, log streams, source ticker. Inter for everything else.
- Subtle scanline/grid background on the flow rail (CSS `repeating-linear-gradient`).
- CRT-style glow on running agent panels (existing `--glow` CSS var pattern, extended).
- Spring entry animations on cards via Framer Motion.

## 4. Architecture changes

### Frontend

Files to add:
- `src/routes/discover.tsx` — thesis input + examples, posts to `/api/runs/start` with `job: "discover"`
- `src/routes/dossier.tsx` — company name input
- `src/routes/connect.tsx` — company name input
- `src/components/run/MissionControl.tsx` — main layout shell
- `src/components/run/AgentPanel.tsx` — terminal-style agent panel (replaces `AgentChip` on the run page)
- `src/components/run/ActorPill.tsx` — actor + elapsed time pill
- `src/components/run/LogStream.tsx` — fading log lines
- `src/components/run/FlowRail.tsx` — SVG DAG
- `src/components/run/SourcesTicker.tsx`
- `src/components/run/SynthDock.tsx` — replaces `SynthesisPanel`, with job-specific renderers
- `src/components/run/jobs/DiscoverDock.tsx`
- `src/components/run/jobs/DossierDock.tsx`
- `src/components/run/jobs/ConnectDock.tsx`

Files to modify:
- `src/routes/index.tsx` — investor-only landing, three job CTAs
- `src/routes/runs.$id.tsx` — swap content for `MissionControl`
- `src/routes/__root.tsx` — minor (remove founder-mode artifacts)
- `src/lib/agent-meta.ts` — add metadata for actor IDs (display name, icon, color) so `ActorPill` can render properly

Files to remove or hide:
- `src/routes/new.tsx` — replaced by per-job routes (or repurposed as fallback)

### Backend

Existing pipeline mostly stays. Required changes:
- `src/server/types.ts` — add `RunJob = "discover" | "dossier" | "connect"` (replaces `RunMode` for new runs; keep `RunMode` typedef for backwards compat through demo).
- `src/server/orchestrator.ts` — branch coordinator prompts and synthesis shape on `job`. New synthesis types: `DiscoverResult`, `DossierResult`, `ConnectResult` (extend `Synthesis` with optional fields).
- `src/server/api.ts` — `POST /api/runs/start` accepts `job` field; back-compat with `mode` for demo events. Demo prompts (`prompt: "demo:dossier-cursor"`) trigger mock mode.
- `src/server/agents/registry.ts` — add `investor-mapper` (was open work, now central) and `warm-path-mapper` (new). Skeletons that emit mock data first; real implementations are stretch.

### Mock-mode demo timeline

New: `src/server/mock/timelines.ts` exporting one timeline per canned scenario. Scenarios:

1. `demo:dossier-cursor` — Cursor (AI coding agent target)
2. `demo:dossier-decagon` — Decagon (vertical AI customer support)
3. `demo:discover-vertical-ai-health` — Discover thesis flow
4. `demo:connect-anthropic` — Connect flow with cap-table

Each timeline is an array of `{ delayMs, event: RunEvent }`. The mock orchestrator path replaces real agent calls but emits identical events through the existing `run-store`. The frontend stays unchanged. Real-keys path remains intact.

## 5. Build order

Each step ends in a runnable, demoable state.

1. **Mock-mode plumbing + 1 dossier scenario** (cursor) — proves the replay path end-to-end with the *current* UI before we redesign anything.
2. **Mission Control shell on `/runs/:id`** — three-pane + dock layout, no new visual flair yet.
3. **Agent terminal panel** — `AgentPanel` + `ActorPill` + `LogStream`. Replaces `AgentChip` only on the run page.
4. **Sources ticker.**
5. **Synth dock — Dossier renderer first** (verdict + bullets + roadmap).
6. **Flow rail mini-DAG** — SVG, animated edges.
7. **Discover route + Discover dock** — thesis input, ranked feed renderer.
8. **Connect route + Connect dock** — cap-table SVG (force-directed) + warm-path list.
9. **Landing facelift** — three job tiles, investor-only copy.
10. **Polish pass** — Framer Motion entry animations, glow tuning, mobile fallback (or "demo on desktop only" banner).

**Stretch:**
11. Build and publish `founder-pedigree-scorer` Apify actor (LinkedIn URL + optional GitHub → structured pedigree score). Wire into `founder-profiler` agent.

## 6. Naming

Keep working name "Dream Weaver" through the build for code stability. Tagline shift to: **"Where deals come from."** Final naming decision deferred to landing-facelift step (step 9).

## 7. Open scope guards

- No real outreach sending — Connect's "draft outreach" only renders the draft.
- No persistence beyond a run's lifetime; existing in-memory `Map` is fine.
- No auth, no multi-user — same as current.
- Mobile is "best-effort"; demo runs on a laptop.
- Cloudflare Workers deploy stays out of scope (already noted in `AGENT_CONTEXT.md`).

## 8. Success criteria for the demo

- A judge sees three buttons (Discover / Dossier / Connect), clicks Dossier, types "Cursor," and within 5 seconds sees agents fan out, actor pills counting up, sources streaming, and a verdict materializing token-by-token. Total demo: <90 seconds per job.
- For every visible card and source, the actor that produced it is visible without a click.
- `bun run lint` and `bunx tsc --noEmit` stay clean.
- The existing real-keys path still works (smoke-test command from `AGENT_CONTEXT.md` still passes).

## 9. Decisions logged

- **Flow rail:** hand-drawn SVG, not `react-flow`.
- **Animation:** Framer Motion (~40KB).
- **Demo data:** mock-mode replayer keyed off `prompt: "demo:..."` prefix. Real path untouched.
- **All three jobs in v1**, not just Dossier.
- **Founder pedigree actor**: stretch only, after the three jobs land.
- **Naming:** keep "Dream Weaver" through build; revisit at landing facelift.

## 10. Out of scope

- Real Harmonic API integration
- Real intro-sending or CRM integration
- Multi-user accounts, persistence, auth
- Real-time streaming reconnection beyond what `useRunStream` already does
- Cloudflare Workers / Durable Object migration
