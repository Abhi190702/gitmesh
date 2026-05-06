/**
 * HTTP adapter environment test.
 *
 * The function runs a small ordered pipeline of validation steps and then
 * (if the URL is well-formed) probes the endpoint with a HEAD request. Each
 * step appends `AdapterEnvironmentCheck` entries; the final status summary
 * is derived from the highest severity present in the collected checks.
 *
 * The pipeline is expressed as a list of step functions so reading the file
 * makes the order obvious, and individual steps can be unit-tested in
 * isolation if needed.
 */
import type {
  AdapterEnvironmentCheck,
  AdapterEnvironmentTestContext,
  AdapterEnvironmentTestResult,
} from "../types.js";
import { asString, parseObject } from "../utils.js";

interface PipelineState {
  readonly ctx: AdapterEnvironmentTestContext;
  readonly checks: AdapterEnvironmentCheck[];
  /** The validated URL, if parsing succeeded. Set by the URL parsing step. */
  url: URL | null;
  /** Resolved HTTP method (defaults to POST). */
  method: string;
  /** Halts the pipeline early when set (e.g. URL is missing). */
  abort: boolean;
}

type PipelineStep = (state: PipelineState) => PipelineState | Promise<PipelineState>;

// ---------------------------------------------------------------------------
// Status summarisation
// ---------------------------------------------------------------------------

const SEVERITY_RANK = { error: 3, warn: 2, info: 1 } as const;

function summarizeStatus(
  checks: AdapterEnvironmentCheck[],
): AdapterEnvironmentTestResult["status"] {
  let highest = 0;
  for (const check of checks) {
    const rank = SEVERITY_RANK[check.level as keyof typeof SEVERITY_RANK] ?? 0;
    if (rank > highest) highest = rank;
  }
  if (highest === SEVERITY_RANK.error) return "fail";
  if (highest === SEVERITY_RANK.warn) return "warn";
  return "pass";
}

function normalizeMethod(input: string): string {
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed.toUpperCase() : "POST";
}

// ---------------------------------------------------------------------------
// Pipeline steps
// ---------------------------------------------------------------------------

const stepValidateUrlPresent: PipelineStep = (state) => {
  const config = parseObject(state.ctx.config);
  const urlValue = asString(config.url, "");
  state.method = normalizeMethod(asString(config.method, "POST"));

  if (!urlValue) {
    state.checks.push({
      code: "http_url_missing",
      level: "error",
      message: "HTTP adapter requires a URL.",
      hint: "Set adapterConfig.url to an absolute http(s) endpoint.",
    });
    state.abort = true;
    return state;
  }

  try {
    state.url = new URL(urlValue);
  } catch {
    state.checks.push({
      code: "http_url_invalid",
      level: "error",
      message: `Invalid URL: ${urlValue}`,
    });
  }
  return state;
};

const stepValidateProtocol: PipelineStep = (state) => {
  const url = state.url;
  if (!url) return state;
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    state.checks.push({
      code: "http_url_protocol_invalid",
      level: "error",
      message: `Unsupported URL protocol: ${url.protocol}`,
      hint: "Use an http:// or https:// endpoint.",
    });
  } else {
    state.checks.push({
      code: "http_url_valid",
      level: "info",
      message: `Configured endpoint: ${url.toString()}`,
    });
  }
  return state;
};

const stepRecordMethod: PipelineStep = (state) => {
  state.checks.push({
    code: "http_method_configured",
    level: "info",
    message: `Configured method: ${state.method}`,
  });
  return state;
};

const stepProbeEndpoint: PipelineStep = async (state) => {
  const url = state.url;
  if (!url) return state;
  if (url.protocol !== "http:" && url.protocol !== "https:") return state;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3000);
  try {
    const response = await fetch(url, { method: "HEAD", signal: controller.signal });
    if (!response.ok && response.status !== 405 && response.status !== 501) {
      state.checks.push({
        code: "http_endpoint_probe_unexpected_status",
        level: "warn",
        message: `Endpoint probe returned HTTP ${response.status}.`,
        hint: "Verify the endpoint is reachable from the server.",
      });
    } else {
      state.checks.push({
        code: "http_endpoint_probe_ok",
        level: "info",
        message: "Endpoint responded to a HEAD probe.",
      });
    }
  } catch (err) {
    state.checks.push({
      code: "http_endpoint_probe_failed",
      level: "warn",
      message: err instanceof Error ? err.message : "Endpoint probe failed",
      hint:
        "This may be expected in restricted networks; verify connectivity when invoking runs.",
    });
  } finally {
    clearTimeout(timeout);
  }
  return state;
};

const PIPELINE: PipelineStep[] = [
  stepValidateUrlPresent,
  stepValidateProtocol,
  stepRecordMethod,
  stepProbeEndpoint,
];

// ---------------------------------------------------------------------------
// Public entry
// ---------------------------------------------------------------------------

export async function testEnvironment(
  ctx: AdapterEnvironmentTestContext,
): Promise<AdapterEnvironmentTestResult> {
  let state: PipelineState = {
    ctx,
    checks: [],
    url: null,
    method: "POST",
    abort: false,
  };

  for (const step of PIPELINE) {
    state = await step(state);
    if (state.abort) break;
  }

  return {
    adapterType: ctx.adapterType,
    status: summarizeStatus(state.checks),
    checks: state.checks,
    testedAt: new Date().toISOString(),
  };
}
