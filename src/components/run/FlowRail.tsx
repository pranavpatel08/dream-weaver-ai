import { Fragment } from "react";
import { Brain, Sparkles, type LucideIcon } from "lucide-react";
import { metaFor } from "@/lib/agent-meta";
import type { AgentJob, AgentStatus, RunStatus } from "@/server/types";
import { cn } from "@/lib/utils";

type NodeStatus = AgentStatus | "synth-running";

export function FlowRail({
  agents,
  status,
}: {
  agents: AgentJob[];
  status: RunStatus | undefined;
}) {
  const total = agents.length;
  const anyAgentRunning = agents.some((a) => a.status === "running");
  const allAgentsDone =
    total > 0 && agents.every((a) => a.status === "done" || a.status === "error");

  const coordinatorStatus: NodeStatus =
    total === 0 ? (status === "running" ? "running" : "pending") : "done";

  const synthStatus: NodeStatus =
    status === "done"
      ? "done"
      : status === "synthesizing"
        ? "synth-running"
        : status === "error"
          ? "error"
          : "pending";

  return (
    <div className="scanlines flex h-full flex-col gap-0 overflow-y-auto p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Flow
      </div>

      <FlowNode label="Coordinator" color="#c084fc" icon={Brain} status={coordinatorStatus} />

      <Connector active={total > 0 && !allAgentsDone} color="#c084fc" />

      {agents.map((a, i) => {
        const meta = metaFor(a.agentId);
        return (
          <Fragment key={a.id}>
            <FlowNode label={meta.label} color={meta.color} icon={meta.icon} status={a.status} />
            {i < agents.length - 1 && <Connector active={anyAgentRunning} color={meta.color} />}
          </Fragment>
        );
      })}

      {total > 0 && <Connector active={status === "synthesizing"} color="#34d399" />}

      <FlowNode label="Synthesizer" color="#34d399" icon={Sparkles} status={synthStatus} />
    </div>
  );
}

function FlowNode({
  label,
  color,
  icon: Icon,
  status,
}: {
  label: string;
  color: string;
  icon: LucideIcon;
  status: NodeStatus;
}) {
  const isRunning = status === "running" || status === "synth-running";
  const isDone = status === "done";
  const isError = status === "error";
  const isPending = status === "pending";

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-md border px-2 py-1.5 transition-colors",
        isPending && "border-border/30 bg-[#0d1320]/40",
        isRunning && "border-border/50 bg-[#111827]/80",
        isDone && "border-border/40 bg-[#0d1320]/60",
        isError && "border-destructive/50 bg-destructive/5",
      )}
    >
      <span
        className="flex size-5 shrink-0 items-center justify-center rounded"
        style={{
          backgroundColor: isPending ? "transparent" : `${color}22`,
          color: isPending ? "rgb(100 116 139)" : color,
        }}
      >
        <Icon className="size-3" />
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate font-mono text-[10.5px]",
          isPending ? "text-muted-foreground/60" : "text-foreground/90",
        )}
        title={label}
      >
        {label}
      </span>
      <StatusDot status={status} color={color} />
    </div>
  );
}

function StatusDot({ status, color }: { status: NodeStatus; color: string }) {
  if (status === "pending") {
    return <span className="size-1.5 rounded-full bg-muted-foreground/30" />;
  }
  if (status === "error") {
    return <span className="size-1.5 rounded-full bg-destructive" />;
  }
  if (status === "running" || status === "synth-running") {
    return (
      <span
        className="size-1.5 animate-pulse rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}33` }}
      />
    );
  }
  return <span className="size-1.5 rounded-full bg-emerald-500/80" />;
}

function Connector({ active, color }: { active: boolean; color: string }) {
  return (
    <div className="flex h-3 items-center pl-3.5">
      <span
        className="block h-full w-px"
        style={{
          backgroundColor: active ? color : "rgb(51 65 85)",
          opacity: active ? 0.8 : 0.4,
        }}
      />
    </div>
  );
}
