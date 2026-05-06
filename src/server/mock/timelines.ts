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

const verticalAiHealthDiscover: MockScenario = {
  id: "discover-vertical-ai-health",
  job: "discover",
  prompt: "Vertical AI for healthcare back-office (claims, prior auth, RCM)",
  steps: [
    {
      delayMs: 0,
      kind: "queue",
      job: makeJob("competitor-mapper", "Find candidates in healthcare back-office AI", [
        "apify/google-search-scraper",
      ]),
    },
    {
      delayMs: 50,
      kind: "queue",
      job: makeJob("linkedin-company-scout", "Headcount + growth signal on top candidates", [
        "harvestapi/linkedin-company-search",
      ]),
    },
    {
      delayMs: 100,
      kind: "queue",
      job: makeJob("founder-profiler", "Founder pedigree on each candidate", [
        "apidojo/tweet-scraper",
      ]),
    },
    {
      delayMs: 150,
      kind: "queue",
      job: makeJob("funding-tracker", "Funding rounds in space (last 12mo)", [
        "complex_intricate_networks/fundraising-and-startup-funding-scraper",
      ]),
    },

    { delayMs: 250, kind: "start", agentId: "competitor-mapper" },
    { delayMs: 300, kind: "start", agentId: "linkedin-company-scout" },
    { delayMs: 350, kind: "start", agentId: "founder-profiler" },
    { delayMs: 400, kind: "start", agentId: "funding-tracker" },

    {
      delayMs: 600,
      kind: "log",
      agentId: "competitor-mapper",
      message: "Calling apify/google-search-scraper · query='vertical AI prior auth claims RCM'",
    },
    {
      delayMs: 900,
      kind: "log",
      agentId: "linkedin-company-scout",
      message: "Calling harvestapi/linkedin-company-search · 6 queries queued",
    },
    {
      delayMs: 1100,
      kind: "log",
      agentId: "founder-profiler",
      message: "Calling apidojo/tweet-scraper · 6 founder handles",
    },
    {
      delayMs: 1300,
      kind: "log",
      agentId: "funding-tracker",
      message: "Filtering rounds by 'healthcare AI' + 'RCM' keywords",
    },

    {
      delayMs: 1500,
      kind: "source",
      agentId: "competitor-mapper",
      source: {
        id: "ds1",
        url: "https://anterior.com",
        title: "Anterior — Prior auth automation",
        actorId: "apify/google-search-scraper",
        agentId: "competitor-mapper",
      },
    },
    {
      delayMs: 1700,
      kind: "card",
      agentId: "competitor-mapper",
      card: {
        id: "dc1",
        kind: "competitor",
        title: "Anterior",
        subtitle: "Prior auth for payers",
        body: "Direct match — automating UM workflows for health plans.",
        agentId: "competitor-mapper",
      },
    },

    {
      delayMs: 1900,
      kind: "source",
      agentId: "linkedin-company-scout",
      source: {
        id: "ds2",
        url: "https://linkedin.com/company/anterior",
        title: "Anterior — 38 employees, +12 in 90d",
        actorId: "harvestapi/linkedin-company-search",
        agentId: "linkedin-company-scout",
      },
    },
    {
      delayMs: 2100,
      kind: "card",
      agentId: "linkedin-company-scout",
      card: {
        id: "dc2",
        kind: "hiring",
        title: "Anterior headcount sprint",
        subtitle: "+12 hires in 90d (38 → 50)",
        body: "Three from UnitedHealth — high-signal hire from a payer.",
        agentId: "linkedin-company-scout",
      },
    },

    {
      delayMs: 2300,
      kind: "source",
      agentId: "founder-profiler",
      source: {
        id: "ds3",
        url: "https://x.com/anterior_ceo",
        title: "Anterior CEO on X",
        actorId: "apidojo/tweet-scraper",
        agentId: "founder-profiler",
      },
    },
    {
      delayMs: 2500,
      kind: "card",
      agentId: "founder-profiler",
      card: {
        id: "dc3",
        kind: "founder",
        title: "Anterior founders",
        subtitle: "ex-Stripe risk + MIT EECS",
        body: "Risk modeling team that owned chargeback infra at Stripe — strong fit.",
        agentId: "founder-profiler",
      },
    },

    {
      delayMs: 2800,
      kind: "card",
      agentId: "funding-tracker",
      card: {
        id: "dc4",
        kind: "funding",
        title: "Latent — Seed round closing",
        subtitle: "Sequoia term sheet rumored · $4-6M",
        body: "Pre-empt window: 8 weeks. Secondary co-investor slot likely.",
        agentId: "funding-tracker",
      },
    },

    {
      delayMs: 3100,
      kind: "card",
      agentId: "competitor-mapper",
      card: {
        id: "dc5",
        kind: "competitor",
        title: "Claimable",
        subtitle: "Denials management agents",
        body: "30 logos, $2.4M ARR — emerging. Founders ex-Olive AI.",
        agentId: "competitor-mapper",
      },
    },
    {
      delayMs: 3400,
      kind: "card",
      agentId: "linkedin-company-scout",
      card: {
        id: "dc6",
        kind: "competitor",
        title: "Encoda",
        subtitle: "Coding + audit for specialty practices",
        body: "Physician-founder; Reddit r/medicalcoding sentiment trending up.",
        agentId: "linkedin-company-scout",
      },
    },
    {
      delayMs: 3700,
      kind: "card",
      agentId: "founder-profiler",
      card: {
        id: "dc7",
        kind: "founder",
        title: "Vivian Health AI",
        subtitle: "ex-Vivian / ex-Trusted founders",
        body: "Staffing + clinical credentialing focus; two hires from Forge.",
        agentId: "founder-profiler",
      },
    },

    { delayMs: 4000, kind: "finish", agentId: "competitor-mapper" },
    { delayMs: 4100, kind: "finish", agentId: "linkedin-company-scout" },
    { delayMs: 4200, kind: "finish", agentId: "founder-profiler" },
    { delayMs: 4300, kind: "finish", agentId: "funding-tracker" },
  ],
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
        {
          id: "anterior",
          name: "Anterior",
          oneLiner: "Prior auth automation for payers",
          discoveryScore: 92,
          pedigree: "ex-Stripe risk team, MIT EECS",
          signal: "+3 hires from UnitedHealth in last 30d",
          url: "https://anterior.com",
        },
        {
          id: "latent",
          name: "Latent",
          oneLiner: "RCM for ambulatory groups",
          discoveryScore: 88,
          pedigree: "ex-Athena, ex-Scale",
          signal: "Just closed seed; Sequoia term sheet rumor",
          url: "https://latent.com",
        },
        {
          id: "claimable",
          name: "Claimable",
          oneLiner: "Denials management agents",
          discoveryScore: 84,
          pedigree: "ex-Olive AI",
          signal: "30 logo customers; $2.4M ARR",
          url: "https://claimable.ai",
        },
        {
          id: "encoda",
          name: "Encoda",
          oneLiner: "Coding + audit for specialty practices",
          discoveryScore: 79,
          pedigree: "physician-founder",
          signal: "Reddit r/medicalcoding mentions trending up",
          url: "https://encoda.com",
        },
        {
          id: "vivian",
          name: "Vivian Health AI",
          oneLiner: "Staffing + clinical credentialing",
          discoveryScore: 73,
          pedigree: "ex-Vivian, ex-Trusted",
          signal: "Two hires from Forge",
          url: "https://vivian.ai",
        },
        {
          id: "pylon",
          name: "Pylon",
          oneLiner: "Provider data management",
          discoveryScore: 70,
          pedigree: "ex-Mirah",
          signal: "Quiet for 90 days; cash-strapped",
          url: "https://pylonhealth.com",
        },
      ],
    },
  },
};

