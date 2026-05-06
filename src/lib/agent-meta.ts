// Display metadata for agents, kept on the client to avoid round-trips
// just to render labels/colors. Mirror of src/server/agents/registry.ts
// (server is the source of truth for which agents EXIST; this file only
// names how to render them).

import {
  Brain,
  Briefcase,
  LineChart,
  MessageSquare,
  Newspaper,
  Search,
  ShieldAlert,
  Users,
  Youtube,
  type LucideIcon,
} from "lucide-react";
import type { AgentId } from "@/server/types";

type Meta = {
  label: string;
  color: string;
  icon: LucideIcon;
};

export const AGENT_META: Record<AgentId, Meta> = {
  "competitor-mapper": { label: "Competitor Mapper", color: "#60a5fa", icon: Search },
  "linkedin-company-scout": { label: "LinkedIn Scout", color: "#3b82f6", icon: Briefcase },
  "founder-profiler": { label: "Founder Profiler", color: "#22d3ee", icon: Users },
  "funding-tracker": { label: "Funding Tracker", color: "#34d399", icon: LineChart },
  "investor-mapper": { label: "Investor Mapper", color: "#a3e635", icon: Briefcase },
  "youtube-listener": { label: "YouTube Listener", color: "#ef4444", icon: Youtube },
  "sentiment-scout": { label: "Sentiment Scout", color: "#f59e0b", icon: MessageSquare },
  "news-scout": { label: "News & Trend Scout", color: "#a78bfa", icon: Newspaper },
  "hiring-signal-reader": { label: "Hiring Signals", color: "#fb7185", icon: Briefcase },
  critic: { label: "Critic", color: "#fb923c", icon: ShieldAlert },
  synthesizer: { label: "Synthesizer", color: "#c084fc", icon: Brain },
};

export function metaFor(id: AgentId): Meta {
  return AGENT_META[id] ?? { label: id, color: "#94a3b8", icon: Brain };
}
