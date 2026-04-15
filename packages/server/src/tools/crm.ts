/**
 * MCP tool handlers for CRM read and write operations.
 * Tools: bucks_list_boards, bucks_list_cards, bucks_get_card,
 *        bucks_create_card, bucks_update_card, bucks_move_card,
 *        bucks_add_card_note, bucks_delete_card_note
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { crm } from "../flwchat/crm.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { DEFAULT_LIST_LIMIT } from "../flwchat/sessions.js";
import { requestContext } from "../request-context.js";
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";

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
      } catch (err) {
        return buildError((err as Error).message);
      }

      try {
        const panels = await crm.listPanels();
        return mcpOk({ panels, count: panels.length });
      } catch (err) {
        return buildError((err as Error).message);
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
      } catch (err) {
        return buildError((err as Error).message);
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
        return buildError((err as Error).message);
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
      } catch (err) {
        return buildError((err as Error).message);
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
          return buildError(`Card com ID '${args.id}' não encontrado.`);
        }
        return buildError((err as Error).message);
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
      description: z.string().optional().describe("Descrição / corpo do card"),
      contactId: z.string().optional().describe("ID do contato associado"),
      agentId: z.string().optional().describe("ID do agente responsável"),
      value: z.number().nonnegative().optional().describe("Valor monetário da oportunidade"),
      tags: z.array(z.string()).optional().describe("Etiquetas do card"),
      dueDate: z.string().optional().describe("Data de vencimento (ISO 8601, ex: 2026-05-01T00:00:00Z)"),
      customFields: z.record(z.unknown()).optional().describe("Campos personalizados (objeto chave-valor)"),
      confirmed: z.boolean().optional().describe("true para confirmar e criar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        const campos: Record<string, unknown> = { painel: args.panelId, etapa: args.stageId };
        if (args.title) campos["título"] = args.title;
        if (args.description) campos["descrição"] = args.description;
        if (args.contactId) campos["contato"] = args.contactId;
        if (args.agentId) campos["responsável"] = args.agentId;
        if (args.value !== undefined) campos["valor"] = args.value;
        if (args.dueDate) campos["vencimento"] = args.dueDate;
        if (args.customFields) campos["campos personalizados"] = args.customFields;
        return buildPreview({ acao: "Criar card", alvo: args.title ?? "(sem título)", campos });
      }
      try {
        const card = await crm.createCard({
          panelId: args.panelId,
          stageId: args.stageId,
          title: args.title,
          description: args.description,
          contactId: args.contactId,
          agentId: args.agentId,
          value: args.value,
          tags: args.tags,
          dueDate: args.dueDate,
          customFields: args.customFields as Record<string, unknown> | undefined,
        });
        return buildSuccess("Card criado com sucesso.", card);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_card ───────────────────────────────────────────────────────

  server.tool(
    "bucks_update_card",
    "Atualiza campos de um card existente (título, descrição, responsável, valor, etiquetas, vencimento, campos personalizados). Exige prévia e confirmação.",
    {
      id: z.string().min(1).describe("ID do card"),
      title: z.string().optional().describe("Novo título"),
      description: z.string().optional().describe("Nova descrição"),
      stageId: z.string().optional().describe("ID da nova etapa (mover card)"),
      agentId: z.string().optional().describe("ID do novo agente responsável"),
      value: z.number().nonnegative().optional().describe("Novo valor monetário"),
      tags: z.array(z.string()).optional().describe("Novas etiquetas"),
      dueDate: z.string().optional().describe("Nova data de vencimento (ISO 8601)"),
      customFields: z.record(z.unknown()).optional().describe("Campos personalizados (objeto chave-valor)"),
      confirmed: z.boolean().optional().describe("true para confirmar e atualizar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        const campos: Record<string, unknown> = { "card ID": args.id };
        if (args.title) campos["título"] = args.title;
        if (args.description) campos["descrição"] = args.description;
        if (args.stageId) campos["etapa"] = args.stageId;
        if (args.agentId) campos["responsável"] = args.agentId;
        if (args.value !== undefined) campos["valor"] = args.value;
        if (args.dueDate) campos["vencimento"] = args.dueDate;
        if (args.customFields) campos["campos personalizados"] = args.customFields;
        return buildPreview({ acao: "Atualizar card", alvo: `Card ID: ${args.id}`, campos });
      }
      try {
        const card = await crm.updateCard(args.id, {
          title: args.title,
          description: args.description,
          stageId: args.stageId,
          agentId: args.agentId,
          value: args.value,
          tags: args.tags,
          dueDate: args.dueDate,
          customFields: args.customFields as Record<string, unknown> | undefined,
        });
        return buildSuccess("Card atualizado com sucesso.", card);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Card '${args.id}' não encontrado.`);
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
    "Adiciona uma nota interna a um card do CRM. Exige prévia e confirmação.",
    {
      cardId: z.string().min(1).describe("ID do card"),
      text: z.string().min(1).describe("Texto da nota"),
      confirmed: z.boolean().optional().describe("true para confirmar e salvar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
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

  // ── bucks_delete_card_note ──────────────────────────────────────────────────

  server.tool(
    "bucks_delete_card_note",
    "Remove uma nota interna de um card do CRM. Exige prévia e confirmação.",
    {
      cardId: z.string().min(1).describe("ID do card"),
      noteId: z.string().min(1).describe("ID da nota a remover"),
      confirmed: z.boolean().optional().describe("true para confirmar e deletar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Remover nota de card",
          alvo: `Nota ID: ${args.noteId}`,
          campos: { "card ID": args.cardId },
          aviso: "Esta ação é irreversível.",
        });
      }
      try {
        await crm.deleteCardNote({ cardId: args.cardId, noteId: args.noteId });
        return buildSuccess("Nota removida com sucesso.", { cardId: args.cardId, noteId: args.noteId });
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Card ou nota não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_duplicate_card ────────────────────────────────────────────────────

  server.tool(
    "bucks_duplicate_card",
    "Duplica um card existente no CRM. Exige prévia e confirmação.",
    {
      cardId: z.string().min(1).describe("ID do card a duplicar"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar a duplicação"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Duplicar card",
          alvo: `Card ID: ${args.cardId}`,
        });
      }
      try {
        const result = await crm.duplicateCard(args.cardId);
        return buildSuccess("Card duplicado com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Card '${args.cardId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );
}
