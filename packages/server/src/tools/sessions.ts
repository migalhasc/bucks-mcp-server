/**
 * MCP tool handlers for session, message and outbound operations.
 * Tools: bucks_list_sessions, bucks_get_session, bucks_list_messages,
 *        bucks_reply_session, bucks_send_outbound, bucks_assign_session,
 *        bucks_transfer_session, bucks_set_session_status,
 *        bucks_close_session, bucks_add_session_note
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sessions, DEFAULT_RECENCY_HOURS, DEFAULT_RECENT_LIMIT, DEFAULT_LIST_LIMIT } from "../flwchat/sessions.js";
import { contacts } from "../flwchat/contacts.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { requestContext } from "../request-context.js";
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";
import {
  validateOutboundInput,
  buildOutboundPreview,
} from "../outbound-policy.js";
import { config } from "../config.js";

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

  // ── bucks_assign_session ────────────────────────────────────────────────────

  server.tool(
    "bucks_assign_session",
    "Atribui uma sessão a um agente específico. Exige prévia e confirmação.",
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
      agentId: z.string().min(1).describe("ID do agente a ser responsável"),
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
          acao: "Atribuir sessão",
          alvo: `Sessão ID: ${args.sessionId}`,
          campos: { agente: args.agentId },
        });
      }
      try {
        const result = await sessions.assign({ sessionId: args.sessionId, agentId: args.agentId });
        return buildSuccess("Sessão atribuída com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sessão '${args.sessionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_transfer_session ──────────────────────────────────────────────────

  server.tool(
    "bucks_transfer_session",
    "Transfere uma sessão para outro agente ou departamento. Ação sensível — exige prévia reforçada e confirmação.",
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
      agentId: z.string().optional().describe("ID do agente de destino"),
      departmentId: z.string().optional().describe("ID do departamento de destino"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.agentId && !args.departmentId) {
        return buildError("Informe ao menos agentId ou departmentId para a transferência.");
      }
      if (!args.confirmed) {
        const campos: Record<string, unknown> = {};
        if (args.agentId) campos["agente destino"] = args.agentId;
        if (args.departmentId) campos["departamento destino"] = args.departmentId;
        return buildPreview({
          acao: "Transferir sessão",
          alvo: `Sessão ID: ${args.sessionId}`,
          campos,
          aviso: "A sessão será removida do atendente atual e transferida.",
        });
      }
      try {
        const result = await sessions.transfer({
          sessionId: args.sessionId,
          agentId: args.agentId,
          departmentId: args.departmentId,
        });
        return buildSuccess("Sessão transferida com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sessão '${args.sessionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_set_session_status ────────────────────────────────────────────────

  server.tool(
    "bucks_set_session_status",
    "Altera o status de uma sessão (ex: open, pending, resolved). Exige prévia e confirmação.",
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
      status: z.string().min(1).describe("Novo status (ex: open, pending, resolved)"),
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
          acao: "Alterar status da sessão",
          alvo: `Sessão ID: ${args.sessionId}`,
          campos: { "novo status": args.status },
        });
      }
      try {
        const result = await sessions.setStatus({ sessionId: args.sessionId, status: args.status });
        return buildSuccess("Status atualizado com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sessão '${args.sessionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_close_session ─────────────────────────────────────────────────────

  server.tool(
    "bucks_close_session",
    "Conclui (encerra) uma sessão. Ação sensível e irreversível — exige prévia reforçada e confirmação.",
    {
      sessionId: z.string().min(1).describe("ID da sessão a concluir"),
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
          acao: "Concluir sessão",
          alvo: `Sessão ID: ${args.sessionId}`,
          aviso: "A sessão será encerrada. Esta ação não pode ser desfeita.",
        });
      }
      try {
        const result = await sessions.complete(args.sessionId);
        return buildSuccess("Sessão concluída com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sessão '${args.sessionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_add_session_note ──────────────────────────────────────────────────

  server.tool(
    "bucks_add_session_note",
    "Adiciona uma nota interna a uma sessão (não visível ao cliente). Exige prévia e confirmação.",
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
      text: z.string().min(1).describe("Texto da nota interna"),
      confirmed: z.boolean().optional().describe("true para confirmar e salvar a nota"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Adicionar nota interna",
          alvo: `Sessão ID: ${args.sessionId}`,
          campos: { nota: args.text },
        });
      }
      try {
        const result = await sessions.addNote({ sessionId: args.sessionId, text: args.text });
        return buildSuccess("Nota adicionada com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sessão '${args.sessionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_session ────────────────────────────────────────────────────

  server.tool(
    "bucks_update_session",
    "Atualiza parcialmente uma sessão (apenas os campos listados em 'fields'). Exige prévia e confirmação.",
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
      attrs: z.record(z.unknown()).describe("Campos a atualizar (chave-valor)"),
      fields: z.array(z.string()).min(1).describe("Lista dos nomes dos campos que serão atualizados"),
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
          acao: "Atualizar sessão parcialmente",
          alvo: `Sessão ID: ${args.sessionId}`,
          campos: { campos: args.fields, valores: args.attrs },
        });
      }
      try {
        const result = await sessions.update(args.sessionId, args.attrs, args.fields);
        return buildSuccess("Sessão atualizada com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sessão '${args.sessionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_list_session_notes ────────────────────────────────────────────────

  server.tool(
    "bucks_list_session_notes",
    "Lista todas as notas internas de uma sessão.",
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const notes = await sessions.listNotes(args.sessionId);
        return mcpOk({ notes, count: notes.length });
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Sessão '${args.sessionId}' não encontrada.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_get_session_note ──────────────────────────────────────────────────

  server.tool(
    "bucks_get_session_note",
    "Obtém uma nota interna de sessão pelo ID da nota.",
    {
      noteId: z.string().min(1).describe("ID da nota"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const note = await sessions.getNote(args.noteId);
        return mcpOk(note);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Nota '${args.noteId}' não encontrada.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_delete_session_note ───────────────────────────────────────────────

  server.tool(
    "bucks_delete_session_note",
    "Exclui uma nota interna de sessão. Ação irreversível — exige prévia e confirmação.",
    {
      noteId: z.string().min(1).describe("ID da nota a excluir"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar a exclusão"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Excluir nota de sessão",
          alvo: `Nota ID: ${args.noteId}`,
          aviso: "A nota será excluída permanentemente. Esta ação não pode ser desfeita.",
        });
      }
      try {
        await sessions.deleteNote(args.noteId);
        return buildSuccess("Nota excluída com sucesso.");
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Nota '${args.noteId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_reply_session_sync ────────────────────────────────────────────────

  server.tool(
    "bucks_reply_session_sync",
    "Envia uma resposta de texto em uma sessão de forma síncrona (aguarda confirmação do canal, até ~25s). Exige prévia e confirmação.",
    {
      sessionId: z.string().min(1).describe("ID da sessão"),
      text: z.string().min(1).describe("Texto da mensagem a enviar"),
      confirmed: z.boolean().optional().describe("true para confirmar e enviar a mensagem"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return buildError((err as Error).message);
      }
      if (!args.confirmed) {
        return buildPreview({
          acao: "Responder sessão (síncrono)",
          alvo: `Sessão ID: ${args.sessionId}`,
          campos: { mensagem: args.text },
          aviso: "Aguarda confirmação do canal por até 25 segundos.",
        });
      }
      try {
        const result = await sessions.replySync({ sessionId: args.sessionId, text: args.text });
        return buildSuccess("Mensagem enviada com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sessão '${args.sessionId}' não encontrada.`);
        return buildError((err as Error).message);
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

  // ── bucks_send_outbound ─────────────────────────────────────────────────────

  server.tool(
    "bucks_send_outbound",
    "Inicia uma mensagem outbound para um número de telefone. Suporta contato existente ou criação de contato novo no mesmo fluxo. Ação sensível — exige prévia reforçada e confirmação. Apenas papéis 'commercial' e 'admin' podem usar esta tool.",
    {
      phone: z.string().describe("Telefone do destinatário em formato internacional (ex: +5511999999999)"),
      text: z.string().min(1).describe("Texto da mensagem outbound"),
      channel: z.string().optional().describe("ID do canal de envio (usa canal padrão se omitido)"),
      newContact: z
        .object({
          name: z.string().min(1).describe("Nome completo do novo contato"),
          origin: z.string().min(1).describe("Origem do contato (ex: evento, site, indicação)"),
          tags: z.array(z.string()).optional().describe("Etiquetas opcionais para o novo contato"),
        })
        .optional()
        .describe("Preencha para criar um novo contato antes de enviar. Omita se o contato já existe."),
      confirmed: z.boolean().optional().describe("true para confirmar e executar o envio"),
    },
    async (args) => {
      const ctx = (() => {
        try { return getContext(); } catch { return null; }
      })();
      if (!ctx) return buildError("Contexto de requisição não disponível.");

      const defaultChannel = config.DEFAULT_CHANNEL;
      const input = {
        phone: args.phone,
        channel: args.channel,
        defaultChannel,
        message: args.text,
        newContact: args.newContact,
      };

      // Validate input
      const validationError = validateOutboundInput(input);
      if (validationError) return validationError;

      const resolvedChannel = (args.channel ?? defaultChannel)!;
      const contactName = args.newContact?.name ?? args.phone;

      // Preview (unconfirmed)
      if (!args.confirmed) {
        return buildOutboundPreview(input, contactName);
      }

      // Execute
      try {
        // If new contact, create it first
        if (args.newContact) {
          await contacts.create({
            name: args.newContact.name,
            phone: args.phone,
            tags: args.newContact.origin
              ? [args.newContact.origin, ...(args.newContact.tags ?? [])]
              : args.newContact.tags,
          });
        }

        const result = await sessions.sendOutbound({
          phone: args.phone,
          channel: resolvedChannel,
          text: args.text,
        });

        const successMsg = args.newContact
          ? `Contato criado e mensagem outbound enviada para ${contactName} (${args.phone}).`
          : `Mensagem outbound enviada para ${contactName} (${args.phone}).`;

        return buildSuccess(successMsg, result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );
}
