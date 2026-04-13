/**
 * Tests for the central FlwChat HTTP client.
 * Uses environment variable injection for config and global fetch mocking.
 */

import { jest, describe, it, expect, beforeEach } from "@jest/globals";

// Mock fetch globally
const mockFetch = jest.fn<typeof fetch>();
(global as typeof globalThis).fetch = mockFetch;

import {
  flwchat,
  FlwChatAuthError,
  FlwChatRateLimitError,
  FlwChatNotFoundError,
  FlwChatError,
} from "../flwchat/client.js";

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): Response {
  const bodyStr = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get: (key: string) => {
        const lc = key.toLowerCase();
        const found = Object.entries(headers).find(
          ([k]) => k.toLowerCase() === lc,
        );
        return found ? found[1] : (lc === "content-type" ? "application/json" : null);
      },
    },
    json: async () => JSON.parse(bodyStr),
    text: async () => bodyStr,
  } as unknown as Response;
}

describe("flwchat.get", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("returns parsed JSON on 200", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, { items: [1, 2, 3] }));
    const result = await flwchat.get<{ items: number[] }>("/core/v2/contact");
    expect(result.items).toEqual([1, 2, 3]);
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("https://api.wts.chat/core/v2/contact");
    expect((init.headers as Record<string, string>)["Authorization"]).toBe(
      "Bearer test-service-token",
    );
  });

  it("appends query params", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await flwchat.get("/core/v2/contact", { page: 1, pageSize: 20, name: "João" });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("page=1");
    expect(url).toContain("pageSize=20");
    expect(url).toContain("name=Jo%C3%A3o");
  });

  it("omits null/undefined query params", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(200, {}));
    await flwchat.get("/core/v2/contact", { page: 1, name: undefined, tag: null });
    const [url] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).not.toContain("name");
    expect(url).not.toContain("tag");
  });

  it("throws FlwChatAuthError on 401", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(401, { error: "unauthorized" }));
    await expect(flwchat.get("/core/v2/contact")).rejects.toBeInstanceOf(FlwChatAuthError);
  });

  it("throws FlwChatNotFoundError on 404", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(404, {}));
    await expect(flwchat.get("/core/v2/contact/abc")).rejects.toBeInstanceOf(FlwChatNotFoundError);
  });

  it("retries on 500 up to MAX_SAFE_RETRIES times", async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(500, {}))
      .mockResolvedValueOnce(makeResponse(500, {}))
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const result = await flwchat.get<{ ok: boolean }>("/path");
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("handles 429 with retry-after header on safe request", async () => {
    mockFetch
      .mockResolvedValueOnce(
        makeResponse(429, {}, { "retry-after": "0" }),
      )
      .mockResolvedValueOnce(makeResponse(200, { ok: true }));
    const result = await flwchat.get<{ ok: boolean }>("/path");
    expect(result.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});

describe("flwchat.post", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("sends POST with body", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(201, { id: "abc" }));
    const result = await flwchat.post<{ id: string }>("/core/v2/contact", {
      name: "Test",
      phone: "+5511999999999",
    });
    expect(result.id).toBe("abc");
    const [, init] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toMatchObject({ name: "Test" });
  });

  it("does NOT retry on 500 for POST", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(500, {}));
    await expect(flwchat.post("/core/v2/contact", {})).rejects.toBeInstanceOf(FlwChatError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("throws FlwChatRateLimitError on 429 for POST", async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(429, {}, { "retry-after": "5" }));
    await expect(flwchat.post("/core/v2/contact", {})).rejects.toBeInstanceOf(
      FlwChatRateLimitError,
    );
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("flwchat.fetchAllPages", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("aggregates pages until hasMore is false", async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(200, { contacts: ["a", "b"], total: 3 }))
      .mockResolvedValueOnce(makeResponse(200, { contacts: ["c"], total: 3 }));

    const results = await flwchat.fetchAllPages<string>(
      "/core/v2/contact",
      {},
      2,
      (raw, page, ps) => {
        const r = raw as { contacts: string[]; total: number };
        return {
          data: r.contacts,
          total: r.total,
          page,
          pageSize: ps,
          hasMore: r.contacts.length === ps,
        };
      },
    );

    expect(results).toEqual(["a", "b", "c"]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("stops at MAX_AUTO_PAGES (5)", async () => {
    mockFetch.mockResolvedValue(makeResponse(200, { items: ["x", "x"], total: 100 }));

    const results = await flwchat.fetchAllPages<string>(
      "/path",
      {},
      2,
      (raw) => {
        const r = raw as { items: string[] };
        return { data: r.items, page: 1, pageSize: 2, hasMore: true };
      },
    );

    expect(results.length).toBe(10); // 5 pages × 2 items
    expect(mockFetch).toHaveBeenCalledTimes(5);
  });
});
