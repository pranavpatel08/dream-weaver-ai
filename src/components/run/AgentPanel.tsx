import { motion, AnimatePresence } from "framer-motion";
import { metaFor } from "@/lib/agent-meta";
import type { AgentJob } from "@/server/types";
import { ActorPill } from "./ActorPill";
import { LogStream } from "./LogStream";

export function AgentPanel({ job, logs }: { job: AgentJob; logs: string[] }) {
  const meta = metaFor(job.agentId);
  const Icon = meta.icon;
  const running = job.status === "running";
  const done = job.status === "done";

  const cardsToShow = job.cards.slice(-3);
  const hidden = Math.max(0, job.cards.length - cardsToShow.length);

  return (
    <div className="rounded-lg border border-border/40 bg-[#111827]/70 p-3 transition-colors">
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className="flex size-7 shrink-0 items-center justify-center rounded"
              style={{ backgroundColor: meta.color + "22", color: meta.color }}
            >
              <Icon className="size-3.5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12.5px] font-medium">{meta.label}</div>
              <div className="truncate text-[10.5px] text-muted-foreground">{job.intent}</div>
            </div>
          </div>
          <StatusDot status={job.status} color={meta.color} />
        </div>

        <div className="mt-2 flex flex-col items-stretch gap-1">
          {job.actorIds.map((aid) => (
            <ActorPill key={aid} actorId={aid} startedAt={job.startedAt} active={running} />
          ))}
        </div>

        <div className="mt-2 rounded border border-border/40 bg-black/30 p-2">
          <LogStream lines={logs} />
        </div>

        <div className="mt-2 flex items-center gap-2 text-[10.5px] text-muted-foreground">
          <span>{job.cards.length} cards</span>
          <span>·</span>
          <span>{job.sources.length} sources</span>
          {done && job.startedAt && job.finishedAt && (
            <>
              <span>·</span>
              <span className="tabular-nums">
                {Math.max(0, Math.round((job.finishedAt - job.startedAt) / 100) / 10)}s
              </span>
            </>
          )}
        </div>

        <AnimatePresence initial={false}>
          {cardsToShow.map((c) => (
            <motion.div
              key={c.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 220, damping: 22 }}
              className="mt-2 rounded border border-border/40 bg-black/20 p-2 text-[11.5px]"
            >
              <div className="line-clamp-1 font-medium">{c.title}</div>
              {c.subtitle && (
                <div className="mt-0.5 line-clamp-1 text-[10.5px] text-muted-foreground">
                  {c.subtitle}
                </div>
              )}
              {c.body && (
                <div className="mt-1 line-clamp-2 text-[11px] text-foreground/80">{c.body}</div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
        {hidden > 0 && (
          <div className="mt-1 text-[10.5px] text-muted-foreground">+{hidden} more cards</div>
        )}
      </div>
    </div>
  );
}

function StatusDot({ status, color }: { status: AgentJob["status"]; color: string }) {
  if (status === "pending") return <span className="size-2 rounded-full bg-muted-foreground/40" />;
  if (status === "running")
    return (
      <span
        className="size-2 animate-pulse rounded-full"
        style={{ backgroundColor: color, boxShadow: `0 0 0 3px ${color}33` }}
      />
    );
  if (status === "error") return <span className="size-2 rounded-full bg-destructive" />;
  return <span className="size-2 rounded-full bg-emerald-500" />;
}
