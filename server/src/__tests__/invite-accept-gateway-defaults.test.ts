import { describe, expect, it } from "vitest";
import {
  buildJoinDefaultsPayloadForAccept,
  normalizeAgentDefaultsForJoin,
} from "../api/access.js";

describe("buildJoinDefaultsPayloadForAccept (gateway)", () => {
  it("leaves non-gateway payloads unchanged", () => {
    const defaultsPayload = { command: "echo hello" };
    const result = buildJoinDefaultsPayloadForAccept({
      adapterType: "process",
      defaultsPayload,
      inboundGatewayAuthHeader: "ignored-token",
    });

    expect(result).toEqual(defaultsPayload);
  });

  it("normalizes wrapped x-gateway-token header", () => {
    const result = buildJoinDefaultsPayloadForAccept({
      adapterType: "gateway",
      defaultsPayload: {
        url: "ws://127.0.0.1:18789",
        headers: {
          "x-gateway-token": {
            value: "gateway-token-1234567890",
          },
        },
      },
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      url: "ws://127.0.0.1:18789",
      headers: {
        "x-gateway-token": "gateway-token-1234567890",
      },
    });
  });

  it("accepts inbound x-gateway-token for gateway joins", () => {
    const result = buildJoinDefaultsPayloadForAccept({
      adapterType: "gateway",
      defaultsPayload: {
        url: "ws://127.0.0.1:18789",
      },
      inboundGatewayTokenHeader: "gateway-token-1234567890",
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      headers: {
        "x-gateway-token": "gateway-token-1234567890",
      },
    });
  });

  it("derives x-gateway-token from authorization header", () => {
    const result = buildJoinDefaultsPayloadForAccept({
      adapterType: "gateway",
      defaultsPayload: {
        url: "ws://127.0.0.1:18789",
        headers: {
          authorization: "Bearer gateway-token-1234567890",
        },
      },
    }) as Record<string, unknown>;

    expect(result).toMatchObject({
      headers: {
        authorization: "Bearer gateway-token-1234567890",
        "x-gateway-token": "gateway-token-1234567890",
      },
    });
  });
});

describe("normalizeAgentDefaultsForJoin (gateway)", () => {
  it("generates persistent device key when device auth is enabled", () => {
    const normalized = normalizeAgentDefaultsForJoin({
      adapterType: "gateway",
      defaultsPayload: {
        url: "ws://127.0.0.1:18789",
        headers: {
          "x-gateway-token": "gateway-token-1234567890",
        },
        disableDeviceAuth: false,
      },
      deploymentMode: "authenticated",
      deploymentExposure: "private",
      bindHost: "127.0.0.1",
      allowedHostnames: [],
    });

    expect(normalized.fatalErrors).toEqual([]);
    expect(normalized.normalized?.disableDeviceAuth).toBe(false);
    expect(typeof normalized.normalized?.devicePrivateKeyPem).toBe("string");
    expect((normalized.normalized?.devicePrivateKeyPem as string).length).toBeGreaterThan(64);
  });

  it("does not generate device key when disableDeviceAuth=true", () => {
    const normalized = normalizeAgentDefaultsForJoin({
      adapterType: "gateway",
      defaultsPayload: {
        url: "ws://127.0.0.1:18789",
        headers: {
          "x-gateway-token": "gateway-token-1234567890",
        },
        disableDeviceAuth: true,
      },
      deploymentMode: "authenticated",
      deploymentExposure: "private",
      bindHost: "127.0.0.1",
      allowedHostnames: [],
    });

    expect(normalized.fatalErrors).toEqual([]);
    expect(normalized.normalized?.disableDeviceAuth).toBe(true);
    expect(normalized.normalized?.devicePrivateKeyPem).toBeUndefined();
  });
});
