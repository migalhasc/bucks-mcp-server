/**
 * In-memory session store.
 * Each MCP session maps a random bearer token → user context (email, role, flwchatToken).
 * Sessions expire after TTL_MS (default 8h).
 */

import { randomBytes } from "node:crypto";

export interface Session {
  email: string;
  role: string;
  flwchatToken: string;
  createdAt: number;
  expiresAt: number;
}

const TTL_MS = 8 * 60 * 60 * 1000; // 8 hours
const store = new Map<string, Session>();

export function createSession(email: string, role: string, flwchatToken: string): string {
  const token = randomBytes(32).toString("hex");
  const now = Date.now();
  store.set(token, { email, role, flwchatToken, createdAt: now, expiresAt: now + TTL_MS });
  return token;
}

export function getSession(token: string): Session | null {
  const session = store.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    store.delete(token);
    return null;
  }
  return session;
}

export function deleteSession(token: string): void {
  store.delete(token);
}
