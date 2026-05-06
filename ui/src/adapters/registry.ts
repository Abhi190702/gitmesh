import type { UIAdapterModule } from "./types";
import { claudeLocalUIAdapter } from "./claude-local";
import { codexLocalUIAdapter } from "./codex-local";
import { cursorLocalUIAdapter } from "./cursor";
import { openCodeLocalUIAdapter } from "./opencode-local";
import { piLocalUIAdapter } from "./pi-local";
import { gatewayUIAdapter } from "./gateway";
import { processUIAdapter } from "./process";
import { httpUIAdapter } from "./http";
import { minimaxUIAdapter } from "./minimax";

const adaptersByType = new Map<string, UIAdapterModule>(
  [
    claudeLocalUIAdapter,
    codexLocalUIAdapter,
    openCodeLocalUIAdapter,
    piLocalUIAdapter,
    cursorLocalUIAdapter,
    gatewayUIAdapter,
    processUIAdapter,
    httpUIAdapter,
    minimaxUIAdapter,
  ].map((a) => [a.type, a]),
);

export function getUIAdapter(type: string): UIAdapterModule {
  return adaptersByType.get(type) ?? processUIAdapter;
}
