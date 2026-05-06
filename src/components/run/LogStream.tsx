export function LogStream({ lines }: { lines: string[] }) {
  const recent = lines.slice(-4);
  return (
    <div className="space-y-0.5 font-mono text-[10.5px] leading-relaxed">
      {recent.length === 0 && <div className="text-muted-foreground/40">▎ awaiting actor…</div>}
      {recent.map((line, i) => {
        const opacity = 0.4 + (i / Math.max(1, recent.length - 1)) * 0.6;
        return (
          <div
            key={`${i}-${line.slice(0, 12)}`}
            className="truncate text-muted-foreground"
            style={{ opacity }}
          >
            <span className="text-emerald-400/80">▎</span> {line}
          </div>
        );
      })}
    </div>
  );
}
