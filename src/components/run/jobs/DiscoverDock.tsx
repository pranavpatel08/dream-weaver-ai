import type { Synthesis, DiscoverEntry } from "@/server/types";
import { Badge } from "@/components/ui/badge";

export function DiscoverDock({
  synthesis,
  expanded,
}: {
  synthesis?: Synthesis;
  expanded: boolean;
}) {
  const entries = synthesis?.discover?.entries ?? [];
  if (!synthesis?.summary) {
    return <div className="text-[11px] text-muted-foreground/60">Searching the field…</div>;
  }
  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <Badge className="bg-emerald-500 text-white">{entries.length} matches</Badge>
        <div className="line-clamp-1 text-[12.5px]">{synthesis.summary}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
      {entries.map((e) => (
        <EntryCard key={e.id} entry={e} />
      ))}
    </div>
  );
}

function EntryCard({ entry }: { entry: DiscoverEntry }) {
  return (
    <div className="rounded border border-border/40 bg-black/30 p-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[12.5px] font-semibold">{entry.name}</div>
          <div className="truncate text-[10.5px] text-muted-foreground">{entry.oneLiner}</div>
        </div>
        <div className="font-mono text-[11px] tabular-nums text-emerald-400">
          {entry.discoveryScore}
        </div>
      </div>
      <div className="mt-1.5 text-[10.5px] text-foreground/80">{entry.pedigree}</div>
      <div className="mt-0.5 text-[10.5px] text-amber-300/80">▎ {entry.signal}</div>
    </div>
  );
}
