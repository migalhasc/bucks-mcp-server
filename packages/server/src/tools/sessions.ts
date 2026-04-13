/**
 * MCP tool handlers for session and message read operations.
 * Tools: bucks_list_sessions, bucks_get_session, bucks_list_messages
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sessions, DEFAULT_RECENCY_HOURS, DEFAULT_RECENT_LIMIT, DEFAULT_LIST_LIMIT } from "../flwchat/sessions.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { assertToolAllowed } from "../rbac.js";
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

export function registerSessionTools(server: McpServer): void {
  // ── bucks_list_sessions ─────────────────────────────────────────────────────

  server.tool(
    "bucks_list_sessions",
    `Lista sessões de atendimento com filtros opcionais. Por padrão retorna sessões das últimas ${DEFAULT_RECENCY_HOURS}h (limite ${DEFAULT_RECENT_LIMIT} itens). Use 'page' e 'pageSize' para controle explícito (padrão geral: ${DEFAULT_LIST_LIMIT} itens).`,
    {
      contactId: z.string().optional().describe("Filtrar por ID do contato"),
      status: z.string().optional().describe("Filtrar por status (ex: open, closed, pending)"),
      agentId: z.string().optional().describe("Filtrar por ID do agente responsável"),
      hours: z.number().int().positive().optional().describe(`Janela de recência em horas (padrão: ${DEFAULT_RECENCY_HOURS}h)`),
      recent: z.boolean().optional().describe(`Se true, retorna sessões das últimas N horas com limite ${DEFAULT_RECENT_LIMIT}`),
      page: z.number().int().positive().optional().describe("Página específica (omita para iteração automática)"),
      pageSize: z.number().int().min(1).max(100).optional().describe(`Itens por página (padrão: ${DEFAULT_LIST_LIMIT})`),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_list_sessions");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        if (args.recent) {
          const result = await sessions.listRecent({
            hours: args.hours,
            contactId: args.contactId,
            status: args.status,
            agentId: args.agentId,
            limit: args.pageSize ?? DEFAULT_RECENT_LIMIT,
          });
          return mcpOk({ sessions: result, count: result.length, mode: "recent" });
        }

        const result = await sessions.list({
          contactId: args.contactId,
          status: args.status,
          agentId: args.agentId,
          page: args.page,
          pageSize: args.pageSize,
        });
        return mcpOk({ sessions: result.sessions, total: result.total, count: result.sessions.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_get_session ───────────────────────────────────────────────────────

  server.tool(
    "bucks_get_session",
    "Obtém detalhes completos de uma sessão pelo ID.",
    {
      id: z.string().min(1).describe("ID da sessão"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_get_session");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        const session = await sessions.getById(args.id);
        return mcpOk(session);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) {
          return mcpError(`Sessão com ID '${args.id}' não encontrada.`);
        }
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_list_messages ─────────────────────────────────────────────────────

  server.tool(
    "bucks_list_messages",
    `Lista mensagens de uma sessão. Por padrão retorna mensagens das últimas ${DEFAULT_RECENCY_HOURS}h (limite ${DEFAULT_RECENT_LIMIT} itens). Use 'after' para definir janela explícita ou 'page' para paginação direta.`,
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
      after: z.string().optional().describe("ISO 8601 — retorna mensagens após esta data/hora"),
      limit: z.number().int().min(1).max(100).optional().describe(`Máximo de mensagens (padrão: ${DEFAULT_RECENT_LIMIT})`),
      page: z.number().int().positive().optional().describe("Página específica"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_list_messages");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        const result = await sessions.listMessages({
          sessionId: args.sessionId,
          after: args.after,
          limit: args.limit,
          page: args.page,
        });
        return mcpOk({
          messages: result.messages,
          total: result.total,
          count: result.messages.length,
        });
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) {
          return mcpError(`Sessão com ID '${args.sessionId}' não encontrada.`);
        }
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_reply_session ─────────────────────────────────────────────────────

  server.tool(
    "bucks_reply_session",
    "Envia uma resposta de texto dentro de uma sessão existente. Exige prévia e confirmação explícita. Para iniciar uma conversa nova use bucks_send_outbound.",
    {
      sessionId: z.string().min(1).describe("ID da sessão a responder"),
      text: z.string().min(1).describe("Texto da mensagem a enviar"),
      confirmed: z.boolean().optional().describe("true para confirmar e enviar a mensagem"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_reply_session");
      } catch (err) {
        return buildError((err as Error).message);
      }

      if (!args.confirmed) {
        return buildPreview({
          acao: "Responder sessão",
          alvo: `Sessão ID: ${args.sessionId}`,
          campos: { mensagem: args.text },
        });
      }

      try {
        const result = await sessions.reply({
          sessionId: args.sessionId,
          text: args.text,
        });
        return buildSuccess("Mensagem enviada com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) {
          return buildError(`Sessão com ID '${args.sessionId}' não encontrada.`);
        }
        return buildError((err as Error).message);
      }
    },
  );
}
