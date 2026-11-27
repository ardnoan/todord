import { describe, expect, it } from "vitest";
import type { User } from "@supabase/supabase-js";
import { isAdminUser } from "../useAppParameters";

function makeUser(overrides: Partial<User>): User {
  return {
    id: "user-1",
    app_metadata: {},
    user_metadata: {},
    aud: "authenticated",
    created_at: "2026-11-27T00:00:00.000Z",
    email: "user@example.com",
    ...overrides,
  };
}

describe("isAdminUser", () => {
  it("returns false for null user or regular user", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser(makeUser({}))).toBe(false);
  });

  it("rejects user_metadata.role = 'admin' to prevent client privilege escalation", () => {
    const spoofed = makeUser({
      user_metadata: { role: "admin" },
      app_metadata: { role: "user" },
    });
    expect(isAdminUser(spoofed)).toBe(false);
  });

  it("grants admin only when app_metadata.role === 'admin'", () => {
    const realAdmin = makeUser({
      app_metadata: { role: "admin" },
    });
    expect(isAdminUser(realAdmin)).toBe(true);
  });
});
