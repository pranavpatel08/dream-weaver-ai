import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, Search, FileSearch, Network, ArrowRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="dark min-h-screen bg-[#0a0e17] text-foreground">
      <div className="relative isolate overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(60%_50%_at_50%_0%,oklch(0.32_0.18_265/.6)_0,transparent_70%)]" />
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link to="/" className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            <span className="font-semibold tracking-tight">Dream Weaver</span>
          </Link>
          <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
            For investors · Powered by Apify
          </div>
        </header>

        <section className="mx-auto max-w-4xl px-6 pb-12 pt-12 text-center">
          <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
            Where deals come from{" "}
            <span className="bg-gradient-to-br from-emerald-300 to-sky-400 bg-clip-text text-transparent">
              in the open
            </span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            A transparent deal copilot. A swarm of agents fans out across LinkedIn, X, Reddit,
            Crunchbase, and YouTube. Every signal cites the Apify actor that fetched it. No black
            boxes — watch the work happen.
          </p>
        </section>

        <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
          <JobTile
            to="/discover"
            icon={<Search className="size-5" />}
            title="Discover"
            body="Type a thesis. Get a ranked feed of companies you haven't seen yet."
            cta="Surface deals"
            accent="emerald"
          />
          <JobTile
            to="/dossier"
            icon={<FileSearch className="size-5" />}
            title="Dossier"
            body="Paste a company. Watch agents build a due-diligence brief in 90 seconds."
            cta="Brief me"
            accent="sky"
          />
          <JobTile
            to="/connect"
            icon={<Network className="size-5" />}
            title="Connect"
            body="Map the cap table. Find your warmest path to the founder."
            cta="Find a path"
            accent="violet"
          />
        </section>
      </div>
    </div>
  );
}

const ACCENT_MAP = {
  emerald: { gradient: "from-emerald-400/40 to-transparent", text: "text-emerald-400" },
  sky: { gradient: "from-sky-400/40 to-transparent", text: "text-sky-400" },
  violet: { gradient: "from-violet-400/40 to-transparent", text: "text-violet-400" },
} as const;

function JobTile({
  to,
  icon,
  title,
  body,
  cta,
  accent,
}: {
  to: "/discover" | "/dossier" | "/connect";
  icon: React.ReactNode;
  title: string;
  body: string;
  cta: string;
  accent: keyof typeof ACCENT_MAP;
}) {
  const a = ACCENT_MAP[accent];
  return (
    <Link
      to={to}
      className="group relative overflow-hidden rounded-xl border border-border/60 bg-card/40 p-5 backdrop-blur transition-colors hover:border-border"
    >
      <div className={`absolute inset-0 -z-10 bg-gradient-to-br ${a.gradient} opacity-30`} />
      <div className={a.text}>{icon}</div>
      <div className="mt-3 text-lg font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium">
        {cta} <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}
