/**
 * In-memory session store.
 * Each MCP session maps a random bearer token → user context (email, role, flwchatToken).
 * Sessions expire after TTL_MS (default 8h), or never for permanent tokens.
 */

import { randomBytes } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface Session {
  email: string;
  role: string;
  flwchatToken: string;
  createdAt: number;
  expiresAt: number; // Number.MAX_SAFE_INTEGER = permanent
}

const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const store = new Map<string, Session>();

// Persistent token file — path relative to this source file (survives cwd changes)
const TOKENS_FILE = join(dirname(fileURLToPath(import.meta.url)), "..", "permanent-tokens.json");

function loadPermanentTokens(): void {
  if (!existsSync(TOKENS_FILE)) return;
  try {
    const raw = readFileSync(TOKENS_FILE, "utf-8");
    const entries: [string, Session][] = JSON.parse(raw);
    for (const [token, session] of entries) {
      store.set(token, session);
    }
  } catch {
    // ignore corrupt file
  }
}

function savePermanentTokens(): void {
  const permanent: [string, Session][] = [];
  for (const [token, session] of store) {
    if (session.expiresAt === Number.MAX_SAFE_INTEGER) {
      permanent.push([token, session]);
    }
  }
  writeFileSync(TOKENS_FILE, JSON.stringify(permanent, null, 2), "utf-8");
}

// Load on module init
loadPermanentTokens();

export function createSession(email: string, role: string, flwchatToken: string): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  store.set(token, { email, role, flwchatToken, createdAt: now, expiresAt: now + TTL_MS });
  return token;
}

export function createPermanentToken(email: string, role: string, flwchatToken: string): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  store.set(token, { email, role, flwchatToken, createdAt: now, expiresAt: Number.MAX_SAFE_INTEGER });
  savePermanentTokens();
  return token;
}

export function getSession(token: string): Session | null {
  const session = store.get(token);
  if (!session) return null;
  if (session.expiresAt !== Number.MAX_SAFE_INTEGER && Date.now() > session.expiresAt) {
    store.delete(token);
    return null;
  }
  return session;
}

export function deleteSession(token: string): void {
  store.delete(token);
}
