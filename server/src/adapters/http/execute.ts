import type { AdapterExecutionContext, AdapterExecutionResult } from "../types.js";
import { asString, asNumber, parseObject } from "../utils.js";

async function httpRequest(opts: {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}): Promise<Response> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | null = null;

  if (opts.timeoutMs > 0) {
    timer = setTimeout(() => controller.abort(), opts.timeoutMs);
  }

  try {
    return await fetch(opts.url, {
      method: opts.method,
      headers: opts.headers,
      body: opts.body,
      signal: controller.signal,
    });
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

export async function execute(ctx: AdapterExecutionContext): Promise<AdapterExecutionResult> {
  const { config, runId, agent, context } = ctx;

  const url = asString(config.url, "");
  if (!url) throw new Error("HTTP adapter missing url");

  const method = asString(config.method, "POST");
  const timeoutMs = asNumber(config.timeoutMs, 0);
  const headers = parseObject(config.headers) as Record<string, string>;
  const payloadTemplate = parseObject(config.payloadTemplate);
  const body = JSON.stringify({ ...payloadTemplate, agentId: agent.id, runId, context });

  let res: Response;
  try {
    res = await httpRequest({
      url,
      method,
      headers: { "content-type": "application/json", ...headers },
      body,
      timeoutMs,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      return { exitCode: -1, signal: null, timedOut: true, errorMessage: `Request timed out after ${timeoutMs}ms` };
    }
    throw err;
  }

  if (!res.ok) {
    throw new Error(`HTTP invoke failed with status ${res.status}`);
  }

  return { exitCode: 0, signal: null, timedOut: false, summary: `HTTP ${method} ${url}` };
}
