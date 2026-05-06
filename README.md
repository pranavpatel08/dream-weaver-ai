# Dream Builder

A platform where users describe any dream (business, project, life goal, creative pursuit), and a team of AI agents researches, analyzes, and builds a living dashboard to help them pursue it.

## Core User Flow

1. **Sign in** (email/password + Google) — dreams are saved to their account
2. **Describe the dream** — free-form prompt + a few quick clarifying questions the AI generates
3. **Watch the agents work** — live progress feed as agents run in parallel
4. **Explore the dashboard** — interactive report with sections, sources, and follow-up actions
5. **Iterate** — ask follow-up questions, regenerate sections, save versions

## The Agent Team

A coordinator agent reads the prompt, decides which specialists to deploy, then synthesizes their outputs.

1. **Clarifier** — asks 3–5 sharp questions up front to scope the dream (skippable)
2. **Researcher** — web search + Firecrawl scraping to gather facts, examples, precedents, market data
3. **Landscape Analyst** — maps competitors, comparable projects, key players, communities
4. **Opportunity Analyst** — identifies gaps, trends, unique angles, SWOT
5. **Strategist** — turns findings into a concrete roadmap with phases and milestones
6. **Resource Curator** — tools, courses, communities, people to follow, books, funding sources
7. **Critic** — stress-tests the plan, surfaces risks, blind spots, and counter-arguments
8. **Synthesizer** — produces the executive summary tying everything together

Agents run in parallel where possible; status streams to the UI as each completes.

## Interactive Dashboard

The deliverable is a single dashboard page per dream with collapsible sections:

- **Hero**: dream title, one-line vision, progress indicators
- **Executive Summary**: synthesized 5-bullet overview
- **Landscape**: competitor/comparable cards with logos and links
- **Opportunities & Risks**: side-by-side SWOT-style cards
- **Roadmap**: phased timeline (Now / Next / Later) with milestones
- **Resources**: categorized list (learn, tools, communities, funding)
- **Critical Questions**: items the user should answer or research further
- **Sources**: every citation with link to original page
- **Chat panel**: ask follow-ups, regenerate any section, "go deeper on X"

Each section shows which agent produced it and is individually re-runnable.

## Pages

- `/` — Landing (what it does, example dreams, sign in CTA)
- `/login` & `/signup`
- `/dashboard` — list of user's dreams + "New dream" button
- `/dreams/new` — prompt + clarifier flow
- `/dreams/$id` — the live agent run + interactive dashboard
- `/account` — profile, sign out

## Design

Dark, focused, slightly editorial — think Linear meets a research notebook. Generous whitespace, clear typography hierarchy, soft animation as agent results stream in. Each agent has a small avatar/color so the user can tell who said what.

## Technical Approach

- **Auth**: Lovable Cloud — email/password + Google, with `profiles` table
- **Database**: `dreams`, `agent_runs`, `agent_outputs`, `sources`, `chat_messages` tables, RLS scoped to `user_id`
- **Agents**: Lovable AI Gateway (`google/gemini-3-flash-preview` default; `gemini-2.5-pro` for synthesis/critic). Coordinator orchestrates via tool-calling
- **Web research**: Firecrawl connector for scrape/search/map
- **Streaming**: SSE from a server function to stream agent status + tokens into the dashboard live
- **Server logic**: TanStack `createServerFn` for orchestration; one server route per agent so they can run in parallel

## Phase 1 Scope

Auth, new-dream flow, coordinator + 4 core agents (Researcher, Landscape, Strategist, Synthesizer), live streaming dashboard with sources, saved dream history, follow-up chat. Critic, Resource Curator, Opportunity Analyst, and section re-runs come in Phase 2.