// Shared types used by server orchestration and the frontend dashboard.
// Keep these JSON-serializable so they pass cleanly through SSE.

export type RunMode = "founder" | "investor";

export type RunJob = "discover" | "dossier" | "connect";

export type DiscoverEntry = {
  id: string;
  name: string;
  oneLiner: string;
  discoveryScore: number;
  pedigree: string;
  signal: string;
  url?: string;
};

export type WarmPath = {
  id: string;
  via: string;
  hops: { name: string; role: string }[];
  strength: number;
  rationale: string;
};

export type CapTableEntry = {
  id: string;
  name: string;
  kind: "lead" | "follow" | "angel" | "advisor";
  round?: string;
};

export type RunStatus = "pending" | "running" | "synthesizing" | "done" | "error";

export type AgentStatus = "pending" | "running" | "done" | "error";

export type AgentId =
  | "competitor-mapper"
  | "linkedin-company-scout"
  | "founder-profiler"
  | "funding-tracker"
  | "investor-mapper"
  | "youtube-listener"
  | "sentiment-scout"
  | "news-scout"
  | "hiring-signal-reader"
  | "critic"
  | "synthesizer";

export type CardKind =
  | "competitor"
  | "founder"
  | "funding"
  | "investor"
  | "sentiment"
  | "news"
  | "youtube"
  | "hiring"
  | "insight"
  | "risk"
  | "verdict"
  | "roadmap";

export type Card = {
  id: string;
  kind: CardKind;
  title: string;
  subtitle?: string;
  body?: string;
  url?: string;
  meta?: Record<string, string | number | boolean | null>;
  agentId: AgentId;
};

export type Source = {
  id: string;
  url: string;
  title: string;
  snippet?: string;
  actorId: string;
  agentId: AgentId;
};

export type AgentJob = {
  id: string;
  agentId: AgentId;
  intent: string;
  status: AgentStatus;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  cards: Card[];
  sources: Source[];
  actorIds: string[];
};

export type Synthesis = {
  summary: string;
  bullets: string[];
  verdict?: { label: string; confidence: number; reasoning: string };
  roadmap?: { phase: string; items: string[] }[];
  // Job-specific extras (only one populated per run):
  discover?: { entries: DiscoverEntry[] };
  connect?: { capTable: CapTableEntry[]; paths: WarmPath[] };
};

export type RunSnapshot = {
  id: string;
  mode: RunMode;
  job?: RunJob;
  prompt: string;
  status: RunStatus;
  createdAt: number;
  agents: AgentJob[];
  synthesis?: Synthesis;
};

export type RunEvent =
  | { type: "run.started"; runId: string; mode: RunMode; prompt: string }
  | { type: "agent.queued"; agent: AgentJob }
  | { type: "agent.started"; agentId: AgentId }
  | { type: "agent.card"; agentId: AgentId; card: Card }
  | { type: "agent.source"; agentId: AgentId; source: Source }
  | { type: "agent.log"; agentId: AgentId; message: string }
  | { type: "agent.finished"; agentId: AgentId; status: AgentStatus; error?: string }
  | { type: "synth.delta"; chunk: string }
  | { type: "synth.done"; synthesis: Synthesis }
  | { type: "run.finished"; status: RunStatus };

export type AgentPlanItem = { agentId: AgentId; intent: string };
export type AgentPlan = { items: AgentPlanItem[]; rationale: string };
