import type { CapTableEntry } from "@/server/types";

const KIND_COLOR: Record<CapTableEntry["kind"], string> = {
  lead: "#34d399",
  follow: "#60a5fa",
  angel: "#a78bfa",
  advisor: "#f59e0b",
};

export function CapTableGraph({ company, entries }: { company: string; entries: CapTableEntry[] }) {
  const r = 90;
  const cx = 130;
  const cy = 110;
  return (
    <svg viewBox="0 0 260 220" className="block w-full max-w-[320px]">
      {entries.map((e, i) => {
        const angle = (i / entries.length) * Math.PI * 2 - Math.PI / 2;
        const x = cx + Math.cos(angle) * r;
        const y = cy + Math.sin(angle) * r;
        return (
          <g key={e.id}>
            <line x1={cx} y1={cy} x2={x} y2={y} stroke={KIND_COLOR[e.kind]} strokeOpacity={0.4} />
            <circle cx={x} cy={y} r={6} fill={KIND_COLOR[e.kind]} />
            <text
              x={x}
              y={y - 10}
              textAnchor="middle"
              fontSize={9}
              fill="#cbd5e1"
              className="font-mono"
            >
              {e.name}
            </text>
          </g>
        );
      })}
      <circle cx={cx} cy={cy} r={18} fill="#0d1320" stroke="#34d399" />
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="white" fontWeight={600}>
        {company}
      </text>
    </svg>
  );
}
