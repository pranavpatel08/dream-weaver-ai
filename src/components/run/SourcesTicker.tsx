import { motion, AnimatePresence } from "framer-motion";
import { metaFor } from "@/lib/agent-meta";
import type { AgentJob, Source } from "@/server/types";

type StampedSource = Source & { ts: number };

export function SourcesTicker({ agents }: { agents: AgentJob[] }) {
  const all: StampedSource[] = [];
  agents.forEach((a) => {
    a.sources.forEach((s, i) => {
      all.push({ ...s, ts: (a.startedAt ?? 0) + i });
    });
  });
  all.sort((a, b) => b.ts - a.ts);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border/40 px-3 py-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        <span>Sources</span>
        <span className="tabular-nums">{all.length}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-1">
        <AnimatePresence initial={false}>
          {all.length === 0 && (
            <div className="px-1 py-2 text-[10.5px] text-muted-foreground/60">No sources yet.</div>
          )}
          {all.map((s) => {
            const meta = metaFor(s.agentId);
            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.18 }}
                className="border-b border-border/30 px-1 py-1.5 font-mono text-[10.5px] last:border-b-0"
              >
                <div className="flex items-center gap-1.5">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
                  <span className="truncate text-muted-foreground/80">{s.actorId}</span>
                </div>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="line-clamp-1 text-foreground hover:text-emerald-400"
                  title={s.title}
                >
                  {s.title}
                </a>
                <div className="truncate text-muted-foreground/60">{domainOf(s.url)}</div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}
