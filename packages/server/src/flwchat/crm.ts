/**
 * FlwChat CRM domain module.
 * Covers: panels (boards), cards, and card notes.
 *
 * API field mappings (internal → API):
 *   stageId       → stepId
 *   agentId       → responsibleUserId
 *   contactId     → contactIds (array)
 *   value         → monetaryAmount
 *   tags          → tagIds
 */

import { flwchat, PagedResult } from "./client.js";
import { DEFAULT_LIST_LIMIT } from "./sessions.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Panel {
  id: string;
  title?: string;
  name?: string;
  description?: string;
  stages?: Stage[];
  steps?: Stage[];
  [key: string]: unknown;
}

export interface Stage {
  id: string;
  name?: string;
  title?: string;
  position?: number;
  [key: string]: unknown;
}

export interface Card {
  id: string;
  title?: string;
  description?: string;
  stageId?: string;
  stage?: Stage;
  panelId?: string;
  contactId?: string;
  contactIds?: string[];
  contacts?: unknown[];
  agentId?: string;
  value?: number;
  tags?: string[];
  tagIds?: string[];
  dueDate?: string;
  customFields?: Record<string, unknown> | null;
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

/**
 * Normalize API card response to internal field names:
 *   stepId           → stageId
 *   responsibleUserId → agentId
 *   monetaryAmount   → value
 *   contactIds[0]    → contactId (keep contactIds too)
 *   tagIds           → tags (keep tagIds too)
 */
function normalizeCard(card: Record<string, unknown>): Card {
  if (card["stepId"] !== undefined && card["stageId"] === undefined) {
    card["stageId"] = card["stepId"];
  }
  if (card["responsibleUserId"] !== undefined && card["agentId"] === undefined) {
    card["agentId"] = card["responsibleUserId"];
  }
  if (card["monetaryAmount"] !== undefined && card["value"] === undefined) {
    card["value"] = card["monetaryAmount"];
  }
  const contactIds = card["contactIds"] as string[] | undefined;
  if (Array.isArray(contactIds) && contactIds.length > 0 && card["contactId"] === undefined) {
    card["contactId"] = contactIds[0];
  }
  const tagIds = card["tagIds"] as string[] | undefined;
  if (Array.isArray(tagIds) && card["tags"] === undefined) {
    card["tags"] = tagIds;
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
  description?: string;
  contactId?: string;
  agentId?: string;
  value?: number;
  tags?: string[];
  dueDate?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateCardParams {
  title?: string;
  description?: string;
  stageId?: string;
  agentId?: string;
  value?: number;
  tags?: string[];
  dueDate?: string;
  customFields?: Record<string, unknown>;
}

export interface AddCardNoteParams {
  cardId: string;
  text: string;
}

export interface DeleteCardNoteParams {
  cardId: string;
  noteId: string;
}

export const crm = {
  /** List all panels (boards). */
  async listPanels(): Promise<Panel[]> {
    const raw = await flwchat.get<unknown>("/crm/v1/panel");
    if (Array.isArray(raw)) return raw as Panel[];
    const r = raw as { panels?: Panel[]; data?: Panel[]; items?: Panel[] };
    return r.items ?? r.panels ?? r.data ?? [];
  },

  /** Get a single panel by ID (includes steps). */
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
    if (params.agentId) query["responsibleUserId"] = params.agentId;

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

  /** List notes for a card (auto-paginated). */
  async listCardNotes(cardId: string): Promise<CardNote[]> {
    return flwchat.fetchAllPages<CardNote>(
      `/crm/v1/panel/card/${encodeURIComponent(cardId)}/note`,
      {},
      50,
      (raw, pg, ps) => {
        let data: CardNote[];
        if (Array.isArray(raw)) data = raw as CardNote[];
        else {
          const r = raw as { notes?: CardNote[]; data?: CardNote[]; items?: CardNote[] };
          data = r.items ?? r.notes ?? r.data ?? [];
        }
        const hasMore = (raw as { hasMorePages?: boolean }).hasMorePages ?? data.length === ps;
        return { data, hasMore, page: pg, pageSize: ps };
      },
    );
  },

  /** Create a new card in a panel. */
  async createCard(params: CreateCardParams): Promise<Card> {
    const { stageId, agentId, contactId, value, tags, customFields, ...rest } = params;
    const body: Record<string, unknown> = { ...rest, stepId: stageId };
    if (agentId !== undefined) body["responsibleUserId"] = agentId;
    if (contactId !== undefined) body["contactIds"] = [contactId];
    if (value !== undefined) body["monetaryAmount"] = value;
    if (tags !== undefined) body["tagIds"] = tags;
    if (customFields !== undefined) body["customFieldValues"] = customFields;
    const raw = await flwchat.post<Record<string, unknown>>("/crm/v1/panel/card", body);
    return normalizeCard(raw);
  },

  /** Update a card (includes moving between stages). */
  async updateCard(id: string, params: UpdateCardParams): Promise<Card> {
    const { stageId, agentId, value, tags, customFields, ...rest } = params;
    const body: Record<string, unknown> = { ...rest };
    if (stageId !== undefined) body["stepId"] = stageId;
    if (agentId !== undefined) body["responsibleUserId"] = agentId;
    if (value !== undefined) body["monetaryAmount"] = value;
    if (tags !== undefined) body["tagIds"] = tags;
    if (customFields !== undefined) body["customFieldValues"] = customFields;
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

  /** Delete a note from a card. */
  async deleteCardNote(params: DeleteCardNoteParams): Promise<void> {
    await flwchat.delete(
      `/crm/v1/panel/card/${encodeURIComponent(params.cardId)}/note/${encodeURIComponent(params.noteId)}`,
    );
  },
};
