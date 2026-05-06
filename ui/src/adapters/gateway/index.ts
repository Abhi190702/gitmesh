import type { UIAdapterModule } from "../types";
import { parseGatewayStdoutLine } from "@gitmesh/adapter-gateway/ui";
import { buildGatewayConfig } from "@gitmesh/adapter-gateway/ui";
import { GatewayConfigFields } from "./config-fields";

export const gatewayUIAdapter: UIAdapterModule = {
  type: "gateway",
  label: "Gateway",
  parseStdoutLine: parseGatewayStdoutLine,
  ConfigFields: GatewayConfigFields,
  buildAdapterConfig: buildGatewayConfig,
};
