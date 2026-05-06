/**
 * OpenCode stream-event formatter, expressed as a declarative spec.
 * See `_shared/event-format.ts` for the helper used here.
 */

import {
  asNumber,
  asRecord,
  asString,
  ERROR_TEXT_PRESETS,
  extractErrorText,
} from "@gitmesh/adapter-shared/coerce";
import {
  defineEventFormatter,
  selectKindFromType,
  tokensLine,
  type EventEmitter,
  type FormatterContext,
} from "@gitmesh/adapter-shared/event-format";

interface OpenCodeContext extends FormatterContext {
  /** `parsed.part` coerced to a record, or null. */
  readonly part: Record<string, unknown> | null;
}

function prepare(base: FormatterContext): OpenCodeContext {
  return Object.freeze({
    ...base,
    part: asRecord(base.parsed?.part),
  });
}

function metadataKvPairs(metadata: Record<string, unknown>): string[] {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(metadata)) {
    if (value !== undefined && value !== null) parts.push(`${key}=${value}`);
  }
  return parts;
}

function handleToolUse(ctx: OpenCodeContext, emit: EventEmitter): void {
  const tool = asString(ctx.part?.tool, "tool");
  const callID = asString(ctx.part?.callID);
  const state = asRecord(ctx.part?.state);
  const status = asString(state?.status);
  const isError = status === "error";
  const metadata = asRecord(state?.metadata);

  emit.warn(`tool_call: ${tool}${callID ? ` (${callID})` : ""}`);

  if (status) {
    const metaParts = [`status=${status}`];
    if (metadata) metaParts.push(...metadataKvPairs(metadata));
    const summary = `tool_result ${metaParts.join(" ")}`;
    if (isError) emit.error(summary);
    else emit.muted(summary);
  }

  const output = (asString(state?.output) || asString(state?.error)).trim();
  if (output) {
    if (isError) emit.error(output);
    else emit.muted(output);
  }
}

function handleStepFinish(ctx: OpenCodeContext, emit: EventEmitter): void {
  const tokens = asRecord(ctx.part?.tokens);
  const cache = asRecord(tokens?.cache);
  const input = asNumber(tokens?.input, 0);
  const output = asNumber(tokens?.output, 0) + asNumber(tokens?.reasoning, 0);
  const cached = asNumber(cache?.read, 0);
  const cost = asNumber(ctx.part?.cost, 0);
  const reason = asString(ctx.part?.reason, "step");
  emit.info(`step finished: reason=${reason}`);
  emit.info(tokensLine({ input, output, cached, cost }));
}

const formatter = defineEventFormatter<OpenCodeContext>({
  name: "opencode",
  prepare,
  selectKind: selectKindFromType,

  events: {
    step_start: {
      handle(ctx, emit) {
        const sessionId = asString(ctx.parsed?.sessionID);
        emit.info(`step started${sessionId ? ` (session: ${sessionId})` : ""}`);
      },
    },

    text: {
      handle(ctx, emit) {
        const text = asString(ctx.part?.text).trim();
        if (text) emit.success(`assistant: ${text}`);
      },
    },

    reasoning: {
      handle(ctx, emit) {
        const text = asString(ctx.part?.text).trim();
        if (text) emit.muted(`thinking: ${text}`);
      },
    },

    tool_use: { handle: handleToolUse },

    step_finish: { handle: handleStepFinish },

    error: {
      handle(ctx, emit) {
        const message = extractErrorText(
          ctx.parsed?.error ?? ctx.parsed?.message,
          ERROR_TEXT_PRESETS.opencode,
        );
        if (message) emit.error(`error: ${message}`);
      },
    },
  },

  // Mirror the legacy default: print the raw line for unrecognised types.
  fallback(ctx, emit) {
    emit.raw(ctx.line);
  },
});

export const printOpenCodeStreamEvent: (raw: string, debug: boolean) => void = formatter;
