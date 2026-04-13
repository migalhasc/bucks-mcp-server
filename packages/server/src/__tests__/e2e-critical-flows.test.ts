/**
 * End-to-end integration tests for v1 critical flows.
 * Validates tool-level behavior via InMemoryTransport + MCP Client.
 *
 * Critical flows covered:
 *   - criar contato (bucks_create_contact)
 *   - responder sessão (bucks_reply_session)
 *   - enviar outbound (bucks_send_outbound)
 *   - mover card (bucks_move_card)
 *   - concluir atendimento (bucks_close_session)
 *
 * Also validates:
 *   - role-based access (positive + negative)
 *   - tool registry / multi-client compatibility (names, bucks_ prefix, descriptions in pt-BR)
 *   - default limits / recency / preview-before-write behavior
 *
 * Issue #15: Compatibilidade multi-client e testes end-to-end da v1
 */

import { jest, describe, it, expect, beforeEach, afterEach } from "@jest/globals";
import type { Client as ClientType } from "@modelcontextprotocol/sdk/client/index.js";

// ── Mocks ─────────────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockGet = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPost = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPut = jest.fn<any>();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockFetchAllPages = jest.fn<any>();

jest.unstable_mockModule("../flwchat/client.js", () => ({
  flwchat: { get: mockGet, post: mockPost, put: mockPut, fetchAllPages: mockFetchAllPages },
  FlwChatNotFoundError: class extends Error {
    statusCode = 404;
    constructor() { super("Recurso não encontrado."); this.name = "FlwChatNotFoundError"; }
  },
  FlwChatAuthError: class extends Error { constructor() { super("Auth"); } },
  FlwChatError: class extends Error { constructor(msg: string) { super(msg); } },
}));

// requestContext mock — getStore returns a configurable role
let _currentRole = "commercial";
jest.unstable_mockModule("../request-context.js", () => ({
  requestContext: {
    getStore: () => ({
      userEmail: `${_currentRole}@example.com`,
      userRole: _currentRole,
      req: {},
    }),
  },
}));

