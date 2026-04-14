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
  items?: Card[];
  total?: number;
  totalItems?: number;
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

/** Normalize API card: map stepId → stageId so internal code stays consistent. */
function normalizeCard(card: Record<string, unknown>): Card {
  if (card["stepId"] !== undefined && card["stageId"] === undefined) {
    card["stageId"] = card["stepId"];
  }
  return card as unknown as Card;
}

function extractCards(raw: unknown): Card[] {
  const r = raw as CardListResponse;
  const cards = r.items ?? r.cards ?? r.data ?? [];
  return cards.map((c) => normalizeCard(c as Record<string, unknown>));
}

function extractCardPage(raw: unknown, page: number, pageSize: number): PagedResult<Card> {
  const data = extractCards(raw);
  const r = raw as CardListResponse;
  const total = r.totalItems ?? r.total;
  return { data, total, page, pageSize, hasMore: data.length === pageSize };
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface CreateCardParams {
  panelId: string;
  stageId: string;
  title?: string;
  contactId?: string;
  agentId?: string;
  value?: number;
  tags?: string[];
}

export interface UpdateCardParams {
  title?: string;
  stageId?: string;
  agentId?: string;
  value?: number;
  tags?: string[];
}

export interface AddCardNoteParams {
  cardId: string;
  text: string;
}

export const crm = {
  /** List all panels (boards). */
  async listPanels(): Promise<Panel[]> {
    const raw = await flwchat.get<unknown>("/crm/v1/panel");
    if (Array.isArray(raw)) return raw as Panel[];
    const r = raw as { panels?: Panel[]; data?: Panel[]; items?: Panel[] };
    return r.items ?? r.panels ?? r.data ?? [];
  },

  /** Get a single panel by ID. */
  async getPanelById(id: string): Promise<Panel> {
    return flwchat.get<Panel>(`/crm/v1/panel/${encodeURIComponent(id)}`);
  },

  /** List cards with optional filters. Auto-paginates if no page specified. */
  async listCards(params: ListCardsParams): Promise<{ cards: Card[]; total?: number }> {
    const pageSize = params.pageSize ?? DEFAULT_LIST_LIMIT;
    const query: Record<string, string | number | boolean | undefined | null> = { pageSize };

    if (params.panelId) query["panelId"] = params.panelId;
    if (params.stageId) query["stepId"] = params.stageId;
    if (params.contactId) query["contactId"] = params.contactId;
    if (params.agentId) query["agentId"] = params.agentId;

    if (params.page) {
      query["page"] = params.page;
      const raw = await flwchat.get<CardListResponse>("/crm/v1/panel/card", query);
      return { cards: extractCards(raw), total: (raw as CardListResponse).totalItems ?? (raw as CardListResponse).total };
    }

    const all = await flwchat.fetchAllPages<Card>(
      "/crm/v1/panel/card",
      query,
      pageSize,
      (raw, pg, ps) => extractCardPage(raw, pg, ps),
    );
    return { cards: all };
  },

  /** Get a single card by ID. */
  async getCardById(id: string): Promise<Card> {
    const raw = await flwchat.get<Record<string, unknown>>(`/crm/v1/panel/card/${encodeURIComponent(id)}`);
    return normalizeCard(raw);
  },

  /** List notes for a card. */
  async listCardNotes(cardId: string): Promise<CardNote[]> {
    const raw = await flwchat.get<unknown>(`/crm/v1/panel/card/${encodeURIComponent(cardId)}/note`);
    if (Array.isArray(raw)) return raw as CardNote[];
    const r = raw as { notes?: CardNote[]; data?: CardNote[]; items?: CardNote[] };
    return r.items ?? r.notes ?? r.data ?? [];
  },

  /** Create a new card in a panel. */
  async createCard(params: CreateCardParams): Promise<Card> {
    const { stageId, ...rest } = params;
    const raw = await flwchat.post<Record<string, unknown>>("/crm/v1/panel/card", { ...rest, stepId: stageId });
    return normalizeCard(raw);
  },

  /** Update a card (includes moving between stages). */
  async updateCard(id: string, params: UpdateCardParams): Promise<Card> {
    const { stageId, ...rest } = params;
    const body: Record<string, unknown> = { ...rest };
    if (stageId !== undefined) body["stepId"] = stageId;
    const raw = await flwchat.put<Record<string, unknown>>(`/crm/v2/panel/card/${encodeURIComponent(id)}`, body);
    return normalizeCard(raw);
  },

  /** Add a note to a card. */
  async addCardNote(params: AddCardNoteParams): Promise<CardNote> {
    return flwchat.post<CardNote>(
      `/crm/v1/panel/card/${encodeURIComponent(params.cardId)}/note`,
      { text: params.text },
    );
  },
};
