import { describe, expect, it } from "vitest";
import { parsePiJsonl, isPiUnknownSessionError } from "./parse.js";

/**
 * Tests for `parsePiJsonl`.
 *
 * The legacy version of this file inlined every fixture as a long
 * `[ ... ].join("\n")` block, which made unrelated cases look like duplicates
 * in jscpd reports. This suite instead:
 *
 *   1. Build JSONL streams via `jsonl(...events)` instead of inline joins.
 *   2. Group lifecycle / streaming / tool-call / usage scenarios with a
 *      distinct file layout while preserving behaviour.
 *
 * The behaviour under test is unchanged.
 */

/* -------------------------------------------------------------------------- */
/* Fixture helpers                                                            */
/* -------------------------------------------------------------------------- */

type StreamEvent = Record<string, unknown>;

const jsonl = (...events: StreamEvent[]): string =>
  events.map((event) => JSON.stringify(event)).join("\n");

const turnEnd = (overrides: Partial<StreamEvent> = {}): StreamEvent => ({
  type: "turn_end",
  message: { role: "assistant", content: "" },
  ...overrides,
});

const assistantTurn = (text: string, extras: Partial<StreamEvent> = {}): StreamEvent =>
  turnEnd({
    message: { role: "assistant", content: text },
    ...extras,
  });

const textDelta = (delta: string): StreamEvent => ({
  type: "message_update",
  assistantMessageEvent: { type: "text_delta", delta },
});

const toolStart = (toolCallId: string, toolName: string, args: unknown): StreamEvent => ({
  type: "tool_execution_start",
  toolCallId,
  toolName,
  args,
});

const toolEnd = (
  toolCallId: string,
  toolName: string,
  result: string,
  isError = false,
): StreamEvent => ({
  type: "tool_execution_end",
  toolCallId,
  toolName,
  result,
  isError,
});

/* -------------------------------------------------------------------------- */
/* Suite                                                                      */
/* -------------------------------------------------------------------------- */

describe("parsePiJsonl: lifecycle & messages", () => {
  it("parses agent lifecycle and messages", () => {
    const parsed = parsePiJsonl(
      jsonl(
        { type: "agent_start" },
        turnEnd({
          message: {
            role: "assistant",
            content: [{ type: "text", text: "Hello from Pi" }],
          },
        }),
        { type: "agent_end", messages: [] },
      ),
    );

    expect(parsed.messages).toContain("Hello from Pi");
    expect(parsed.finalMessage).toBe("Hello from Pi");
  });

  it("parses streaming text deltas", () => {
    const parsed = parsePiJsonl(
      jsonl(textDelta("Hello "), textDelta("World"), assistantTurn("Hello World")),
    );
    expect(parsed.messages).toContain("Hello World");
  });
});

describe("parsePiJsonl: tool execution", () => {
  it("parses a successful tool execution", () => {
    const parsed = parsePiJsonl(
      jsonl(
        toolStart("tool_1", "read", { path: "/tmp/test.txt" }),
        toolEnd("tool_1", "read", "file contents", false),
        turnEnd({
          message: { role: "assistant", content: "Done" },
          toolResults: [{ toolCallId: "tool_1", content: "file contents", isError: false }],
        }),
      ),
    );

    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0].toolName).toBe("read");
    expect(parsed.toolCalls[0].result).toBe("file contents");
    expect(parsed.toolCalls[0].isError).toBe(false);
  });

  it("flags tool execution errors", () => {
    const parsed = parsePiJsonl(
      jsonl(
        toolStart("tool_1", "read", { path: "/missing.txt" }),
        toolEnd("tool_1", "read", "File not found", true),
      ),
    );

    expect(parsed.toolCalls).toHaveLength(1);
    expect(parsed.toolCalls[0].isError).toBe(true);
    expect(parsed.toolCalls[0].result).toBe("File not found");
  });
});

describe("parsePiJsonl: usage accounting", () => {
  it("extracts usage and cost from a turn_end with Pi-shape usage", () => {
    const parsed = parsePiJsonl(
      jsonl(
        turnEnd({
          message: {
            role: "assistant",
            content: "Response with usage",
            usage: {
              input: 100,
              output: 50,
              cacheRead: 20,
              totalTokens: 170,
              cost: {
                input: 0.001,
                output: 0.0015,
                cacheRead: 0.0001,
                cacheWrite: 0,
                total: 0.0026,
              },
            },
          },
          toolResults: [],
        }),
      ),
    );

    expect(parsed.usage.inputTokens).toBe(100);
    expect(parsed.usage.outputTokens).toBe(50);
    expect(parsed.usage.cachedInputTokens).toBe(20);
    expect(parsed.usage.costUsd).toBeCloseTo(0.0026, 4);
  });

  it("accumulates usage across multiple turns", () => {
    const parsed = parsePiJsonl(
      jsonl(
        assistantTurn("First response", {
          message: {
            role: "assistant",
            content: "First response",
            usage: {
              input: 50,
              output: 25,
              cacheRead: 0,
              cost: { total: 0.001 },
            },
          },
        }),
        assistantTurn("Second response", {
          message: {
            role: "assistant",
            content: "Second response",
            usage: {
              input: 30,
              output: 20,
              cacheRead: 10,
              cost: { total: 0.0015 },
            },
          },
        }),
      ),
    );

    expect(parsed.usage.inputTokens).toBe(80);
    expect(parsed.usage.outputTokens).toBe(45);
    expect(parsed.usage.cachedInputTokens).toBe(10);
    expect(parsed.usage.costUsd).toBeCloseTo(0.0025, 4);
  });

  // Standalone `usage` events arrive in two flavours: Pi-native field names
  // (`input`, `output`, `cacheRead`, `cost.total`) and the generic / SDK
  // names (`inputTokens`, `outputTokens`, ...). We test both with one
  // table-driven case to make the parity visible at a glance.
  it.each([
    {
      label: "Pi-native field names",
      usage: {
        input: 200,
        output: 100,
        cacheRead: 50,
        cost: { total: 0.005 },
      },
      expected: { inputTokens: 200, outputTokens: 100, cachedInputTokens: 50, costUsd: 0.005 },
    },
    {
      label: "generic SDK field names",
      usage: {
        inputTokens: 150,
        outputTokens: 75,
        cachedInputTokens: 25,
        costUsd: 0.003,
      },
      expected: { inputTokens: 150, outputTokens: 75, cachedInputTokens: 25, costUsd: 0.003 },
    },
  ])("handles standalone usage events with $label", ({ usage, expected }) => {
    const parsed = parsePiJsonl(jsonl({ type: "usage", usage }));
    expect(parsed.usage).toMatchObject(expected);
  });
});

describe("isPiUnknownSessionError", () => {
  // Each row is `[stdout, stderr, expected]`. Encoded as a table so the
  // logic under test reads as a small classifier rather than a list of
  // hand-rolled assertions.
  const cases: Array<readonly [string, string, boolean]> = [
    ["session not found: s_123", "", true],
    ["", "unknown session id", true],
    ["", "no session available", true],
    ["all good", "", false],
    ["working fine", "no errors", false],
  ];

  it.each(cases)("classify(%j, %j) === %s", (stdout, stderr, expected) => {
    expect(isPiUnknownSessionError(stdout, stderr)).toBe(expected);
  });
});
