import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, FileSearch, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/dossier")({
  component: DossierPage,
});

const EXAMPLES = ["Cursor", "Decagon", "Harvey", "Anthropic"];

function DossierPage() {
  const navigate = useNavigate();
  const [company, setCompany] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(prompt: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/runs/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, mode: "investor", job: "dossier" }),
      });
      if (!res.ok) {
        setError(`Failed to start (${res.status})`);
        setSubmitting(false);
        return;
      }
      const json = (await res.json()) as { runId: string };
      void navigate({ to: "/runs/$id", params: { id: json.runId } });
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  return (
    <div className="dark min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl items-center gap-2 px-6 py-5">
        <Link to="/" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <FileSearch className="size-4 text-primary" />
        <div className="font-medium tracking-tight">Dossier</div>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <label className="mb-2 block text-sm font-medium">Company name or URL</label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Cursor"
            className="text-base"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Agents will fan out and assemble a due-diligence brief in 60–90 seconds.
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setCompany(e)}
                className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => start("demo:dossier-cursor")}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300"
            >
              ▶ Run demo (Cursor)
            </button>
          </div>
          {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
          <div className="mt-5 flex justify-end">
            <Button
              size="lg"
              onClick={() => start(company)}
              disabled={!company.trim() || submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Brief me
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
