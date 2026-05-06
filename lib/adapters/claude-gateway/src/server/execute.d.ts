import type { AdapterExecutionContext, AdapterExecutionResult } from "@gitmesh/adapter-sdk";
export declare function runClaudeGatewayLogin(input: {
    runId: string;
    agent: AdapterExecutionContext["agent"];
    config: Record<string, unknown>;
    context?: Record<string, unknown>;
    authToken?: string;
    onLog?: (stream: "stdout" | "stderr", chunk: string) => Promise<void>;
}): Promise<AdapterExecutionResult>;
export declare function execute(input: AdapterExecutionContext): Promise<AdapterExecutionResult>;
//# sourceMappingURL=execute.d.ts.map