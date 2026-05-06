import type { ServerAdapterModule } from "../types.js";
import {
  execute as claudeExecute,
  testEnvironment as claudeTestEnvironment,
} from "@gitmesh/adapter-claude-local/server";

export const minimaxAdapter: ServerAdapterModule = {
  type: "minimax",
  execute: claudeExecute,
  testEnvironment: claudeTestEnvironment,
  models: [],
  supportsLocalAgentJwt: true,
};
