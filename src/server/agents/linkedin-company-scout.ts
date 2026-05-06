// LinkedIn Company Scout — given a topic, find a few relevant companies
// and pull employee counts / hiring signals via harvestapi/linkedin-company-search.

import { runActorSync } from "../apify";
import type { AgentModule } from "./types";
import { newCardId } from "./types";

const ACTOR = "harvestapi/linkedin-company-search";

type Company = {
  name?: string;
  url?: string;
  industry?: string;
  employees?: number | string;
  description?: string;
  website?: string;
  headquarters?: string;
  followerCount?: number | string;
};

export const linkedinCompanyScout: AgentModule = {
  id: "linkedin-company-scout",
  label: "LinkedIn Scout",
  description: "Finds companies in the space + headcount/HQ data.",
  modes: ["founder", "investor"],
  color: "#3b82f6", // blue-500
  icon: "Briefcase",
  actorIds: [ACTOR],

  async run({ prompt, emit }) {
    const topic = stripVerbs(prompt);
    emit.log(`LinkedIn company search: "${topic}"`);

    let companies: Company[] = [];
    try {
      // Schema verified via Apify MCP fetch-actor-details:
      //   searchQuery: string (singular), scraperMode: "short"|"full", maxItems: int
      companies = await runActorSync<Company>(ACTOR, {
        searchQuery: topic,
        scraperMode: "full",
        maxItems: 8,
      });
    } catch (err) {
      emit.log(`LinkedIn search failed: ${(err as Error).message.slice(0, 140)}`);
      return;
    }

    for (const c of companies.slice(0, 6)) {
      if (!c.name) continue;
      const url = c.url ?? c.website ?? "";
      if (url) {
        emit.source({
          id: newCardId(),
          url,
          title: c.name,
          snippet: c.description?.slice(0, 200),
          actorId: ACTOR,
          agentId: "linkedin-company-scout",
        });
      }
      emit.card({
        id: newCardId(),
        kind: "competitor",
        title: c.name,
        subtitle: [c.industry, c.headquarters, c.employees ? `${c.employees} employees` : null]
          .filter(Boolean)
          .join(" · "),
        body: c.description?.slice(0, 240),
        url: url || undefined,
        meta: { followers: c.followerCount ?? null },
        agentId: "linkedin-company-scout",
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
