/**
 * Pi stream-event formatter, expressed declaratively.
 * Wire output is identical to the legacy imperative implementation.
 */

import {
  asRecord,
  asString,
} from "@gitmesh/adapter-shared/coerce";
import {
  defineEventFormatter,
  emitToolInput,
  selectKindFromType,
  type EventEmitter,
  type FormatterContext,
} from "@gitmesh/adapter-shared/event-format";

interface PiContentPart {
  type: string;
  text?: string;
}

function extractTextContent(content: string | PiContentPart[] | unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((c): c is PiContentPart => Boolean(c && typeof c === "object" && (c as PiContentPart).type === "text" && (c as PiContentPart).text))
    .map((c) => c.text ?? "")
    .join("");
}

function handleTurnEnd(ctx: FormatterContext, emit: EventEmitter): void {
  const message = asRecord(ctx.parsed?.message);
  if (!message) return;
  const text = extractTextContent(message.content);
  if (text) emit.success(`assistant: ${text}`);
}

function handleMessageUpdate(ctx: FormatterContext, emit: EventEmitter): void {
  const assistantEvent = asRecord(ctx.parsed?.assistantMessageEvent);
  if (!assistantEvent) return;
  if (asString(assistantEvent.type) !== "text_delta") return;
  const delta = asString(assistantEvent.delta);
  if (delta) emit.success(delta);
}

function handleToolStart(ctx: FormatterContext, emit: EventEmitter): void {
  const toolName = asString(ctx.parsed?.toolName);
  emit.warn(`tool_start: ${toolName}`);
  emitToolInput(ctx.parsed?.args, emit);
}

function handleToolEnd(ctx: FormatterContext, emit: EventEmitter): void {
  const result = ctx.parsed?.result;
  const isError = ctx.parsed?.isError === true;
  const output = typeof result === "string" ? result : JSON.stringify(result);
  if (!output) return;
  if (isError) emit.error(output);
  else emit.muted(output);
}

const formatter = defineEventFormatter({
  name: "pi",
  selectKind: selectKindFromType,

  events: {
    agent_start: { handle: (_ctx, emit) => emit.info("Pi agent started") },
    agent_end: { handle: (_ctx, emit) => emit.info("Pi agent finished") },
    turn_start: { handle: (_ctx, emit) => emit.info("Turn started") },
    turn_end: { handle: handleTurnEnd },
    message_update: { handle: handleMessageUpdate },
    tool_execution_start: { handle: handleToolStart },
    tool_execution_end: { handle: handleToolEnd },
  },

  fallback(ctx, emit) {
    emit.raw(ctx.line);
  },
});

export const printPiStreamEvent: (raw: string, debug: boolean) => void = formatter;
