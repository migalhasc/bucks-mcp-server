/**
 * MCP tool handlers for CRM read and write operations.
 * Tools: bucks_list_boards, bucks_list_cards, bucks_get_card,
 *        bucks_create_card, bucks_move_card, bucks_add_card_note
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { crm } from "../flwchat/crm.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { DEFAULT_LIST_LIMIT } from "../flwchat/sessions.js";
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

export function registerCrmTools(server: McpServer): void {
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

  // ── bucks_create_card ───────────────────────────────────────────────────────

  server.tool(
    "bucks_create_card",
    "Cria um novo card de oportunidade no CRM. Exige prévia e confirmação.",
    {
      panelId: z.string().min(1).describe("ID do painel (board)"),
      stageId: z.string().min(1).describe("ID da etapa inicial"),
      title: z.string().optional().describe("Título do card"),
      contactId: z.string().optional().describe("ID do contato associado"),
      agentId: z.string().optional().describe("ID do agente responsável"),
      value: z.number().nonnegative().optional().describe("Valor da oportunidade"),
      tags: z.array(z.string()).optional().describe("Etiquetas do card"),
      confirmed: z.boolean().optional().describe("true para confirmar e criar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_create_card");
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        const campos: Record<string, unknown> = { painel: args.panelId, etapa: args.stageId };
        if (args.title) campos["título"] = args.title;
        if (args.contactId) campos["contato"] = args.contactId;
        if (args.value !== undefined) campos["valor"] = args.value;
        return buildPreview({ acao: "Criar card", alvo: args.title ?? "(sem título)", campos });
      }
      try {
        const card = await crm.createCard({
          panelId: args.panelId,
          stageId: args.stageId,
          title: args.title,
          contactId: args.contactId,
          agentId: args.agentId,
          value: args.value,
          tags: args.tags,
        });
        return buildSuccess("Card criado com sucesso.", card);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_move_card ─────────────────────────────────────────────────────────

  server.tool(
    "bucks_move_card",
    "Move um card para outra etapa do pipeline. Movimentos para etapas finais usam prévia reforçada.",
    {
      id: z.string().min(1).describe("ID do card"),
      stageId: z.string().min(1).describe("ID da etapa de destino"),
      isFinalStage: z.boolean().optional().describe("Indique true se a etapa de destino é uma etapa final (ganha/perde)"),
      confirmed: z.boolean().optional().describe("true para confirmar e mover"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_move_card");
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Mover card",
          alvo: `Card ID: ${args.id}`,
          campos: { "etapa destino": args.stageId },
          aviso: args.isFinalStage
            ? "Esta é uma etapa final. Certifique-se de que o movimento é correto."
            : undefined,
        });
      }
      try {
        const card = await crm.updateCard(args.id, { stageId: args.stageId });
        return buildSuccess("Card movido com sucesso.", card);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Card '${args.id}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_add_card_note ─────────────────────────────────────────────────────

  server.tool(
    "bucks_add_card_note",
    "Adiciona uma nota a um card do CRM. Exige prévia e confirmação.",
    {
      cardId: z.string().min(1).describe("ID do card"),
      text: z.string().min(1).describe("Texto da nota"),
      confirmed: z.boolean().optional().describe("true para confirmar e salvar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_add_card_note");
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Adicionar nota em card",
          alvo: `Card ID: ${args.cardId}`,
          campos: { nota: args.text },
        });
      }
      try {
        const note = await crm.addCardNote({ cardId: args.cardId, text: args.text });
        return buildSuccess("Nota adicionada com sucesso.", note);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Card '${args.cardId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );
}
