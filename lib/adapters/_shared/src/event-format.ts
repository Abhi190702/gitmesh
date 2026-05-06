/**
 * Declarative stream-event formatter shared by gitmesh adapter CLIs.
 *
 * Each adapter's `format-event.ts` used to be a long imperative chain of
 * `if (type === "...")` branches that all called `console.log` with
 * `picocolors`-coloured strings. Adapters instead express formatting as:
 *
 *   const formatter = defineEventFormatter<MyEventCtx>({
 *     name: "Adapter",
 *     prepare(raw) { ... return { ctx, lines } },
 *     events: {
 *       "thread.started": { handle(ctx, emit) { emit.info(...) } },
 *       ...
 *     },
 *     fallback(ctx, emit) { emit.raw(ctx.line) },
 *   });
 *
 * The helper produces a `(raw, debug) => void` printer that calls
 * `console.log` with the same coloured strings the imperative versions
 * produced. The user-visible wire output is unchanged; only the source
 * shape is different.
 */

import pc from "picocolors";

import { asRecord, asString, safeJsonParse, type JsonRecord } from "./coerce.js";

/* -------------------------------------------------------------------------- */
/* Emitter                                                                    */
/* -------------------------------------------------------------------------- */

/**
 * Wire-output sink that adapter event handlers write to. The default
 * implementation routes to `console.log` (so existing log capture still
 * works) but tests / future tooling can substitute a different sink.
 */
export interface EventEmitter {
  /** Plain text, no colour. */
  raw(line: string): void;
  /** Blue, intended for system / lifecycle lines. */
  info(line: string): void;
  /** Green, intended for assistant-visible content. */
  success(line: string): void;
  /** Yellow, intended for tool-call announcements. */
  warn(line: string): void;
  /** Cyan, intended for tool-result summaries. */
  note(line: string): void;
  /** Red, intended for errors / failed states. */
  error(line: string): void;
  /** Gray, intended for secondary / muted detail lines (thinking, payloads). */
  muted(line: string): void;
}

function makeConsoleEmitter(): EventEmitter {
  const write = (text: string) => {
    if (text === "" || text === undefined) return;
    console.log(text);
  };
  return {
    raw: (line) => write(line),
    info: (line) => write(pc.blue(line)),
    success: (line) => write(pc.green(line)),
    warn: (line) => write(pc.yellow(line)),
    note: (line) => write(pc.cyan(line)),
    error: (line) => write(pc.red(line)),
    muted: (line) => write(pc.gray(line)),
  };
}

/* -------------------------------------------------------------------------- */
/* Spec types                                                                 */
/* -------------------------------------------------------------------------- */

export interface FormatterContext {
  /** Trimmed raw line, untouched JSON or otherwise. */
  readonly line: string;
  /** Parsed JSON object, or null when the line is not parseable. */
  readonly parsed: JsonRecord | null;
  /** Whether the caller passed `debug=true`. */
  readonly debug: boolean;
}

export type EventHandler<Ctx extends FormatterContext> = (
  ctx: Ctx,
  emit: EventEmitter,
) => void;

export interface EventEntry<Ctx extends FormatterContext> {
  /** Optional human-readable label, kept for documentation / future logs. */
  label?: string;
  handle: EventHandler<Ctx>;
}

export interface FormatterSpec<Ctx extends FormatterContext> {
  /** Friendly adapter name, currently only used for stack traces. */
  name: string;

  /**
   * Determine which key of `events` to dispatch this parsed line to.
   *
   * Return `null` to skip dispatch entirely (the fallback runs instead).
   * Most adapters return `parsed.type` as a string here.
   */
  selectKind: (ctx: Ctx) => string | null;

  /**
   * Hook to enrich the base context before dispatch (for example to coerce
   * `parsed.subtype`). Returning a different shape lets handlers stay
   * strongly typed without re-coercing fields they all use.
   */
  prepare?: (base: FormatterContext) => Ctx;

  events: Record<string, EventEntry<Ctx>>;

  /**
   * Run when no event entry matches. Defaults to printing the raw line.
   */
  fallback?: EventHandler<Ctx>;