SCENARIOS["discover-vertical-ai-health"] = verticalAiHealthDiscover;

const connectAnthropic: MockScenario = {
  id: "connect-anthropic",
  job: "connect",
  prompt: "Anthropic",
  steps: [
    {
      delayMs: 0,
      kind: "queue",
      job: makeJob("linkedin-company-scout", "Map Anthropic team + cap-table investors", [
        "harvestapi/linkedin-company-search",
      ]),
    },
    {
      delayMs: 50,
      kind: "queue",
      job: makeJob("founder-profiler", "Founder reachability + outreach signal", [
        "apidojo/tweet-scraper",
      ]),
    },
    {
      delayMs: 100,
      kind: "queue",
      job: makeJob("news-scout", "Recent fundraises + investor announcements", [
        "apify/google-search-scraper",
      ]),
    },

    { delayMs: 200, kind: "start", agentId: "linkedin-company-scout" },
    { delayMs: 250, kind: "start", agentId: "founder-profiler" },
    { delayMs: 300, kind: "start", agentId: "news-scout" },

    {
      delayMs: 500,
      kind: "log",
      agentId: "linkedin-company-scout",
      message: "Calling harvestapi/linkedin-company-search · searchQuery='Anthropic'",
    },
    {
      delayMs: 800,
      kind: "log",
      agentId: "founder-profiler",
      message: "Calling apidojo/tweet-scraper · @darioamodei",
    },
    {
      delayMs: 1100,
      kind: "log",
      agentId: "news-scout",
      message: "Calling apify/google-search-scraper · 'Anthropic Series + investors'",
    },

    {
      delayMs: 1300,
      kind: "source",
      agentId: "linkedin-company-scout",
      source: {
        id: "ks1",
        url: "https://linkedin.com/company/anthropic",
        title: "Anthropic — 850+ employees",
        actorId: "harvestapi/linkedin-company-search",
        agentId: "linkedin-company-scout",
      },
    },
    {
      delayMs: 1500,
      kind: "card",
      agentId: "linkedin-company-scout",
      card: {
        id: "kc1",
        kind: "investor",
        title: "Spark Capital",
        subtitle: "Series A lead · 2021",
        body: "Bijan Sabet's bet; he's no longer at Spark — pivot to Sarah Guo (now Conviction).",
        agentId: "linkedin-company-scout",
      },
    },

    {
      delayMs: 1800,
      kind: "source",
      agentId: "news-scout",
      source: {
        id: "ks2",
        url: "https://techcrunch.com/anthropic-series-c",
        title: "Anthropic raises $750M",
        actorId: "apify/google-search-scraper",
        agentId: "news-scout",
      },
    },
    {
      delayMs: 2000,
      kind: "card",
      agentId: "news-scout",
      card: {
        id: "kc2",
        kind: "funding",
        title: "Series D — Google + others",
        subtitle: "$2B+ commitments",
        body: "Lightspeed, Salesforce Ventures, Menlo, Fidelity follow.",
        agentId: "news-scout",
      },
    },

    {
      delayMs: 2200,
      kind: "source",
      agentId: "founder-profiler",
      source: {
        id: "ks3",
        url: "https://x.com/darioamodei",
        title: "Dario Amodei on X",
        actorId: "apidojo/tweet-scraper",
        agentId: "founder-profiler",
      },
    },
    {
      delayMs: 2400,
      kind: "card",
      agentId: "founder-profiler",
      card: {
        id: "kc3",
        kind: "founder",
        title: "Dario + Daniela Amodei",
        subtitle: "ex-OpenAI · Stanford CS PhD network",
        body: "Cold inbound mostly batch-ignored; warm portfolio routing strongly preferred.",
        agentId: "founder-profiler",
      },
    },

    {
      delayMs: 2700,
      kind: "card",
      agentId: "linkedin-company-scout",
      card: {
        id: "kc4",
        kind: "investor",
        title: "Cap-table fan-out",
        subtitle: "Spark, Lightspeed, Salesforce, Google, Menlo, Fidelity",
        body: "11 named investors total; Spark is the warmest path via Sarah Guo (now Conviction).",
        agentId: "linkedin-company-scout",
      },
    },

    { delayMs: 3000, kind: "finish", agentId: "linkedin-company-scout" },
    { delayMs: 3100, kind: "finish", agentId: "founder-profiler" },
    { delayMs: 3200, kind: "finish", agentId: "news-scout" },
  ],
  synthesis: {
    summary: "Three warm paths exist. Start with Sarah at Conviction.",
    bullets: [
      "Cap-table: Spark, Lightspeed, Salesforce, Google, Menlo, Fidelity — 11 named investors total.",
      "Strongest path: Sarah Guo @ Conviction — co-led Anthropic's Series A while at Spark.",
      "Founder is responsive to deeply technical inbound; signal-heavy outreach > volume.",
      "Avoid cold founder DM — they batch-ignore; route via portfolio CEO instead.",
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
        {
          id: "p1",
          via: "Spark Capital → Sarah Guo (Conviction)",
          hops: [
            { name: "Sarah Guo", role: "ex-Spark partner" },
            { name: "Dario Amodei", role: "CEO Anthropic" },
          ],
          strength: 92,
          rationale: "Sarah co-led Anthropic's Series A while at Spark; warmest hop.",
        },
        {
          id: "p2",
          via: "Vellum (your portfolio) → Anthropic Solutions Eng",
          hops: [
            { name: "Akash Sharma", role: "CEO Vellum" },
            { name: "Nicholas Joseph", role: "Engineering Lead" },
          ],
          strength: 78,
          rationale: "Vellum is an Anthropic API ecosystem company; reciprocal dependency.",
        },
        {
          id: "p3",
          via: "Stanford CS PhD network",
          hops: [{ name: "Chris Olah", role: "Co-founder" }],
          strength: 64,
          rationale: "Stanford alumni cluster — slower, less pointed.",
        },
        {
          id: "p4",
          via: "Cold outreach (signal-heavy)",
          hops: [],
          strength: 35,
          rationale: "Last resort; only with a technical artifact attached.",
        },
      ],
    },
  },
};

SCENARIOS["connect-anthropic"] = connectAnthropic;
