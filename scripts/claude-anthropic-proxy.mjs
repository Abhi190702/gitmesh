#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";

const host = process.env.CLAUDE_PROXY_HOST || "127.0.0.1";
const port = Number(process.env.CLAUDE_PROXY_PORT || 8765);
const defaultProvider = (process.env.CLAUDE_PROXY_DEFAULT_PROVIDER || "anthropic").trim().toLowerCase();

function parseModelMap() {
  const raw = process.env.CLAUDE_PROXY_MODEL_MAP?.trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    const out = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof key === "string" && typeof value === "string" && key.trim() && value.trim()) {
        out[key.trim()] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

const modelMap = parseModelMap();

function trimTrailingSlash(value) {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function providerConfig(provider) {
  const p = provider.toUpperCase();

  const baseUrl = trimTrailingSlash(
    process.env[`${p}_BASE_URL`] ||
      (provider === "anthropic" ? "https://api.anthropic.com" : "") ||
      (provider === "minimax" ? "https://api.minimax.io/anthropic" : ""),
  );

  const apiKey =
    process.env[`${p}_API_KEY`] ||
    (provider === "anthropic" ? process.env.ANTHROPIC_API_KEY : undefined) ||
    (provider === "minimax" ? process.env.ANTHROPIC_AUTH_TOKEN : undefined) ||
    "";

  const authHeader = process.env[`${p}_AUTH_HEADER`] || (provider === "anthropic" ? "x-api-key" : "Authorization");
  const authScheme = process.env[`${p}_AUTH_SCHEME`] || (provider === "anthropic" ? "" : "Bearer");

  return {
    provider,
    baseUrl,
    apiKey,
    authHeader,
    authScheme,
  };
}

function withProviderModelPrefix(provider, model) {
  return `${provider}/${model}`;
}

function resolveRoute(inputModel, explicitProviderHeader) {
  const mappedModel = typeof inputModel === "string" && modelMap[inputModel] ? modelMap[inputModel] : inputModel;

  if (typeof mappedModel === "string" && mappedModel.includes("/")) {
    const [providerRaw, ...rest] = mappedModel.split("/");
    const provider = providerRaw.trim().toLowerCase();
    const model = rest.join("/").trim();
    if (provider && model) {
      return { provider, model, mappedModel };
    }
  }

  if (explicitProviderHeader) {
    return { provider: explicitProviderHeader, model: mappedModel, mappedModel };
  }

  return { provider: defaultProvider, model: mappedModel, mappedModel };
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function buildUpstreamHeaders(reqHeaders, provider) {
  const headers = {};
  for (const [key, value] of Object.entries(reqHeaders)) {
    const lower = key.toLowerCase();
    if (
      lower === "host" ||
      lower === "content-length" ||
      lower === "connection" ||
      lower === "x-forwarded-for" ||
      lower === "x-provider"
    ) {
      continue;
    }
    if (typeof value === "string") headers[key] = value;
  }

  if (!headers["anthropic-version"]) {
    headers["anthropic-version"] = "2023-06-01";
  }

  if (provider.apiKey) {
    const rawValue = provider.authScheme
      ? `${provider.authScheme.trim()} ${provider.apiKey}`
      : provider.apiKey;
    headers[provider.authHeader] = rawValue;
    if (provider.authHeader.toLowerCase() !== "x-api-key" && !headers["x-api-key"]) {
      headers["x-api-key"] = provider.apiKey;
    }
  }

  return headers;
}

function writeError(res, statusCode, message, extra = {}) {
  res.writeHead(statusCode, { "content-type": "application/json" });
  res.end(JSON.stringify({ error: message, ...extra }));
}

const server = http.createServer(async (req, res) => {
  try {
    const method = (req.method || "GET").toUpperCase();
    const path = req.url || "/";

    if (method === "GET" && path === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          ok: true,
          proxy: "claude-anthropic-proxy",
          defaultProvider,
          providers: {
            anthropic: providerConfig("anthropic").baseUrl,
            minimax: providerConfig("minimax").baseUrl,
          },
        }),
      );
      return;
    }

    if (!path.startsWith("/v1/")) {
      writeError(res, 404, "Only /v1/* endpoints are supported", { path });
      return;
    }

    const bodyBuffer = await readBody(req);
    let parsedBody = null;

    if (bodyBuffer.length > 0) {
      try {
        parsedBody = JSON.parse(bodyBuffer.toString("utf8"));
      } catch {
        parsedBody = null;
      }
    }

    const providerHeader = typeof req.headers["x-provider"] === "string"
      ? req.headers["x-provider"].trim().toLowerCase()
      : "";

    const incomingModel = parsedBody && typeof parsedBody === "object" ? parsedBody.model : undefined;
    const route = resolveRoute(incomingModel, providerHeader || undefined);
    const provider = providerConfig(route.provider);

    if (!provider.baseUrl) {
      writeError(res, 500, `Provider '${route.provider}' is not configured (missing ${route.provider.toUpperCase()}_BASE_URL)`);
      return;
    }

    if (!provider.apiKey) {
      writeError(
        res,
        500,
        `Provider '${route.provider}' is missing API key (expected ${route.provider.toUpperCase()}_API_KEY${route.provider === "minimax" ? " or ANTHROPIC_AUTH_TOKEN" : ""})`,
      );
      return;
    }

    let outboundBody = bodyBuffer;
    if (parsedBody && typeof parsedBody === "object") {
      const cloned = { ...parsedBody };
      if (typeof cloned.model === "string") {
        cloned.model = route.model;
      }
      outboundBody = Buffer.from(JSON.stringify(cloned));
    }

    const upstreamUrl = new URL(path, provider.baseUrl).toString();
    const headers = buildUpstreamHeaders(req.headers, provider);

    const upstream = await fetch(upstreamUrl, {
      method,
      headers,
      body: method === "GET" || method === "HEAD" ? undefined : outboundBody,
      redirect: "manual",
    });

    const upstreamHeaders = {};
    upstream.headers.forEach((value, key) => {
      if (key.toLowerCase() === "content-length") return;
      upstreamHeaders[key] = value;
    });

    upstreamHeaders["x-claude-proxy-provider"] = route.provider;
    if (typeof route.mappedModel === "string" && route.mappedModel) {
      upstreamHeaders["x-claude-proxy-model-in"] = route.mappedModel;
      upstreamHeaders["x-claude-proxy-model-out"] = withProviderModelPrefix(route.provider, route.model);
    }

    res.writeHead(upstream.status, upstreamHeaders);

    if (!upstream.body) {
      res.end();
      return;
    }

    for await (const chunk of upstream.body) {
      res.write(chunk);
    }
    res.end();
  } catch (error) {
    writeError(res, 500, "Proxy failed", {
      details: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(port, host, () => {
  console.log(`[claude-proxy] listening on http://${host}:${port}`);
  console.log(`[claude-proxy] default provider: ${defaultProvider}`);
  console.log("[claude-proxy] set CLAUDE_PROXY_MODEL_MAP to remap model names, e.g. {'MiniMax-M2.7':'minimax/MiniMax-M2.7'}");
});
