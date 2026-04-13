/**
 * MCP tool handlers for contact operations (read + write).
 * Tools: bucks_find_contact_by_phone, bucks_search_contacts,
 *        bucks_create_contact, bucks_update_contact, bucks_update_contact_tags
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { contacts } from "../flwchat/contacts.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { assertToolAllowed } from "../rbac.js";
import { requestContext } from "../request-context.js";
import { buildPreview, buildSuccess, buildError, buildDisambiguation } from "../confirmation.js";

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

  // ── bucks_create_contact ────────────────────────────────────────────────────

  server.tool(
    "bucks_create_contact",
    "Cria um novo contato com nome, telefone e dados opcionais. Exige prévia e confirmação explícita antes de executar. Telefone em formato internacional (ex: +5511999999999).",
    {
      name: z.string().min(1).describe("Nome completo do contato"),
      phone: z.string().describe("Telefone em formato internacional (ex: +5511999999999)"),
      email: z.string().email().optional().describe("E-mail do contato (opcional)"),
      tags: z.array(z.string()).optional().describe("Etiquetas iniciais (opcional)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar a criação"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_create_contact");
      } catch (err) {
        return buildError((err as Error).message);
      }

      if (!args.confirmed) {
        return buildPreview({
          acao: "Criar contato",
          alvo: `${args.name} (${args.phone})`,
          campos: {
            nome: args.name,
            telefone: args.phone,
            ...(args.email ? { email: args.email } : {}),
            ...(args.tags?.length ? { etiquetas: args.tags } : {}),
          },
          aviso: "Contato novo será criado na plataforma.",
        });
      }

      try {
        const contact = await contacts.create({
          name: args.name,
          phone: args.phone,
          email: args.email,
          tags: args.tags,
        });
        return buildSuccess(`Contato criado com sucesso.`, contact);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_contact ────────────────────────────────────────────────────

  server.tool(
    "bucks_update_contact",
    "Atualiza dados de um contato existente (nome, e-mail ou etiquetas) pelo ID. Exige prévia e confirmação. Use bucks_find_contact_by_phone para obter o ID do contato.",
    {
      id: z.string().min(1).describe("ID do contato"),
      name: z.string().min(1).optional().describe("Novo nome"),
      email: z.string().email().optional().describe("Novo e-mail"),
      tags: z.array(z.string()).optional().describe("Nova lista de etiquetas (substitui as existentes)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar a atualização"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_update_contact");
      } catch (err) {
        return buildError((err as Error).message);
      }

      const campos: Record<string, unknown> = {};
      if (args.name) campos["nome"] = args.name;
      if (args.email) campos["email"] = args.email;
      if (args.tags) campos["etiquetas"] = args.tags;

      if (Object.keys(campos).length === 0) {
        return buildError("Nenhum campo fornecido para atualização. Informe ao menos nome, email ou tags.");
      }

      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar contato",
          alvo: `ID: ${args.id}`,
          campos,
        });
      }

      try {
        const updated = await contacts.update(args.id, {
          name: args.name,
          email: args.email,
          tags: args.tags,
        });
        return buildSuccess(`Contato atualizado com sucesso.`, updated);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) {
          return buildError(`Contato com ID '${args.id}' não encontrado.`);
        }
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_contact_tags ───────────────────────────────────────────────

  server.tool(
    "bucks_update_contact_tags",
    "Atualiza as etiquetas de um contato existente pelo ID. Substitui todas as etiquetas atuais pelas fornecidas. Exige prévia e confirmação.",
    {
      id: z.string().min(1).describe("ID do contato"),
      tags: z.array(z.string()).min(1).describe("Nova lista de etiquetas (substitui todas as existentes)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar a atualização"),
    },
    async (args) => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_update_contact_tags");
      } catch (err) {
        return buildError((err as Error).message);
      }

      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar etiquetas do contato",
          alvo: `ID: ${args.id}`,
          campos: { etiquetas: args.tags },
          aviso: "As etiquetas atuais serão substituídas pelas novas.",
        });
      }

      try {
        const updated = await contacts.updateTags(args.id, args.tags);
        return buildSuccess(`Etiquetas atualizadas com sucesso.`, updated);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) {
          return buildError(`Contato com ID '${args.id}' não encontrado.`);
        }
        return buildError((err as Error).message);
      }
    },
  );
}

export { buildDisambiguation };
