import type { TranscriptEntry } from "@gitmesh/adapter-sdk";
import {
  asNumber,
  asRecord,
  asString,
  safeJsonParse,
  stringifyUnknown,
  type JsonRecord,
} from "@gitmesh/adapter-shared/coerce";
import { normalizeCursorStreamLine } from "../shared/stream.js";

/**
 * Cursor stream-stdout → TranscriptEntry parser.
 *
 * Restructured from the legacy single-function imperative implementation
 * into a small declarative dispatch table. Each Cursor event `type` maps
 * to a `(parsed, ts) => TranscriptEntry[]` handler. The behaviour (and
 * therefore the persisted transcript shape) is preserved exactly.
 */

const SHELL_OUTPUT_TRUNCATE = 2000;
const SHELL_TOOL_NAMES = new Set(["shell", "shellToolCall"]);

type EventHandler = (parsed: JsonRecord, ts: string, raw: string) => TranscriptEntry[];

/* -------------------------------------------------------------------------- */
/* Tool-result helpers                                                        */
/* -------------------------------------------------------------------------- */

function truncate(text: string): string {
  return text.length > SHELL_OUTPUT_TRUNCATE
    ? `${text.slice(0, SHELL_OUTPUT_TRUNCATE)}\n... (truncated)`
    : text;
}

function formatShellToolResultForLog(result: unknown): string {
  const obj = asRecord(result);
  if (!obj) return stringifyUnknown(result);
  const success = asRecord(obj.success);
  if (!success) return stringifyUnknown(result);

  const exitCode = asNumber(success.exitCode, NaN);
  const stdout = asString(success.stdout).trim();
  const stderr = asString(success.stderr).trim();
  if (!Number.isFinite(exitCode) && !stdout && !stderr) return stringifyUnknown(result);

  const lines: string[] = [];
  if (Number.isFinite(exitCode)) lines.push(`exit ${exitCode}`);
  if (stdout) {
    lines.push("<stdout>");
    lines.push(truncate(stdout));
  }
  if (stderr) {
    lines.push("<stderr>");
    lines.push(truncate(stderr));
  }
  return lines.join("\n");
}

function compactShellToolInput(rawInput: unknown, payload?: JsonRecord): unknown {
  const cmd = asString(payload?.command ?? asRecord(rawInput)?.command);
  return cmd ? { command: cmd } : rawInput;
}

/* -------------------------------------------------------------------------- */
/* Message-shape parsers (user / assistant)                                   */
/* -------------------------------------------------------------------------- */

function pushTextEntries(
  raw: unknown,
  ts: string,
  kind: "user" | "assistant",
): TranscriptEntry[] {
  if (typeof raw === "string") {
    const text = raw.trim();
    return text ? [{ kind, ts, text }] : [];
  }
  const message = asRecord(raw);
  if (!message) return [];

  const entries: TranscriptEntry[] = [];
  const direct = asString(message.text).trim();
  if (direct) entries.push({ kind, ts, text: direct });

  const content = Array.isArray(message.content) ? message.content : [];
  for (const partRaw of content) {
    const part = asRecord(partRaw);
    if (!part) continue;
    const partType = asString(part.type).trim();
    if (partType !== "output_text" && partType !== "text") continue;
    const text = asString(part.text).trim();
    if (text) entries.push({ kind, ts, text });
  }
  return entries;
}

function parseAssistantMessage(messageRaw: unknown, ts: string): TranscriptEntry[] {
  if (typeof messageRaw === "string") {
    const text = messageRaw.trim();
    return text ? [{ kind: "assistant", ts, text }] : [];
  }
  const message = asRecord(messageRaw);
  if (!message) return [];

  const entries: TranscriptEntry[] = [];
  const direct = asString(message.text).trim();
  if (direct) entries.push({ kind: "assistant", ts, text: direct });

  const content = Array.isArray(message.content) ? message.content : [];
  for (const partRaw of content) {
    const part = asRecord(partRaw);
    if (!part) continue;
    const partType = asString(part.type).trim();

    if (partType === "output_text" || partType === "text") {
      const text = asString(part.text).trim();
      if (text) entries.push({ kind: "assistant", ts, text });
      continue;
    }

    if (partType === "thinking") {
      const text = asString(part.text).trim();
      if (text) entries.push({ kind: "thinking", ts, text });
      continue;
    }

    if (partType === "tool_call") {
      const name = asString(part.name, asString(part.tool, "tool"));
      const rawInput = part.input ?? part.arguments ?? part.args ?? {};
      const input = SHELL_TOOL_NAMES.has(name)
        ? compactShellToolInput(rawInput, asRecord(rawInput) ?? undefined)
        : rawInput;
      entries.push({ kind: "tool_call", ts, name, input });
      continue;
    }

    if (partType === "tool_result") {
      const toolUseId =
        asString(part.tool_use_id) ||
        asString(part.toolUseId) ||
        asString(part.call_id) ||
        asString(part.id) ||
        "tool_result";
      const rawOutput = part.output ?? part.result ?? part.text;
      const contentText =
        typeof rawOutput === "object" && rawOutput !== null
          ? formatShellToolResultForLog(rawOutput)
          : asString(rawOutput) || stringifyUnknown(rawOutput);
      const isError = part.is_error === true || asString(part.status).toLowerCase() === "error";
      entries.push({
        kind: "tool_result",
        ts,
        toolUseId,
        content: contentText,
        isError,
      });
    }
  }
  return entries;
}

