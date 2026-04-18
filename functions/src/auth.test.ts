import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("firebase-admin", async () => {
  const { createFirebaseAdminMock } = await import("./__mocks__/firebase-admin-mock");
  return createFirebaseAdminMock();
});

import * as admin from "firebase-admin";
import { authenticate } from "./index";

const state = (admin as any).__state as {
  store: Map<string, Map<string, any>>;
  verifyIdToken: ReturnType<typeof vi.fn>;
};

function makeReq(token?: string) {
  return { headers: token ? { authorization: `Bearer ${token}` } : {} };
}

describe("authenticate()", () => {
  beforeEach(() => {
    state.store.clear();
    state.verifyIdToken.mockReset();
  });

  it("returns null when authorization header is missing", async () => {
    const result = await authenticate({ headers: {} });
    expect(result).toBeNull();
  });

  it("returns null when token is invalid (verifyIdToken throws)", async () => {
    state.verifyIdToken.mockRejectedValue(new Error("invalid token"));
    const result = await authenticate(makeReq("bad-token"));
    expect(result).toBeNull();
  });

  it("returns null when token is expired", async () => {
    state.verifyIdToken.mockRejectedValue(
      Object.assign(new Error("Firebase ID token has expired."), { code: "auth/id-token-expired" })
    );
    const result = await authenticate(makeReq("expired-token"));
    expect(result).toBeNull();
  });

  it("auto-creates new user on first login (role=user)", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "uid-new", email: "newuser@example.com", name: "New" });

    const result = await authenticate(makeReq("good-token"));

    expect(result).toEqual({ uid: "uid-new", email: "newuser@example.com", role: "user" });
    const stored = state.store.get("users")?.get("uid-new");
    expect(stored).toBeDefined();
    expect(stored.role).toBe("user");
    expect(stored.dailyQuota).toBe(10);
  });

  it("auto-creates owner with elevated quota when email matches OWNER_EMAIL", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "uid-owner", email: "blcktgr73@gmail.com", name: "Owner" });

    const result = await authenticate(makeReq("good-token"));

    expect(result?.role).toBe("owner");
    const stored = state.store.get("users")?.get("uid-owner");
    expect(stored.role).toBe("owner");
    expect(stored.dailyQuota).toBe(9999);
  });

  it("reads existing user role correctly (admin)", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "uid-admin", email: "admin@example.com" });
    const users = new Map();
    users.set("uid-admin", { email: "admin@example.com", role: "admin", dailyQuota: 100 });
    state.store.set("users", users);

    const result = await authenticate(makeReq("good-token"));

    expect(result).toEqual({ uid: "uid-admin", email: "admin@example.com", role: "admin" });
  });
});
