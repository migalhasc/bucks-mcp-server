/**
 * MCP tool handlers for Chatbots / Automations.
 * Tools: bucks_list_chatbots
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chatbots } from "../flwchat/chatbots.js";
import { requestContext } from "../request-context.js";
import { buildError, buildPreview, buildSuccess } from "../confirmation.js";

function mcpOk(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function getContext() {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error("Contexto de requisição não disponível.");
  return ctx;
}

export function registerChatbotTools(server: McpServer): void {
  // ── bucks_list_chatbots ─────────────────────────────────────────────────────

  server.tool(
    "bucks_list_chatbots",
    "Lista todos os chatbots e automações configurados na conta FlwChat.",
    {},
    async () => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }

      try {
        const list = await chatbots.listChatbots();
        return mcpOk({ chatbots: list, count: list.length });
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_send_chatbot ──────────────────────────────────────────────────────

  server.tool(
    "bucks_send_chatbot",
    "Dispara um chatbot para uma sessão ou número de telefone. Ação sensível — durante a execução do chatbot a interação do agente fica desabilitada. Exige prévia e confirmação.",
    {
      chatbotId: z.string().min(1).describe("ID do chatbot a disparar"),
      sessionId: z.string().optional().describe("ID da sessão (use sessionId ou phone)"),
      phone: z.string().optional().describe("Telefone do contato em formato internacional (use phone ou sessionId)"),
      channel: z.string().optional().describe("ID do canal (opcional)"),
      confirmed: z.boolean().optional().describe("true para confirmar e disparar o chatbot"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }

      if (!args.sessionId && !args.phone) {
        return buildError("Informe ao menos sessionId ou phone para disparar o chatbot.");
      }

      if (!args.confirmed) {
        return buildPreview({
          acao: "Disparar chatbot",
          alvo: args.sessionId ? `Sessão ID: ${args.sessionId}` : `Telefone: ${args.phone}`,
          campos: {
            chatbotId: args.chatbotId,
            ...(args.channel ? { canal: args.channel } : {}),
          },
          aviso: "Ao disparar o chatbot, a interação do agente ficará desabilitada enquanto ele estiver em execução.",
        });
      }

      try {
        const result = await chatbots.sendChatbot({
          chatbotId: args.chatbotId,
          sessionId: args.sessionId,
          phone: args.phone,
          channel: args.channel,
        });
        return buildSuccess("Chatbot disparado com sucesso.", result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );
}
