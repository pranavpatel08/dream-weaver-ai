// Competitor Mapper — finds competitive companies/products via Google SERP,
// then summarizes each result into a Card.
//
// Apify actor: apify/google-search-scraper (id: nFJndFXA5zjCTuudP)
//   docs: https://apify.com/apify/google-search-scraper

import { runActorSync } from "../apify";
import { complete } from "../llm";
import { getEnv } from "../env";
import type { AgentModule } from "./types";
import { newCardId } from "./types";

const ACTOR = "apify/google-search-scraper";

type SerpItem = {
  title?: string;
  url?: string;
  description?: string;
  displayedUrl?: string;
  position?: number;
};

type SerpResult = {
  searchQuery?: { term?: string };
  organicResults?: SerpItem[];
};

export const competitorMapper: AgentModule = {
  id: "competitor-mapper",
  label: "Competitor Mapper",
  description: "Finds competitors and adjacent players via Google SERP scraping.",
  modes: ["founder", "investor"],
  color: "#60a5fa", // blue-400
  icon: "Search",
  actorIds: [ACTOR],

  async run({ intent, prompt, emit }) {
    const query = buildQuery(prompt, intent);
    emit.log(`Querying Google: "${query}"`);

    const datasets = await runActorSync<SerpResult>(ACTOR, {
      queries: query,
      maxPagesPerQuery: 1,
      resultsPerPage: 10,
      countryCode: "us",
      languageCode: "en",
    });

    const results = datasets.flatMap((d) => d.organicResults ?? []).slice(0, 10);
    if (!results.length) {
      emit.log("Google returned no organic results.");
      return;
    }

    for (const r of results) {
      if (!r.url || !r.title) continue;
      emit.source({
        id: newCardId(),
        url: r.url,
        title: r.title,
        snippet: r.description,
        actorId: ACTOR,
        agentId: "competitor-mapper",
      });
    }

    // Summarize the SERP into competitor cards via LLM.
    // In demo mode without an LLM key, fall back to "card per result".
    const env = getEnv();
    if (!env.llm.apiKey || env.mockLlm) {
      for (const r of results.slice(0, 6)) {
        emit.card({
          id: newCardId(),
          kind: "competitor",
          title: cleanTitle(r.title ?? "Untitled"),
          subtitle: r.displayedUrl ?? new URL(r.url ?? "https://x").host,
          body: r.description ?? "",
          url: r.url,
          agentId: "competitor-mapper",
        });
      }
      return;
    }

    const summary = await complete({
      tier: "worker",
      temperature: 0.3,
      maxTokens: 700,
      messages: [
        {
          role: "system",
          content:
            "You map competitive landscapes. From the supplied Google search results, return up to 6 competitor companies as JSON: an array of {name, oneLiner, url}. Skip aggregator pages, news roundups, and obviously irrelevant results. Respond with ONLY the JSON array.",
        },
        {
          role: "user",
          content: `Search query: "${query}"\nIntent: ${intent}\nResults:\n${results
            .map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description ?? ""}`)
            .join("\n")}`,
        },
      ],
    });

    let parsed: { name: string; oneLiner: string; url: string }[] = [];
    try {
      parsed = JSON.parse(extractJsonArray(summary));
    } catch {
      emit.log("Coordinator LLM returned non-JSON; falling back to raw cards.");
    }

    if (!parsed.length) {
      for (const r of results.slice(0, 6)) {
        if (!r.url || !r.title) continue;
        emit.card({
          id: newCardId(),
          kind: "competitor",
          title: cleanTitle(r.title),
          subtitle: r.displayedUrl ?? new URL(r.url).host,
          body: r.description ?? "",
          url: r.url,
          agentId: "competitor-mapper",
        });
      }
      return;
    }

    for (const c of parsed.slice(0, 6)) {
      emit.card({
        id: newCardId(),
        kind: "competitor",
        title: c.name,
        subtitle: safeHost(c.url),
        body: c.oneLiner,
        url: c.url,
        agentId: "competitor-mapper",
      });
    }
  },
};

function buildQuery(prompt: string, intent: string): string {
  // Strip leading verbs like "build a" / "should I invest in" so the SERP
  // sees the topic, not the question.
  const cleaned = prompt
    .replace(
      /^(should i invest in|invest in|build (a |an )?|i want to build (a |an )?|startup for |startup that )/i,
      "",
    )
    .replace(/[?.!]$/, "");
  return `${cleaned} startups competitors`;
}

function cleanTitle(t: string): string {
  return t.replace(/\s*[-|·–]\s*[^|]+$/, "").slice(0, 80);
}

function safeHost(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}

function extractJsonArray(s: string): string {
  const start = s.indexOf("[");
  const end = s.lastIndexOf("]");
  if (start < 0 || end <= start) return "[]";
  return s.slice(start, end + 1);
}
