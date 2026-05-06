import type { AgentId, AgentJob, Card, RunJob, Source, Synthesis } from "../types";

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
  synthesis: Synthesis;
};

export const SCENARIOS: Record<string, MockScenario> = {};

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
    {
      delayMs: 0,
      kind: "queue",
      job: makeJob("competitor-mapper", "Map AI coding agent landscape around Cursor", [
        "apify/google-search-scraper",
      ]),
    },
    {
      delayMs: 50,
      kind: "queue",
      job: makeJob("linkedin-company-scout", "LinkedIn company snapshot of Anysphere/Cursor", [
        "harvestapi/linkedin-company-search",
      ]),
    },
    {
      delayMs: 100,
      kind: "queue",
      job: makeJob("founder-profiler", "Profile Michael Truell + Aman Sanger", [
        "apidojo/tweet-scraper",
      ]),
    },
    {
      delayMs: 150,
      kind: "queue",
      job: makeJob("funding-tracker", "Cursor funding history", [
        "complex_intricate_networks/fundraising-and-startup-funding-scraper",
      ]),
    },
    {
      delayMs: 200,
      kind: "queue",
      job: makeJob("sentiment-scout", "Reddit + HN pulse on Cursor vs Copilot", [
        "parseforge/reddit-posts-scraper",
        "gentle_cloud/hacker-news-scraper",
      ]),
    },

    { delayMs: 300, kind: "start", agentId: "competitor-mapper" },
    { delayMs: 350, kind: "start", agentId: "linkedin-company-scout" },
    { delayMs: 400, kind: "start", agentId: "founder-profiler" },
    { delayMs: 500, kind: "start", agentId: "funding-tracker" },
    { delayMs: 600, kind: "start", agentId: "sentiment-scout" },

    {
      delayMs: 800,
      kind: "log",
      agentId: "competitor-mapper",
      message: "Calling apify/google-search-scraper · query='AI coding agent Cursor competitor'",
    },
    {
      delayMs: 1100,
      kind: "log",
      agentId: "linkedin-company-scout",
      message: "Calling harvestapi/linkedin-company-search · searchQuery='Anysphere'",
    },
    {
      delayMs: 1500,
      kind: "source",
      agentId: "competitor-mapper",
      source: {
        id: "s1",
        url: "https://github.com/features/copilot",
        title: "GitHub Copilot — Your AI pair programmer",
        actorId: "apify/google-search-scraper",
        agentId: "competitor-mapper",
      },
    },
    {
      delayMs: 1900,
      kind: "card",
      agentId: "competitor-mapper",
      card: {
        id: "c1",
        kind: "competitor",
        title: "GitHub Copilot",
        subtitle: "Microsoft · $10/mo",
        body: "First-mover; lock-in via VS Code; weaker at agentic edits.",
        agentId: "competitor-mapper",
      },
    },
    {
      delayMs: 2200,
      kind: "source",
      agentId: "linkedin-company-scout",
      source: {
        id: "s2",
        url: "https://linkedin.com/company/anysphere",
        title: "Anysphere — 87 employees",
        actorId: "harvestapi/linkedin-company-search",
        agentId: "linkedin-company-scout",
      },
    },
    {
      delayMs: 2400,
      kind: "card",
      agentId: "linkedin-company-scout",
      card: {
        id: "c2",
        kind: "competitor",
        title: "Anysphere (Cursor)",
        subtitle: "87 employees · 3.2x YoY headcount",
        body: "Engineering-heavy team; SF based; 78% senior IC.",
        agentId: "linkedin-company-scout",
      },
    },
    {
      delayMs: 2700,
      kind: "source",
      agentId: "founder-profiler",
      source: {
        id: "s3",
        url: "https://x.com/mntruell",
        title: "Michael Truell on X",
        actorId: "apidojo/tweet-scraper",
        agentId: "founder-profiler",
      },
    },
    {
      delayMs: 2900,
      kind: "card",
      agentId: "founder-profiler",
      card: {
        id: "c3",
        kind: "founder",
        title: "Michael Truell, CEO",
        subtitle: "MIT '22 · ex-Google",
        body: "Builds in public; high-velocity tweets; product-led founder.",
        agentId: "founder-profiler",
      },
    },
    {
      delayMs: 3200,
      kind: "card",
      agentId: "funding-tracker",
      card: {
        id: "c4",
        kind: "funding",
        title: "Series C — $400M @ $9B",
        subtitle: "Dec 2024 · Thrive Capital lead",
        body: "Andreessen, Benchmark, Stripe co-investors. 3rd round in 18 months.",
        agentId: "funding-tracker",
      },
    },
    {
      delayMs: 3500,
      kind: "card",
      agentId: "sentiment-scout",
      card: {
        id: "c5",
        kind: "sentiment",
        title: "r/programming pulse",
        subtitle: "+412 sentiment score (last 30d)",
        body: "Devs migrate from Copilot for agentic edits; complaints on price.",
        agentId: "sentiment-scout",
      },
    },

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
    verdict: {
      label: "Take meeting",
      confidence: 88,
      reasoning:
        "Asymmetric upside on a category leader compounding faster than the rest of dev tools. Entry only available via secondary; primary closed.",
    },
  },
};

SCENARIOS["dossier-cursor"] = cursorScenario;
