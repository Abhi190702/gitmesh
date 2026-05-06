import type { CLIAdapterModule } from "@gitmesh/adapter-sdk";
import { printClaudeStreamEvent } from "@gitmesh/adapter-claude-local/cli";
import { printCodexStreamEvent } from "@gitmesh/adapter-codex-local/cli";
import { printCursorStreamEvent } from "@gitmesh/adapter-cursor-local/cli";
import { printOpenCodeStreamEvent } from "@gitmesh/adapter-opencode-local/cli";
import { printPiStreamEvent } from "@gitmesh/adapter-pi-local/cli";
import { printGatewayStreamEvent } from "@gitmesh/adapter-gateway/cli";
import { processCLIAdapter } from "./process/index.js";
import { httpCLIAdapter } from "./http/index.js";

const claudeLocalCLIAdapter: CLIAdapterModule = {
  type: "claude_local",
  formatStdoutEvent: printClaudeStreamEvent,
};

const codexLocalCLIAdapter: CLIAdapterModule = {
  type: "codex_local",
  formatStdoutEvent: printCodexStreamEvent,
};

const openCodeLocalCLIAdapter: CLIAdapterModule = {
  type: "opencode_local",
  formatStdoutEvent: printOpenCodeStreamEvent,
};

const piLocalCLIAdapter: CLIAdapterModule = {
  type: "pi_local",
  formatStdoutEvent: printPiStreamEvent,
};

const cursorLocalCLIAdapter: CLIAdapterModule = {
  type: "cursor",
  formatStdoutEvent: printCursorStreamEvent,
};

const gatewayCLIAdapter: CLIAdapterModule = {
  type: "gateway",
  formatStdoutEvent: printGatewayStreamEvent,
};

const adaptersByType = new Map<string, CLIAdapterModule>(
  [
    claudeLocalCLIAdapter,
    codexLocalCLIAdapter,
    openCodeLocalCLIAdapter,
    piLocalCLIAdapter,
    cursorLocalCLIAdapter,
    gatewayCLIAdapter,
    processCLIAdapter,
    httpCLIAdapter,
  ].map((a) => [a.type, a]),
);

export function getCLIAdapter(type: string): CLIAdapterModule {
  return adaptersByType.get(type) ?? processCLIAdapter;
}
