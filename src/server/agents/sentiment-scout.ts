// Sentiment Scout — surfaces what's being said on Reddit and HN.
// Apify actors: parseforge/reddit-posts-scraper, gentle_cloud/hacker-news-scraper

import { runActorSync } from "../apify";
import type { AgentModule } from "./types";
import { newCardId } from "./types";

const REDDIT_ACTOR = "parseforge/reddit-posts-scraper";
const HN_ACTOR = "gentle_cloud/hacker-news-scraper";

type RedditPost = {
  title?: string;
  url?: string;
  subreddit?: string;
  numComments?: number;
  score?: number;
  selftext?: string;
};

type HnStory = {
  title?: string;
  url?: string;
  points?: number;
  num_comments?: number;
  author?: string;
};

export const sentimentScout: AgentModule = {
  id: "sentiment-scout",
  label: "Sentiment Scout",
  description: "Pulse from Reddit + Hacker News on the topic.",
  modes: ["founder", "investor"],
  color: "#f59e0b", // amber-500
  icon: "MessageSquare",
  actorIds: [REDDIT_ACTOR, HN_ACTOR],

  async run({ intent, prompt, emit }) {
    const query = stripVerbs(prompt);
    emit.log(`Querying Reddit + HN for: "${query}"`);

    // Reddit
    try {
      // Schema verified via Apify MCP fetch-actor-details:
      //   searchQueries: string[], maxItems: int, sort: enum,
      //   proxyConfiguration: { useApifyProxy, apifyProxyGroups } REQUIRED
      const reddit = await runActorSync<RedditPost>(REDDIT_ACTOR, {
        searchQueries: [query],
        maxItems: 8,
        sort: "relevance",
        time: "month",
        proxyConfiguration: {
          useApifyProxy: true,
          apifyProxyGroups: ["RESIDENTIAL"],
        },
      });

      for (const r of reddit.slice(0, 5)) {
        if (!r.title || !r.url) continue;
        emit.source({
          id: newCardId(),
          url: r.url,
          title: r.title,
          snippet: r.selftext?.slice(0, 200),
          actorId: REDDIT_ACTOR,
          agentId: "sentiment-scout",
        });
        emit.card({
          id: newCardId(),
          kind: "sentiment",
          title: r.title.slice(0, 110),
          subtitle: `r/${r.subreddit ?? "?"} · ${r.score ?? 0}↑ · ${r.numComments ?? 0} comments`,
          body: r.selftext?.slice(0, 280) ?? "",
          url: r.url,
          meta: { source: "reddit" },
          agentId: "sentiment-scout",
        });
      }
    } catch (err) {
      emit.log(`Reddit failed: ${(err as Error).message.slice(0, 140)}`);
    }

    // Hacker News (Algolia search)
    try {
      // Schema verified via Apify MCP: mode required (use "search"),
      // query (string), search_sort, max_results.
      const hn = await runActorSync<HnStory>(HN_ACTOR, {
        mode: "search",
        query,
        search_sort: "relevance",
        max_results: 6,
      });

      for (const s of hn.slice(0, 4)) {
        const link = s.url ?? "https://news.ycombinator.com";
        if (!s.title) continue;
        emit.source({
          id: newCardId(),
          url: link,
          title: s.title,
          actorId: HN_ACTOR,
          agentId: "sentiment-scout",
        });
        emit.card({
          id: newCardId(),
          kind: "sentiment",
          title: s.title.slice(0, 110),
          subtitle: `HN · ${s.points ?? 0}↑ · ${s.num_comments ?? 0} comments`,
          url: link,
          meta: { source: "hn" },
          agentId: "sentiment-scout",
        });
      }
    } catch (err) {
      emit.log(`HN failed: ${(err as Error).message.slice(0, 140)}`);
    }
  },
};

function stripVerbs(p: string): string {
  return p
    .replace(/^(should i invest in|invest in|build (a |an )?|i want to build (a |an )?)/i, "")
    .replace(/[?.!]+$/, "")
    .slice(0, 100);
}
