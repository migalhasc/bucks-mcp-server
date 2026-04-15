/**
 * MCP tool handlers for department CRUD operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { departments } from "../flwchat/departments.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";

export function registerDepartmentTools(server: McpServer): void {
  // ── bucks_create_department ─────────────────────────────────────────────────

  server.tool(
    "bucks_create_department",
    "Cria um novo departamento na plataforma. Exige prévia e confirmação.",
    {
      name: z.string().min(1).describe("Nome do departamento"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Criar departamento",
          alvo: args.name,
          campos: {},
        });
      }
      try {
        const result = await departments.createDepartment({ name: args.name });
        return buildSuccess("Departamento criado com sucesso.", result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_department ─────────────────────────────────────────────────

  server.tool(
    "bucks_update_department",
    "Atualiza os dados de um departamento. Exige prévia e confirmação.",
    {
      departmentId: z.string().min(1).describe("ID do departamento"),
      name: z.string().optional().describe("Novo nome"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar departamento",
          alvo: `Departamento ID: ${args.departmentId}`,
          campos: { ...(args.name ? { nome: args.name } : {}) },
        });
      }
      try {
        const params: Record<string, unknown> = {};
        if (args.name) params.name = args.name;
        const result = await departments.updateDepartment(args.departmentId, params);
        return buildSuccess("Departamento atualizado com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Departamento '${args.departmentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_delete_department ─────────────────────────────────────────────────

  server.tool(
    "bucks_delete_department",
    "Exclui um departamento permanentemente. Ação sensível — exige prévia e confirmação.",
    {
      departmentId: z.string().min(1).describe("ID do departamento"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Excluir departamento",
          alvo: `Departamento ID: ${args.departmentId}`,
          campos: {},
          aviso: "Esta ação é irreversível. O departamento será permanentemente removido.",
        });
      }
      try {
        const result = await departments.deleteDepartment(args.departmentId);
        return buildSuccess("Departamento excluído com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Departamento '${args.departmentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_department_agents ─────────────────────────────────────────

  server.tool(
    "bucks_update_department_agents",
    "Atualiza os agentes vinculados a um departamento. Exige prévia e confirmação.",
    {
      departmentId: z.string().min(1).describe("ID do departamento"),
      agentIds: z.array(z.string()).describe("IDs dos agentes"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar agentes do departamento",
          alvo: `Departamento ID: ${args.departmentId}`,
          campos: { agentes: args.agentIds },
        });
      }
      try {
        const result = await departments.updateDepartmentAgents(args.departmentId, args.agentIds);
        return buildSuccess("Agentes do departamento atualizados com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Departamento '${args.departmentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );
}
