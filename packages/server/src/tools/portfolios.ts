/**
 * MCP tool handlers for portfolio operations.
 * Tools: bucks_list_portfolios, bucks_list_portfolio_contacts,
 *        bucks_add_portfolio_contact, bucks_remove_portfolio_contact
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { portfolios } from "../flwchat/portfolios.js";
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

export function registerPortfolioTools(server: McpServer): void {
  // ── bucks_list_portfolios ───────────────────────────────────────────────────

  server.tool(
    "bucks_list_portfolios",
    "Lista todos os portfólios configurados na conta.",
    {},
    async () => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const list = await portfolios.listPortfolios();
        return mcpOk({ portfolios: list, count: list.length });
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_list_portfolio_contacts ───────────────────────────────────────────

  server.tool(
    "bucks_list_portfolio_contacts",
    "Lista os contatos de um portfólio.",
    {
      portfolioId: z.string().min(1).describe("ID do portfólio"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
      } catch (err) {
        return mcpError((err as Error).message);
      }
      try {
        const list = await portfolios.listPortfolioContacts(args.portfolioId);
        return mcpOk({ contacts: list, count: list.length });
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Portfólio '${args.portfolioId}' não encontrado.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_add_portfolio_contact ─────────────────────────────────────────────

  server.tool(
    "bucks_add_portfolio_contact",
    "Adiciona um contato a um portfólio. Exige prévia e confirmação.",
    {
      portfolioId: z.string().min(1).describe("ID do portfólio"),
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
          acao: "Adicionar contato ao portfólio",
          alvo: `Portfólio ID: ${args.portfolioId}`,
          campos: { "contato ID": args.contactId },
        });
      }
      try {
        const result = await portfolios.addContact(args.portfolioId, args.contactId);
        return buildSuccess("Contato adicionado ao portfólio com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Portfólio ou contato não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_remove_portfolio_contact ──────────────────────────────────────────

  server.tool(
    "bucks_remove_portfolio_contact",
    "Remove um contato de um portfólio. Exige prévia e confirmação.",
    {
      portfolioId: z.string().min(1).describe("ID do portfólio"),
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
          acao: "Remover contato do portfólio",
          alvo: `Portfólio ID: ${args.portfolioId}`,
          campos: { "contato ID": args.contactId },
        });
      }
      try {
        const result = await portfolios.removeContact(args.portfolioId, args.contactId);
        return buildSuccess("Contato removido do portfólio com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Portfólio ou contato não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );
}