function parseToolCallEvent(event: JsonRecord, ts: string): TranscriptEntry[] {
  const subtype = asString(event.subtype).trim().toLowerCase();
  const callId =
    asString(event.call_id) || asString(event.callId) || asString(event.id) || "tool_call";
  const toolCall = asRecord(event.tool_call ?? event.toolCall);
  if (!toolCall) {
    return [{ kind: "system", ts, text: `tool_call${subtype ? ` (${subtype})` : ""}` }];
  }

  const [toolName] = Object.keys(toolCall);
  if (!toolName) {
    return [{ kind: "system", ts, text: `tool_call${subtype ? ` (${subtype})` : ""}` }];
  }

  const payload = asRecord(toolCall[toolName]) ?? {};
  const rawInput = payload.args ?? asRecord(payload.function)?.arguments ?? payload;
  const isShellTool = SHELL_TOOL_NAMES.has(toolName);
  const input = isShellTool ? compactShellToolInput(rawInput, payload) : rawInput;

  if (subtype === "started" || subtype === "start") {
    return [{ kind: "tool_call", ts, name: toolName, input }];
  }

  if (subtype === "completed" || subtype === "complete" || subtype === "finished") {
    const result =
      payload.result ??
      payload.output ??
      payload.error ??
      asRecord(payload.function)?.result ??
      asRecord(payload.function)?.output;
    const status = asString(payload.status).toLowerCase();
    const isError =
      event.is_error === true ||
      payload.is_error === true ||
      status === "error" ||
      status === "failed" ||
      status === "cancelled" ||
      payload.error !== undefined;
    const content =
      result !== undefined
        ? isShellTool
          ? formatShellToolResultForLog(result)
          : stringifyUnknown(result)
        : `${toolName} completed`;
    return [{ kind: "tool_result", ts, toolUseId: callId, content, isError }];
  }

  return [{ kind: "system", ts, text: `tool_call${subtype ? ` (${subtype})` : ""}: ${toolName}` }];
}

/* -------------------------------------------------------------------------- */
/* Dispatch table                                                             */
/* -------------------------------------------------------------------------- */

