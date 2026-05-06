import type { UIAdapterModule } from "../types";
import { parseClaudeStdoutLine } from "@gitmesh/adapter-claude-local/ui";
import { MinimaxConfigFields, MinimaxAdvancedFields } from "./config-fields";
import { buildMinimaxConfig } from "./build-config";

export const minimaxUIAdapter: UIAdapterModule = {
  type: "minimax",
  label: "MiniMax",
  parseStdoutLine: parseClaudeStdoutLine,
  ConfigFields: MinimaxConfigFields,
  buildAdapterConfig: buildMinimaxConfig as (values: Parameters<UIAdapterModule["buildAdapterConfig"]>[0]) => Record<string, unknown>,
};
