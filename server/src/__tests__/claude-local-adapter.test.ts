import { describe, it } from "vitest";
import { isClaudeMaxTurnsResult } from "@gitmesh/adapter-claude-local/server";
import {
  defineAdapterScenarios,
  runAdapterCase,
  type AdapterScenario,
} from "./_helpers/adapter-test-harness.js";

const maxTurnsScenarios: AdapterScenario[] = defineAdapterScenarios([
  {
    kind: "parser",
    name: "detects max-turn exhaustion by subtype",
    run: (input) => isClaudeMaxTurnsResult(input as Record<string, unknown>),
    input: { subtype: "error_max_turns", result: "Reached max turns" },
    expect: true,
  },
  {
    kind: "parser",
    name: "detects max-turn exhaustion by stop_reason",
    run: (input) => isClaudeMaxTurnsResult(input as Record<string, unknown>),
    input: { stop_reason: "max_turns" },
    expect: true,
  },
  {
    kind: "parser",
    name: "returns false for non-max-turn results",
    run: (input) => isClaudeMaxTurnsResult(input as Record<string, unknown>),
    input: { subtype: "success", stop_reason: "end_turn" },
    expect: false,
  },
]);

describe("claude_local max-turn detection", () => {
  it.each(maxTurnsScenarios)("$name", runAdapterCase);
});
