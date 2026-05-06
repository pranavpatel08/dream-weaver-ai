// Founder/Team Profiler — scrapes Twitter for founder/operator commentary
// in the space. Apify actor: apidojo/tweet-scraper

import { runActorSync } from "../apify";
import type { AgentModule } from "./types";
import { newCardId } from "./types";

const ACTOR = "apidojo/tweet-scraper";

type Tweet = {
  id?: string;
  text?: string;
  url?: string;
  fullText?: string;
  author?: { userName?: string; name?: string; profilePicture?: string };
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  createdAt?: string;
};

export const founderProfiler: AgentModule = {
  id: "founder-profiler",
  label: "Founder Profiler",
  description: "Mines X/Twitter for founder voices in the space.",
  modes: ["founder", "investor"],
  color: "#22d3ee", // cyan-400
  icon: "Users",
  actorIds: [ACTOR],

  async run({ intent, prompt, emit }) {
    const query = stripVerbs(prompt);
    emit.log(`X / Twitter search: "${query}"`);

    let tweets: Tweet[] = [];
    try {
      tweets = await runActorSync<Tweet>(ACTOR, {
        searchTerms: [`${query} founder`, `${query} startup`],
        maxItems: 20,
        sort: "Latest",
        tweetLanguage: "en",
      });
    } catch (err) {
      emit.log(`Twitter scrape failed: ${(err as Error).message.slice(0, 140)}`);
      return;
    }

    // De-dup by author and pick the highest-engagement tweet per founder voice.
    const byAuthor = new Map<string, Tweet>();
    for (const t of tweets) {
      const handle = t.author?.userName;
      if (!handle || !t.text) continue;
      const score = (t.likeCount ?? 0) + (t.retweetCount ?? 0);
      const prev = byAuthor.get(handle);
      const prevScore = prev ? (prev.likeCount ?? 0) + (prev.retweetCount ?? 0) : -1;
      if (score > prevScore) byAuthor.set(handle, t);
    }

    const top = [...byAuthor.values()]
      .sort(
        (a, b) =>
          (b.likeCount ?? 0) + (b.retweetCount ?? 0) - ((a.likeCount ?? 0) + (a.retweetCount ?? 0)),
      )
      .slice(0, 6);

    for (const t of top) {
      const url = t.url ?? `https://x.com/${t.author?.userName}/status/${t.id ?? ""}`;
      if (t.text) {
        emit.source({
          id: newCardId(),
          url,
          title: `@${t.author?.userName ?? "?"}`,
          snippet: t.text.slice(0, 200),
          actorId: ACTOR,
          agentId: "founder-profiler",
        });
      }
      emit.card({
        id: newCardId(),
        kind: "founder",
        title: t.author?.name ?? `@${t.author?.userName}`,
        subtitle: `@${t.author?.userName ?? "?"} · ${t.likeCount ?? 0} likes`,
        body: (t.fullText ?? t.text ?? "").slice(0, 280),
        url,
        agentId: "founder-profiler",
      });
    }
  },
};

function stripVerbs(p: string): string {
  return p
    .replace(/^(should i invest in|invest in|build (a |an )?|i want to build (a |an )?)/i, "")
    .replace(/[?.!]+$/, "")
    .slice(0, 80);
}
