/**
 * MCP tool handlers for contact read operations.
 * Tools: bucks_find_contact_by_phone, bucks_search_contacts
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { contacts } from "../flwchat/contacts.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { assertToolAllowed } from "../rbac.js";
import { requestContext } from "../request-context.js";

function mcpError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

function mcpOk(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function getContext() {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error("Contexto de requisição não disponível.");
  return ctx;
}

export function registerContactTools(server: McpServer): void {
  server.tool(
    "bucks_find_contact_by_phone",
    "Busca um contato pelo número de telefone (formato internacional, ex: +5511999999999). Retorna os dados completos do contato.",
    {
      phone: z.string().describe("Número de telefone em formato internacional (ex: +5511999999999)"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_find_contact_by_phone");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        const contact = await contacts.findByPhone(args.phone);
        return mcpOk(contact);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) {
          return mcpError(`Contato com telefone '${args.phone}' não encontrado.`);
        }
        return mcpError((err as Error).message);
      }
    },
  );

  server.tool(
    "bucks_search_contacts",
    "Pesquisa contatos por nome e/ou etiquetas com paginação. Retorna lista de contatos e total encontrado. Use 'page' e 'pageSize' para controle de paginação (padrão: até 50 itens, com iteração automática de páginas).",
    {
      name: z.string().optional().describe("Filtro por nome (busca parcial)"),
      tags: z.array(z.string()).optional().describe("Filtro por etiquetas"),
      page: z.number().int().positive().optional().describe("Página específica (omita para iteração automática)"),
      pageSize: z.number().int().min(1).max(100).optional().describe("Itens por página (padrão: 50)"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_search_contacts");
      } catch (err) {
        return mcpError((err as Error).message);
      }

      try {
        const result = await contacts.search({
          name: args.name,
          tags: args.tags,
          page: args.page,
          pageSize: args.pageSize,
        });
        return mcpOk({
          contacts: result.contacts,
          total: result.total,
          count: result.contacts.length,
        });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );
}
