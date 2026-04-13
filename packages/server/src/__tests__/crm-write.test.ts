/**
 * Tests for CRM write operations in the FlwChat domain module.
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

const { crm } = await import("../flwchat/crm.js");

// ── crm.createCard ────────────────────────────────────────────────────────────

describe("crm.createCard", () => {
  beforeEach(() => { mockPost.mockReset(); });

  it("calls POST /crm/v1/card with full params", async () => {
    const card = { id: "c1", title: "Lead X", stageId: "s1" };
    mockPost.mockResolvedValueOnce(card);

    const result = await crm.createCard({
      panelId: "p1",
      stageId: "s1",
      title: "Lead X",
      contactId: "ct1",
      agentId: "ag1",
      value: 1500,
      tags: ["hot"],
    });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/panel/card", {
      panelId: "p1",
      stageId: "s1",
      title: "Lead X",
      contactId: "ct1",
      agentId: "ag1",
      value: 1500,
      tags: ["hot"],
    });
    expect(result).toEqual(card);
  });

  it("calls POST /crm/v1/card with minimal params", async () => {
    mockPost.mockResolvedValueOnce({ id: "c2" });

    await crm.createCard({ panelId: "p1", stageId: "s1" });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/panel/card", { panelId: "p1", stageId: "s1" });
  });

  it("propagates errors from client", async () => {
    mockPost.mockRejectedValueOnce(new Error("Painel não encontrado"));
    await expect(crm.createCard({ panelId: "bad", stageId: "s1" })).rejects.toThrow("Painel não encontrado");
  });
});

// ── crm.updateCard (move) ─────────────────────────────────────────────────────

describe("crm.updateCard", () => {
  beforeEach(() => { mockPut.mockReset(); });

  it("calls PUT /crm/v1/card/{id} with stageId", async () => {
    const updated = { id: "c1", stageId: "s-final" };
    mockPut.mockResolvedValueOnce(updated);

    const result = await crm.updateCard("c1", { stageId: "s-final" });

    expect(mockPut).toHaveBeenCalledWith("/core/v2/panel/card/c1", { stageId: "s-final" });
    expect(result).toEqual(updated);
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockPut.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(crm.updateCard("missing", { stageId: "s1" })).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});

// ── crm.addCardNote ───────────────────────────────────────────────────────────

describe("crm.addCardNote", () => {
  beforeEach(() => { mockPost.mockReset(); });

  it("calls POST /crm/v1/card/{cardId}/note with text", async () => {
    const note = { id: "n1", text: "Follow up agendado." };
    mockPost.mockResolvedValueOnce(note);

    const result = await crm.addCardNote({ cardId: "c1", text: "Follow up agendado." });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/panel/card/c1/note", { text: "Follow up agendado." });
    expect(result).toEqual(note);
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockPost.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(crm.addCardNote({ cardId: "bad", text: "nota" })).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});
