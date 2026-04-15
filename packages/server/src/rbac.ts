/**
 * RBAC module (simplified): email → flwchatToken lookup.
 * All registered emails have full access to all tools.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Schema ────────────────────────────────────────────────────────────────

const UserEntrySchema = z.object({
  flwchatToken: z.string().optional(),
});

const RbacConfigSchema = z.object({
  users: z.record(z.string(), UserEntrySchema),
});

type RbacConfig = z.infer<typeof RbacConfigSchema>;

// ─── Loader ────────────────────────────────────────────────────────────────

let _config: RbacConfig | null = null;

function loadRbacConfig(): RbacConfig {
  if (_config) return _config;
  const yamlPath = join(__dirname, "..", "roles.yaml");
  const raw = readFileSync(yamlPath, "utf-8");
  const parsed = yaml.load(raw);
  const result = RbacConfigSchema.safeParse(parsed);
  if (!result.success) {
    throw new Error(`roles.yaml inválido: ${result.error.message}`);
  }
  _config = result.data;
  return _config;
}

export function _resetRbacConfig(): void {
  _config = null;
}

// ─── Public API ────────────────────────────────────────────────────────────

export class RbacError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RbacError";
  }
}

/**
 * Returns true if the email is registered.
 * Throws RbacError if not found.
 */
export function assertRegisteredEmail(email: string): void {
  const cfg = loadRbacConfig();
  if (!cfg.users[email]) {
    throw new RbacError(
      `Usuário '${email}' não encontrado. Contate o administrador para liberar acesso.`,
    );
  }
}

/**
 * Returns the FlwChat token configured for a user, if any.
 */
export function resolveFlwchatToken(email: string): string | undefined {
  const cfg = loadRbacConfig();
  return cfg.users[email]?.flwchatToken;
}
