import { Link } from "@tanstack/react-router";
import { ArrowLeft, Sparkles, Activity } from "lucide-react";
import type { RunSnapshot } from "@/server/types";
import { Badge } from "@/components/ui/badge";
import { AgentPanel } from "./AgentPanel";
import { SourcesTicker } from "./SourcesTicker";
import { SynthDock } from "./SynthDock";

export function MissionControl({
  runId,
  snapshot,
  logs,
  connected,
}: {
  runId: string;
  snapshot: RunSnapshot | null;
  logs: Record<string, string[]>;
  connected: boolean;
}) {
  return (
    <div className="dark grid h-screen grid-rows-[auto_1fr_auto] bg-[#0a0e17] text-foreground">
      <TopBar runId={runId} snapshot={snapshot} connected={connected} />
      <div className="grid min-h-0 grid-cols-[208px_1fr_300px]">
        <aside className="border-r border-border/40 bg-[#0d1320]/60">
          {/* Task 6 fills FlowRail here */}
          <div className="p-3 text-[11px] uppercase tracking-wider text-muted-foreground">Flow</div>
        </aside>
        <main className="min-w-0 overflow-y-auto p-3">
          {snapshot && snapshot.agents.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {snapshot.agents.map((job) => (
                <AgentPanel key={job.id} job={job} logs={logs[job.agentId] ?? []} />
              ))}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
              Waiting for the coordinator to dispatch agents…
            </div>
          )}
        </main>
        <aside className="border-l border-border/40 bg-[#0d1320]/60">
          <SourcesTicker agents={snapshot?.agents ?? []} />
        </aside>
      </div>
      <footer className="border-t border-border/40 bg-[#0d1320]/80 px-4 py-3">
        <SynthDock snapshot={snapshot} />
      </footer>
    </div>
  );
}

function TopBar({
  runId,
  snapshot,
  connected,
}: {
  runId: string;
  snapshot: RunSnapshot | null;
  connected: boolean;
}) {
  return (
    <header className="flex items-center gap-3 border-b border-border/40 bg-[#0d1320]/80 px-4 py-2.5 backdrop-blur">
      <Link to="/" className="text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" />
      </Link>
      <Sparkles className="size-4 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{snapshot?.prompt ?? "Loading…"}</div>
        <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          run {runId.slice(0, 8)} · {snapshot?.agents.length ?? 0} agents · {jobLabel(snapshot)}
        </div>
      </div>
      <RunTimer createdAt={snapshot?.createdAt} status={snapshot?.status} />
      <StatusBadge status={snapshot?.status} connected={connected} />
    </header>
  );
}

function jobLabel(snap: RunSnapshot | null): string {
  if (!snap) return "";
  if (snap.job === "discover") return "Discover";
  if (snap.job === "dossier") return "Dossier";
  if (snap.job === "connect") return "Connect";
  return snap.mode === "founder" ? "Founder" : "Investor";
}

function RunTimer({ createdAt, status }: { createdAt?: number; status?: string }) {
  if (!createdAt) return null;
  const elapsed = Math.max(0, Math.floor((Date.now() - createdAt) / 1000));
  const frozen = status === "done" || status === "error";
  return (
    <div className="flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
      <Activity className={frozen ? "size-3" : "size-3 animate-pulse text-emerald-400"} />
      {elapsed}s
    </div>
  );
}

function StatusBadge({ status, connected }: { status?: string; connected: boolean }) {
  if (!connected) return <Badge variant="outline">disconnected</Badge>;
  if (!status) return <Badge variant="outline">connecting</Badge>;
  if (status === "running") return <Badge className="bg-blue-500 text-white">running</Badge>;
  if (status === "synthesizing")
    return <Badge className="bg-violet-500 text-white">synthesizing</Badge>;
  if (status === "done") return <Badge className="bg-emerald-500 text-white">done</Badge>;
  if (status === "error") return <Badge variant="destructive">error</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}
