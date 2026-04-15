/**
 * MCP tool handlers for scheduled message operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { scheduledMessages } from "../flwchat/scheduledMessages.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";

function mcpOk(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function mcpError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function registerScheduledMessageTools(server: McpServer): void {
  // ── bucks_list_scheduled_messages ──────────────────────────────────────────

  server.tool(
    "bucks_list_scheduled_messages",
    "Lista as mensagens agendadas.",
    {},
    async () => {
      try {
        const result = await scheduledMessages.list();
        return mcpOk(result);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_create_scheduled_message ─────────────────────────────────────────

  server.tool(
    "bucks_create_scheduled_message",
    "Cria uma mensagem agendada. Exige prévia e confirmação.",
    {
      sessionId: z.string().optional().describe("ID da sessão (alternativo ao phone)"),
      phone: z.string().optional().describe("Telefone do destinatário"),
      channel: z.string().optional().describe("ID do canal de envio"),
      text: z.string().min(1).describe("Texto da mensagem"),
      scheduledAt: z.string().describe("Data/hora do agendamento (ISO 8601)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Criar mensagem agendada",
          alvo: args.phone ?? args.sessionId ?? "(sem alvo)",
          campos: {
            mensagem: args.text,
            agendado_para: args.scheduledAt,
            ...(args.channel ? { canal: args.channel } : {}),
          },
        });
      }
      try {
        const { sessionId, phone, channel, text, scheduledAt } = args;
        const params: Record<string, unknown> = { text, scheduledAt };
        if (sessionId) params.sessionId = sessionId;
        if (phone) params.phone = phone;
        if (channel) params.channel = channel;
        const result = await scheduledMessages.create(params);
        return buildSuccess("Mensagem agendada criada com sucesso.", result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_get_scheduled_message ─────────────────────────────────────────────

  server.tool(
    "bucks_get_scheduled_message",
    "Retorna os dados de uma mensagem agendada pelo ID.",
    {
      id: z.string().min(1).describe("ID da mensagem agendada"),
    },
    async (args) => {
      try {
        const result = await scheduledMessages.get(args.id);
        return mcpOk(result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Mensagem agendada '${args.id}' não encontrada.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_update_scheduled_message ─────────────────────────────────────────

  server.tool(
    "bucks_update_scheduled_message",
    "Atualiza uma mensagem agendada. Exige prévia e confirmação.",
    {
      id: z.string().min(1).describe("ID da mensagem agendada"),
      text: z.string().optional().describe("Novo texto"),
      scheduledAt: z.string().optional().describe("Nova data/hora (ISO 8601)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar mensagem agendada",
          alvo: `Mensagem ID: ${args.id}`,
          campos: {
            ...(args.text ? { mensagem: args.text } : {}),
            ...(args.scheduledAt ? { agendado_para: args.scheduledAt } : {}),
          },
        });
      }
      try {
        const params: Record<string, unknown> = {};
        if (args.text) params.text = args.text;
        if (args.scheduledAt) params.scheduledAt = args.scheduledAt;
        const result = await scheduledMessages.update(args.id, params);
        return buildSuccess("Mensagem agendada atualizada com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Mensagem agendada '${args.id}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_cancel_scheduled_message ─────────────────────────────────────────

  server.tool(
    "bucks_cancel_scheduled_message",
    "Cancela uma mensagem agendada. Exige prévia e confirmação.",
    {
      id: z.string().min(1).describe("ID da mensagem agendada"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Cancelar mensagem agendada",
          alvo: `Mensagem ID: ${args.id}`,
          campos: {},
        });
      }
      try {
        const result = await scheduledMessages.cancel(args.id);
        return buildSuccess("Mensagem agendada cancelada com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Mensagem agendada '${args.id}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_batch_cancel_scheduled_messages ───────────────────────────────────

  server.tool(
    "bucks_batch_cancel_scheduled_messages",
    "Cancela múltiplas mensagens agendadas em lote. Exige prévia e confirmação.",
    {
      ids: z.array(z.string()).min(1).describe("IDs das mensagens agendadas a cancelar"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Cancelar mensagens agendadas em lote",
          alvo: `${args.ids.length} mensagem(ns)`,
          campos: { ids: args.ids },
        });
      }
      try {
        const result = await scheduledMessages.batchCancel(args.ids);
        return buildSuccess(`${args.ids.length} mensagem(ns) agendada(s) cancelada(s) com sucesso.`, result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );
}
