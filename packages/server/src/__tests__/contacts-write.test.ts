/**
 * Tests for contact write operations in the FlwChat domain module.
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

const { contacts } = await import("../flwchat/contacts.js");

// ── contacts.create ───────────────────────────────────────────────────────────

describe("contacts.create", () => {
  beforeEach(() => { mockPost.mockReset(); });

  it("calls POST /core/v1/contact with full params", async () => {
    const created = { id: "x1", name: "Ana", phone: "+5511999999999" };
    mockPost.mockResolvedValueOnce(created);

    const result = await contacts.create({ name: "Ana", phone: "+5511999999999", email: "ana@test.com", tags: ["lead"] });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/contact", {
      name: "Ana",
      phone: "+5511999999999",
      email: "ana@test.com",
      tags: ["lead"],
    });
    expect(result).toEqual(created);
  });

  it("calls POST /core/v1/contact with minimal params", async () => {
    mockPost.mockResolvedValueOnce({ id: "x2", name: "Bob", phone: "+5521999999999" });

    await contacts.create({ name: "Bob", phone: "+5521999999999" });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/contact", {
      name: "Bob",
      phone: "+5521999999999",
    });
  });

  it("propagates errors from client", async () => {
    mockPost.mockRejectedValueOnce(new Error("Falha na rede"));
    await expect(contacts.create({ name: "X", phone: "+55" })).rejects.toThrow("Falha na rede");
  });
});

// ── contacts.update ───────────────────────────────────────────────────────────

describe("contacts.update", () => {
  beforeEach(() => { mockPut.mockReset(); });

  it("calls PUT /core/v2/contact/{id} with encoded ID", async () => {
    const updated = { id: "abc", name: "João Atualizado", phone: "+55" };
    mockPut.mockResolvedValueOnce(updated);

    const result = await contacts.update("abc", { name: "João Atualizado" });

    expect(mockPut).toHaveBeenCalledWith("/core/v2/contact/abc", { name: "João Atualizado" });
    expect(result).toEqual(updated);
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockPut.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(contacts.update("missing", { name: "X" })).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});

// ── contacts.updateTags ───────────────────────────────────────────────────────

describe("contacts.updateTags", () => {
  beforeEach(() => { mockPost.mockReset(); });

  it("calls POST /core/v1/contact/{id}/tags with tags body", async () => {
    const updated = { id: "abc", tags: ["lead", "vip"] };
    mockPost.mockResolvedValueOnce(updated);

    const result = await contacts.updateTags("abc", ["lead", "vip"]);

    expect(mockPost).toHaveBeenCalledWith("/core/v1/contact/abc/tags", { tags: ["lead", "vip"] });
    expect(result).toEqual(updated);
  });

  it("propagates FlwChatNotFoundError", async () => {
    mockPost.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(contacts.updateTags("gone", ["x"])).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});
