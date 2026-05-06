import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Search, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/discover")({
  component: DiscoverPage,
});

const EXAMPLES = [
  "Vertical AI for healthcare back-office (claims, prior auth, RCM)",
  "AI agents for legal due diligence — pre-seed and seed only",
  "Dev tools building on coding agents — picks-and-shovels plays",
];

function DiscoverPage() {
  const navigate = useNavigate();
  const [thesis, setThesis] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start(prompt: string) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/runs/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ prompt, mode: "investor", job: "discover" }),
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
        <Search className="size-4 text-primary" />
        <div className="font-medium tracking-tight">Discover</div>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <label className="mb-2 block text-sm font-medium">Your thesis</label>
          <Textarea
            value={thesis}
            onChange={(e) => setThesis(e.target.value)}
            rows={4}
            placeholder="What space are you hunting in?"
            className="resize-none text-base"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Agents will fan out and surface companies matching your thesis with discovery scores.
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {EXAMPLES.map((e) => (
              <button
                key={e}
                type="button"
                onClick={() => setThesis(e)}
                className="rounded-full border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:text-foreground"
              >
                {e}
              </button>
            ))}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => start("demo:discover-vertical-ai-health")}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300"
            >
              ▶ Run demo (vertical AI in healthcare)
            </button>
          </div>
          {error && <div className="mt-3 text-xs text-destructive">{error}</div>}
          <div className="mt-5 flex justify-end">
            <Button
              size="lg"
              onClick={() => start(thesis)}
              disabled={!thesis.trim() || submitting}
              className="gap-2"
            >
              {submitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowRight className="size-4" />
              )}
              Surface deals
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
