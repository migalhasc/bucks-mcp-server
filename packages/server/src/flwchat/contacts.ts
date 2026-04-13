/**
 * FlwChat contacts domain module.
 * Wraps the central client for contact read operations.
 */

import { flwchat, PagedResult } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface ContactListResponse {
  contacts?: Contact[];
  data?: Contact[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface SearchContactsParams {
  name?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractContacts(raw: unknown): Contact[] {
  const r = raw as ContactListResponse;
  return r.contacts ?? r.data ?? [];
}

function extractPage(
  raw: unknown,
  page: number,
  pageSize: number,
): PagedResult<Contact> {
  const r = raw as ContactListResponse;
  const data = extractContacts(raw);
  const total = r.total;
  return {
    data,
    total,
    page,
    pageSize,
    hasMore: data.length === pageSize,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const contacts = {
  /**
   * Find a single contact by phone number.
   * Returns null if not found (404 is handled by client as FlwChatNotFoundError).
   */
  async findByPhone(phone: string): Promise<Contact> {
    return flwchat.get<Contact>(`/core/v1/contact/phonenumber/${encodeURIComponent(phone)}`);
  },

  /**
   * Search contacts with optional filters.
   * Uses POST /core/v1/contact/filter for filtered search,
   * or GET /core/v1/contact for unfiltered listing.
   * Auto-iterates pages up to the safe limit.
   */
  async search(params: SearchContactsParams): Promise<{ contacts: Contact[]; total?: number }> {
    const pageSize = params.pageSize ?? 50;

    if (params.name || params.tags?.length) {
      // Filtered search via POST /filter
      const body: Record<string, unknown> = {
        page: params.page ?? 1,
        pageSize,
      };
      if (params.name) body["name"] = params.name;
      if (params.tags?.length) body["tags"] = params.tags;

      if (params.page) {
        // Single page requested explicitly
        const raw = await flwchat.post<ContactListResponse>("/core/v1/contact/filter", body);
        const data = extractContacts(raw);
        return { contacts: data, total: (raw as ContactListResponse).total };
      }

      // Auto-iterate pages
      const all = await flwchat.fetchAllPages<Contact>(
        "/core/v1/contact/filter",
        {},
        pageSize,
        (raw, pg, ps) => extractPage(raw, pg, ps),
      );
      return { contacts: all };
    }

    // No filters — use GET list with auto-pagination
    if (params.page) {
      const raw = await flwchat.get<ContactListResponse>("/core/v1/contact", {
        page: params.page,
        pageSize,
      });
      const data = extractContacts(raw);
      return { contacts: data, total: (raw as ContactListResponse).total };
    }

    const all = await flwchat.fetchAllPages<Contact>(
      "/core/v1/contact",
      {},
      pageSize,
      (raw, pg, ps) => extractPage(raw, pg, ps),
    );
    return { contacts: all };
  },
};
