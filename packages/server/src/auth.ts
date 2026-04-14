/**
 * Auth module: extracts and validates Bearer JWT from request headers.
 * Returns the authenticated user's email claim.
 *
 * For v1, we support two modes controlled by AUTH_MODE env var:
 *   - "jwt"    : validate RS256/ES256 JWT via JWKS_URI (default)
 *   - "static" : accept static tokens from STATIC_TOKENS env (comma-separated email:token pairs)
 *                Useful for local dev and testing without a real OAuth provider.
 */

import { createRemoteJWKSet, jwtVerify } from "jose";
import { Request } from "express";
import { config } from "./config.js";

export class AuthError extends Error {
  readonly loginUrl = "/login";
  constructor(
    message: string,
    public readonly statusCode: number = 401,
  ) {
    super(message);
    this.name = "AuthError";
  }
}

/** Parses STATIC_TOKENS env into a token→email map. */
function buildStaticTokenMap(): Map<string, string> {
  const map = new Map<string, string>();
  if (!config.STATIC_TOKENS) return map;
  for (const pair of config.STATIC_TOKENS.split(",")) {
    const [email, token] = pair.trim().split(":");
    if (email && token) map.set(token.trim(), email.trim());
  }
  return map;
}

let staticTokenMap: Map<string, string> | null = null;
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getStaticTokenMap(): Map<string, string> {
  if (!staticTokenMap) staticTokenMap = buildStaticTokenMap();
  return staticTokenMap;
}

function getJwks(): ReturnType<typeof createRemoteJWKSet> {
  if (!jwks) {
    if (!config.JWKS_URI) {
      throw new AuthError(
        "Servidor não configurado para autenticação JWT. Contate o administrador.",
        500,
      );
    }
    jwks = createRemoteJWKSet(new URL(config.JWKS_URI));
  }
  return jwks;
}

/**
 * Extracts the Bearer token from the Authorization header.
 */
function extractBearerToken(req: Request): string {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    throw new AuthError("Cabeçalho Authorization ausente. Autentique-se para continuar.");
  }
  const parts = authHeader.split(" ");
  if (parts.length !== 2 || parts[0].toLowerCase() !== "bearer") {
    throw new AuthError(
      "Formato de autorização inválido. Use: Authorization: Bearer <token>",
    );
  }
  return parts[1];
}

/**
 * Validates the token and returns { email, flwchatToken? }.
 * Checks session store first, then falls back to static/JWT modes.
 */
export async function authenticate(req: Request): Promise<{ email: string; flwchatToken?: string }> {
  const token = extractBearerToken(req);

  // Session-based auth (login page flow)
  const { getSession } = await import("./session-store.js");
  const session = getSession(token);
  if (session) {
    return { email: session.email, flwchatToken: session.flwchatToken };
  }

  if (config.AUTH_MODE === "static") {
    const map = getStaticTokenMap();
    const email = map.get(token);
    if (!email) {
      throw new AuthError("Token inválido ou não autorizado.");
    }
    return { email };
  }

  // JWT mode
  try {
    const jwks = getJwks();
    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.JWT_ISSUER,
      audience: config.JWT_AUDIENCE,
    });

    const email =
      (payload["email"] as string | undefined) ||
      (payload["sub"] as string | undefined);

    if (!email) {
      throw new AuthError(
        "Token JWT não contém e-mail ou subject. Verifique as configurações do provedor OAuth.",
      );
    }

    return { email };
  } catch (err) {
    if (err instanceof AuthError) throw err;
    throw new AuthError(
      "Token JWT inválido ou expirado. Autentique-se novamente.",
    );
  }
}
