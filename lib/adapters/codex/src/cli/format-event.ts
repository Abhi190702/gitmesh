/**
 * Codex stream-event formatter, expressed declaratively over the shared
 * helper. The wire-visible output (line text + colour) matches the legacy
 * imperative version.
 *
 * Codex is unusual in that the meaningful event payload lives inside
 * `parsed.item` for `item.started` / `item.completed` events, dispatched
 * by the inner `item.type`. We model that as a small per-event sub-spec.
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
  emitToolInput,
  selectKindFromType,
  tokensLine,
  type EventEmitter,
  type FormatterContext,
} from "@gitmesh/adapter-shared/event-format";

const codexErrorText = (value: unknown) => extractErrorText(value, ERROR_TEXT_PRESETS.codex);

type ItemHandler = (item: Record<string, unknown>, emit: EventEmitter) => boolean;

const ITEM_STARTED_HANDLERS: Record<string, ItemHandler> = {
  command_execution(item, emit) {
    const command = asString(item.command);
    emit.warn("tool_call: command_execution");
    if (command) emit.muted(command);
    return true;
  },
  tool_use(item, emit) {
    const name = asString(item.name, "unknown");
    emit.warn(`tool_call: ${name}`);
    emitToolInput(item.input, emit);
    return true;
  },
};

const ITEM_COMPLETED_HANDLERS: Record<string, ItemHandler> = {
  agent_message(item, emit) {
    const text = asString(item.text);
    if (text) emit.success(`assistant: ${text}`);
    return true;
  },
  reasoning(item, emit) {
    const text = asString(item.text);
    if (text) emit.muted(`thinking: ${text}`);
    return true;
  },
  tool_use(item, emit) {
    const name = asString(item.name, "unknown");
    emit.warn(`tool_call: ${name}`);
    emitToolInput(item.input, emit);
    return true;
  },
  command_execution(item, emit) {
    const command = asString(item.command);
    const status = asString(item.status);
    const exitCode = typeof item.exit_code === "number" && Number.isFinite(item.exit_code) ? item.exit_code : null;
    const output = asString(item.aggregated_output).replace(/\s+$/, "");
    const isError =
      (exitCode !== null && exitCode !== 0) ||
      status === "failed" ||
      status === "errored" ||
      status === "error" ||
      status === "cancelled";
    const summaryParts = [
      "tool_result: command_execution",
      command ? `command="${command}"` : "",
      status ? `status=${status}` : "",
      exitCode !== null ? `exit_code=${exitCode}` : "",
    ].filter(Boolean);
    const line = summaryParts.join(" ");
    if (isError) emit.error(line);
    else emit.note(line);
    if (output) {
      if (isError) emit.error(output);
      else emit.muted(output);
    }
    return true;
  },
  file_change(item, emit) {
    const changes = Array.isArray(item.changes) ? item.changes : [];
    const entries = changes
      .map((changeRaw) => asRecord(changeRaw))
      .filter((change): change is Record<string, unknown> => Boolean(change))
      .map((change) => `${asString(change.kind, "update")} ${asString(change.path, "unknown")}`);
    const preview = entries.length > 0 ? entries.slice(0, 6).join(", ") : "none";
    const more = entries.length > 6 ? ` (+${entries.length - 6} more)` : "";
    emit.note(`file_change: ${preview}${more}`);
    return true;
  },
  error(item, emit) {
    const message = codexErrorText(item.message ?? item.error ?? item);
    if (message) emit.error(`error: ${message}`);
    return true;
  },
  tool_result(item, emit) {
    const isError = item.is_error === true || asString(item.status) === "error";
    const text = asString(item.content) || asString(item.result) || asString(item.output);
    const header = `tool_result${isError ? " (error)" : ""}`;
    if (isError) emit.error(header);
    else emit.note(header);
    if (text) {
      if (isError) emit.error(text);
      else emit.muted(text);
    }
    return true;
  },
};

function handleItemEvent(
  ctx: FormatterContext,
  emit: EventEmitter,
  table: Record<string, ItemHandler>,
  eventType: "item.started" | "item.completed",
): void {
  const item = asRecord(ctx.parsed?.item);
  if (!item) {
    emit.muted(eventType);
    return;
  }
  const itemType = asString(item.type, "unknown");
  const handler = table[itemType];
  if (handler && handler(item, emit)) return;

  const id = asString(item.id);
  const status = asString(item.status);
  const meta = [id ? `id=${id}` : "", status ? `status=${status}` : ""].filter(Boolean).join(" ");
  emit.muted(`${eventType}: ${itemType}${meta ? ` (${meta})` : ""}`);
}

function handleTurnCompleted(ctx: FormatterContext, emit: EventEmitter): void {
  const usage = asRecord(ctx.parsed?.usage);
  const input = asNumber(usage?.input_tokens);
  const output = asNumber(usage?.output_tokens);
  const cached = asNumber(usage?.cached_input_tokens, asNumber(usage?.cache_read_input_tokens));
  const cost = asNumber(ctx.parsed?.total_cost_usd);
  const isError = ctx.parsed?.is_error === true;
  const subtype = asString(ctx.parsed?.subtype);
  const errors = Array.isArray(ctx.parsed?.errors)
    ? (ctx.parsed!.errors as unknown[]).map(codexErrorText).filter(Boolean)
    : [];

  emit.info(tokensLine({ input, output, cached, cost }));
  if (subtype || isError || errors.length > 0) {
    emit.error(`result: subtype=${subtype || "unknown"} is_error=${isError ? "true" : "false"}`);
    if (errors.length > 0) emit.error(`errors: ${errors.join(" | ")}`);
  }
}

function handleTurnFailed(ctx: FormatterContext, emit: EventEmitter): void {
  const usage = asRecord(ctx.parsed?.usage);
  const input = asNumber(usage?.input_tokens);
  const output = asNumber(usage?.output_tokens);
  const cached = asNumber(usage?.cached_input_tokens, asNumber(usage?.cache_read_input_tokens));
  const message = codexErrorText(ctx.parsed?.error ?? ctx.parsed?.message);
  emit.error(`turn failed${message ? `: ${message}` : ""}`);
  // The legacy implementation omits the `cost=$…` portion here on purpose.
  emit.info(`tokens: in=${input} out=${output} cached=${cached}`);
}

const formatter = defineEventFormatter({
  name: "codex",
  selectKind: selectKindFromType,

  events: {
    "thread.started": {
      handle(ctx, emit) {
        const threadId = asString(ctx.parsed?.thread_id);
        const model = asString(ctx.parsed?.model);
        const details = [threadId ? `session: ${threadId}` : "", model ? `model: ${model}` : ""]
          .filter(Boolean)
          .join(", ");
        emit.info(`Codex thread started${details ? ` (${details})` : ""}`);
      },
    },
    "turn.started": {
      handle(_ctx, emit) {
        emit.info("turn started");
      },
    },
    "item.started": {
      handle: (ctx, emit) => handleItemEvent(ctx, emit, ITEM_STARTED_HANDLERS, "item.started"),
    },
    "item.completed": {
      handle: (ctx, emit) => handleItemEvent(ctx, emit, ITEM_COMPLETED_HANDLERS, "item.completed"),
    },
    "turn.completed": { handle: handleTurnCompleted },
    "turn.failed": { handle: handleTurnFailed },
    error: {
      handle(ctx, emit) {
        const message = codexErrorText(ctx.parsed?.message ?? ctx.parsed?.error ?? ctx.parsed);
        if (message) emit.error(`error: ${message}`);
      },
    },
  },

  fallback(ctx, emit) {
    emit.raw(ctx.line);
  },
});

export const printCodexStreamEvent: (raw: string, debug: boolean) => void = formatter;
