/**
 * MCP tool handlers for CRM read operations.
 * Tools: bucks_list_boards, bucks_list_cards, bucks_get_card
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { crm } from "../flwchat/crm.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { DEFAULT_LIST_LIMIT } from "../flwchat/sessions.js";
import { assertToolAllowed } from "../rbac.js";
import { requestContext } from "../request-context.js";

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

export function registerCrmReadTools(server: McpServer): void {
  // ── bucks_list_boards ───────────────────────────────────────────────────────

  server.tool(
    "bucks_list_boards",
    "Lista os painéis (boards) do CRM disponíveis, incluindo etapas de cada painel.",
    {},
    async () => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_list_boards");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        const panels = await crm.listPanels();
        return mcpOk({ panels, count: panels.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_list_cards ────────────────────────────────────────────────────────

  server.tool(
    "bucks_list_cards",
    `Lista cards do CRM com filtros opcionais. Padrão: ${DEFAULT_LIST_LIMIT} itens com iteração automática de páginas.`,
    {
      panelId: z.string().optional().describe("Filtrar por ID do painel"),
      stageId: z.string().optional().describe("Filtrar por ID da etapa"),
      contactId: z.string().optional().describe("Filtrar por ID do contato"),
      agentId: z.string().optional().describe("Filtrar por ID do agente responsável"),
      page: z.number().int().positive().optional().describe("Página específica"),
      pageSize: z.number().int().min(1).max(100).optional().describe(`Itens por página (padrão: ${DEFAULT_LIST_LIMIT})`),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_list_cards");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        const result = await crm.listCards({
          panelId: args.panelId,
          stageId: args.stageId,
          contactId: args.contactId,
          agentId: args.agentId,
          page: args.page,
          pageSize: args.pageSize,
        });
        return mcpOk({ cards: result.cards, total: result.total, count: result.cards.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_get_card ──────────────────────────────────────────────────────────

  server.tool(
    "bucks_get_card",
    "Obtém detalhes completos de um card do CRM pelo ID, incluindo notas internas.",
    {
      id: z.string().min(1).describe("ID do card"),
      includeNotes: z.boolean().optional().describe("Se true, inclui as notas do card na resposta"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_get_card");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        const card = await crm.getCardById(args.id);
        if (args.includeNotes) {
          const notes = await crm.listCardNotes(args.id);
          return mcpOk({ ...card, notes });
        }
        return mcpOk(card);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) {
          return mcpError(`Card com ID '${args.id}' não encontrado.`);
        }
        return mcpError((err as Error).message);
      }
    },
  );
}
