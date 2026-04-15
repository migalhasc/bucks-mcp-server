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
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";

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

  // ── Office Hours ─────────────────────────────────────────────────────────────

  server.tool(
    "bucks_get_office_hours",
    "Retorna a configuração de horário de atendimento da empresa.",
    {},
    async () => {
      try {
        const result = await lookup.getOfficeHours();
        return mcpOk(result);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── File Upload ──────────────────────────────────────────────────────────────

  server.tool(
    "bucks_get_file_upload_url",
    "Obtém uma URL pré-assinada para upload de arquivo.",
    {
      fileName: z.string().optional().describe("Nome do arquivo"),
      mimeType: z.string().optional().describe("MIME type do arquivo (ex: image/png)"),
    },
    async (args) => {
      try {
        const result = await lookup.getFileUploadUrl(args);
        return mcpOk(result);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_save_file",
    "Registra um arquivo após upload e obtém o fileId. Exige prévia e confirmação.",
    {
      fileName: z.string().min(1).describe("Nome do arquivo"),
      url: z.string().url().describe("URL do arquivo após upload"),
      mimeType: z.string().optional().describe("MIME type do arquivo"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Registrar arquivo",
          alvo: args.fileName,
          campos: { url: args.url, ...(args.mimeType ? { mimeType: args.mimeType } : {}) },
        });
      }
      try {
        const { fileName, url, mimeType } = args;
        const params: Record<string, unknown> = { fileName, url };
        if (mimeType) params.mimeType = mimeType;
        const result = await lookup.saveFile(params);
        return buildSuccess("Arquivo registrado com sucesso.", result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── OTP ──────────────────────────────────────────────────────────────────────

  server.tool(
    "bucks_send_otp",
    "Envia um código OTP por template para um telefone. Exige prévia e confirmação.",
    {
      phone: z.string().min(1).describe("Telefone do destinatário"),
      channel: z.string().min(1).describe("ID do canal de envio"),
      templateId: z.string().optional().describe("ID do template OTP (usa padrão se omitido)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Enviar OTP",
          alvo: args.phone,
          campos: { canal: args.channel, ...(args.templateId ? { templateId: args.templateId } : {}) },
        });
      }
      try {
        const result = await lookup.sendOtp({ phone: args.phone, channel: args.channel, templateId: args.templateId });
        return buildSuccess(`OTP enviado para ${args.phone}.`, result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_get_otp_status",
    "Retorna o status de entrega de um OTP pelo ID da mensagem.",
    {
      messageId: z.string().min(1).describe("ID da mensagem OTP"),
    },
    async (args) => {
      try {
        const result = await lookup.getOtpStatus(args.messageId);
        return mcpOk(result);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
