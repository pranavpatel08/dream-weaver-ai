import type { AgentId, RunMode } from "../types";
import type { AgentModule } from "./types";
import { competitorMapper } from "./competitor-mapper";
import { founderProfiler } from "./founder-profiler";
import { fundingTracker } from "./funding-tracker";
import { linkedinCompanyScout } from "./linkedin-company-scout";
import { newsScout } from "./news-scout";
import { sentimentScout } from "./sentiment-scout";
import { youtubeListener } from "./youtube-listener";

export const ALL_AGENTS: AgentModule[] = [
  competitorMapper,
  linkedinCompanyScout,
  founderProfiler,
  fundingTracker,
  newsScout,
  sentimentScout,
  youtubeListener,
];

export const AGENT_BY_ID: Record<AgentId, AgentModule | undefined> = Object.fromEntries(
  ALL_AGENTS.map((a) => [a.id, a]),
) as Record<AgentId, AgentModule | undefined>;

export function agentsForMode(mode: RunMode): AgentModule[] {
  return ALL_AGENTS.filter((a) => a.modes.includes(mode));
}

/**
 * Public-facing metadata for the UI. Only the bits the client needs —
 * no functions, no Apify call payloads.
 */
export type AgentMeta = {
  id: AgentId;
  label: string;
  description: string;
  color: string;
  icon: string;
  actorIds: string[];
};

export function publicAgentMeta(): AgentMeta[] {
  return ALL_AGENTS.map((a) => ({
    id: a.id,
    label: a.label,
    description: a.description,
    color: a.color,
    icon: a.icon,
    actorIds: a.actorIds,
  }));
}
