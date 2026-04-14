/**
 * FlwChat sessions domain module.
 * Covers: list sessions, get session, list messages, outbound send.
 *
 * Correct API paths (verified against api.wts.chat):
 *   List/Get sessions : /chat/v2/session
 *   Session ops       : /chat/v1/session/:id/{message,note,assignee,transfer,status,complete}
 */

import { flwchat, PagedResult } from "./client.js";

// ── Constants ─────────────────────────────────────────────────────────────────

export const DEFAULT_RECENCY_HOURS = 24;
export const DEFAULT_RECENT_LIMIT = 20;
export const DEFAULT_LIST_LIMIT = 50;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Session {
  id: string;
  status?: string;
  contactId?: string;
  contact?: unknown;
  agentId?: string;
  agent?: unknown;
  channelId?: string;
  channel?: unknown;
  createdAt?: string;
  updatedAt?: string;
  closedAt?: string;
  [key: string]: unknown;
}

export interface Message {
  id: string;
  sessionId?: string;
  content?: string;
  text?: string;
  type?: string;
  direction?: string;
  createdAt?: string;
  [key: string]: unknown;
}

// /chat/v2/session response uses { items, totalItems, hasMorePages, ... }
interface SessionListResponse {
  items?: Session[];
  totalItems?: number;
  hasMorePages?: boolean;
  pageNumber?: number;
  pageSize?: number;
  // legacy fallbacks
  sessions?: Session[];
  data?: Session[];
  total?: number;
}

interface MessageListResponse {
  items?: Message[];
  messages?: Message[];
  data?: Message[];
  total?: number;
  totalItems?: number;
}

export interface ListSessionsParams {
  contactId?: string;
  status?: string;
  agentId?: string;
  updatedAfter?: string;
  page?: number;
  pageSize?: number;
}

export interface ListMessagesParams {
  sessionId: string;
  after?: string;
  limit?: number;
  page?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractSessions(raw: unknown): Session[] {
  const r = raw as SessionListResponse;
  return r.items ?? r.sessions ?? r.data ?? [];
}

function extractMessages(raw: unknown): Message[] {
  const r = raw as MessageListResponse;
  return r.items ?? r.messages ?? r.data ?? [];
}

function extractSessionPage(raw: unknown, page: number, pageSize: number): PagedResult<Session> {
  const data = extractSessions(raw);
  const r = raw as SessionListResponse;
  const total = r.totalItems ?? r.total;
  const hasMore = r.hasMorePages ?? data.length === pageSize;
  return { data, total, page, pageSize, hasMore };
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ── Param types ───────────────────────────────────────────────────────────────

export interface ReplySessionParams    { sessionId: string; text: string }
export interface AssignSessionParams   { sessionId: string; agentId: string }
export interface TransferSessionParams { sessionId: string; agentId?: string; departmentId?: string }
export interface SetSessionStatusParams { sessionId: string; status: string }
export interface AddSessionNoteParams  { sessionId: string; text: string }
export interface SendMessageResponse   { id?: string; messageId?: string; status?: string; [key: string]: unknown }
export interface SendOutboundParams    { phone: string; channel: string; text: string }
export interface OutboundSendResponse  { id?: string; messageId?: string; status?: string; [key: string]: unknown }

// ── Public API ────────────────────────────────────────────────────────────────

export const sessions = {
  async list(params: ListSessionsParams): Promise<{ sessions: Session[]; total?: number }> {
    const pageSize = params.pageSize ?? DEFAULT_LIST_LIMIT;
    const query: Record<string, string | number | boolean | undefined | null> = { pageSize };

    if (params.contactId)  query["contactId"]  = params.contactId;
    if (params.status)     query["status"]     = params.status;
    if (params.agentId)    query["agentId"]    = params.agentId;
    if (params.updatedAfter) query["updatedAfter"] = params.updatedAfter;

    if (params.page) {
      query["page"] = params.page;
      const raw = await flwchat.get<SessionListResponse>("/chat/v2/session", query);
      const r = raw as SessionListResponse;
      return { sessions: extractSessions(raw), total: r.totalItems ?? r.total };
    }

    const all = await flwchat.fetchAllPages<Session>(
      "/chat/v2/session",
      query,
      pageSize,
      (raw, pg, ps) => extractSessionPage(raw, pg, ps),
    );
    return { sessions: all };
  },

  async listRecent(params: {
    hours?: number; contactId?: string; status?: string; agentId?: string; limit?: number;
  } = {}): Promise<Session[]> {
    const hours = params.hours ?? DEFAULT_RECENCY_HOURS;
    const limit = params.limit ?? DEFAULT_RECENT_LIMIT;
    const result = await sessions.list({
      updatedAfter: isoHoursAgo(hours),
      contactId: params.contactId,
      status: params.status,
      agentId: params.agentId,
      pageSize: limit,
      page: 1,
    });
    return result.sessions.slice(0, limit);
  },

  async getById(id: string): Promise<Session> {
    return flwchat.get<Session>(`/chat/v2/session/${encodeURIComponent(id)}`);
  },

  async assign(params: AssignSessionParams): Promise<Session> {
    return flwchat.put<Session>(
      `/chat/v1/session/${encodeURIComponent(params.sessionId)}/assignee`,
      { agentId: params.agentId },
    );
  },

  async transfer(params: TransferSessionParams): Promise<Session> {
    const body: Record<string, string> = {};
    if (params.agentId)     body["agentId"]     = params.agentId;
    if (params.departmentId) body["departmentId"] = params.departmentId;
    return flwchat.put<Session>(
      `/chat/v1/session/${encodeURIComponent(params.sessionId)}/transfer`,
      body,
    );
  },

  async setStatus(params: SetSessionStatusParams): Promise<Session> {
    return flwchat.put<Session>(
      `/chat/v1/session/${encodeURIComponent(params.sessionId)}/status`,
      { status: params.status },
    );
  },

  async complete(sessionId: string): Promise<Session> {
    return flwchat.put<Session>(
      `/chat/v1/session/${encodeURIComponent(sessionId)}/complete`,
      {},
    );
  },

  async addNote(params: AddSessionNoteParams): Promise<unknown> {
    return flwchat.post(
      `/chat/v1/session/${encodeURIComponent(params.sessionId)}/note`,
      { text: params.text },
    );
  },

  async reply(params: ReplySessionParams): Promise<SendMessageResponse> {
    return flwchat.post<SendMessageResponse>(
      `/chat/v1/session/${encodeURIComponent(params.sessionId)}/message`,
      { text: params.text },
    );
  },

  async sendOutbound(params: SendOutboundParams): Promise<OutboundSendResponse> {
    return flwchat.post<OutboundSendResponse>("/chat/v1/message/send", {
      phone: params.phone,
      channel: params.channel,
      text: params.text,
    });
  },

  async listMessages(params: ListMessagesParams): Promise<{ messages: Message[]; total?: number }> {
    const limit = params.limit ?? DEFAULT_RECENT_LIMIT;
    const query: Record<string, string | number | boolean | undefined | null> = { pageSize: limit };

    if (!params.after && !params.page) query["after"] = isoHoursAgo(DEFAULT_RECENCY_HOURS);
    if (params.after) query["after"] = params.after;
    if (params.page)  query["page"]  = params.page;

    const raw = await flwchat.get<MessageListResponse>(
      `/chat/v1/session/${encodeURIComponent(params.sessionId)}/message`,
      query,
    );
    const r = raw as MessageListResponse;
    return { messages: extractMessages(raw), total: r.totalItems ?? r.total };
  },
};
