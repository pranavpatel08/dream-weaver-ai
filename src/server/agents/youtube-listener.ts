// YouTube Listener — pulls VC/founder podcast transcripts relevant to the topic
// and surfaces "talking point" cards.
//
// Strategy: use Google Search with site filters to find podcast episodes,
// then transcribe via pintostudio/youtube-transcript-scraper and pull
// 1-2 quotes per episode.

import { runActorSync } from "../apify";
import { complete } from "../llm";
import { getEnv } from "../env";
import type { AgentModule } from "./types";
import { newCardId } from "./types";

const SEARCH_ACTOR = "apify/google-search-scraper";
const TRANSCRIPT_ACTOR = "pintostudio/youtube-transcript-scraper";

type SerpItem = { title?: string; url?: string; description?: string };
type SerpResult = { organicResults?: SerpItem[] };
type Transcript = { transcript?: { text?: string }[]; videoTitle?: string };

export const youtubeListener: AgentModule = {
  id: "youtube-listener",
  label: "YouTube Listener",
  description: "Mines a16z, TWiST, All-In and other investor pods for talking points.",
  modes: ["founder", "investor"],
  color: "#ef4444", // red-500
  icon: "Youtube",
  actorIds: [SEARCH_ACTOR, TRANSCRIPT_ACTOR],

  async run({ intent, prompt, emit }) {
    const query = `${cleanTopic(prompt)} site:youtube.com (a16z OR "all in podcast" OR "this week in startups" OR Lenny OR "20vc")`;
    emit.log(`Searching YouTube via Google: "${query}"`);

    const serps = await runActorSync<SerpResult>(SEARCH_ACTOR, {
      queries: query,
      maxPagesPerQuery: 1,
      resultsPerPage: 8,
      countryCode: "us",
    });

    const videos = serps
      .flatMap((s) => s.organicResults ?? [])
      .filter((r) => r.url?.includes("youtube.com/watch"))
      .slice(0, 3);

    if (!videos.length) {
      emit.log("No YouTube episodes matched.");
      return;
    }

    for (const v of videos) {
      if (!v.url || !v.title) continue;
      emit.source({
        id: newCardId(),
        url: v.url,
        title: v.title,
        snippet: v.description,
        actorId: SEARCH_ACTOR,
        agentId: "youtube-listener",
      });

      try {
        // Schema verified via Apify MCP: videoUrl + targetLanguage required.
        const out = await runActorSync<Transcript>(TRANSCRIPT_ACTOR, {
          videoUrl: v.url,
          targetLanguage: "en",
        });
        const text = (out[0]?.transcript ?? [])
          .map((c) => c.text ?? "")
          .join(" ")
          .slice(0, 8000);
        if (!text.length) continue;

        const quote = await pickQuote(text, intent);
        if (!quote) continue;

        emit.card({
          id: newCardId(),
          kind: "youtube",
          title: cleanVideoTitle(v.title),
          subtitle: hostFor(v.url),
          body: quote,
          url: v.url,
          meta: { actor: TRANSCRIPT_ACTOR },
          agentId: "youtube-listener",
        });
      } catch (err) {
        emit.log(`Transcript failed for ${v.url}: ${(err as Error).message.slice(0, 120)}`);
      }
    }
  },
};

async function pickQuote(text: string, intent: string): Promise<string | null> {
  const env = getEnv();
  if (!env.llm.apiKey || env.mockLlm) {
    // Fallback: take a clean middle slice of the transcript.
    return text.slice(2000, 2400).trim() + "…";
  }
  const res = await complete({
    tier: "worker",
    temperature: 0.2,
    maxTokens: 250,
    messages: [
      {
        role: "system",
        content:
          "Extract ONE concise, quote-worthy sentence (≤220 chars) from the transcript that's directly relevant to the intent. No prefix, no quotes.",
      },
      { role: "user", content: `Intent: ${intent}\n\nTranscript:\n${text}` },
    ],
  });
  const trimmed = res.trim().replace(/^"|"$/g, "");
  return trimmed.length > 20 ? trimmed.slice(0, 240) : null;
}

function cleanTopic(p: string): string {
  return p.replace(/[?.!]+$/, "").slice(0, 120);
}

function cleanVideoTitle(t: string): string {
  return t.replace(/\s*-\s*YouTube$/, "").slice(0, 100);
}

function hostFor(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return u;
  }
}
