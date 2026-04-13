/**
 * Tests for outbound send via sessions domain module.
 * Policy-level tests are in outbound-policy.test.ts.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── Mocks ────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPost = jest.fn<any>();

jest.unstable_mockModule("../flwchat/client.js", () => ({
  flwchat: {
    get: jest.fn(),
    post: mockPost,
    put: jest.fn(),
    fetchAllPages: jest.fn(),
  },
  FlwChatNotFoundError: class extends Error {
    statusCode = 404;
    constructor() { super("Não encontrado."); this.name = "FlwChatNotFoundError"; }
  },
  FlwChatAuthError: class extends Error { constructor() { super("Auth"); } },
  FlwChatError: class extends Error { constructor(msg: string) { super(msg); } },
}));

const { sessions } = await import("../flwchat/sessions.js");

// ── sessions.sendOutbound ────────────────────────────────────────────────────

describe("sessions.sendOutbound", () => {
  beforeEach(() => { mockPost.mockReset(); });

  it("calls POST /chat/v1/message/send with correct body", async () => {
    const response = { id: "msg-1", status: "queued" };
    mockPost.mockResolvedValueOnce(response);

    const result = await sessions.sendOutbound({
      phone: "+5511999999999",
      channel: "whatsapp-ch",
      text: "Olá, tudo bem?",
    });

    expect(mockPost).toHaveBeenCalledWith("/chat/v1/message/send", {
      phone: "+5511999999999",
      channel: "whatsapp-ch",
      text: "Olá, tudo bem?",
    });
    expect(result).toEqual(response);
  });

  it("propagates errors from client", async () => {
    mockPost.mockRejectedValueOnce(new Error("Canal inválido"));
    await expect(
      sessions.sendOutbound({ phone: "+5511999999999", channel: "ch", text: "Oi" }),
    ).rejects.toThrow("Canal inválido");
  });

  it("returns the full response object from the API", async () => {
    const apiResponse = { id: "msg-99", status: "queued", queuedAt: "2026-04-13T10:00:00Z" };
    mockPost.mockResolvedValueOnce(apiResponse);

    const result = await sessions.sendOutbound({
      phone: "+447911123456",
      channel: "wa-uk",
      text: "Hello",
    });

    expect(result).toMatchObject({ id: "msg-99", status: "queued" });
  });
});
