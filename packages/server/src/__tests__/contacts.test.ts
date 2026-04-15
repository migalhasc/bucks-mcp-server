/**
 * Tests for the contacts domain module.
 * Uses jest.unstable_mockModule for ESM compatibility.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// ── Mocks (must be declared before dynamic imports) ───────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGet = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPost = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetchAllPages = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPostAllPages = jest.fn<any>();

class MockFlwChatNotFoundError extends Error {
  statusCode = 404;
  constructor() { super("Recurso não encontrado."); this.name = "FlwChatNotFoundError"; }
}

jest.unstable_mockModule("../flwchat/client.js", () => ({
  flwchat: {
    get: mockGet,
    post: mockPost,
    fetchAllPages: mockFetchAllPages,
    postAllPages: mockPostAllPages,
  },
  FlwChatNotFoundError: MockFlwChatNotFoundError,
  FlwChatAuthError: class extends Error { constructor() { super("Auth error"); } },
  FlwChatError: class extends Error { constructor(msg: string) { super(msg); } },
}));

// ── Dynamic imports after mocks ───────────────────────────────────────────────

const { contacts } = await import("../flwchat/contacts.js");

// ── contacts.findByPhone ──────────────────────────────────────────────────────

describe("contacts.findByPhone", () => {
  beforeEach(() => { mockGet.mockReset(); });

  it("calls correct endpoint and returns contact", async () => {
    const contact = { id: "abc", name: "João", phone: "+5511999999999" };
    mockGet.mockResolvedValueOnce(contact);

    const result = await contacts.findByPhone("+5511999999999");

    expect(result).toEqual(contact);
    expect(mockGet).toHaveBeenCalledWith(
      "/core/v1/contact/phonenumber/%2B5511999999999",
    );
  });

  it("propagates FlwChatNotFoundError on 404", async () => {
    mockGet.mockRejectedValueOnce(new MockFlwChatNotFoundError());
    await expect(contacts.findByPhone("+5500000000000")).rejects.toBeInstanceOf(MockFlwChatNotFoundError);
  });
});

// ── contacts.search ───────────────────────────────────────────────────────────

describe("contacts.search", () => {
  beforeEach(() => {
    mockGet.mockReset();
    mockPost.mockReset();
    mockFetchAllPages.mockReset();
    mockPostAllPages.mockReset();
  });

  it("uses GET list with auto-pagination when no filters", async () => {
    mockFetchAllPages.mockResolvedValueOnce([{ id: "1", name: "A", phone: "+55" }]);

    const result = await contacts.search({});

    expect(mockFetchAllPages).toHaveBeenCalledWith(
      "/core/v1/contact",
      {},
      50,
      expect.any(Function),
    );
    expect(result.contacts).toHaveLength(1);
  });

  it("uses postAllPages with POST filter path when name provided", async () => {
    mockPostAllPages.mockResolvedValueOnce([{ id: "2", name: "João", phone: "+55" }]);

    const result = await contacts.search({ name: "João" });

    expect(mockPostAllPages).toHaveBeenCalledWith(
      "/core/v1/contact/filter",
      expect.objectContaining({ name: "João" }),
      50,
      expect.any(Function),
    );
    expect(result.contacts).toHaveLength(1);
  });

  it("uses GET with explicit page when page specified (no filters)", async () => {
    mockGet.mockResolvedValueOnce({ contacts: [{ id: "3" }], total: 10 });

    const result = await contacts.search({ page: 2, pageSize: 20 });

    expect(mockGet).toHaveBeenCalledWith("/core/v1/contact", { page: 2, pageSize: 20 });
    expect(result.total).toBe(10);
  });

  it("uses POST filter with explicit page when name + page provided", async () => {
    mockPost.mockResolvedValueOnce({ contacts: [{ id: "4" }], total: 5 });

    const result = await contacts.search({ name: "Maria", page: 1 });

    expect(mockPost).toHaveBeenCalledWith("/core/v1/contact/filter", {
      name: "Maria",
      page: 1,
      pageSize: 50,
    });
    expect(result.total).toBe(5);
  });

  it("respects custom pageSize", async () => {
    mockFetchAllPages.mockResolvedValueOnce([]);
    await contacts.search({ pageSize: 10 });
    expect(mockFetchAllPages).toHaveBeenCalledWith(
      "/core/v1/contact",
      {},
      10,
      expect.any(Function),
    );
  });

  it("handles data field in response (alternate shape)", async () => {
    mockGet.mockResolvedValueOnce({ data: [{ id: "5" }], total: 1 });
    const result = await contacts.search({ page: 1 });
    expect(result.contacts).toHaveLength(1);
  });

  it("uses tags filter in POST body", async () => {
    mockPost.mockResolvedValueOnce({ contacts: [], total: 0 });
    await contacts.search({ tags: ["lead"], page: 1 });
    expect(mockPost).toHaveBeenCalledWith("/core/v1/contact/filter", {
      tags: ["lead"],
      page: 1,
      pageSize: 50,
    });
  });
});

// ── Pagination extractor ──────────────────────────────────────────────────────

describe("contacts.search pagination extractor", () => {
  beforeEach(() => { mockFetchAllPages.mockReset(); });

  it("hasMore is true when returned count equals pageSize", async () => {
    type ExtractFn = (raw: unknown, page: number, ps: number) => { hasMore: boolean; data: unknown[] };
    mockFetchAllPages.mockImplementationOnce(async (...args: unknown[]) => {
      const ps = args[2] as number;
      const extract = args[3] as ExtractFn;
      const raw = { contacts: [{ id: "a" }, { id: "b" }] };
      const paged = extract(raw, 1, ps);
      expect(paged.hasMore).toBe(true);
      return paged.data;
    });
    await contacts.search({ pageSize: 2 });
  });

  it("hasMore is false when returned count less than pageSize", async () => {
    type ExtractFn = (raw: unknown, page: number, ps: number) => { hasMore: boolean; data: unknown[] };
    mockFetchAllPages.mockImplementationOnce(async (...args: unknown[]) => {
      const ps = args[2] as number;
      const extract = args[3] as ExtractFn;
      const raw = { contacts: [{ id: "a" }] };
      const paged = extract(raw, 1, ps);
      expect(paged.hasMore).toBe(false);
      return paged.data;
    });
    await contacts.search({ pageSize: 2 });
  });
});
