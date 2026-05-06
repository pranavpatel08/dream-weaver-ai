# Dream Weaver AI

From a one-line idea to a sourced dashboard in three minutes.

A coordinator LLM dispatches a swarm of agents that scrape **real Apify actors**
(LinkedIn, Google, X/Twitter, Reddit, HN, YouTube transcripts), streams results
into a live dashboard, and ends with a synthesized verdict — for both
**founders** ("help me build this") and **investors** ("should I invest?").

## Why this exists

Apify is the world's largest marketplace of scraping actors. Pointing a swarm
of LLM agents at them turns a one-line prompt into a sourced research
dashboard in minutes — every claim cites the Apify actor that fetched it.

## How it works

```
User /new (prompt + mode)
   │
   ▼
POST /api/runs/start            ← creates run + spawns orchestrator
   │
   ▼
Coordinator (LLM)  →  AgentPlan: which 4–6 agents, with what intent
   │
   ▼  (parallel fan-out)
Competitor Mapper   ─┐
LinkedIn Scout      ─┤
Founder Profiler    ─┼─►  Apify run-sync  ─►  dataset rows
Funding Tracker     ─┤        ↓
News Scout          ─┤   Worker LLM extracts cards
Sentiment Scout     ─┤        ↓
YouTube Listener    ─┘   emit(card | source | log)
                              ↓
   In-memory run store  →  SSE /api/runs/:id/stream
                              ↓
                /runs/:id live dashboard
   ▼
Synthesizer (LLM) → mode-specific verdict / roadmap
```

## Stack

- **TanStack Start** (React 19, SSR) on Vite
- **shadcn/ui + Tailwind v4** dark UI
- **OpenAI-compatible** LLM client — works with **Lovable AI Gateway**,
  **NVIDIA NIM**, **OpenAI**, Together, Groq
- **Apify** REST API via `fetch` (no SDK — works on Node and Workers)
- **In-memory** run store + **SSE** for live streaming

## Setup

```bash
bun install
cp .env.example .env.local
# fill in APIFY_TOKEN and LLM_API_KEY in .env.local
bun run dev
# → http://localhost:8080
```

### Required secrets

| var                    | what                                                |
| ---------------------- | --------------------------------------------------- |
| `APIFY_TOKEN`          | https://console.apify.com/settings/integrations     |
| `LLM_API_KEY`          | API key for the provider you choose below           |
| `LLM_BASE_URL`         | OpenAI-compatible chat-completions base URL         |
| `LLM_MODEL_COORDINATOR`| coordinator + synthesizer model                     |
| `LLM_MODEL_WORKER`     | worker-tier extraction model                        |

Pre-set provider examples are in `.env.example`. Defaults target Lovable AI
Gateway with Gemini 3 Flash (workers) + Gemini 2.5 Pro (coordinator).

### Optional

- `DEMO_MODE=1` — agents fall back to simpler card layouts when LLM is
  unavailable; lets the demo still light up if the gateway flakes.

## Apify actors used

| agent                  | actor                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| competitor-mapper      | `apify/google-search-scraper`                                                               |
| linkedin-company-scout | `harvestapi/linkedin-company-search`                                                        |
| founder-profiler       | `apidojo/tweet-scraper`                                                                     |
| funding-tracker        | `complex_intricate_networks/fundraising-and-startup-funding-scraper` (Google fallback)      |
| news-scout             | `apify/google-search-scraper`                                                               |
| sentiment-scout        | `parseforge/reddit-posts-scraper`, `gentle_cloud/hacker-news-scraper`                       |
| youtube-listener       | `apify/google-search-scraper` + `pintostudio/youtube-transcript-scraper`                    |

Every card surfaced by an agent is tagged with the actor that fetched it,
visible on the **Sources** tab.

## Project structure

```
src/
  server/
    env.ts            — typed env (APIFY_TOKEN, LLM_*, …)
    types.ts          — RunSnapshot, Card, Source, AgentJob, RunEvent
    apify.ts          — runActorSync via fetch + cached()
    cache.ts          — in-memory TTL cache
    llm.ts            — OpenAI-compatible client (complete/structured/stream)
    run-store.ts      — Map<runId, RunState> + SSE pub/sub
    orchestrator.ts   — coordinator → fan-out → synthesizer
    api.ts            — POST /api/runs/start, GET /api/runs/:id/{snapshot,stream}
    agents/
      registry.ts     — AGENT_BY_ID + agentsForMode + publicAgentMeta
      types.ts        — AgentModule, EmitFn, AgentRunCtx
      <agent>.ts      — one file per agent
  routes/
    index.tsx         — landing
    new.tsx           — prompt + mode toggle
    runs.$id.tsx      — split-pane live dashboard
  components/run/     — AgentChip, AgentTimeline, DashboardCard, …
  lib/
    agent-meta.ts     — display metadata (label / color / icon)
    run-socket.ts     — useRunStream(runId) → { snapshot, connected }
```

## Verifying

```bash
bun run lint              # ESLint, expect 0 errors
bunx tsc --noEmit         # TypeScript, expect 0 errors
bun run build             # SSR + client production build
bun run dev               # http://localhost:8080
```

Then in the browser: pick **Founder Studio** → enter `AI agents for legal
due diligence` → run. Watch agents in the left rail go from `pending` →
`running` → `done`, cards stream into the dashboard, and a verdict appears
in the Synthesis tab.

## Out of scope (v1)

Auth, accounts, persistence across restarts, follow-up chat, exports. The
in-memory run store is fine for the demo — restart wipes runs.
