/**
 * FlwChat sessions domain module.
 * Covers: list sessions, get session, list messages for a session.
 */

import { flwchat, PagedResult } from "./client.js";

// ── Constants ─────────────────────────────────────────────────────────────────

/** Default recency window in hours for "recent" queries (PRD: 24h). */
export const DEFAULT_RECENCY_HOURS = 24;
/** Default limit for recent queries (PRD: 20). */
export const DEFAULT_RECENT_LIMIT = 20;
/** Default limit for general listings (PRD: 50). */
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

export interface SessionListResponse {
  sessions?: Session[];
  data?: Session[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface MessageListResponse {
  messages?: Message[];
  data?: Message[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ListSessionsParams {
  contactId?: string;
  status?: string;
  agentId?: string;
  /** ISO date string — only sessions updated after this time */
  updatedAfter?: string;
  page?: number;
  pageSize?: number;
}

export interface ListMessagesParams {
  sessionId: string;
  /** ISO date string — only messages after this time */
  after?: string;
  limit?: number;
  page?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractSessions(raw: unknown): Session[] {
  const r = raw as SessionListResponse;
  return r.sessions ?? r.data ?? [];
}

function extractMessages(raw: unknown): Message[] {
  const r = raw as MessageListResponse;
  return r.messages ?? r.data ?? [];
}

function extractSessionPage(
  raw: unknown,
  page: number,
  pageSize: number,
): PagedResult<Session> {
  const data = extractSessions(raw);
  const total = (raw as SessionListResponse).total;
  return { data, total, page, pageSize, hasMore: data.length === pageSize };
}

function isoHoursAgo(hours: number): string {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface ReplySessionParams {
  sessionId: string;
  text: string;
}

export interface SendMessageResponse {
  id?: string;
  messageId?: string;
  status?: string;
  [key: string]: unknown;
}

export const sessions = {
  /**
   * List sessions with optional filters.
   * When `updatedAfter` is omitted and no page is given, auto-iterates pages.
   */
  async list(params: ListSessionsParams): Promise<{ sessions: Session[]; total?: number }> {
    const pageSize = params.pageSize ?? DEFAULT_LIST_LIMIT;
    const query: Record<string, string | number | boolean | undefined | null> = { pageSize };

    if (params.contactId) query["contactId"] = params.contactId;
    if (params.status) query["status"] = params.status;
    if (params.agentId) query["agentId"] = params.agentId;
    if (params.updatedAfter) query["updatedAfter"] = params.updatedAfter;

    if (params.page) {
      query["page"] = params.page;
      const raw = await flwchat.get<SessionListResponse>("/core/v2/session", query);
      return { sessions: extractSessions(raw), total: (raw as SessionListResponse).total };
    }

    const all = await flwchat.fetchAllPages<Session>(
      "/core/v2/session",
      query,
      pageSize,
      (raw, pg, ps) => extractSessionPage(raw, pg, ps),
    );
    return { sessions: all };
  },

  /**
   * List sessions updated in the last N hours (default 24h).
   * Returns up to DEFAULT_RECENT_LIMIT items.
   */
  async listRecent(params: {
    hours?: number;
    contactId?: string;
    status?: string;
    agentId?: string;
    limit?: number;
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

  /** Get a single session by ID. */
  async getById(id: string): Promise<Session> {
    return flwchat.get<Session>(`/core/v2/session/${encodeURIComponent(id)}`);
  },

  /**
   * Send a reply (text message) to an existing session.
   * This is a write operation — not retried on failure.
   */
  async reply(params: ReplySessionParams): Promise<SendMessageResponse> {
    return flwchat.post<SendMessageResponse>(
      `/core/v1/session/${encodeURIComponent(params.sessionId)}/message`,
      { text: params.text },
    );
  },

  /**
   * List messages for a session, newest first by default.
   * Applies recency window when `after` is omitted and no page given.
   */
  async listMessages(params: ListMessagesParams): Promise<{ messages: Message[]; total?: number }> {
    const limit = params.limit ?? DEFAULT_RECENT_LIMIT;
    const query: Record<string, string | number | boolean | undefined | null> = {
      pageSize: limit,
    };

    // Default: last 24h if no time filter provided and no explicit page
    if (!params.after && !params.page) {
      query["after"] = isoHoursAgo(DEFAULT_RECENCY_HOURS);
    }
    if (params.after) query["after"] = params.after;
    if (params.page) query["page"] = params.page;

    const raw = await flwchat.get<MessageListResponse>(
      `/core/v1/session/${encodeURIComponent(params.sessionId)}/message`,
      query,
    );
    return {
      messages: extractMessages(raw),
      total: (raw as MessageListResponse).total,
    };
  },
};
