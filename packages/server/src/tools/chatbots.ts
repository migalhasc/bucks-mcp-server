/**
 * MCP tool handlers for Chatbots / Automations.
 * Tools: bucks_list_chatbots
 */

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { chatbots } from "../flwchat/chatbots.js";
import { assertToolAllowed } from "../rbac.js";
import { requestContext } from "../request-context.js";
import { buildError } from "../confirmation.js";

function mcpOk(data: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }] };
}

function getContext() {
  const ctx = requestContext.getStore();
  if (!ctx) throw new Error("Contexto de requisição não disponível.");
  return ctx;
}

export function registerChatbotTools(server: McpServer): void {
  // ── bucks_list_chatbots ─────────────────────────────────────────────────────

  server.tool(
    "bucks_list_chatbots",
    "Lista todos os chatbots e automações configurados na conta FlwChat.",
    {},
    async () => {
      try {
        const { userRole } = getContext();
        assertToolAllowed(userRole as "commercial" | "cs" | "admin", "bucks_list_chatbots");
      } catch (err) {
        return buildError((err as Error).message);
      }

      try {
        const list = await chatbots.listChatbots();
        return mcpOk({ chatbots: list, count: list.length });
      } catch (err) {
        return buildError((err as Error).message);
      }
    },
  );
}
