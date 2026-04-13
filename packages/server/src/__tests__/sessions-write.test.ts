/**
 * Tests for session write operations in the FlwChat domain module.
 * Covers: assign, transfer, setStatus, complete, addNote, reply.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPost = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPut = jest.fn<any>();

class MockFlwChatNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("Recurso não encontrado."); this.name = "FlwChatNotFoundError"; }
}

jest.unstable_mockModule("../flwchat/client.js", () => ({
  flwchat: {
    get: jest.fn(),
    post: mockPost,
    put: mockPut,
    fetchAllPages: jest.fn(),
  },
  FlwChatNotFoundError: MockFlwChatNotFoundError,
  FlwChatAuthError: class extends Error { constructor() { super("Auth"); } },
  FlwChatError: class extends Error { constructor(msg: string) { super(msg); } },
}));

const { sessions } = await import("../flwchat/sessions.js");

// ── sessions.assign ───────────────────────────────────────────────────────────

describe("sessions.assign", () => {
  beforeEach(() => { mockPut.mockReset(); });

  it("calls PUT /core/v1/session/{id}/assignee with agentId", async () => {
    const session = { id: "s1", agentId: "ag1" };
    mockPut.mockResolvedValueOnce(session);

    const result = await sessions.assign({ sessionId: "s1", agentId: "ag1" });

    expect(mockPut).toHaveBeenCalledWith("/core/v1/session/s1/assignee", { agentId: "ag1" });
    expect(result).toEqual(session);
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockPut.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(sessions.assign({ sessionId: "bad", agentId: "ag1" })).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});

// ── sessions.transfer ─────────────────────────────────────────────────────────

describe("sessions.transfer", () => {
  beforeEach(() => { mockPut.mockReset(); });

  it("calls PUT /core/v1/session/{id}/transfer with agentId", async () => {
    mockPut.mockResolvedValueOnce({ id: "s1" });

    await sessions.transfer({ sessionId: "s1", agentId: "ag2" });

    expect(mockPut).toHaveBeenCalledWith("/core/v1/session/s1/transfer", { agentId: "ag2" });
  });

  it("calls PUT with departmentId only", async () => {
    mockPut.mockResolvedValueOnce({ id: "s1" });

    await sessions.transfer({ sessionId: "s1", departmentId: "dept1" });

    expect(mockPut).toHaveBeenCalledWith("/core/v1/session/s1/transfer", { departmentId: "dept1" });
  });

  it("calls PUT with both agentId and departmentId", async () => {
    mockPut.mockResolvedValueOnce({ id: "s1" });

    await sessions.transfer({ sessionId: "s1", agentId: "ag2", departmentId: "dept1" });

    expect(mockPut).toHaveBeenCalledWith("/core/v1/session/s1/transfer", {
      agentId: "ag2",
      departmentId: "dept1",
    });
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockPut.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(sessions.transfer({ sessionId: "bad", agentId: "ag1" })).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});

// ── sessions.setStatus ────────────────────────────────────────────────────────

describe("sessions.setStatus", () => {
  beforeEach(() => { mockPut.mockReset(); });

  it("calls PUT /core/v1/session/{id}/status with status", async () => {
    mockPut.mockResolvedValueOnce({ id: "s1", status: "pending" });

    await sessions.setStatus({ sessionId: "s1", status: "pending" });

    expect(mockPut).toHaveBeenCalledWith("/core/v1/session/s1/status", { status: "pending" });
  });
});

// ── sessions.complete ─────────────────────────────────────────────────────────

describe("sessions.complete", () => {
  beforeEach(() => { mockPut.mockReset(); });

  it("calls PUT /core/v1/session/{id}/complete with empty body", async () => {
    mockPut.mockResolvedValueOnce({ id: "s1", status: "closed" });

    await sessions.complete("s1");

    expect(mockPut).toHaveBeenCalledWith("/core/v1/session/s1/complete", {});
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockPut.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(sessions.complete("bad")).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});

// ── sessions.addNote ──────────────────────────────────────────────────────────

describe("sessions.addNote", () => {
  beforeEach(() => { mockPost.mockReset(); });

  it("calls POST /core/v1/session/{id}/note with text", async () => {
    const note = { id: "n1", text: "Cliente ligou." };
    mockPost.mockResolvedValueOnce(note);

    const result = await sessions.addNote({ sessionId: "s1", text: "Cliente ligou." });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/session/s1/note", { text: "Cliente ligou." });
    expect(result).toEqual(note);
  });
});

// ── sessions.reply ────────────────────────────────────────────────────────────

describe("sessions.reply", () => {
  beforeEach(() => { mockPost.mockReset(); });

  it("calls POST /core/v1/session/{id}/message with text", async () => {
    const response = { id: "msg1", status: "sent" };
    mockPost.mockResolvedValueOnce(response);

    const result = await sessions.reply({ sessionId: "s1", text: "Olá, como posso ajudar?" });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/session/s1/message", { text: "Olá, como posso ajudar?" });
    expect(result).toEqual(response);
  });

  it("propagates errors from client", async () => {
    mockPost.mockRejectedValueOnce(new Error("Sessão encerrada"));
    await expect(sessions.reply({ sessionId: "s1", text: "Oi" })).rejects.toThrow("Sessão encerrada");
  });
});
