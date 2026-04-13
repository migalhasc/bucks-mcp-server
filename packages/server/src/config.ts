import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000").transform(Number),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  LOG_LEVEL: z.string().default("info"),
  FLWCHAT_API_URL: z.string().url().optional(),
  FLWCHAT_SERVICE_TOKEN: z.string().optional(),
});

function loadConfig() {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    throw new Error(`Invalid environment config: ${result.error.message}`);
  }
  return result.data;
}

export const config = loadConfig();
