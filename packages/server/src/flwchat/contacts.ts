/**
 * FlwChat contacts domain module.
 * Wraps the central client for contact read and write operations.
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

export interface CreateContactParams {
  name: string;
  phone: string;
  email?: string;
  tags?: string[];
}

export interface UpdateContactParams {
  name?: string;
  phone?: string;
  email?: string;
  tags?: string[];
}

export interface UpdateTagsParams {
  tags: string[];
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

      // Auto-iterate pages via POST (filter endpoint requires POST)
      const filterBody: Record<string, unknown> = {};
      if (params.name) filterBody["name"] = params.name;
      if (params.tags?.length) filterBody["tags"] = params.tags;
      const all = await flwchat.postAllPages<Contact>(
        "/core/v1/contact/filter",
        filterBody,
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

  /** Create a new contact. */
  async create(params: CreateContactParams): Promise<Contact> {
    return flwchat.post<Contact>("/core/v1/contact", params);
  },

  /** Update a contact by ID. Sensitive if phone is being changed. */
  async update(id: string, params: UpdateContactParams): Promise<Contact> {
    return flwchat.put<Contact>(`/core/v2/contact/${encodeURIComponent(id)}`, params);
  },

  /** Update tags for a contact by ID. Replaces existing tags. */
  async updateTags(id: string, tags: string[]): Promise<Contact> {
    return flwchat.post<Contact>(`/core/v1/contact/${encodeURIComponent(id)}/tags`, { tags });
  },
};
