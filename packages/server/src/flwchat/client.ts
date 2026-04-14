/**
 * Central HTTP client for FlwChat (api.wts.chat).
 * Handles: Bearer auth, timeout, safe-read retry with exponential backoff,
 * 429 handling, cursor/offset pagination helpers, and error normalization.
 */

import { config } from "../config.js";
import { logger } from "../logger.js";
import { requestContext } from "../request-context.js";

// ── Error types ───────────────────────────────────────────────────────────────

export class FlwChatError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "FlwChatError";
  }
}

export class FlwChatAuthError extends FlwChatError {
  constructor(body?: unknown) {
    super("Não autorizado na FlwChat. Verifique o token de serviço.", 401, body);
    this.name = "FlwChatAuthError";
  }
}

export class FlwChatRateLimitError extends FlwChatError {
  constructor(public readonly retryAfterMs: number, body?: unknown) {
    super(
      `Limite de requisições atingido. Tente novamente em ${Math.ceil(retryAfterMs / 1000)}s.`,
      429,
      body,
    );
    this.name = "FlwChatRateLimitError";
  }
}

export class FlwChatNotFoundError extends FlwChatError {
  constructor(body?: unknown) {
    super("Recurso não encontrado.", 404, body);
    this.name = "FlwChatNotFoundError";
  }
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: unknown;
  /** Whether this request is idempotent/safe and can be retried on transient errors. Default: false */
  safe?: boolean;
}

export interface PageOptions {
  page?: number;
  pageSize?: number;
}

export interface PagedResult<T> {
  data: T[];
  total?: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const TIMEOUT_MS = 60_000;
const MAX_SAFE_RETRIES = 3;
const BACKOFF_BASE_MS = 300;
// Max pages to auto-iterate in fetchAllPages
const MAX_AUTO_PAGES = 5;

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const base = (config.FLWCHAT_API_URL ?? "https://api.wts.chat").replace(/\/$/, "");
  const url = new URL(`${base}${path}`);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null) {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function backoffMs(attempt: number): number {
  return BACKOFF_BASE_MS * Math.pow(2, attempt);
}

async function parseResponse(res: Response): Promise<unknown> {
  const ct = res.headers.get("content-type") ?? "";
  if (ct.includes("application/json")) {
    return res.json();
  }
  return res.text();
}

// ── Core request ─────────────────────────────────────────────────────────────

async function executeRequest(opts: RequestOptions): Promise<unknown> {
  // Prefer per-user token from session; fall back to global service token.
  const ctx = requestContext.getStore();
  const token = ctx?.flwchatToken ?? config.FLWCHAT_SERVICE_TOKEN;
  if (!token) {
    throw new FlwChatAuthError();
  }

  const url = buildUrl(opts.path, opts.query);
  const method = opts.method ?? "GET";
  const isSafe = opts.safe ?? method === "GET";

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const init: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(TIMEOUT_MS),
    ...(opts.body !== undefined ? { body: JSON.stringify(opts.body) } : {}),
  };

  let lastError: Error | undefined;
  const maxAttempts = isSafe ? MAX_SAFE_RETRIES : 1;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      const delay = backoffMs(attempt - 1);
      logger.debug({ url, attempt, delay }, "flwchat retry");
      await sleep(delay);
    }

    let res: Response;
    try {
      res = await fetch(url, init);
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn({ url, attempt, err: lastError.message }, "flwchat network error");
      if (!isSafe) throw lastError;
      continue;
    }

    // 429 — rate limit
    if (res.status === 429) {
      const retryAfter = res.headers.get("retry-after");
      const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 5_000;
      const body = await parseResponse(res).catch(() => undefined);
      if (!isSafe) throw new FlwChatRateLimitError(retryMs, body);
      logger.warn({ url, retryMs }, "flwchat 429, waiting before retry");
      await sleep(retryMs);
      lastError = new FlwChatRateLimitError(retryMs, body);
      continue;
    }

    // 401
    if (res.status === 401) {
      const body = await parseResponse(res).catch(() => undefined);
      throw new FlwChatAuthError(body);
    }

    // 404
    if (res.status === 404) {
      const body = await parseResponse(res).catch(() => undefined);
      throw new FlwChatNotFoundError(body);
    }

    // Other errors
    if (!res.ok) {
      const body = await parseResponse(res).catch(() => undefined);
      const msg = `FlwChat respondeu com ${res.status}`;
      logger.warn({ url, status: res.status, body }, "flwchat error response");
      if (!isSafe) throw new FlwChatError(msg, res.status, body);
      lastError = new FlwChatError(msg, res.status, body);
      // don't retry 4xx (except 429 handled above)
      if (res.status >= 400 && res.status < 500) throw lastError;
      continue;
    }

    return parseResponse(res);
  }

  throw lastError ?? new FlwChatError("Falha desconhecida na requisição FlwChat.", 0);
}

// ── Public API ────────────────────────────────────────────────────────────────

export const flwchat = {
  /** Safe GET with retry */
  get<T = unknown>(
    path: string,
    query?: RequestOptions["query"],
  ): Promise<T> {
    return executeRequest({ method: "GET", path, query, safe: true }) as Promise<T>;
  },

  /** POST — not retried */
  post<T = unknown>(path: string, body?: unknown): Promise<T> {
    return executeRequest({ method: "POST", path, body, safe: false }) as Promise<T>;
  },

  /** PUT — not retried */
  put<T = unknown>(path: string, body?: unknown): Promise<T> {
    return executeRequest({ method: "PUT", path, body, safe: false }) as Promise<T>;
  },

  /** PATCH — not retried */
  patch<T = unknown>(path: string, body?: unknown): Promise<T> {
    return executeRequest({ method: "PATCH", path, body, safe: false }) as Promise<T>;
  },

  /**
   * Iterate pages automatically (GET only, safe).
   * Stops when hasMore is false or MAX_AUTO_PAGES is reached.
   * Caller provides `extractPage` to parse the raw response into PagedResult.
   */
  async fetchAllPages<T>(
    path: string,
    baseQuery: RequestOptions["query"],
    pageSize: number,
    extractPage: (raw: unknown, page: number, pageSize: number) => PagedResult<T>,
  ): Promise<T[]> {
    const results: T[] = [];
    let page = 1;

    while (page <= MAX_AUTO_PAGES) {
      const raw = await flwchat.get(path, { ...baseQuery, page, pageSize });
      const paged = extractPage(raw, page, pageSize);
      results.push(...paged.data);
      logger.debug(
        { path, page, fetched: paged.data.length, total: paged.total },
        "flwchat page fetched",
      );
      if (!paged.hasMore) break;
      page++;
    }

    return results;
  },
};
