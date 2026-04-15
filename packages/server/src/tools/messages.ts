/**
 * MCP tool handlers for message operations.
 * Tools: bucks_get_message, bucks_get_message_status, bucks_send_outbound_sync
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { messages } from "../flwchat/messages.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { requestContext } from "../request-context.js";
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";

function mcpError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function mcpOk(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function getContext() {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error("Contexto de requisição não disponível.");
  return ctx;
}

export function registerMessageTools(server: McpServer): void {
  // ── bucks_get_message ───────────────────────────────────────────────────────

  server.tool(
    "bucks_get_message",
    "Obtém os dados de uma mensagem pelo ID.",
    {
      id: z.string().min(1).describe("ID da mensagem"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const msg = await messages.getMessage(args.id);
        return mcpOk(msg);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Mensagem '${args.id}' não encontrada.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_get_message_status ────────────────────────────────────────────────

  server.tool(
    "bucks_get_message_status",
    "Obtém o status de entrega/leitura de uma mensagem pelo ID.",
    {
      id: z.string().min(1).describe("ID da mensagem"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const status = await messages.getMessageStatus(args.id);
        return mcpOk(status);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Mensagem '${args.id}' não encontrada.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_send_outbound_sync ────────────────────────────────────────────────

  server.tool(
    "bucks_send_outbound_sync",
    "Envia uma mensagem outbound de forma síncrona (aguarda confirmação do canal). Exige prévia e confirmação.",
    {
      phone: z.string().describe("Telefone do destinatário em formato internacional (ex: +5511999999999)"),
      text: z.string().min(1).describe("Texto da mensagem a enviar"),
      channel: z.string().optional().describe("ID do canal de envio (usa canal padrão se omitido)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar o envio"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Enviar mensagem outbound (síncrono)",
          alvo: args.phone,
          campos: {
            mensagem: args.text,
            ...(args.channel ? { canal: args.channel } : {}),
          },
        });
      }
      try {
        const result = await messages.sendSync({ phone: args.phone, text: args.text, channel: args.channel });
        return buildSuccess(`Mensagem enviada para ${args.phone}.`, result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_delete_message ────────────────────────────────────────────────────

  server.tool(
    "bucks_delete_message",
    "Exclui uma mensagem permanentemente. Ação sensível e irreversível — exige prévia e confirmação.",
    {
      id: z.string().min(1).describe("ID da mensagem"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Excluir mensagem",
          alvo: `Mensagem ID: ${args.id}`,
          campos: {},
          aviso: "Esta ação é irreversível. A mensagem será permanentemente removida.",
        });
      }
      try {
        const result = await messages.deleteMessage(args.id);
        return buildSuccess("Mensagem excluída com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Mensagem '${args.id}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );
}
