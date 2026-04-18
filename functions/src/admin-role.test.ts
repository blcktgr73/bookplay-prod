import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("firebase-admin", async () => {
  const { createFirebaseAdminMock } = await import("./__mocks__/firebase-admin-mock");
  return createFirebaseAdminMock();
});

import * as admin from "firebase-admin";
import { adminUpdateRole } from "./index";

const state = (admin as any).__state as {
  store: Map<string, Map<string, any>>;
  subStore: Map<string, Map<string, Map<string, any>>>;
  verifyIdToken: ReturnType<typeof vi.fn>;
};

function makeRes() {
  const listeners: Record<string, Array<() => void>> = {};
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as any,
    on: vi.fn(function (this: any, event: string, cb: () => void) {
      (listeners[event] ||= []).push(cb);
      return this;
    }),
    getHeader: vi.fn(function (this: any, key: string) {
      return this.headers[key];
    }),
    setHeader: vi.fn(function (this: any, key: string, val: string) {
      this.headers[key] = val;
      return this;
    }),
    removeHeader: vi.fn(function (this: any, key: string) {
      delete this.headers[key];
    }),
    status: vi.fn(function (this: any, code: number) {
      this.statusCode = code;
      return this;
    }),
    end: vi.fn(function (this: any) {
      (listeners["finish"] || []).forEach((cb) => cb());
      return this;
    }),
    json: vi.fn(function (this: any, payload: any) {
      this.body = payload;
      (listeners["finish"] || []).forEach((cb) => cb());
      return this;
    }),
    set: vi.fn(function (this: any, key: string, val: string) {
      this.headers[key] = val;
      return this;
    }),
    send: vi.fn(function (this: any, payload: any) {
      this.body = payload;
      (listeners["finish"] || []).forEach((cb) => cb());
      return this;
    }),
  };
  return res;
}

function setUser(uid: string, role: string, email = `${uid}@example.com`) {
  let users = state.store.get("users");
  if (!users) {
    users = new Map();
    state.store.set("users", users);
  }
  users.set(uid, { email, role, dailyQuota: role === "owner" ? 9999 : 10 });
}

describe("adminUpdateRole", () => {
  beforeEach(() => {
    state.store.clear();
    state.subStore.clear();
    state.verifyIdToken.mockReset();
  });

  it("owner can promote a user to admin", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "blcktgr73@gmail.com" });
    setUser("owner-uid", "owner");
    setUser("target-uid", "user");

    const req: any = {
      headers: { authorization: "Bearer owner-token" },
      body: { uid: "target-uid", role: "admin" },
    };
    const res = makeRes();

    await (adminUpdateRole as any)(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ success: true });
    expect(state.store.get("users")?.get("target-uid").role).toBe("admin");
  });

  it("owner can demote an admin to user", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "blcktgr73@gmail.com" });
    setUser("owner-uid", "owner");
    setUser("admin-uid", "admin");

    const req: any = {
      headers: { authorization: "Bearer owner-token" },
      body: { uid: "admin-uid", role: "user" },
    };
    const res = makeRes();

    await (adminUpdateRole as any)(req, res);

    expect(res.statusCode).toBe(200);
    expect(state.store.get("users")?.get("admin-uid").role).toBe("user");
  });

  it("owner role cannot be changed (immutable)", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "owner-uid", email: "blcktgr73@gmail.com" });
    setUser("owner-uid", "owner");
    setUser("other-owner-uid", "owner", "other-owner@example.com");

    const req: any = {
      headers: { authorization: "Bearer owner-token" },
      body: { uid: "other-owner-uid", role: "user" },
    };
    const res = makeRes();

    await (adminUpdateRole as any)(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/owner/i);
    expect(state.store.get("users")?.get("other-owner-uid").role).toBe("owner");
  });

  it("non-admin (regular user) is rejected with 403", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "user-uid", email: "user@example.com" });
    setUser("user-uid", "user");
    setUser("target-uid", "user");

    const req: any = {
      headers: { authorization: "Bearer user-token" },
      body: { uid: "target-uid", role: "admin" },
    };
    const res = makeRes();

    await (adminUpdateRole as any)(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body.error).toMatch(/admin access required/i);
    expect(state.store.get("users")?.get("target-uid").role).toBe("user");
  });

  it("non-owner (admin) cannot create a new owner — invalid role rejected with 400", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "admin-uid", email: "admin@example.com" });
    setUser("admin-uid", "admin");
    setUser("target-uid", "user");

    const req: any = {
      headers: { authorization: "Bearer admin-token" },
      // attempting to set role=owner — not in allowed enum
      body: { uid: "target-uid", role: "owner" },
    };
    const res = makeRes();

    await (adminUpdateRole as any)(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/invalid uid or role/i);
    expect(state.store.get("users")?.get("target-uid").role).toBe("user");
  });
});
