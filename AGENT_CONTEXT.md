# Dream Weaver AI — Agent Handoff

Read this first if you're picking up the project. Authoritative plan lives at `~/.claude/plans/i-need-you-to-spicy-puddle.md` (the original, more ambitious Cloudflare-DO version). What actually shipped is described below — it diverges from the plan in important ways.

## What it is

A Silicon-Valley research swarm. Pick **Founder Studio** (build a startup) or **Investor Lens** (evaluate a thesis), type a one-line prompt, watch 4–6 LLM agents fire **real Apify actors** in parallel, stream cards into a live dashboard, end on a synthesized verdict. Built for an Apify-sponsored 24–48h hackathon.

## Status

- ✅ End-to-end working on `bun run dev` → http://localhost:8080
- ✅ Coordinator → fan-out → synthesizer pipeline confirmed (smoke-tested with real keys: 5 agents queued, LinkedIn returned 6 cards + 6 sources)
- ✅ Lint clean, `tsc --noEmit` clean, `bun run build` clean
- ⚠️ Will **not** run on Cloudflare Workers as-is (in-memory state + fire-and-forget). See "Deploy" below.

## Stack

- TanStack Start (React 19, SSR) on Vite
- shadcn/ui + Tailwind v4, dark mode default
- OpenAI-compatible LLM client (Lovable AI Gateway / NVIDIA NIM / OpenAI / Together / Groq)
- Apify REST API via plain `fetch` (no SDK)
- In-memory `Map<runId, RunState>` + Server-Sent Events for live streaming

## Architecture (actually-shipped version)

```
POST /api/runs/start  ── server.ts → api.ts → run-store.createRun()
                                            └─→ orchestrator.runOrchestrator()  (fire-and-forget)
                                                  ├─ pickPlan()    [Coordinator LLM, fallback to all-agents]
                                                  ├─ fan-out: each agent → runActorSync() → emit cards/sources
                                                  └─ synthesize() [Synthesizer LLM]

GET  /api/runs/:id/snapshot  ── current full state (used for SSR hydrate)
GET  /api/runs/:id/stream    ── SSE: replays from event log + live tail
GET  /api/agents             ── public agent metadata (color/icon/label)
```

The `useRunStream(runId)` React hook on `/runs/:id` does SSR-hydrate from `/snapshot` then attaches an `EventSource` to `/stream`. Event log is replayed on reconnect via `Last-Event-ID`.

## File map (read in this order)

1. `src/server/types.ts` — every shared type. Read first.
2. `src/server/run-store.ts` — in-memory state + emit/subscribe.
3. `src/server/api.ts` — the three HTTP endpoints.
4. `src/server.ts` — Worker entry; routes `/api/*` through `maybeHandleApi` before TanStack.
5. `src/server/orchestrator.ts` — coordinator, fan-out, synthesizer. ~220 lines, one file.
6. `src/server/agents/types.ts` + `registry.ts` — agent contract + pool.
7. `src/server/agents/<name>.ts` — one file per agent. All follow the same shape.
8. `src/server/apify.ts` — `runActorSync(actorId, input, opts)` + KV-style cache.
9. `src/server/llm.ts` — `complete()`, `structured(zodSchema)`, `streamComplete()`.
10. `src/lib/run-socket.ts` — `useRunStream(runId)` hook.
11. `src/routes/{index,new,runs.$id}.tsx` — the three pages.
12. `src/components/run/*` — dashboard pieces.

## Setup

```bash
bun install
cp .env.example .env       # then fill in APIFY_TOKEN + LLM_API_KEY
bun run dev                # http://localhost:8080
bun run lint               # 0 errors, 6 pre-existing warnings on shadcn UI files
bunx tsc --noEmit          # 0 errors
bun run build              # SSR + client production build
```

`.env` is gitignored. Don't commit secrets. `.env.example` is the shareable template.

## Apify actors (all schemas verified via Apify MCP `fetch-actor-details`)

| Agent | Actor | Notes |
|---|---|---|
| competitor-mapper | `apify/google-search-scraper` | `queries` (string), `maxPagesPerQuery` |
| linkedin-company-scout | `harvestapi/linkedin-company-search` | `searchQuery` (string, NOT `searchKeywords`), `scraperMode: "full"`, `maxItems` |
| founder-profiler | `apidojo/tweet-scraper` | `searchTerms` (array), `maxItems`, `sort: "Latest"`, `tweetLanguage` |
| funding-tracker | `complex_intricate_networks/fundraising-and-startup-funding-scraper` + Google fallback | Actor takes only `dateFilter` + `maxRequestsPerCrawl` — **no keyword filter**. We filter results client-side, then run a parallel Google search for topic-specific hits. |
| news-scout | `apify/google-search-scraper` | adds `quickDateRange: "m3"` for news-style ranking |
| sentiment-scout (Reddit) | `parseforge/reddit-posts-scraper` | `searchQueries` (array), `proxyConfiguration: { useApifyProxy: true, apifyProxyGroups: ["RESIDENTIAL"] }` is **required** |
| sentiment-scout (HN) | `gentle_cloud/hacker-news-scraper` | `mode: "search"` (required), `query` (singular string), `max_results` |
| youtube-listener | `apify/google-search-scraper` + `pintostudio/youtube-transcript-scraper` | Transcript actor needs `videoUrl` AND `targetLanguage: "en"` |

