import { describe, expect, it } from "vitest";
import {
  buildJoinDefaultsPayloadForAccept,
  canReplayGatewayInviteAccept,
  mergeJoinDefaultsPayloadForReplay,
} from "../api/access.js";

describe("canReplayGatewayInviteAccept", () => {
  it("allows replay only for gateway agent joins in pending or approved state", () => {
    expect(
      canReplayGatewayInviteAccept({
        requestType: "agent",
        adapterType: "gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "gateway",
          status: "pending_approval",
        },
      }),
    ).toBe(true);

    expect(
      canReplayGatewayInviteAccept({
        requestType: "agent",
        adapterType: "gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "gateway",
          status: "approved",
        },
      }),
    ).toBe(true);

    expect(
      canReplayGatewayInviteAccept({
        requestType: "agent",
        adapterType: "gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "gateway",
          status: "rejected",
        },
      }),
    ).toBe(false);

    expect(
      canReplayGatewayInviteAccept({
        requestType: "human",
        adapterType: "gateway",
        existingJoinRequest: {
          requestType: "agent",
          adapterType: "gateway",
          status: "pending_approval",
        },
      }),
    ).toBe(false);
  });
});

describe("mergeJoinDefaultsPayloadForReplay", () => {
  it("merges replay payloads and allows gateway token override", () => {
    const merged = mergeJoinDefaultsPayloadForReplay(
      {
        url: "ws://old.example:18789",
        gitmeshAgentsApiUrl: "http://host.docker.internal:3100",
        headers: {
          "x-gateway-token": "old-token-1234567890",
          "x-custom": "keep-me",
        },
      },
      {
        gitmeshAgentsApiUrl: "https://gitmesh-agents.example.com",
        headers: {
          "x-gateway-token": "new-token-1234567890",
        },
      },
    );

    const normalized = buildJoinDefaultsPayloadForAccept({
      adapterType: "gateway",
      defaultsPayload: merged,
      inboundGatewayAuthHeader: null,
    }) as Record<string, unknown>;

    expect(normalized.url).toBe("ws://old.example:18789");
    expect(normalized.gitmeshAgentsApiUrl).toBe("https://gitmesh-agents.example.com");
    expect(normalized.headers).toMatchObject({
      "x-gateway-token": "new-token-1234567890",
      "x-custom": "keep-me",
    });
  });
});
