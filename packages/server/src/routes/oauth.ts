/**
 * OAuth 2.1 shim for Claude Desktop compatibility.
 * Implements dynamic client registration (RFC 7591), authorization, and token exchange.
 * Maps to existing email/password -> permanent token flow.
 */

import { Router, Request, Response, IRouter } from "express";
import express from "express";
import { randomBytes, randomUUID } from "node:crypto";
import { createPermanentToken } from "../session-store.js";
import { resolveRole, resolveFlwchatToken, RbacError } from "../rbac.js";
import { logger } from "../logger.js";

export const oauthRouter: IRouter = Router();
oauthRouter.use(express.urlencoded({ extended: false }));

const clients = new Map<string, { clientId: string; redirectUris: string[] }>();
const authCodes = new Map<string, { clientId: string; email: string; role: string; redirectUri: string; expiresAt: number }>();

// ── RFC 8414: Authorization Server Metadata ──────────────────────────────────

oauthRouter.get("/.well-known/oauth-authorization-server", (req: Request, res: Response) => {
  const issuer = `${req.protocol}://${req.get("host")}`;
  res.json({
    issuer,
    authorization_endpoint: `${issuer}/authorize`,
    token_endpoint: `${issuer}/token`,
    registration_endpoint: `${issuer}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  });
});

// ── RFC 7591: Dynamic Client Registration ────────────────────────────────────

oauthRouter.post("/register", (req: Request, res: Response) => {
  const { redirect_uris, client_name } = req.body ?? {};
  const clientId = randomUUID();
  const redirectUris = Array.isArray(redirect_uris) ? redirect_uris : [];
  clients.set(clientId, { clientId, redirectUris });
  logger.info({ clientId, client_name }, "oauth client registered");
  res.status(201).json({
    client_id: clientId,
    client_name: client_name ?? "mcp-client",
    redirect_uris: redirectUris,
    grant_types: ["authorization_code"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
  });
});

// ── Authorization Endpoint ───────────────────────────────────────────────────

oauthRouter.get("/authorize", (req: Request, res: Response) => {
  const { client_id, redirect_uri, state } = req.query as Record<string, string>;
  if (!client_id || !redirect_uri) {
    res.status(400).json({ error: "client_id and redirect_uri required" });
    return;
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(authorizeHtml(client_id, redirect_uri, state ?? ""));
});

oauthRouter.post("/authorize", (req: Request, res: Response) => {
  const { client_id, redirect_uri, state, email, password } = req.body ?? {};

  if (!email || !password) {
    res.status(400).json({ error: "email e password obrigatorios" });
    return;
  }

  if (password !== "Blank1234") {
    res.status(401).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(errorHtml("Senha incorreta", client_id, redirect_uri, state));
    return;
  }

  let role: string;
  try {
    role = resolveRole(email);
  } catch (err) {
    if (err instanceof RbacError) {
      res.status(403).setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(errorHtml("Acesso negado para " + email, client_id, redirect_uri, state));
      return;
    }
    throw err;
  }

  const flwchatToken = resolveFlwchatToken(email);
  if (!flwchatToken) {
    res.status(403).setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(errorHtml("Token FlwChat nao configurado", client_id, redirect_uri, state));
    return;
  }

  const code = randomBytes(32).toString("hex");
  authCodes.set(code, {
    clientId: client_id,
    email,
    role,
    redirectUri: redirect_uri,
    expiresAt: Date.now() + 5 * 60 * 1000,
  });

  logger.info({ email, role, clientId: client_id }, "oauth code issued");

  const url = new URL(redirect_uri);
  url.searchParams.set("code", code);
  if (state) url.searchParams.set("state", state);
  res.redirect(302, url.toString());
});

// ── Token Endpoint ───────────────────────────────────────────────────────────

oauthRouter.post("/token", (req: Request, res: Response) => {
  const { grant_type, code } = req.body ?? {};

  if (grant_type !== "authorization_code") {
    res.status(400).json({ error: "unsupported_grant_type" });
    return;
  }

  const authCode = authCodes.get(code);
  if (!authCode) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code expired or invalid" });
    return;
  }

  authCodes.delete(code);

  if (Date.now() > authCode.expiresAt) {
    res.status(400).json({ error: "invalid_grant", error_description: "Code expired" });
    return;
  }

  const flwchatToken = resolveFlwchatToken(authCode.email);
  if (!flwchatToken) {
    res.status(500).json({ error: "server_error" });
    return;
  }

  const accessToken = createPermanentToken(authCode.email, authCode.role, flwchatToken);
  logger.info({ email: authCode.email, role: authCode.role }, "oauth token issued");

  res.json({
    access_token: accessToken,
    token_type: "Bearer",
    scope: "mcp",
  });
});

// ── HTML helpers ─────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function authorizeHtml(clientId: string, redirectUri: string, state: string): string {
  return '<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"><title>Bucks MCP - Autorizar</title><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:-apple-system,sans-serif;background:#0a0a0a;color:#ededed;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px}.card{background:#111;border:1px solid #222;border-radius:12px;padding:32px;max-width:400px;width:100%}h1{font-size:20px;font-weight:600;margin-bottom:4px}.sub{font-size:14px;color:#666;margin-bottom:24px}.field{margin-bottom:16px}label{display:block;font-size:13px;color:#ccc;margin-bottom:6px}input{width:100%;padding:10px 12px;background:#0a0a0a;border:1px solid #2a2a2a;border-radius:8px;color:#fff;font-size:14px;outline:none}input:focus{border-color:#3ecf8e}.btn{width:100%;padding:11px;background:#3ecf8e;color:#0a0a0a;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;margin-top:8px}.btn:hover{background:#33b87a}</style></head><body><div class="card"><h1>Bucks MCP</h1><p class="sub">Autorize o acesso ao seu cliente LLM</p><form method="POST" action="/authorize"><input type="hidden" name="client_id" value="' + esc(clientId) + '"><input type="hidden" name="redirect_uri" value="' + esc(redirectUri) + '"><input type="hidden" name="state" value="' + esc(state) + '"><div class="field"><label>Email</label><input name="email" type="email" placeholder="seu@email.com" required></div><div class="field"><label>Senha</label><input name="password" type="password" required></div><button type="submit" class="btn">Autorizar</button></form></div></body></html>';
}

function errorHtml(message: string, clientId: string, redirectUri: string, state: string): string {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Erro</title><style>body{font-family:sans-serif;background:#0a0a0a;color:#ededed;display:flex;align-items:center;justify-content:center;min-height:100vh}.card{background:#111;border:1px solid #222;border-radius:12px;padding:32px;max-width:400px;text-align:center}.err{color:#f87171;margin-bottom:16px}a{color:#3ecf8e}</style></head><body><div class="card"><p class="err">' + esc(message) + '</p><a href="/authorize?client_id=' + esc(clientId) + '&redirect_uri=' + encodeURIComponent(redirectUri) + '&state=' + esc(state) + '">Tentar novamente</a></div></body></html>';
}
