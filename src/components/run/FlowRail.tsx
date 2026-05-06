import { metaFor } from "@/lib/agent-meta";
import type { AgentJob, RunStatus } from "@/server/types";

const NODE_HEIGHT = 36;
const NODE_GAP = 6;
const SVG_WIDTH = 192;

export function FlowRail({
  agents,
  status,
}: {
  agents: AgentJob[];
  status: RunStatus | undefined;
}) {
  const total = agents.length;
  const middleHeight = total * NODE_HEIGHT + Math.max(0, total - 1) * NODE_GAP;
  const totalHeight = NODE_HEIGHT + 24 + middleHeight + 24 + NODE_HEIGHT;
  const synthesizing = status === "synthesizing" || status === "done";

  return (
    <div className="scanlines h-full overflow-y-auto p-3">
      <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
        Flow
      </div>
      <svg width={SVG_WIDTH} height={totalHeight} className="block">
        <FlowNode
          x={0}
          y={0}
          color="#c084fc"
          label="Coordinator"
          active={total === 0}
          done={total > 0}
        />
        {agents.map((a, i) => {
          const meta = metaFor(a.agentId);
          const yMid = NODE_HEIGHT + 24 + i * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT / 2;
          const animate = a.status === "running";
          return (
            <line
              key={`top-${a.id}`}
              x1={SVG_WIDTH / 2}
              y1={NODE_HEIGHT}
              x2={SVG_WIDTH / 2}
              y2={yMid}
              stroke={meta.color}
              strokeWidth={1}
              strokeDasharray={animate ? "4 4" : undefined}
              opacity={a.status === "pending" ? 0.3 : 0.7}
              className={animate ? "animate-pulse" : ""}
            />
          );
        })}
        {agents.map((a, i) => {
          const meta = metaFor(a.agentId);
          const y = NODE_HEIGHT + 24 + i * (NODE_HEIGHT + NODE_GAP);
          return (
            <FlowNode
              key={a.id}
              x={0}
              y={y}
              color={meta.color}
              label={meta.label}
              active={a.status === "running"}
              done={a.status === "done"}
              error={a.status === "error"}
            />
          );
        })}
        {agents.map((a, i) => {
          const meta = metaFor(a.agentId);
          const yMid = NODE_HEIGHT + 24 + i * (NODE_HEIGHT + NODE_GAP) + NODE_HEIGHT / 2;
          const yBottom = NODE_HEIGHT + 24 + middleHeight + 24;
          const done = a.status === "done";
          return (
            <line
              key={`bot-${a.id}`}
              x1={SVG_WIDTH / 2}
              y1={yMid}
              x2={SVG_WIDTH / 2}
              y2={yBottom}
              stroke={meta.color}
              strokeWidth={1}
              opacity={done ? 0.7 : 0.2}
            />
          );
        })}
        <FlowNode
          x={0}
          y={NODE_HEIGHT + 24 + middleHeight + 24}
          color="#34d399"
          label="Synthesizer"
          active={synthesizing && status !== "done"}
          done={status === "done"}
        />
      </svg>
    </div>
  );
}

function FlowNode({
  x,
  y,
  color,
  label,
  active,
  done,
  error,
}: {
  x: number;
  y: number;
  color: string;
  label: string;
  active?: boolean;
  done?: boolean;
  error?: boolean;
}) {
  const fill = active ? color : done ? `${color}55` : `${color}22`;
  const stroke = error ? "#ef4444" : color;
  return (
    <g transform={`translate(${x},${y})`}>
      <rect
        x={4}
        y={0}
        width={SVG_WIDTH - 8}
        height={NODE_HEIGHT}
        rx={6}
        fill={fill}
        stroke={stroke}
        strokeOpacity={0.6}
      />
      <text
        x={SVG_WIDTH / 2}
        y={NODE_HEIGHT / 2 + 4}
        textAnchor="middle"
        className="font-mono"
        fontSize={11}
        fill="white"
      >
        {label}
      </text>
      {active && (
        <circle cx={SVG_WIDTH - 14} cy={NODE_HEIGHT / 2} r={3} fill="#22c55e">
          <animate attributeName="opacity" values="1;0.2;1" dur="1s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}