const HANDLERS: Record<string, EventHandler> = {
  system: (parsed, ts) => {
    const subtype = asString(parsed.subtype);
    if (subtype === "init") {
      const sessionId =
        asString(parsed.session_id) || asString(parsed.sessionId) || asString(parsed.sessionID);
      return [{ kind: "init", ts, model: asString(parsed.model, "cursor"), sessionId }];
    }
    return [{ kind: "system", ts, text: subtype ? `system: ${subtype}` : "system" }];
  },

  assistant: (parsed, ts) => {
    const entries = parseAssistantMessage(parsed.message, ts);
    return entries.length > 0
      ? entries
      : [{ kind: "assistant", ts, text: asString(parsed.result) }];
  },

  user: (parsed, ts) => pushTextEntries(parsed.message, ts, "user"),

  thinking: (parsed, ts) => {
    const topLevel = asString(parsed.text);
    const fromDelta = asString(asRecord(parsed.delta)?.text);
    const text = topLevel.length > 0 ? topLevel : fromDelta;
    const subtype = asString(parsed.subtype).trim().toLowerCase();
    const isDelta = subtype === "delta" || asRecord(parsed.delta) !== null;
    if (!text.trim()) return [];
    return [
      {
        kind: "thinking",
        ts,
        text: isDelta ? text : text.trim(),
        ...(isDelta ? { delta: true } : {}),
      },
    ];
  },

  tool_call: (parsed, ts) => parseToolCallEvent(parsed, ts),

  result: (parsed, ts) => {
    const usage = asRecord(parsed.usage);
    const inputTokens = asNumber(usage?.input_tokens, asNumber(usage?.inputTokens));
    const outputTokens = asNumber(usage?.output_tokens, asNumber(usage?.outputTokens));
    const cachedTokens = asNumber(
      usage?.cached_input_tokens,
      asNumber(usage?.cachedInputTokens, asNumber(usage?.cache_read_input_tokens)),
    );
    const subtype = asString(parsed.subtype, "result");
    const errors = Array.isArray(parsed.errors)
      ? (parsed.errors as unknown[]).map((value) => stringifyUnknown(value)).filter(Boolean)
      : [];
    const errorText = asString(parsed.error).trim();
    if (errorText) errors.push(errorText);
    const isError = parsed.is_error === true || subtype === "error" || subtype === "failed";

    return [
      {
        kind: "result",
        ts,
        text: asString(parsed.result),
        inputTokens,
        outputTokens,
        cachedTokens,
        costUsd: asNumber(parsed.total_cost_usd, asNumber(parsed.cost_usd, asNumber(parsed.cost))),
        subtype,
        isError,
        errors,
      },
    ];
  },

  error: (parsed, ts, raw) => {
    const message =
      asString(parsed.message) || stringifyUnknown(parsed.error ?? parsed.detail) || raw;
    return [{ kind: "stderr", ts, text: message }];
  },

  step_start: (parsed, ts) => {
    const sessionId = asString(parsed.sessionID);
    return [{ kind: "system", ts, text: `step started${sessionId ? ` (${sessionId})` : ""}` }];
  },

  text: (parsed, ts) => {
    const part = asRecord(parsed.part);
    const text = asString(part?.text).trim();
    return text ? [{ kind: "assistant", ts, text }] : [];
  },

  tool_use: (parsed, ts) => {
    const part = asRecord(parsed.part);
    const toolUseId = asString(part?.callID, asString(part?.id, "tool_use"));
    const toolName = asString(part?.tool, "tool");
    const state = asRecord(part?.state);
    const input = state?.input ?? {};
    const output = asString(state?.output).trim();
    const status = asString(state?.status).trim();
    const exitCode = asNumber(asRecord(state?.metadata)?.exit, NaN);
    const isError =
      status === "failed" ||
      status === "error" ||
      status === "cancelled" ||
      (Number.isFinite(exitCode) && exitCode !== 0);

    const entries: TranscriptEntry[] = [
      { kind: "tool_call", ts, name: toolName, input },
    ];

    if (status || output) {
      const lines: string[] = [];
      if (status) lines.push(`status: ${status}`);
      if (Number.isFinite(exitCode)) lines.push(`exit: ${exitCode}`);
      if (output) {
        if (lines.length > 0) lines.push("");
        lines.push(output);
      }
      entries.push({
        kind: "tool_result",
        ts,
        toolUseId,
        content: lines.join("\n").trim() || "tool completed",
        isError,
      });
    }
    return entries;
  },

  step_finish: (parsed, ts) => {
    const part = asRecord(parsed.part);
    const tokens = asRecord(part?.tokens);
    const cache = asRecord(tokens?.cache);
    const reason = asString(part?.reason);
    return [
      {
        kind: "result",
        ts,
        text: reason,
        inputTokens: asNumber(tokens?.input),
        outputTokens: asNumber(tokens?.output),
        cachedTokens: asNumber(cache?.read),
        costUsd: asNumber(part?.cost),
        subtype: reason || "step_finish",
        isError: reason === "error" || reason === "failed",
        errors: [],
      },
    ];
  },
};

/* -------------------------------------------------------------------------- */
/* Public entry point                                                         */
/* -------------------------------------------------------------------------- */

export function parseCursorStdoutLine(line: string, ts: string): TranscriptEntry[] {
  const normalised = normalizeCursorStreamLine(line);
  if (!normalised.line) return [];

  const parsed = asRecord(safeJsonParse(normalised.line));
  if (!parsed) {
    return [{ kind: "stdout", ts, text: normalised.line }];
  }

  const type = asString(parsed.type);
  const handler = HANDLERS[type];
  if (handler) return handler(parsed, ts, normalised.line);

  return [{ kind: "stdout", ts, text: normalised.line }];
}
