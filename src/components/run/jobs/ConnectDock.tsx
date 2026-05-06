import type { Synthesis } from "@/server/types";
import { Badge } from "@/components/ui/badge";
import { CapTableGraph } from "../CapTableGraph";

export function ConnectDock({
  synthesis,
  expanded,
  company,
}: {
  synthesis?: Synthesis;
  expanded: boolean;
  company: string;
}) {
  const cap = synthesis?.connect?.capTable ?? [];
  const paths = synthesis?.connect?.paths ?? [];
  if (!synthesis?.summary) {
    return <div className="text-[11px] text-muted-foreground/60">Mapping the room…</div>;
  }
  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        <Badge className="bg-emerald-500 text-white">{paths.length} warm paths</Badge>
        <div className="line-clamp-1 text-[12.5px]">{synthesis.summary}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[280px_1fr]">
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Cap table
        </div>
        <CapTableGraph company={company} entries={cap} />
      </div>
      <div>
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Warm paths
        </div>
        <ul className="space-y-2">
          {paths.map((p) => (
            <li key={p.id} className="rounded border border-border/40 bg-black/20 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="line-clamp-1 text-[12px] font-medium">{p.via}</div>
                <div className="font-mono text-[11px] tabular-nums text-emerald-400">
                  {p.strength}
                </div>
              </div>
              <div className="mt-0.5 text-[10.5px] text-foreground/80">{p.rationale}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px] text-muted-foreground">
                {p.hops.map((h, i) => (
                  <span key={i}>
                    {h.name} <span className="text-muted-foreground/60">({h.role})</span>
                    {i < p.hops.length - 1 && " → "}
                  </span>
                ))}
              </div>
              <button
                type="button"
                className="mt-2 rounded border border-border/40 px-2 py-0.5 font-mono text-[10px] text-muted-foreground hover:text-foreground"
              >
                Draft outreach
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
