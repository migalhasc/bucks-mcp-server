/**
 * FlwChat CRM domain module.
 * Covers: panels (boards), cards, and card notes.
 */

import { flwchat, PagedResult } from "./client.js";
import { DEFAULT_LIST_LIMIT } from "./sessions.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Panel {
  id: string;
  name?: string;
  description?: string;
  stages?: Stage[];
  [key: string]: unknown;
}

export interface Stage {
  id: string;
  name?: string;
  position?: number;
  [key: string]: unknown;
}

export interface Card {
  id: string;
  title?: string;
  name?: string;
  stageId?: string;
  stage?: Stage;
  panelId?: string;
  contactId?: string;
  contact?: unknown;
  agentId?: string;
  agent?: unknown;
  value?: number;
  tags?: string[];
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

export interface CardNote {
  id: string;
  cardId?: string;
  text?: string;
  agentId?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface CardListResponse {
  cards?: Card[];
  data?: Card[];
  total?: number;
  page?: number;
  pageSize?: number;
}

export interface ListCardsParams {
  panelId?: string;
  stageId?: string;
  contactId?: string;
  agentId?: string;
  page?: number;
  pageSize?: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractCards(raw: unknown): Card[] {
  const r = raw as CardListResponse;
  return r.cards ?? r.data ?? [];
}

function extractCardPage(raw: unknown, page: number, pageSize: number): PagedResult<Card> {
  const data = extractCards(raw);
  const total = (raw as CardListResponse).total;
  return { data, total, page, pageSize, hasMore: data.length === pageSize };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const crm = {
  /** List all panels (boards). */
  async listPanels(): Promise<Panel[]> {
    const raw = await flwchat.get<unknown>("/core/v1/panel");
    if (Array.isArray(raw)) return raw as Panel[];
    const r = raw as { panels?: Panel[]; data?: Panel[] };
    return r.panels ?? r.data ?? [];
  },

  /** Get a single panel by ID. */
  async getPanelById(id: string): Promise<Panel> {
    return flwchat.get<Panel>(`/core/v1/panel/${encodeURIComponent(id)}`);
  },

  /** List cards with optional filters. Auto-paginates if no page specified. */
  async listCards(params: ListCardsParams): Promise<{ cards: Card[]; total?: number }> {
    const pageSize = params.pageSize ?? DEFAULT_LIST_LIMIT;
    const query: Record<string, string | number | boolean | undefined | null> = { pageSize };

    if (params.panelId) query["panelId"] = params.panelId;
    if (params.stageId) query["stageId"] = params.stageId;
    if (params.contactId) query["contactId"] = params.contactId;
    if (params.agentId) query["agentId"] = params.agentId;

    if (params.page) {
      query["page"] = params.page;
      const raw = await flwchat.get<CardListResponse>("/core/v1/panel/card", query);
      return { cards: extractCards(raw), total: (raw as CardListResponse).total };
    }

    const all = await flwchat.fetchAllPages<Card>(
      "/core/v1/panel/card",
      query,
      pageSize,
      (raw, pg, ps) => extractCardPage(raw, pg, ps),
    );
    return { cards: all };
  },

  /** Get a single card by ID. */
  async getCardById(id: string): Promise<Card> {
    return flwchat.get<Card>(`/core/v1/panel/card/${encodeURIComponent(id)}`);
  },

  /** List notes for a card. */
  async listCardNotes(cardId: string): Promise<CardNote[]> {
    const raw = await flwchat.get<unknown>(`/core/v1/panel/card/${encodeURIComponent(cardId)}/note`);
    if (Array.isArray(raw)) return raw as CardNote[];
    const r = raw as { notes?: CardNote[]; data?: CardNote[] };
    return r.notes ?? r.data ?? [];
  },
};