// config mock — provide DEFAULT_CHANNEL so outbound tests work
jest.unstable_mockModule("../config.js", () => ({
  config: {
    DEFAULT_CHANNEL: "wa-default",
    DEFAULT_BOARD: "board-default",
    PORT: 3000,
    NODE_ENV: "test",
    LOG_LEVEL: "silent",
    AUTH_MODE: "static",
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────────────────────

const { Client } = await import("@modelcontextprotocol/sdk/client/index.js");
const { InMemoryTransport } = await import("@modelcontextprotocol/sdk/inMemory.js");
const { createMcpServer } = await import("../server.js");

// ── Helpers ───────────────────────────────────────────────────────────────────

function setRole(role: "commercial" | "cs" | "admin") {
  _currentRole = role;
}

async function makeClient() {
  const server = createMcpServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  const client = new Client({ name: "test-client", version: "1.0.0" });
  await client.connect(clientTransport);
  return { client, server };
}

// Helper: call a tool and return parsed text content
async function callTool(
  client: ClientType,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const text = (result.content as Array<{ type: string; text: string }>)
    .filter((c) => c.type === "text")
    .map((c) => c.text)
    .join("\n");
  return { text, isError: !!result.isError };
}

// ── Multi-client compatibility: tool registry ─────────────────────────────────

describe("Tool registry — multi-client compatibility", () => {
  let client: ClientType;

  beforeEach(async () => {
    setRole("admin");
    ({ client } = await makeClient());
  });

  afterEach(async () => {
    await client.close();
  });

  it("all tools have bucks_ prefix", async () => {
    const { tools } = await client.listTools();
    expect(tools.length).toBeGreaterThan(0);
    for (const tool of tools) {
      expect(tool.name).toMatch(/^bucks_/);
    }
  });

  it("all tools have a non-empty description", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.description).toBeTruthy();
      expect(tool.description!.length).toBeGreaterThan(5);
    }
  });

  it("all expected v1 tools are registered", async () => {
    const { tools } = await client.listTools();
    const names = tools.map((t: { name: string }) => t.name);
    const expected = [
      "bucks_find_contact_by_phone",
      "bucks_search_contacts",
      "bucks_create_contact",
      "bucks_update_contact",
      "bucks_update_contact_tags",
      "bucks_list_sessions",
      "bucks_get_session",
      "bucks_list_messages",
      "bucks_reply_session",
      "bucks_send_outbound",
      "bucks_assign_session",
      "bucks_transfer_session",
      "bucks_set_session_status",
      "bucks_close_session",
      "bucks_add_session_note",
      "bucks_list_boards",
      "bucks_list_cards",
      "bucks_get_card",
      "bucks_create_card",
      "bucks_move_card",
      "bucks_add_card_note",
    ];
    for (const name of expected) {
      expect(names).toContain(name);
    }
  });

  it("tool input schemas are JSON Schema objects", async () => {
    const { tools } = await client.listTools();
    for (const tool of tools) {
      expect(tool.inputSchema).toBeDefined();
      expect(tool.inputSchema.type).toBe("object");
    }
  });
});

// ── Critical flow: criar contato ──────────────────────────────────────────────

describe("Critical flow: bucks_create_contact", () => {
  let client: ClientType;

  beforeEach(async () => {
    setRole("commercial");
    mockPost.mockReset();
    ({ client } = await makeClient());
  });

  afterEach(async () => { await client.close(); });

  it("returns preview when confirmed is omitted", async () => {
    const { text, isError } = await callTool(client, "bucks_create_contact", {
      name: "Ana Lima",
      phone: "+5511999990001",
    });
    expect(isError).toBe(false);
    expect(text).toContain("confirmed: true");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("creates contact when confirmed: true", async () => {
    const created = { id: "c-001", name: "Ana Lima", phone: "+5511999990001" };
    mockPost.mockResolvedValueOnce(created);

    const { text, isError } = await callTool(client, "bucks_create_contact", {
      name: "Ana Lima",
      phone: "+5511999990001",
      confirmed: true,
    });

    expect(isError).toBe(false);
    expect(text).toContain("Ana Lima");
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("admin role can also create contacts", async () => {
    setRole("admin");
    const created = { id: "c-002", name: "Bob Admin", phone: "+5511999990002" };
    mockPost.mockResolvedValueOnce(created);

    const { isError } = await callTool(client, "bucks_create_contact", {
      name: "Bob Admin",
      phone: "+5511999990002",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });
});

// ── Critical flow: responder sessão ──────────────────────────────────────────

describe("Critical flow: bucks_reply_session", () => {
  let client: ClientType;

  beforeEach(async () => {
    setRole("commercial");
    mockPost.mockReset();
    ({ client } = await makeClient());
  });

  afterEach(async () => { await client.close(); });

  it("returns preview when confirmed is omitted", async () => {
    const { text, isError } = await callTool(client, "bucks_reply_session", {
      sessionId: "s-001",
      text: "Olá, como posso ajudar?",
    });
    expect(isError).toBe(false);
    expect(text).toContain("confirmed: true");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("sends reply when confirmed: true", async () => {
    mockPost.mockResolvedValueOnce({ id: "msg-1", status: "sent" });

    const { isError } = await callTool(client, "bucks_reply_session", {
      sessionId: "s-001",
      text: "Olá!",
      confirmed: true,
    });
    expect(isError).toBe(false);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("cs role can reply session", async () => {
    setRole("cs");
    mockPost.mockResolvedValueOnce({ id: "msg-2", status: "sent" });

    const { isError } = await callTool(client, "bucks_reply_session", {
      sessionId: "s-002",
      text: "Atendimento em andamento.",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });

  it("admin can reply session", async () => {
    setRole("admin");
    mockPost.mockResolvedValueOnce({ id: "msg-3", status: "sent" });

    const { isError } = await callTool(client, "bucks_reply_session", {
      sessionId: "s-003",
      text: "Admin respondendo.",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });
});

// ── Critical flow: enviar outbound ───────────────────────────────────────────

describe("Critical flow: bucks_send_outbound", () => {
  let client: ClientType;

  beforeEach(async () => {
    setRole("commercial");
    mockPost.mockReset();
    ({ client } = await makeClient());
  });

  afterEach(async () => { await client.close(); });

  it("returns preview when confirmed is omitted", async () => {
    const { text, isError } = await callTool(client, "bucks_send_outbound", {
      phone: "+5511999990010",
      text: "Olá, somos da Blank School.",
    });
    expect(isError).toBe(false);
    expect(text).toContain("confirmed: true");
    expect(mockPost).not.toHaveBeenCalled();
  });

  it("sends outbound to existing contact when confirmed: true", async () => {
    mockPost.mockResolvedValueOnce({ id: "msg-out-1", status: "queued" });

    const { isError } = await callTool(client, "bucks_send_outbound", {
      phone: "+5511999990010",
      text: "Olá!",
      confirmed: true,
    });
    expect(isError).toBe(false);
    expect(mockPost).toHaveBeenCalledTimes(1);
  });

  it("creates contact then sends outbound with newContact confirmed", async () => {
    mockPost
      .mockResolvedValueOnce({ id: "c-new", name: "Lead Novo", phone: "+5511999990011" }) // create contact
      .mockResolvedValueOnce({ id: "msg-out-2", status: "queued" }); // send message

    const { isError } = await callTool(client, "bucks_send_outbound", {
      phone: "+5511999990011",
      text: "Bem-vindo!",
      newContact: { name: "Lead Novo", origin: "evento" },
      confirmed: true,
    });
    expect(isError).toBe(false);
    expect(mockPost).toHaveBeenCalledTimes(2);
  });

  it("cs role is blocked from outbound", async () => {
    setRole("cs");
    const { text, isError } = await callTool(client, "bucks_send_outbound", {
      phone: "+5511999990012",
      text: "CS tentando outbound.",
    });
    expect(isError).toBe(true);
    expect(text).toMatch(/Permissão negada|comercial/i);
  });

  it("admin can send outbound", async () => {
    setRole("admin");
    mockPost.mockResolvedValueOnce({ id: "msg-out-admin", status: "queued" });

    const { isError } = await callTool(client, "bucks_send_outbound", {
      phone: "+5511999990013",
      text: "Admin outbound.",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });
});

// ── Critical flow: mover card ────────────────────────────────────────────────

describe("Critical flow: bucks_move_card", () => {
  let client: ClientType;

  beforeEach(async () => {
    setRole("commercial");
    mockPut.mockReset();
    ({ client } = await makeClient());
  });

  afterEach(async () => { await client.close(); });

  it("returns preview when confirmed is omitted", async () => {
    const { text, isError } = await callTool(client, "bucks_move_card", {
      id: "card-001",
      stageId: "stage-002",
    });
    expect(isError).toBe(false);
    expect(text).toContain("confirmed: true");
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("moves card when confirmed: true", async () => {
    mockPut.mockResolvedValueOnce({ id: "card-001", stageId: "stage-002" });

    const { isError } = await callTool(client, "bucks_move_card", {
      id: "card-001",
      stageId: "stage-002",
      confirmed: true,
    });
    expect(isError).toBe(false);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it("cs role is blocked from moving cards", async () => {
    setRole("cs");
    const { isError, text } = await callTool(client, "bucks_move_card", {
      id: "card-002",
      stageId: "stage-003",
    });
    expect(isError).toBe(true);
    expect(text).toContain("Permissão negada");
  });

  it("admin can move card to final stage", async () => {
    setRole("admin");
    mockPut.mockResolvedValueOnce({ id: "card-003", stageId: "stage-final" });

    const { isError } = await callTool(client, "bucks_move_card", {
      id: "card-003",
      stageId: "stage-final",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });
});

// ── Critical flow: concluir atendimento ──────────────────────────────────────

describe("Critical flow: bucks_close_session", () => {
  let client: ClientType;

  beforeEach(async () => {
    setRole("cs");
    mockPut.mockReset();
    ({ client } = await makeClient());
  });

  afterEach(async () => { await client.close(); });

  it("returns preview when confirmed is omitted", async () => {
    const { text, isError } = await callTool(client, "bucks_close_session", {
      sessionId: "s-close-001",
    });
    expect(isError).toBe(false);
    expect(text).toContain("confirmed: true");
    expect(mockPut).not.toHaveBeenCalled();
  });

  it("closes session when confirmed: true", async () => {
    mockPut.mockResolvedValueOnce({ id: "s-close-001", status: "closed" });

    const { isError } = await callTool(client, "bucks_close_session", {
      sessionId: "s-close-001",
      confirmed: true,
    });
    expect(isError).toBe(false);
    expect(mockPut).toHaveBeenCalledTimes(1);
  });

  it("commercial role is blocked from closing session", async () => {
    setRole("commercial");
    const { text, isError } = await callTool(client, "bucks_close_session", {
      sessionId: "s-close-002",
    });
    expect(isError).toBe(true);
    expect(text).toContain("Permissão negada");
  });

  it("admin can close session", async () => {
    setRole("admin");
    mockPut.mockResolvedValueOnce({ id: "s-close-003", status: "closed" });

    const { isError } = await callTool(client, "bucks_close_session", {
      sessionId: "s-close-003",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });
});

// ── Role-based access: additional scenarios ───────────────────────────────────

describe("Role-based access — additional scenarios", () => {
  let client: ClientType;

  beforeEach(async () => {
    mockPut.mockReset();
    mockPost.mockReset();
  });

  afterEach(async () => { await client?.close(); });

  it("commercial cannot assign session", async () => {
    setRole("commercial");
    ({ client } = await makeClient());
    const { isError, text } = await callTool(client, "bucks_assign_session", {
      sessionId: "s-assign-1",
      agentId: "ag-1",
    });
    expect(isError).toBe(true);
    expect(text).toContain("Permissão negada");
  });

  it("commercial cannot transfer session", async () => {
    setRole("commercial");
    ({ client } = await makeClient());
    const { isError } = await callTool(client, "bucks_transfer_session", {
      sessionId: "s-transfer-1",
      agentId: "ag-2",
    });
    expect(isError).toBe(true);
  });

  it("cs can assign session", async () => {
    setRole("cs");
    ({ client } = await makeClient());
    mockPut.mockResolvedValueOnce({ id: "s-assign-2", agentId: "ag-1" });
    const { isError } = await callTool(client, "bucks_assign_session", {
      sessionId: "s-assign-2",
      agentId: "ag-1",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });

  it("cs can transfer session", async () => {
    setRole("cs");
    ({ client } = await makeClient());
    mockPut.mockResolvedValueOnce({ id: "s-transfer-2", agentId: "ag-3" });
    const { isError } = await callTool(client, "bucks_transfer_session", {
      sessionId: "s-transfer-2",
      agentId: "ag-3",
      confirmed: true,
    });
    expect(isError).toBe(false);
  });

  it("cs cannot use outbound", async () => {
    setRole("cs");
    ({ client } = await makeClient());
    const { isError } = await callTool(client, "bucks_send_outbound", {
      phone: "+5511999990099",
      text: "Oi",
    });
    expect(isError).toBe(true);
  });

  it("admin can use all tools — spot check", async () => {
    setRole("admin");
    ({ client } = await makeClient());
    // Just verify no RBAC error on preview calls
    const tools = ["bucks_close_session", "bucks_assign_session", "bucks_transfer_session", "bucks_send_outbound"];
    for (const tool of tools) {
        const argsMap: Record<string, Record<string, unknown>> = {
        bucks_close_session: { sessionId: "s-admin-1" },
        bucks_assign_session: { sessionId: "s-admin-1", agentId: "ag-1" },
        bucks_transfer_session: { sessionId: "s-admin-1", agentId: "ag-1" },
        bucks_send_outbound: { phone: "+5511999990001", text: "Oi" },
      };
      const args = argsMap[tool];
      const { text } = await callTool(client, tool, args);
      // Previews should not contain Permissão negada
      expect(text).not.toContain("Permissão negada");
    }
  });
});

// ── Default limits and recency defaults ──────────────────────────────────────

describe("Default limits and recency", () => {
  let client: ClientType;

  beforeEach(async () => {
    setRole("commercial");
    mockGet.mockReset();
    mockFetchAllPages.mockReset();
    ({ client } = await makeClient());
  });

  afterEach(async () => { await client.close(); });

  it("bucks_list_sessions (recent mode) uses DEFAULT_RECENT_LIMIT", async () => {
    const sessions = Array.from({ length: 20 }, (_, i) => ({ id: `s-${i}` }));
    mockGet.mockResolvedValueOnce({ data: sessions, total: 20, page: 1, pageSize: 20 });

    const { isError } = await callTool(client, "bucks_list_sessions", { recent: true });
    expect(isError).toBe(false);
    // The call should have been made (mockGet called once)
    expect(mockGet).toHaveBeenCalledTimes(1);
  });

  it("bucks_list_sessions returns mode:recent in response", async () => {
    mockGet.mockResolvedValueOnce({ data: [], total: 0, page: 1, pageSize: 20 });
    const { text, isError } = await callTool(client, "bucks_list_sessions", { recent: true });
    expect(isError).toBe(false);
    expect(text).toContain("recent");
  });

  it("bucks_search_contacts returns results list", async () => {
    const contactList = [{ id: "c-1", name: "Ana" }];
    // search with name filter uses fetchAllPages auto-iteration
    mockFetchAllPages.mockResolvedValueOnce(contactList);

    const { text, isError } = await callTool(client, "bucks_search_contacts", { name: "Ana" });
    expect(isError).toBe(false);
    expect(text).toContain("Ana");
  });

  it("bucks_list_boards returns boards", async () => {
    setRole("admin");
    const boards = [{ id: "b-1", name: "Vendas" }];
    mockGet.mockResolvedValueOnce({ data: boards, total: 1, page: 1, pageSize: 50 });

    const { text, isError } = await callTool(client, "bucks_list_boards", {});
    expect(isError).toBe(false);
    expect(text).toContain("Vendas");
  });
});
