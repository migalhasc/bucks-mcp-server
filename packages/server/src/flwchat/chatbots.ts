/**
 * FlwChat Chatbots domain module.
 * Covers: listing chatbots and automations.
 */

import { flwchat } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Chatbot {
  id: string;
  name?: string;
  title?: string;
  description?: string;
  active?: boolean;
  type?: string;
  createdAt?: string;
  updatedAt?: string;
  [key: string]: unknown;
}

// ── Public API ────────────────────────────────────────────────────────────────

function extractChatbotPage(raw: unknown): { data: Chatbot[]; hasMore: boolean; total?: number } {
  if (Array.isArray(raw)) return { data: raw as Chatbot[], hasMore: false };
  const r = raw as {
    items?: Chatbot[]; chatbots?: Chatbot[]; data?: Chatbot[];
    hasMorePages?: boolean; totalPages?: number; pageNumber?: number;
  };
  const data = r.items ?? r.chatbots ?? r.data ?? [];
  const hasMore = r.hasMorePages ?? false;
  return { data, hasMore, total: data.length };
}

export const chatbots = {
  /** List all chatbots / automations (auto-paginated). */
  async listChatbots(): Promise<Chatbot[]> {
    return flwchat.fetchAllPages<Chatbot>(
      "/chat/v1/chatbot",
      {},
      50,
      (raw, page, pageSize) => {
        const { data, hasMore } = extractChatbotPage(raw);
        return { data, hasMore, total: data.length, page, pageSize };
      },
    );
  },
};
