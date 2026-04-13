/**
 * Auth unit tests — static mode only (no real OAuth provider needed).
 *
 * We use a test-specific config by setting env vars before importing the module.
 * Since ts-jest/ESM isolates each test file, env vars set here apply to this suite.
 */

import type { Request } from "express";
import { authenticate, AuthError } from "../auth.js";

// NOTE: static mode is activated by setting AUTH_MODE=static before running.
// In tests we call authenticate which reads config lazily, so we patch env here.
// Since config is loaded at import time in config.ts, we need a different approach:
// We test static mode by verifying the behavior given the env that's loaded.
// See jest.config.js testEnvironment — we rely on process.env set at module load.

function makeReq(authHeader?: string): Request {
  return {
    headers: authHeader ? { authorization: authHeader } : {},
  } as unknown as Request;
}

describe("AuthError", () => {
  test("is an Error subclass with statusCode", () => {
    const err = new AuthError("test message", 401);
    expect(err).toBeInstanceOf(Error);
    expect(err.message).toBe("test message");
    expect(err.statusCode).toBe(401);
    expect(err.name).toBe("AuthError");
  });

  test("defaults to 401 statusCode", () => {
    const err = new AuthError("test");
    expect(err.statusCode).toBe(401);
  });
});

describe("extractBearerToken (via authenticate)", () => {
  // These tests verify the header parsing logic independent of token validation.
  // We use a mode where any token fails validation so we get past header parsing.
  // Since AUTH_MODE may be "jwt" in the loaded config, missing header is caught first.

  test("throws AuthError when Authorization header is missing", async () => {
    await expect(authenticate(makeReq())).rejects.toThrow(AuthError);
    await expect(authenticate(makeReq())).rejects.toThrow(/ausente/);
  });

  test("throws AuthError for malformed Authorization header (no Bearer prefix)", async () => {
    await expect(authenticate(makeReq("invalid-token-only"))).rejects.toThrow(AuthError);
    await expect(authenticate(makeReq("invalid-token-only"))).rejects.toThrow(/inválido/);
  });

  test("throws AuthError for Basic auth scheme instead of Bearer", async () => {
    await expect(authenticate(makeReq("Basic dXNlcjpwYXNz"))).rejects.toThrow(AuthError);
    await expect(authenticate(makeReq("Basic dXNlcjpwYXNz"))).rejects.toThrow(/inválido/);
  });
});
