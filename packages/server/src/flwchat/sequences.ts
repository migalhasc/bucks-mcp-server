/**
 * FlwChat sequences domain module.
 * Covers: list sequences, list/add/remove sequence contacts.
 */

import { flwchat, PagedResult } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface SequenceListResponse {
  items?: unknown[];
  sequences?: unknown[];
  data?: unknown[];
  hasMorePages?: boolean;
  totalItems?: number;
  total?: number;
}

interface SequenceContactListResponse {
  items?: unknown[];
  contacts?: unknown[];
  data?: unknown[];
  hasMorePages?: boolean;
  totalItems?: number;
  total?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractSequencePage(raw: unknown, page: number, pageSize: number): PagedResult<unknown> {
  const r = raw as SequenceListResponse;
  const data = r.items ?? r.sequences ?? r.data ?? [];
  const hasMore = r.hasMorePages ?? data.length === pageSize;
  return { data, hasMore, total: r.totalItems ?? r.total, page, pageSize };
}

function extractContactPage(raw: unknown, page: number, pageSize: number): PagedResult<unknown> {
  const r = raw as SequenceContactListResponse;
  const data = r.items ?? r.contacts ?? r.data ?? [];
  const hasMore = r.hasMorePages ?? data.length === pageSize;
  return { data, hasMore, total: r.totalItems ?? r.total, page, pageSize };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const sequences = {
  /** List all sequences (auto-paginated). */
  async listSequences(): Promise<unknown[]> {
    return flwchat.fetchAllPages<unknown>(
      "/chat/v1/sequence",
      {},
      50,
      (raw, pg, ps) => extractSequencePage(raw, pg, ps),
    );
  },

  /** List contacts in a sequence (auto-paginated). */
  async listSequenceContacts(id: string): Promise<unknown[]> {
    return flwchat.fetchAllPages<unknown>(
      `/chat/v2/sequence/${encodeURIComponent(id)}/contact`,
      {},
      50,
      (raw, pg, ps) => extractContactPage(raw, pg, ps),
    );
  },

  /** Add a contact to a sequence. */
  async addContact(sequenceId: string, contactId: string): Promise<unknown> {
    return flwchat.post<unknown>(
      `/chat/v1/sequence/${encodeURIComponent(sequenceId)}/contact`,
      { contactId },
    );
  },

  /** Remove a contact from a sequence. */
  async removeContact(sequenceId: string, contactId: string): Promise<unknown> {
    return flwchat.post<unknown>(
      `/chat/v1/sequence/${encodeURIComponent(sequenceId)}/contact/remove`,
      { contactId },
    );
  },

  /** Batch add contacts to a sequence via filter. */
  async batchAddContacts(sequenceId: string, filter: Record<string, unknown>): Promise<unknown> {
    return flwchat.post<unknown>(
      `/chat/v1/sequence/${encodeURIComponent(sequenceId)}/contact/batch`,
      { filter },
    );
  },

  /** Batch remove contacts from a sequence via filter. */
  async batchRemoveContacts(sequenceId: string, filter: Record<string, unknown>): Promise<unknown> {
    return flwchat.post<unknown>(
      `/chat/v1/sequence/${encodeURIComponent(sequenceId)}/contact/batch-remove`,
      { filter },
    );
  },
};
