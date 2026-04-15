/**
 * FlwChat agents domain module.
 * Covers: create, update, delete agent; update departments; set status; logout.
 */

import { flwchat } from "./client.js";

export const agents = {
  async createAgent(params: Record<string, unknown>): Promise<unknown> {
    return flwchat.post<unknown>("/core/v1/agent", params);
  },

  async updateAgent(id: string, params: Record<string, unknown>): Promise<unknown> {
    return flwchat.put<unknown>(`/core/v1/agent/${encodeURIComponent(id)}`, params);
  },

  async deleteAgent(id: string): Promise<unknown> {
    return flwchat.delete<unknown>(`/core/v1/agent/${encodeURIComponent(id)}`);
  },

  async updateAgentDepartments(id: string, departmentIds: string[]): Promise<unknown> {
    return flwchat.post<unknown>(`/core/v1/agent/${encodeURIComponent(id)}/departments`, { departmentIds });
  },

  async setAgentStatus(id: string, status: string): Promise<unknown> {
    return flwchat.post<unknown>(`/core/v1/agent/${encodeURIComponent(id)}/status`, { status });
  },

  async logoutAgent(id: string): Promise<unknown> {
    return flwchat.post<unknown>(`/core/v1/agent/${encodeURIComponent(id)}/logout`, {});
  },
};
