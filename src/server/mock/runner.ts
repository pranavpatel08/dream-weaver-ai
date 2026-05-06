import {
  appendCard,
  appendSource,
  emitSynthDelta,
  finishAgent,
  logAgent,
  queueAgent,
  setRunStatus,
  setSynthesis,
  startAgent,
} from "../run-store";
import type { MockScenario } from "./timelines";

export async function runMock(runId: string, scenario: MockScenario) {
  setRunStatus(runId, "running");

  let last = 0;
  for (const step of scenario.steps) {
    const wait = step.delayMs - last;
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = step.delayMs;

    switch (step.kind) {
      case "queue":
        queueAgent(runId, step.job);
        break;
      case "start":
        startAgent(runId, step.agentId);
        break;
      case "log":
        logAgent(runId, step.agentId, step.message);
        break;
      case "card":
        appendCard(runId, step.agentId, step.card);
        break;
      case "source":
        appendSource(runId, step.agentId, step.source);
        break;
      case "finish":
        finishAgent(runId, step.agentId, "done");
        break;
    }
  }

  setRunStatus(runId, "synthesizing");
  const txt = scenario.synthesis.summary;
  const chunkSize = 12;
  for (let i = 0; i < txt.length; i += chunkSize) {
    emitSynthDelta(runId, txt.slice(i, i + chunkSize));
    await new Promise((r) => setTimeout(r, 80));
  }
  setSynthesis(runId, scenario.synthesis);
  setRunStatus(runId, "done");
}
