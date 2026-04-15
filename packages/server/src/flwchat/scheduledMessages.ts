/**
 * FlwChat scheduled messages domain module.
 * Covers: list, create, get, update, cancel, batch-cancel.
 */

import { flwchat } from "./client.js";

export const scheduledMessages = {
  async list(params?: Record<string, unknown>): Promise<unknown> {
    return flwchat.get<unknown>("/chat/v1/scheduled-message", params as Record<string, string | undefined>);
  },

  async create(params: Record<string, unknown>): Promise<unknown> {
    return flwchat.post<unknown>("/chat/v1/scheduled-message", params);
  },

  async get(id: string): Promise<unknown> {
    return flwchat.get<unknown>(`/chat/v1/scheduled-message/${encodeURIComponent(id)}`);
  },

  async update(id: string, params: Record<string, unknown>): Promise<unknown> {
    return flwchat.put<unknown>(`/chat/v1/scheduled-message/${encodeURIComponent(id)}`, params);
  },

  async cancel(id: string): Promise<unknown> {
    return flwchat.post<unknown>(`/chat/v1/scheduled-message/${encodeURIComponent(id)}/cancel`, {});
  },

  async batchCancel(ids: string[]): Promise<unknown> {
    return flwchat.post<unknown>("/chat/v1/scheduled-message/batch-cancel", { ids });
  },
};
