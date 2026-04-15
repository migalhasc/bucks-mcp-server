/**
 * MCP tool handlers for lookup operations (read-only).
 * Tools: bucks_list_agents, bucks_get_agent,
 *        bucks_list_departments, bucks_get_department, bucks_list_department_channels,
 *        bucks_list_channels, bucks_list_tags, bucks_list_templates,
 *        bucks_list_custom_fields, bucks_list_contact_custom_fields, bucks_get_panel_custom_fields
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { lookup } from "../flwchat/lookup.js";

function mcpOk(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function mcpError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function registerLookupTools(server: McpServer): void {
  // ── Agents ──────────────────────────────────────────────────────────────────

  server.tool(
    "bucks_list_agents",
    "Lista todos os agentes cadastrados na plataforma.",
    {},
    async () => {
      try {
        const agents = await lookup.listAgents();
        return mcpOk({ agents, count: agents.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_get_agent",
    "Retorna os dados de um agente pelo ID.",
    { id: z.string().min(1).describe("ID do agente") },
    async (args) => {
      try {
        const agent = await lookup.getAgent(args.id);
        return mcpOk(agent);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── Departments ──────────────────────────────────────────────────────────────

  server.tool(
    "bucks_list_departments",
    "Lista todos os departamentos cadastrados na plataforma.",
    {},
    async () => {
      try {
        const departments = await lookup.listDepartments();
        return mcpOk({ departments, count: departments.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_get_department",
    "Retorna os dados de um departamento pelo ID.",
    { id: z.string().min(1).describe("ID do departamento") },
    async (args) => {
      try {
        const department = await lookup.getDepartment(args.id);
        return mcpOk(department);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_list_department_channels",
    "Lista os canais de um departamento pelo ID do departamento.",
    { id: z.string().min(1).describe("ID do departamento") },
    async (args) => {
      try {
        const channels = await lookup.listDepartmentChannels(args.id);
        return mcpOk({ channels, count: Array.isArray(channels) ? channels.length : undefined });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── Channels ─────────────────────────────────────────────────────────────────

  server.tool(
    "bucks_list_channels",
    "Lista todos os canais de atendimento cadastrados na plataforma.",
    {},
    async () => {
      try {
        const channels = await lookup.listChannels();
        return mcpOk({ channels, count: Array.isArray(channels) ? channels.length : undefined });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── Tags ─────────────────────────────────────────────────────────────────────

  server.tool(
    "bucks_list_tags",
    "Lista todas as etiquetas cadastradas na plataforma.",
    {},
    async () => {
      try {
        const tags = await lookup.listTags();
        return mcpOk({ tags, count: Array.isArray(tags) ? tags.length : undefined });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── Templates ────────────────────────────────────────────────────────────────

  server.tool(
    "bucks_list_templates",
    "Lista todos os templates de mensagem cadastrados na plataforma.",
    {},
    async () => {
      try {
        const templates = await lookup.listTemplates();
        return mcpOk({ templates, count: templates.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── Custom Fields ─────────────────────────────────────────────────────────────

  server.tool(
    "bucks_list_custom_fields",
    "Lista todos os campos customizados globais da plataforma.",
    {},
    async () => {
      try {
        const fields = await lookup.listCustomFields();
        return mcpOk({ fields, count: Array.isArray(fields) ? fields.length : undefined });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_list_contact_custom_fields",
    "Lista todos os campos customizados de contatos.",
    {},
    async () => {
      try {
        const fields = await lookup.listContactCustomFields();
        return mcpOk({ fields, count: Array.isArray(fields) ? fields.length : undefined });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_get_panel_custom_fields",
    "Retorna os campos customizados de um painel CRM pelo ID do painel.",
    { panelId: z.string().min(1).describe("ID do painel CRM") },
    async (args) => {
      try {
        const fields = await lookup.getPanelCustomFields(args.panelId);
        return mcpOk({ fields, count: Array.isArray(fields) ? fields.length : undefined });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
