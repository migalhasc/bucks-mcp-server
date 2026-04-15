/**
 * FlwChat webhooks domain module.
 * Covers: list events, list/create/get/update/delete subscriptions.
 */

import { flwchat } from "./client.js";

export const webhooks = {
  async listEvents(): Promise<unknown> {
    return flwchat.get<unknown>("/core/v1/webhook/event");
  },

  async listSubscriptions(): Promise<unknown> {
    return flwchat.get<unknown>("/core/v1/webhook/subscription");
  },

  async createSubscription(params: Record<string, unknown>): Promise<unknown> {
    return flwchat.post<unknown>("/core/v1/webhook/subscription", params);
  },

  async getSubscription(id: string): Promise<unknown> {
    return flwchat.get<unknown>(`/core/v1/webhook/subscription/${encodeURIComponent(id)}`);
  },

  async updateSubscription(id: string, params: Record<string, unknown>): Promise<unknown> {
    return flwchat.put<unknown>(`/core/v1/webhook/subscription/${encodeURIComponent(id)}`, params);
  },

  async deleteSubscription(id: string): Promise<unknown> {
    return flwchat.delete<unknown>(`/core/v1/webhook/subscription/${encodeURIComponent(id)}`);
  },
};
