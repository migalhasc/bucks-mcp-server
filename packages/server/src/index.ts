import { config } from "./config.js";
import { logger } from "./logger.js";
import { createApp, createMcpServer } from "./server.js";

const mcpServer = createMcpServer();
const app = createApp(mcpServer);

const httpServer = app.listen(config.PORT, () => {
  logger.info(
    { port: config.PORT, env: config.NODE_ENV },
    "bucks-mcp-server started",
  );
});

process.on("SIGTERM", () => {
  logger.info("SIGTERM received, shutting down");
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  logger.info("SIGINT received, shutting down");
  httpServer.close(() => {
    logger.info("HTTP server closed");
    process.exit(0);
  });
});
