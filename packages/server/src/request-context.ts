/**
 * AsyncLocalStorage-based request context.
 * Allows tool handlers to access the current HTTP request and resolved user.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import type { Request } from "express";

export interface RequestContext {
  req: Request;
  userEmail: string;
  userRole: string;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
