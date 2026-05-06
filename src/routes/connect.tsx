import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Network, Loader2, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/connect")({
  component: ConnectPage,
});

const EXAMPLES = ["Anthropic", "Cursor", "Decagon", "Harvey"];

function ConnectPage() {
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
        body: JSON.stringify({ prompt, mode: "investor", job: "connect" }),
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
        <Network className="size-4 text-primary" />
        <div className="font-medium tracking-tight">Connect</div>
      </header>
      <div className="mx-auto max-w-3xl px-6 pb-16">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur">
          <label className="mb-2 block text-sm font-medium">Company name or URL</label>
          <Input
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="Anthropic"
            className="text-base"
          />
          <div className="mt-2 text-xs text-muted-foreground">
            Agents will map the cap table and rank warm paths to the founder.
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
              onClick={() => start("demo:connect-anthropic")}
              className="rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-300"
            >
              ▶ Run demo (Anthropic)
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
              Find a path
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
