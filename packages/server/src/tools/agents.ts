/**
 * MCP tool handlers for agent CRUD operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { agents } from "../flwchat/agents.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";

export function registerAgentTools(server: McpServer): void {
  // ── bucks_create_agent ──────────────────────────────────────────────────────

  server.tool(
    "bucks_create_agent",
    "Cria um novo agente na plataforma. Exige prévia e confirmação.",
    {
      name: z.string().min(1).describe("Nome do agente"),
      email: z.string().email().describe("E-mail do agente"),
      password: z.string().optional().describe("Senha inicial (opcional)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Criar agente",
          alvo: args.name,
          campos: { email: args.email },
        });
      }
      try {
        const { name, email, password } = args;
        const result = await agents.createAgent({ name, email, ...(password ? { password } : {}) });
        return buildSuccess("Agente criado com sucesso.", result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_agent ──────────────────────────────────────────────────────

  server.tool(
    "bucks_update_agent",
    "Atualiza os dados de um agente. Exige prévia e confirmação.",
    {
      agentId: z.string().min(1).describe("ID do agente"),
      name: z.string().optional().describe("Novo nome"),
      email: z.string().email().optional().describe("Novo e-mail"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar agente",
          alvo: `Agente ID: ${args.agentId}`,
          campos: {
            ...(args.name ? { nome: args.name } : {}),
            ...(args.email ? { email: args.email } : {}),
          },
        });
      }
      try {
        const { agentId, name, email } = args;
        const params: Record<string, unknown> = {};
        if (name) params.name = name;
        if (email) params.email = email;
        const result = await agents.updateAgent(agentId, params);
        return buildSuccess("Agente atualizado com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Agente '${args.agentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_delete_agent ──────────────────────────────────────────────────────

  server.tool(
    "bucks_delete_agent",
    "Exclui um agente permanentemente. Ação sensível — exige prévia e confirmação.",
    {
      agentId: z.string().min(1).describe("ID do agente"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Excluir agente",
          alvo: `Agente ID: ${args.agentId}`,
          campos: {},
          aviso: "Esta ação é irreversível. O agente será permanentemente removido.",
        });
      }
      try {
        const result = await agents.deleteAgent(args.agentId);
        return buildSuccess("Agente excluído com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Agente '${args.agentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_update_agent_departments ─────────────────────────────────────────

  server.tool(
    "bucks_update_agent_departments",
    "Atualiza os departamentos vinculados a um agente. Exige prévia e confirmação.",
    {
      agentId: z.string().min(1).describe("ID do agente"),
      departmentIds: z.array(z.string()).describe("IDs dos departamentos"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar departamentos do agente",
          alvo: `Agente ID: ${args.agentId}`,
          campos: { departamentos: args.departmentIds },
        });
      }
      try {
        const result = await agents.updateAgentDepartments(args.agentId, args.departmentIds);
        return buildSuccess("Departamentos do agente atualizados com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Agente '${args.agentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_set_agent_status ──────────────────────────────────────────────────

  server.tool(
    "bucks_set_agent_status",
    "Define o status de presença de um agente. Exige prévia e confirmação.",
    {
      agentId: z.string().min(1).describe("ID do agente"),
      status: z.string().min(1).describe("Novo status (ex: online, offline, busy)"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Definir status do agente",
          alvo: `Agente ID: ${args.agentId}`,
          campos: { status: args.status },
        });
      }
      try {
        const result = await agents.setAgentStatus(args.agentId, args.status);
        return buildSuccess("Status do agente atualizado com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Agente '${args.agentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_logout_agent ──────────────────────────────────────────────────────

  server.tool(
    "bucks_logout_agent",
    "Desconecta (faz logout) um agente da plataforma. Exige prévia e confirmação.",
    {
      agentId: z.string().min(1).describe("ID do agente"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Desconectar agente",
          alvo: `Agente ID: ${args.agentId}`,
          campos: {},
        });
      }
      try {
        const result = await agents.logoutAgent(args.agentId);
        return buildSuccess("Agente desconectado com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Agente '${args.agentId}' não encontrado.`);
        return buildError((err as Error).message);
      }
    },
  );
}
