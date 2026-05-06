import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import type { RunSnapshot } from "@/server/types";
import { DossierDock } from "./jobs/DossierDock";

export function SynthDock({ snapshot }: { snapshot: RunSnapshot | null }) {
  const [expanded, setExpanded] = useState(false);
  const job = snapshot?.job ?? "dossier";
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          <span>Synthesizer</span>
          <span>·</span>
          <span>{snapshot?.status ?? ""}</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          className="flex items-center gap-1 rounded border border-border/40 px-2 py-0.5 text-[10.5px] text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronDown className="size-3" /> : <ChevronUp className="size-3" />}
          {expanded ? "Collapse" : "Expand"}
        </button>
      </div>
      <div className={expanded ? "mt-3 max-h-[40vh] overflow-y-auto" : "mt-2"}>
        {job === "dossier" && <DossierDock synthesis={snapshot?.synthesis} expanded={expanded} />}
        {job === "discover" && (
          <div className="text-[11px] text-muted-foreground">Discover dock — Task 7</div>
        )}
        {job === "connect" && (
          <div className="text-[11px] text-muted-foreground">Connect dock — Task 8</div>
        )}
      </div>
    </div>
  );
}
