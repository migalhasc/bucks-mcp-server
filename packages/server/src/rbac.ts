/**
 * RBAC module: loads roles.yaml, resolves user role by email,
 * and checks whether a given tool is permitted for that role.
 */

import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Schema ────────────────────────────────────────────────────────────────

const UserEntrySchema = z.union([
  z.string(), // legacy: email: "role"
  z.object({ role: z.string(), flwchatToken: z.string().optional() }),
]);

const RbacConfigSchema = z.object({
  users: z.record(z.string(), UserEntrySchema),
  roles: z.record(
    z.string(),
    z.object({
      allowed_tools: z.union([z.literal("*"), z.array(z.string())]),
    }),
  ),
});

type RbacConfig = z.infer<typeof RbacConfigSchema>;

function userRole(entry: z.infer<typeof UserEntrySchema>): string {
  return typeof entry === "string" ? entry : entry.role;
}

function userFlwchatToken(entry: z.infer<typeof UserEntrySchema>): string | undefined {
  return typeof entry === "string" ? undefined : entry.flwchatToken;
}

export type Role = "commercial" | "cs" | "admin";

// ─── Loader ────────────────────────────────────────────────────────────────

let _config: RbacConfig | null = null;

function loadRbacConfig(): RbacConfig {
  if (_config) return _config;

  // Resolve from package root (one level above src/)
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

// Allow tests to reset the config cache
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
 * Resolves the role for a given email.
 * Throws RbacError if the email has no role configured.
 */
export function resolveRole(email: string): Role {
  const cfg = loadRbacConfig();
  const entry = cfg.users[email];
  if (!entry) {
    throw new RbacError(
      `Usuário '${email}' não encontrado na configuração de papéis. Contate o administrador para liberar acesso.`,
    );
  }
  const role = userRole(entry);
  if (!cfg.roles[role]) {
    throw new RbacError(
      `Papel '${role}' configurado para '${email}' não existe na definição de papéis.`,
    );
  }
  return role as Role;
}

/**
 * Returns the FlwChat token configured for a user, if any.
 */
export function resolveFlwchatToken(email: string): string | undefined {
  const cfg = loadRbacConfig();
  const entry = cfg.users[email];
  if (!entry) return undefined;
  return userFlwchatToken(entry);
}

/**
 * Checks whether a role is allowed to call a tool.
 * Throws RbacError if the role does not have access.
 */
export function assertToolAllowed(role: Role, toolName: string): void {
  const cfg = loadRbacConfig();
  const roleDef = cfg.roles[role];
  if (!roleDef) {
    throw new RbacError(`Papel desconhecido: ${role}`);
  }

  if (roleDef.allowed_tools === "*") return; // admin

  if (!roleDef.allowed_tools.includes(toolName)) {
    throw new RbacError(
      `Permissão negada: o papel '${role}' não tem acesso à tool '${toolName}'.`,
    );
  }
}

/**
 * Returns the list of tools allowed for a role.
 * Returns null if the role has access to all tools ("*").
 */
export function getAllowedTools(role: Role): string[] | null {
  const cfg = loadRbacConfig();
  const roleDef = cfg.roles[role];
  if (!roleDef) return [];
  if (roleDef.allowed_tools === "*") return null;
  return roleDef.allowed_tools;
}
