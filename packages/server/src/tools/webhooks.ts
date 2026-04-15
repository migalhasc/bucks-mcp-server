/**
 * MCP tool handlers for webhook operations.
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { webhooks } from "../flwchat/webhooks.js";
import { FlwChatNotFoundError } from "../flwchat/client.js";
import { buildPreview, buildSuccess, buildError } from "../confirmation.js";

function mcpOk(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function mcpError(message: string) {
  return { content: [{ type: "text" as const, text: message }], isError: true };
}

export function registerWebhookTools(server: McpServer): void {
  // ── bucks_list_webhook_events ───────────────────────────────────────────────

  server.tool(
    "bucks_list_webhook_events",
    "Lista todos os tipos de eventos disponíveis para webhooks.",
    {},
    async () => {
      try {
        const result = await webhooks.listEvents();
        return mcpOk(result);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_list_webhook_subscriptions ───────────────────────────────────────

  server.tool(
    "bucks_list_webhook_subscriptions",
    "Lista todas as inscrições de webhook configuradas.",
    {},
    async () => {
      try {
        const result = await webhooks.listSubscriptions();
        return mcpOk(result);
      } catch (err) {
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_create_webhook_subscription ──────────────────────────────────────

  server.tool(
    "bucks_create_webhook_subscription",
    "Cria uma nova inscrição de webhook. Exige prévia e confirmação.",
    {
      url: z.string().url().describe("URL de destino do webhook"),
      events: z.array(z.string()).describe("Lista de eventos a escutar"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Criar inscrição de webhook",
          alvo: args.url,
          campos: { eventos: args.events },
        });
      }
      try {
        const result = await webhooks.createSubscription({ url: args.url, events: args.events });
        return buildSuccess("Inscrição de webhook criada com sucesso.", result);
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_get_webhook_subscription ─────────────────────────────────────────

  server.tool(
    "bucks_get_webhook_subscription",
    "Retorna os dados de uma inscrição de webhook pelo ID.",
    {
      subscriptionId: z.string().min(1).describe("ID da inscrição de webhook"),
    },
    async (args) => {
      try {
        const result = await webhooks.getSubscription(args.subscriptionId);
        return mcpOk(result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return mcpError(`Inscrição '${args.subscriptionId}' não encontrada.`);
        return mcpError((err as Error).message);
      }
    },
  );

  // ── bucks_update_webhook_subscription ──────────────────────────────────────

  server.tool(
    "bucks_update_webhook_subscription",
    "Atualiza uma inscrição de webhook. Exige prévia e confirmação.",
    {
      subscriptionId: z.string().min(1).describe("ID da inscrição de webhook"),
      url: z.string().url().optional().describe("Nova URL de destino"),
      events: z.array(z.string()).optional().describe("Nova lista de eventos"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Atualizar inscrição de webhook",
          alvo: `Inscrição ID: ${args.subscriptionId}`,
          campos: {
            ...(args.url ? { url: args.url } : {}),
            ...(args.events ? { eventos: args.events } : {}),
          },
        });
      }
      try {
        const params: Record<string, unknown> = {};
        if (args.url) params.url = args.url;
        if (args.events) params.events = args.events;
        const result = await webhooks.updateSubscription(args.subscriptionId, params);
        return buildSuccess("Inscrição de webhook atualizada com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Inscrição '${args.subscriptionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );

  // ── bucks_delete_webhook_subscription ──────────────────────────────────────

  server.tool(
    "bucks_delete_webhook_subscription",
    "Exclui uma inscrição de webhook permanentemente. Ação sensível — exige prévia e confirmação.",
    {
      subscriptionId: z.string().min(1).describe("ID da inscrição de webhook"),
      confirmed: z.boolean().optional().describe("true para confirmar e executar"),
    },
    async (args) => {
      if (!args.confirmed) {
        return buildPreview({
          acao: "Excluir inscrição de webhook",
          alvo: `Inscrição ID: ${args.subscriptionId}`,
          campos: {},
          aviso: "Esta ação é irreversível. O webhook deixará de receber eventos.",
        });
      }
      try {
        const result = await webhooks.deleteSubscription(args.subscriptionId);
        return buildSuccess("Inscrição de webhook excluída com sucesso.", result);
      } catch (err) {
        if (err instanceof FlwChatNotFoundError) return buildError(`Inscrição '${args.subscriptionId}' não encontrada.`);
        return buildError((err as Error).message);
      }
    },
  );
}
