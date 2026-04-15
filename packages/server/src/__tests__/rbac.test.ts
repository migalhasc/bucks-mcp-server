/**
 * RBAC unit tests — simplified: email→token lookup only.
 */

import { assertRegisteredEmail, resolveFlwchatToken, RbacError } from "../rbac.js";

describe("assertRegisteredEmail", () => {
  test("throws RbacError for unknown email", () => {
    expect(() => assertRegisteredEmail("unknown@example.com")).toThrow(RbacError);
    expect(() => assertRegisteredEmail("unknown@example.com")).toThrow(/não encontrado/);
  });

  test("does not throw for registered email", () => {
    expect(() => assertRegisteredEmail("miguel@blankschool.com.br")).not.toThrow();
  });
});

describe("resolveFlwchatToken", () => {
  test("returns token for registered email", () => {
    const token = resolveFlwchatToken("miguel@blankschool.com.br");
    expect(typeof token).toBe("string");
    expect(token!.length).toBeGreaterThan(0);
  });

  test("returns undefined for unknown email", () => {
    expect(resolveFlwchatToken("nobody@example.com")).toBeUndefined();
  });
});
