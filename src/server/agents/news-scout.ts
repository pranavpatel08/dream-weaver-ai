// News & Trend Scout — uses Google search with `news` filter for recent coverage.

import { runActorSync } from "../apify";
import type { AgentModule } from "./types";
import { newCardId } from "./types";

const ACTOR = "apify/google-search-scraper";

type SerpItem = { title?: string; url?: string; description?: string; date?: string };
type SerpResult = { organicResults?: SerpItem[] };

export const newsScout: AgentModule = {
  id: "news-scout",
  label: "News & Trend Scout",
  description: "Recent news and coverage of the space.",
  modes: ["founder", "investor"],
  color: "#a78bfa", // violet-400
  icon: "Newspaper",
  actorIds: [ACTOR],

  async run({ intent, prompt, emit }) {
    const query = `${stripVerbs(prompt)} startup OR company OR funding`;
    emit.log(`Google News-style query: "${query}"`);

    // Schema verified via Apify MCP. quickDateRange="m3" = past 3 months,
    // which gives news-style ranking on top of standard organic SERPs.
    const serps = await runActorSync<SerpResult>(ACTOR, {
      queries: query,
      maxPagesPerQuery: 1,
      countryCode: "us",
      quickDateRange: "m3",
    });

    const results = serps.flatMap((s) => s.organicResults ?? []).slice(0, 8);

    for (const r of results) {
      if (!r.url || !r.title) continue;
      emit.source({
        id: newCardId(),
        url: r.url,
        title: r.title,
        snippet: r.description,
        actorId: ACTOR,
        agentId: "news-scout",
      });
      emit.card({
        id: newCardId(),
        kind: "news",
        title: r.title.slice(0, 110),
        subtitle: hostFor(r.url),
        body: r.description ?? "",
        url: r.url,
        agentId: "news-scout",
      });
    }
  },
};

function stripVerbs(p: string): string {
  return p
    .replace(/^(should i invest in|invest in|build (a |an )?|i want to build (a |an )?)/i, "")
    .replace(/[?.!]+$/, "")
    .slice(0, 100);
}

function hostFor(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
