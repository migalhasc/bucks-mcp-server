import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express, { Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { logger } from "./logger.js";
import { authenticate, AuthError } from "./auth.js";
import { resolveRole, RbacError } from "./rbac.js";
import { requestContext } from "./request-context.js";
import { registerContactTools } from "./tools/contacts.js";
import { registerSessionTools } from "./tools/sessions.js";
import { registerCrmTools } from "./tools/crm.js";

export function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "bucks-mcp-server",
    version: "0.1.0",
  });

  registerContactTools(server);
  registerSessionTools(server);
  registerCrmTools(server);

  return server;
}

export function createApp(mcpServer: McpServer): express.Application {
  const app = express();
  app.use(express.json());

  // Healthcheck
  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "bucks-mcp-server", version: "0.1.0" });
  });

  // Stateless MCP endpoint — new transport per request
  app.post("/mcp", async (req: Request, res: Response) => {
    const requestId = randomUUID();
    logger.info({ requestId, method: req.method, path: req.path }, "mcp request");

    // Authenticate and resolve role before handling the MCP request
    let userEmail: string;
    let userRole: string;
    try {
      userEmail = await authenticate(req);
      userRole = resolveRole(userEmail);
    } catch (err) {
      if (err instanceof AuthError) {
        logger.warn({ requestId, err: err.message }, "auth failed");
        res.status(err.statusCode).json({ error: err.message });
        return;
      }
      if (err instanceof RbacError) {
        logger.warn({ requestId, err: err.message }, "rbac denied");
        res.status(403).json({ error: err.message });
        return;
      }
      throw err;
    }

    logger.info({ requestId, userEmail, userRole }, "authenticated");

    try {
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      res.on("close", () => {
        transport.close().catch((err) => {
          logger.error({ requestId, err }, "transport close error");
        });
      });

      await mcpServer.connect(transport);
      await requestContext.run(
        { req, userEmail, userRole },
        () => transport.handleRequest(req, res, req.body),
      );
    } catch (err) {
      logger.error({ requestId, err }, "mcp request error");
      if (!res.headersSent) {
        res.status(500).json({ error: "Internal server error" });
      }
    }
  });

  // GET/DELETE not supported in stateless mode
  app.get("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({ error: "Use POST for stateless MCP" });
  });
  app.delete("/mcp", (_req: Request, res: Response) => {
    res.status(405).json({ error: "Use POST for stateless MCP" });
  });

  return app;
}
