/**
 * Tests for the sessions domain module.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGet = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetchAllPages = jest.fn<any>();

class MockFlwChatNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("Recurso não encontrado."); this.name = "FlwChatNotFoundError"; }
}

jest.unstable_mockModule("../flwchat/client.js", () => ({
  flwchat: {
    get: mockGet,
    post: jest.fn(),
    put: jest.fn(),
    fetchAllPages: mockFetchAllPages,
  },
  FlwChatNotFoundError: MockFlwChatNotFoundError,
  FlwChatAuthError: class extends Error { constructor() { super("Auth"); } },
  FlwChatError: class extends Error { constructor(msg: string) { super(msg); } },
}));

const { sessions, DEFAULT_RECENCY_HOURS, DEFAULT_RECENT_LIMIT, DEFAULT_LIST_LIMIT } =
  await import("../flwchat/sessions.js");

// ── sessions.list ─────────────────────────────────────────────────────────────

describe("sessions.list", () => {
  beforeEach(() => { mockGet.mockReset(); mockFetchAllPages.mockReset(); });

  it("uses fetchAllPages for list without explicit page", async () => {
    mockFetchAllPages.mockResolvedValueOnce([{ id: "s1" }, { id: "s2" }]);

    const result = await sessions.list({});

    expect(mockFetchAllPages).toHaveBeenCalledWith(
      "/core/v2/session",
      expect.objectContaining({ pageSize: DEFAULT_LIST_LIMIT }),
      DEFAULT_LIST_LIMIT,
      expect.any(Function),
    );
    expect(result.sessions).toHaveLength(2);
  });

  it("uses GET with explicit page", async () => {
    mockGet.mockResolvedValueOnce({ sessions: [{ id: "s3" }], total: 10 });

    const result = await sessions.list({ page: 2, pageSize: 10 });

    expect(mockGet).toHaveBeenCalledWith(
      "/core/v2/session",
      expect.objectContaining({ page: 2, pageSize: 10 }),
    );
    expect(result.total).toBe(10);
  });

  it("applies contactId filter", async () => {
    mockFetchAllPages.mockResolvedValueOnce([]);
    await sessions.list({ contactId: "c1" });
    expect(mockFetchAllPages).toHaveBeenCalledWith(
      "/core/v2/session",
      expect.objectContaining({ contactId: "c1" }),
      expect.any(Number),
      expect.any(Function),
    );
  });
});

// ── sessions.listRecent ───────────────────────────────────────────────────────

describe("sessions.listRecent", () => {
  beforeEach(() => { mockGet.mockReset(); });

  it("applies updatedAfter from hours window and limit", async () => {
    mockGet.mockResolvedValueOnce({ sessions: [], total: 0 });

    await sessions.listRecent({ hours: 12, limit: 5 });

    expect(mockGet).toHaveBeenCalledWith(
      "/core/v2/session",
      expect.objectContaining({ pageSize: 5, page: 1 }),
    );
    const callArgs = mockGet.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs["updatedAfter"]).toBeDefined();
    const updatedAfter = new Date(callArgs["updatedAfter"] as string);
    const expected = new Date(Date.now() - 12 * 60 * 60 * 1000);
    // Allow 5s tolerance
    expect(Math.abs(updatedAfter.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it("uses defaults when no params given", async () => {
    mockGet.mockResolvedValueOnce({ sessions: [], total: 0 });

    await sessions.listRecent();

    const callArgs = mockGet.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs["pageSize"]).toBe(DEFAULT_RECENT_LIMIT);
  });
});

// ── sessions.getById ──────────────────────────────────────────────────────────

describe("sessions.getById", () => {
  beforeEach(() => { mockGet.mockReset(); });

  it("calls correct endpoint", async () => {
    const session = { id: "abc", status: "open" };
    mockGet.mockResolvedValueOnce(session);

    const result = await sessions.getById("abc");

    expect(mockGet).toHaveBeenCalledWith("/core/v2/session/abc");
    expect(result).toEqual(session);
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockGet.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(sessions.getById("missing")).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});

// ── sessions.listMessages ─────────────────────────────────────────────────────

describe("sessions.listMessages", () => {
  beforeEach(() => { mockGet.mockReset(); });

  it("applies default 24h window when no after/page given", async () => {
    mockGet.mockResolvedValueOnce({ messages: [], total: 0 });

    await sessions.listMessages({ sessionId: "s1" });

    const callArgs = mockGet.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs["after"]).toBeDefined();
    const after = new Date(callArgs["after"] as string);
    const expected = new Date(Date.now() - DEFAULT_RECENCY_HOURS * 60 * 60 * 1000);
    expect(Math.abs(after.getTime() - expected.getTime())).toBeLessThan(5000);
  });

  it("uses explicit after when provided", async () => {
    mockGet.mockResolvedValueOnce({ messages: [{ id: "m1" }], total: 1 });
    const after = "2026-01-01T00:00:00.000Z";

    const result = await sessions.listMessages({ sessionId: "s1", after });

    expect(mockGet).toHaveBeenCalledWith(
      "/core/v1/session/s1/message",
      expect.objectContaining({ after }),
    );
    expect(result.messages).toHaveLength(1);
  });

  it("uses explicit page when provided (no auto-window)", async () => {
    mockGet.mockResolvedValueOnce({ messages: [], total: 0 });

    await sessions.listMessages({ sessionId: "s1", page: 2 });

    const callArgs = mockGet.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs["page"]).toBe(2);
    // When page is explicit, no auto-after should be added
    expect(callArgs["after"]).toBeUndefined();
  });

  it("respects custom limit", async () => {
    mockGet.mockResolvedValueOnce({ data: [], total: 0 });

    await sessions.listMessages({ sessionId: "s1", limit: 5 });

    const callArgs = mockGet.mock.calls[0][1] as Record<string, unknown>;
    expect(callArgs["pageSize"]).toBe(5);
  });
});
