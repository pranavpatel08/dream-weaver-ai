// Server-side env access. Reads from process.env (Node/Vite dev)
// or globalThis.env (Cloudflare Workers, future).

type RawEnv = {
  APIFY_TOKEN?: string;
  LLM_BASE_URL?: string;
  LLM_API_KEY?: string;
  LLM_MODEL_COORDINATOR?: string;
  LLM_MODEL_WORKER?: string;
  DEMO_MODE?: string;
  MOCK_LLM?: string;
};

function readRaw(): RawEnv {
  if (typeof process !== "undefined" && process.env) {
    return process.env as unknown as RawEnv;
  }
  return {};
}

export type ServerEnv = {
  apifyToken: string;
  llm: {
    baseUrl: string;
    apiKey: string;
    coordinatorModel: string;
    workerModel: string;
  };
  demoMode: boolean;
  mockLlm: boolean;
};

export function getEnv(): ServerEnv {
  const raw = readRaw();
  return {
    apifyToken: raw.APIFY_TOKEN ?? "",
    llm: {
      baseUrl: raw.LLM_BASE_URL ?? "https://ai.gateway.lovable.dev/v1",
      apiKey: raw.LLM_API_KEY ?? "",
      coordinatorModel: raw.LLM_MODEL_COORDINATOR ?? "google/gemini-2.5-pro",
      workerModel: raw.LLM_MODEL_WORKER ?? "google/gemini-3-flash-preview",
    },
    demoMode: raw.DEMO_MODE === "1" || raw.DEMO_MODE === "true",
    mockLlm: raw.MOCK_LLM === "1" || raw.MOCK_LLM === "true",
  };
}
