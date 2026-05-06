import type { Synthesis } from "@/server/types";
import { Badge } from "@/components/ui/badge";

export function DossierDock({ synthesis, expanded }: { synthesis?: Synthesis; expanded: boolean }) {
  if (!synthesis?.summary) {
    return <div className="text-[11px] text-muted-foreground/60">Synthesizing verdict…</div>;
  }
  if (!expanded) {
    return (
      <div className="flex items-center gap-3">
        {synthesis.verdict && (
          <Badge className="bg-emerald-500 text-white">{synthesis.verdict.label}</Badge>
        )}
        <div className="line-clamp-1 text-[12.5px]">{synthesis.summary}</div>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_2fr]">
      <div>
        {synthesis.verdict && (
          <>
            <Badge className="bg-emerald-500 text-white">{synthesis.verdict.label}</Badge>
            <div className="mt-2 font-mono text-[10.5px] text-muted-foreground">
              {synthesis.verdict.confidence}/100 confidence
            </div>
            <p className="mt-2 text-[12.5px] text-foreground/80">{synthesis.verdict.reasoning}</p>
          </>
        )}
      </div>
      <div>
        <p className="text-[12.5px] text-foreground/90">{synthesis.summary}</p>
        <ul className="mt-2 space-y-1">
          {synthesis.bullets.map((b, i) => (
            <li key={i} className="flex gap-2 text-[12px] text-foreground/80">
              <span className="mt-1 size-1.5 shrink-0 rounded-full bg-emerald-400" />
              {b}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
