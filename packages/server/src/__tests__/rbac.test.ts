/**
 * RBAC unit tests — uses the real roles.yaml for correctness.
 */

import { resolveRole, assertToolAllowed, getAllowedTools, RbacError } from "../rbac.js";

describe("resolveRole", () => {
  test("throws RbacError for unknown email", () => {
    expect(() => resolveRole("unknown@example.com")).toThrow(RbacError);
    expect(() => resolveRole("unknown@example.com")).toThrow(/não encontrado/);
  });
});

describe("assertToolAllowed – admin", () => {
  test("admin can access any tool", () => {
    // admin has allowed_tools: "*" in roles.yaml
    // We add a fake user mapping to test this via getRoleFromEmail isn't available,
    // but we can call assertToolAllowed directly with the "admin" role string.
    expect(() => assertToolAllowed("admin", "bucks_find_contact_by_phone")).not.toThrow();
    expect(() => assertToolAllowed("admin", "bucks_close_session")).not.toThrow();
    expect(() => assertToolAllowed("admin", "bucks_any_future_tool")).not.toThrow();
  });
});

describe("assertToolAllowed – commercial", () => {
  test("commercial can read contacts", () => {
    expect(() => assertToolAllowed("commercial", "bucks_find_contact_by_phone")).not.toThrow();
    expect(() => assertToolAllowed("commercial", "bucks_search_contacts")).not.toThrow();
  });

  test("commercial can write contacts", () => {
    expect(() => assertToolAllowed("commercial", "bucks_create_contact")).not.toThrow();
    expect(() => assertToolAllowed("commercial", "bucks_update_contact")).not.toThrow();
  });

  test("commercial can reply sessions", () => {
    expect(() => assertToolAllowed("commercial", "bucks_reply_session")).not.toThrow();
  });

  test("commercial can send outbound", () => {
    expect(() => assertToolAllowed("commercial", "bucks_send_outbound")).not.toThrow();
  });

  test("commercial is blocked from CS operations", () => {
    expect(() => assertToolAllowed("commercial", "bucks_assign_session")).toThrow(RbacError);
    expect(() => assertToolAllowed("commercial", "bucks_transfer_session")).toThrow(RbacError);
    expect(() => assertToolAllowed("commercial", "bucks_close_session")).toThrow(RbacError);
    expect(() => assertToolAllowed("commercial", "bucks_set_session_status")).toThrow(RbacError);
  });

  test("RbacError message mentions 'Permissão negada'", () => {
    expect(() => assertToolAllowed("commercial", "bucks_assign_session")).toThrow(/Permissão negada/);
  });
});

describe("assertToolAllowed – cs", () => {
  test("cs can read sessions and contacts", () => {
    expect(() => assertToolAllowed("cs", "bucks_list_sessions")).not.toThrow();
    expect(() => assertToolAllowed("cs", "bucks_get_session")).not.toThrow();
    expect(() => assertToolAllowed("cs", "bucks_find_contact_by_phone")).not.toThrow();
  });

  test("cs can perform session operations", () => {
    expect(() => assertToolAllowed("cs", "bucks_assign_session")).not.toThrow();
    expect(() => assertToolAllowed("cs", "bucks_transfer_session")).not.toThrow();
    expect(() => assertToolAllowed("cs", "bucks_close_session")).not.toThrow();
    expect(() => assertToolAllowed("cs", "bucks_add_session_note")).not.toThrow();
  });

  test("cs cannot send outbound", () => {
    expect(() => assertToolAllowed("cs", "bucks_send_outbound")).toThrow(RbacError);
  });

  test("cs cannot write contacts", () => {
    expect(() => assertToolAllowed("cs", "bucks_create_contact")).toThrow(RbacError);
    expect(() => assertToolAllowed("cs", "bucks_update_contact")).toThrow(RbacError);
  });

  test("cs cannot write CRM cards", () => {
    expect(() => assertToolAllowed("cs", "bucks_create_card")).toThrow(RbacError);
    expect(() => assertToolAllowed("cs", "bucks_move_card")).toThrow(RbacError);
  });
});

describe("getAllowedTools", () => {
  test("returns null for admin (all tools)", () => {
    expect(getAllowedTools("admin")).toBeNull();
  });

  test("returns array for commercial", () => {
    const tools = getAllowedTools("commercial");
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toContain("bucks_find_contact_by_phone");
    expect(tools).not.toContain("bucks_assign_session");
  });

  test("returns array for cs", () => {
    const tools = getAllowedTools("cs");
    expect(Array.isArray(tools)).toBe(true);
    expect(tools).toContain("bucks_assign_session");
    expect(tools).not.toContain("bucks_send_outbound");
  });
});
