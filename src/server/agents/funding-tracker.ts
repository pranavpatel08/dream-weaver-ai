// Funding & Deals Tracker — scrapes funding-tracker style news from
// TechCrunch / Crunchbase News / FinSMEs via complex_intricate_networks/fundraising-and-startup-funding-scraper,
// falls back to Google News search if that fails.

import { runActorSync } from "../apify";
import type { AgentModule } from "./types";
import { newCardId } from "./types";

const FUNDING_ACTOR = "complex_intricate_networks/fundraising-and-startup-funding-scraper";
const SEARCH_ACTOR = "apify/google-search-scraper";

type FundingDeal = {
  company?: string;
  amount?: string;
  round?: string;
  date?: string;
  sourceUrl?: string;
  description?: string;
};

type SerpItem = { title?: string; url?: string; description?: string };
type SerpResult = { organicResults?: SerpItem[] };

export const fundingTracker: AgentModule = {
  id: "funding-tracker",
  label: "Funding Tracker",
  description: "Recent rounds, valuations, and comparable deals.",
  modes: ["founder", "investor"],
  color: "#34d399", // emerald-400
  icon: "LineChart",
  actorIds: [FUNDING_ACTOR, SEARCH_ACTOR],

  async run({ prompt, emit }) {
    const topic = stripVerbs(prompt);
    const keywords = topicKeywords(topic);

    // The fundraising-and-startup-funding-scraper actor doesn't accept a
    // keyword filter (verified via Apify MCP fetch-actor-details — only
    // dateFilter + maxRequestsPerCrawl). It scrapes recent funding news
    // from TechCrunch / Crunchbase News / FinSMEs in the time window;
    // we filter client-side for matches against the user's topic.
    let deals: FundingDeal[] = [];
    try {
      deals = await runActorSync<FundingDeal>(FUNDING_ACTOR, {
        dateFilter: "30",
        maxRequestsPerCrawl: 50,
      });
    } catch (err) {
      emit.log(`Funding actor failed: ${(err as Error).message.slice(0, 120)}`);
    }

    const matches = deals.filter((d) => matchesTopic(d, keywords)).slice(0, 6);
    for (const d of matches) {
      if (!d.company) continue;
      emit.source({
        id: newCardId(),
        url: d.sourceUrl ?? "",
        title: `${d.company} ${d.round ?? "round"}`,
        snippet: d.description,
        actorId: FUNDING_ACTOR,
        agentId: "funding-tracker",
      });
      emit.card({
        id: newCardId(),
        kind: "funding",
        title: d.company,
        subtitle: [d.round, d.amount, d.date].filter(Boolean).join(" · "),
        body: d.description ?? "",
        url: d.sourceUrl,
        meta: { round: d.round ?? null, amount: d.amount ?? null },
        agentId: "funding-tracker",
      });
    }

    // Always also run the targeted Google search — gives us topic-specific
    // hits the recent-funding feed is too narrow to have caught.
    emit.log(`Cross-checking Google for "${topic} funding raise".`);
    try {
      const serps = await runActorSync<SerpResult>(SEARCH_ACTOR, {
        queries: `${topic} raises funding round Series`,
        maxPagesPerQuery: 1,
        countryCode: "us",
      });
      const results = serps.flatMap((s) => s.organicResults ?? []).slice(0, 6);
      for (const r of results) {
        if (!r.url || !r.title) continue;
        emit.source({
          id: newCardId(),
          url: r.url,
          title: r.title,
          snippet: r.description,
          actorId: SEARCH_ACTOR,
          agentId: "funding-tracker",
        });
        emit.card({
          id: newCardId(),
          kind: "funding",
          title: cleanTitle(r.title),
          subtitle: hostFor(r.url),
          body: r.description ?? "",
          url: r.url,
          agentId: "funding-tracker",
        });
      }
    } catch (err) {
      emit.log(`Google funding search failed: ${(err as Error).message.slice(0, 120)}`);
    }
  },
};

function topicKeywords(topic: string): string[] {
  return topic
    .toLowerCase()
    .split(/[\s,/+&]+/)
    .filter((w) => w.length > 3)
    .slice(0, 6);
}

function matchesTopic(d: FundingDeal, keywords: string[]): boolean {
  if (!keywords.length) return true;
  const hay = `${d.company ?? ""} ${d.description ?? ""}`.toLowerCase();
  return keywords.some((k) => hay.includes(k));
}

function stripVerbs(p: string): string {
  return p
    .replace(/^(should i invest in|invest in|build (a |an )?|i want to build (a |an )?)/i, "")
    .replace(/[?.!]+$/, "")
    .slice(0, 80);
}

function cleanTitle(t: string): string {
  return t.replace(/\s*[-|·–]\s*[^|]+$/, "").slice(0, 100);
}

function hostFor(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