**Bug history**: my first pass guessed input shapes from MCP `search-actors` summaries and got 4 of 7 wrong. Fixed after running `fetch-actor-details` on each. **Always pull the schema for any new actor.**

## Decisions that diverge from the original plan

| Original plan | Shipped | Why |
|---|---|---|
| Cloudflare Durable Object per run | In-memory `Map` + SSE | User wasn't logged into Cloudflare; vite dev path got us a working demo same-day |
| D1 for persistence | None | Demo doesn't need cross-restart durability |
| KV for scrape cache | In-memory TTL `Map` | Same |
| WebSocket for live updates | SSE | Simpler, auto-reconnects, browser-native, works in vite dev |
| Lovable AI Gateway only | OpenAI-compatible client | One env-var swap to NVIDIA NIM / OpenAI / Groq if Lovable flakes |
| 10 agents | 7 (skipped investor-mapper, hiring-signal-reader, critic) | Wired the registry to make these a one-file add |

## Open work, prioritized

1. **Investor Mapper agent** (warm-investor list). Highest leverage for both modes — founders want "who funded similar?", investors want "who else is in the cap table?". Crunchbase actors are flaky; suggest combining `apify/google-search-scraper` with `site:crunchbase.com` + LinkedIn people scraper.
2. **Mode-specific dashboard sections.** Investor mode currently looks identical to founder. Add a Verdict panel + Comparable Deals to investor; a Roadmap (Now / Next / Later) to founder. Card kinds `verdict` and `roadmap` are already in `types.ts`.
3. **Hiring Signal Reader** — LinkedIn jobs as a traction proxy. Use `harvestapi/linkedin-company-search` with `scraperMode: "full"` + `riceman/linkedin-company-data-insights-scraper` for headcount-growth.
4. **Critic agent** — LLM-only, runs after fan-out, produces "blind spots / risks". Easy add — copy the synthesizer pattern in `orchestrator.ts`.
5. **Pre-warm cache for demo prompts** — script that runs 3 hero prompts so a live demo hits cache and completes in <10s. Touch `src/server/cache.ts` (already in-memory, just need a CLI entry).
6. **Cloudflare migration** (only if a hosted URL is required). See "Deploy" below.

## Deploy — honest take

Lovable hosts this template as a Cloudflare Worker. The current code **breaks on Workers** because:

1. Workers are stateless per request — `Map<runId, RunState>` evaporates between `POST /start` and `GET /stream`.
2. The orchestrator is `void runOrchestrator(...)` — Workers kill the request handler after the response. Need `ctx.waitUntil()`.
3. Each request can hit a different instance.

**To deploy on Cloudflare/Lovable**, do the original-plan migration (~2h):
- Add `RUN_HUB` Durable Object class — one DO instance per `runId`.
- Move `RUNS` map + `subscribe()` set into the DO.
- `/api/runs/start` allocates `env.RUN_HUB.idFromName(runId)`, calls `stub.fetch(...)` from `ctx.waitUntil`.
- `/api/runs/:id/stream` upgrades into the DO and gets the same SSE stream.
- Bindings in `wrangler.jsonc`: `durable_objects` for `RUN_HUB`. Optional `kv_namespaces` for `SCRAPE_CACHE` (for cross-run cache hits).
- Export `RunHub` from `src/server.ts` (Workers requires DO classes exported from the entry).

**Alternative for the hackathon demo**: don't deploy. Run locally and use `cloudflared tunnel --url http://localhost:8080` for a public URL in 10s — zero migration.

Original plan file (for the full DO design): `~/.claude/plans/i-need-you-to-spicy-puddle.md`.

## Gotchas

- **vite.config.ts** uses `@lovable.dev/vite-tanstack-config` which already wires TanStack Start, React, Tailwind, Cloudflare (build-only), ts-paths. Don't add those plugins manually — duplicates break the build.
- **`vite dev` runs in Node**, not Workers. Cloudflare bindings (D1/KV/DO) won't exist there. That's why we used in-memory.
- **Server env reads `process.env`** via `src/server/env.ts`. Bun loads `.env` automatically. For Workers later, `getEnv()` would need to accept the Worker `env` arg.
- **Apify actor input shapes lie in the description** — always call `mcp__apify__fetch-actor-details` with `output: { inputSchema: true }` before integrating.
- **The Reddit actor requires residential proxy config**. Don't drop it.
- **`.env` is gitignored** (added in this session). The `.env.example` template is committed.

## How to verify a change works

After any agent or orchestrator edit:

```bash
bun run dev > /tmp/dev.log 2>&1 &
sleep 8
RUN_ID=$(curl -sS -X POST http://localhost:8080/api/runs/start \
  -H 'content-type: application/json' \
  -d '{"prompt":"AI agents for legal due diligence","mode":"founder"}' | jq -r .runId)
sleep 50
curl -sS http://localhost:8080/api/runs/$RUN_ID/snapshot | jq '.status, .agents[] | {agentId, status, cards: (.cards|length), sources: (.sources|length), error}'
```

Expect: status `done` (or `synthesizing`), ≥2 agents `done`, ≥10 cards across agents, ≥10 sources.

## Contact points

- Plan history: `~/.claude/plans/i-need-you-to-spicy-puddle.md`
- README (user-facing setup): `README.md`
- Env template: `.env.example`
