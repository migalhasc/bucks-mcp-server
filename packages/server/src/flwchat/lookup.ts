/**
 * FlwChat lookup domain module.
 * Read-only lookups: agents, departments, channels, tags, templates, custom fields.
 */

import { flwchat, PagedResult } from "./client.js";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Agent {
  id: string;
  name: string;
  email?: string;
  [key: string]: unknown;
}

export interface Department {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Channel {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Tag {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface Template {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface CustomField {
  id: string;
  name: string;
  [key: string]: unknown;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

interface PagedRaw {
  data?: unknown[];
  items?: unknown[];
  total?: number;
}

function extractPage<T>(raw: unknown, page: number, pageSize: number): PagedResult<T> {
  const r = raw as PagedRaw;
  const data = (r.data ?? r.items ?? []) as T[];
  return {
    data,
    total: r.total,
    page,
    pageSize,
    hasMore: data.length === pageSize,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

export const lookup = {
  // ── Agents ──────────────────────────────────────────────────────────────────

  async listAgents(): Promise<Agent[]> {
    return flwchat.fetchAllPages<Agent>(
      "/core/v1/agent",
      {},
      50,
      (raw, pg, ps) => extractPage<Agent>(raw, pg, ps),
    );
  },

  async getAgent(id: string): Promise<Agent> {
    return flwchat.get<Agent>(`/core/v1/agent/${encodeURIComponent(id)}`);
  },

  // ── Departments ─────────────────────────────────────────────────────────────

  async listDepartments(): Promise<Department[]> {
    return flwchat.fetchAllPages<Department>(
      "/core/v2/department",
      {},
      50,
      (raw, pg, ps) => extractPage<Department>(raw, pg, ps),
    );
  },

  async getDepartment(id: string): Promise<Department> {
    return flwchat.get<Department>(`/core/v1/department/${encodeURIComponent(id)}`);
  },

  async listDepartmentChannels(id: string): Promise<Channel[]> {
    return flwchat.get<Channel[]>(`/core/v1/department/${encodeURIComponent(id)}/channel`);
  },

  // ── Channels ─────────────────────────────────────────────────────────────────

  async listChannels(): Promise<Channel[]> {
    return flwchat.get<Channel[]>("/chat/v1/channel");
  },

  // ── Tags ────────────────────────────────────────────────────────────────────

  async listTags(): Promise<Tag[]> {
    return flwchat.get<Tag[]>("/core/v1/tag");
  },

  // ── Templates ───────────────────────────────────────────────────────────────

  async listTemplates(): Promise<Template[]> {
    return flwchat.fetchAllPages<Template>(
      "/chat/v1/template",
      {},
      50,
      (raw, pg, ps) => extractPage<Template>(raw, pg, ps),
    );
  },

  // ── Custom Fields ────────────────────────────────────────────────────────────

  async listCustomFields(): Promise<CustomField[]> {
    return flwchat.get<CustomField[]>("/core/v1/custom-field");
  },

  async listContactCustomFields(): Promise<CustomField[]> {
    return flwchat.get<CustomField[]>("/core/v1/contact/custom-field");
  },

  async getPanelCustomFields(panelId: string): Promise<CustomField[]> {
    return flwchat.get<CustomField[]>(`/crm/v1/panel/${encodeURIComponent(panelId)}/custom-fields`);
  },
};
