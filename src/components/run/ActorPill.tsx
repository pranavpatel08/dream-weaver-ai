import { useEffect, useState } from "react";

export function ActorPill({
  actorId,
  startedAt,
  active,
}: {
  actorId: string;
  startedAt?: number;
  active: boolean;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [active]);
  const elapsed = startedAt ? Math.max(0, Math.floor((now - startedAt) / 1000)) : null;
  return (
    <div className="inline-flex max-w-full items-center gap-1.5 rounded border border-border/60 bg-black/40 px-1.5 py-0.5 font-mono text-[10px]">
      {active && (
        <span className="size-1.5 shrink-0 animate-pulse rounded-full bg-emerald-400 shadow-[0_0_4px_currentColor]" />
      )}
      <span className="min-w-0 truncate text-muted-foreground" title={actorId}>
        {actorId}
      </span>
      {elapsed !== null && <span className="shrink-0 text-muted-foreground/60">·</span>}
      {elapsed !== null && (
        <span className="shrink-0 tabular-nums text-foreground/80">{elapsed}s</span>
      )}
    </div>
  );
}
