/**
 * FlwChat portfolios domain module.
 * Covers: list portfolios, list/add/remove portfolio contacts.
 */

import { flwchat, PagedResult } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PortfolioListResponse {
  items?: unknown[];
  portfolios?: unknown[];
  data?: unknown[];
  hasMorePages?: boolean;
  totalItems?: number;
  total?: number;
}

interface PortfolioContactListResponse {
  items?: unknown[];
  contacts?: unknown[];
  data?: unknown[];
  hasMorePages?: boolean;
  totalItems?: number;
  total?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractPortfolioPage(raw: unknown, page: number, pageSize: number): PagedResult<unknown> {
  const r = raw as PortfolioListResponse;
  const data = r.items ?? r.portfolios ?? r.data ?? [];
  const hasMore = r.hasMorePages ?? data.length === pageSize;
  return { data, hasMore, total: r.totalItems ?? r.total, page, pageSize };
}

function extractContactPage(raw: unknown, page: number, pageSize: number): PagedResult<unknown> {
  const r = raw as PortfolioContactListResponse;
  const data = r.items ?? r.contacts ?? r.data ?? [];
  const hasMore = r.hasMorePages ?? data.length === pageSize;
  return { data, hasMore, total: r.totalItems ?? r.total, page, pageSize };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const portfolios = {
  /** List all portfolios (auto-paginated). */
  async listPortfolios(): Promise<unknown[]> {
    return flwchat.fetchAllPages<unknown>(
      "/core/v1/portfolio",
      {},
      50,
      (raw, pg, ps) => extractPortfolioPage(raw, pg, ps),
    );
  },

  /** List contacts in a portfolio (auto-paginated). */
  async listPortfolioContacts(id: string): Promise<unknown[]> {
    return flwchat.fetchAllPages<unknown>(
      `/core/v1/portfolio/${encodeURIComponent(id)}/contact`,
      {},
      50,
      (raw, pg, ps) => extractContactPage(raw, pg, ps),
    );
  },

  /** Add a contact to a portfolio. */
  async addContact(portfolioId: string, contactId: string): Promise<unknown> {
    return flwchat.post<unknown>(
      `/core/v1/portfolio/${encodeURIComponent(portfolioId)}/contact`,
      { contactId },
    );
  },

  /** Remove a contact from a portfolio. */
  async removeContact(portfolioId: string, contactId: string): Promise<unknown> {
    return flwchat.delete<unknown>(
      `/core/v1/portfolio/${encodeURIComponent(portfolioId)}/contact/${encodeURIComponent(contactId)}`,
    );
  },
};
