/**
 * MCP tool handlers for sequence operations.
 * Tools: bucks_list_sequences, bucks_list_sequence_contacts,
 *        bucks_add_sequence_contact, bucks_remove_sequence_contact
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { sequences } from "../flwchat/sequences.js";
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

export function registerSequenceTools(server: McpServer): void {
  // ── bucks_list_sequences ────────────────────────────────────────────────────

  server.tool(
    "bucks_list_sequences",
    "Lista todas as sequências (cadências) configuradas na conta.",
    {},
    async () => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const list = await sequences.listSequences();
        return mcpOk({ sequences: list, count: list.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_list_sequence_contacts ────────────────────────────────────────────

  server.tool(
    "bucks_list_sequence_contacts",
    "Lista os contatos inscritos em uma sequência.",
    {
      sequenceId: z.string().min(1).describe("ID da sequência"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const list = await sequences.listSequenceContacts(args.sequenceId);
        return mcpOk({ contacts: list, count: list.length });
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Sequência '${args.sequenceId}' não encontrada.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_add_sequence_contact ──────────────────────────────────────────────

  server.tool(
    "bucks_add_sequence_contact",
    "Inscreve um contato em uma sequência. Exige prévia e confirmação.",
    {
      sequenceId: z.string().min(1).describe("ID da sequência"),
      contactId: z.string().min(1).describe("ID do contato"),
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
          acao: "Inscrever contato na sequência",
          alvo: `Sequência ID: ${args.sequenceId}`,
          campos: { "contato ID": args.contactId },
        });
      }
      try {
        const result = await sequences.addContact(args.sequenceId, args.contactId);
        return buildSuccess("Contato inscrito na sequência com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sequência ou contato não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_remove_sequence_contact ───────────────────────────────────────────

  server.tool(
    "bucks_remove_sequence_contact",
    "Remove um contato de uma sequência, cancelando a cadência ativa. Ação sensível — exige prévia e confirmação.",
    {
      sequenceId: z.string().min(1).describe("ID da sequência"),
      contactId: z.string().min(1).describe("ID do contato"),
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
          acao: "Remover contato da sequência",
          alvo: `Sequência ID: ${args.sequenceId}`,
          campos: { "contato ID": args.contactId },
          aviso: "A cadência ativa do contato será cancelada. Esta ação não pode ser desfeita.",
        });
      }
      try {
        const result = await sequences.removeContact(args.sequenceId, args.contactId);
        return buildSuccess("Contato removido da sequência com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Sequência ou contato não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );
}