  /**
   * Run when the line is non-empty but cannot be JSON-parsed. Defaults to
   * `emit.raw(ctx.line)` (matching the imperative versions).
   */
  onUnparseable?: (line: string, emit: EventEmitter) => void;
}

/* -------------------------------------------------------------------------- */
/* Builder                                                                    */
/* -------------------------------------------------------------------------- */

export interface DefinedFormatter {
  (raw: string, debug: boolean): void;
  /** Lower-level form used in tests; routes through a custom emitter. */
  emit(raw: string, debug: boolean, emit: EventEmitter): void;
}

/**
 * Build an adapter event formatter from a declarative spec.
 *
 * The returned function has the same signature as the legacy
 * `print<Adapter>StreamEvent(raw, debug)` helpers and may be re-exported
 * directly. An `.emit` form is exposed for unit tests that want to
 * capture lines without monkey-patching `console.log`.
 */
export function defineEventFormatter<Ctx extends FormatterContext = FormatterContext>(
  spec: FormatterSpec<Ctx>,
): DefinedFormatter {
  const onUnparseable =
    spec.onUnparseable ?? ((line: string, emit: EventEmitter) => emit.raw(line));

  function dispatch(raw: string, debug: boolean, emit: EventEmitter): void {
    const line = raw.trim();
    if (!line) return;

    const value = safeJsonParse(line);
    const parsed = asRecord(value);
    if (!parsed) {
      onUnparseable(line, emit);
      return;
    }

    const base: FormatterContext = { line, parsed, debug };
    const ctx = (spec.prepare ? spec.prepare(base) : (base as Ctx)) as Ctx;

    const kind = spec.selectKind(ctx);
    if (kind != null) {
      const entry = spec.events[kind];
      if (entry) {
        entry.handle(ctx, emit);
        return;
      }
    }

    if (spec.fallback) {
      spec.fallback(ctx, emit);
      return;
    }

    emit.raw(line);
  }

  const printer = ((raw: string, debug: boolean) => {
    dispatch(raw, debug, makeConsoleEmitter());
  }) as DefinedFormatter;

  printer.emit = (raw, debug, emit) => dispatch(raw, debug, emit);
  return printer;
}

/* -------------------------------------------------------------------------- */
/* Convenience helpers used by adapter specs                                  */
/* -------------------------------------------------------------------------- */

/**
 * Pretty-print an arbitrary tool-call input as a muted JSON block. Matches
 * the legacy `try { JSON.stringify(input, null, 2) } catch { String(input) }`
 * pattern used across every adapter.
 */
export function emitToolInput(input: unknown, emit: EventEmitter): void {
  if (input === undefined) return;
  try {
    emit.muted(JSON.stringify(input, null, 2));
  } catch {
    emit.muted(String(input));
  }
}

/**
 * Build a `key=value` summary string from the supplied entries, dropping
 * any whose value is empty / null / undefined / NaN. Useful for the
 * `tokens: in=… out=…` and `result: subtype=… is_error=…` lines.
 */
export function summary(entries: Array<[string, string | number | boolean | null | undefined]>): string {
  const parts: string[] = [];
  for (const [key, value] of entries) {
    if (value === undefined || value === null || value === "") continue;
    if (typeof value === "number" && !Number.isFinite(value)) continue;
    parts.push(`${key}=${value}`);
  }
  return parts.join(" ");
}

/**
 * Format a tokens / cost line (`in=… out=… cached=… cost=$…`). The cost
 * value is rendered with six fractional digits, matching the legacy output.
 */
export function tokensLine(tokens: {
  input: number;
  output: number;
  cached: number;
  cost?: number;
}): string {
  const cost = typeof tokens.cost === "number" && Number.isFinite(tokens.cost)
    ? tokens.cost
    : 0;
  return `tokens: in=${tokens.input} out=${tokens.output} cached=${tokens.cached} cost=$${cost.toFixed(6)}`;
}

/**
 * Coerce `parsed.type` to a string, returning `null` for missing / non-string
 * values. Adapters use this as their default `selectKind` implementation.
 */
export function selectKindFromType(ctx: FormatterContext): string | null {
  const type = asString(ctx.parsed?.type ?? "");
  return type ? type : null;
}

export { pc };
