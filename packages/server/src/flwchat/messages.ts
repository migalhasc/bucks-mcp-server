/**
 * FlwChat messages domain module.
 * Covers: get message, get message status, send outbound sync.
 */

import { flwchat } from "./client.js";

// ── Public API ────────────────────────────────────────────────────────────────

export const messages = {
  /** Get a single message by ID. */
  async getMessage(id: string): Promise<unknown> {
    return flwchat.get<unknown>(`/chat/v1/message/${encodeURIComponent(id)}`);
  },

  /** Get delivery/read status of a message by ID. */
  async getMessageStatus(id: string): Promise<unknown> {
    return flwchat.get<unknown>(`/chat/v1/message/${encodeURIComponent(id)}/status`);
  },

  /** Send an outbound message synchronously (waits for channel ack). */
  async sendSync(params: { phone: string; channel?: string; text: string }): Promise<unknown> {
    return flwchat.post<unknown>("/chat/v1/message/send-sync", params);
  },
};
