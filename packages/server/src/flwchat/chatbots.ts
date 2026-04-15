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

export const chatbots = {
  /** List all chatbots / automations. */
  async listChatbots(): Promise<Chatbot[]> {
    const raw = await flwchat.get<unknown>("/chat/v1/chatbot");
    if (Array.isArray(raw)) return raw as Chatbot[];
    const r = raw as { chatbots?: Chatbot[]; data?: Chatbot[]; items?: Chatbot[] };
    return r.items ?? r.chatbots ?? r.data ?? [];
  },
};
