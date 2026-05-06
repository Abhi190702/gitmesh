import type { CLIAdapterModule } from "@gitmesh/adapter-sdk";
import { printHttpStdoutEvent } from "./format-event.js";

export const httpCLIAdapter: CLIAdapterModule = {
  type: "http",
  formatStdoutEvent: printHttpStdoutEvent,
};
