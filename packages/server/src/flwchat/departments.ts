/**
 * FlwChat departments domain module.
 * Covers: create, update, delete department; update agents.
 */

import { flwchat } from "./client.js";

export const departments = {
  async createDepartment(params: Record<string, unknown>): Promise<unknown> {
    return flwchat.post<unknown>("/core/v1/department", params);
  },

  async updateDepartment(id: string, params: Record<string, unknown>): Promise<unknown> {
    return flwchat.put<unknown>(`/core/v1/department/${encodeURIComponent(id)}`, params);
  },

  async deleteDepartment(id: string): Promise<unknown> {
    return flwchat.delete<unknown>(`/core/v1/department/${encodeURIComponent(id)}`);
  },

  async updateDepartmentAgents(id: string, agentIds: string[]): Promise<unknown> {
    return flwchat.put<unknown>(`/core/v1/department/${encodeURIComponent(id)}/agents`, { agentIds });
  },
};
