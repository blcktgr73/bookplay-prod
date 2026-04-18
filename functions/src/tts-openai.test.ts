import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("firebase-admin", async () => {
  const { createFirebaseAdminMock } = await import("./__mocks__/firebase-admin-mock");
  return createFirebaseAdminMock();
});

import * as admin from "firebase-admin";
import { ttsOpenai } from "./index";

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

function setUser(uid: string, role = "user", dailyQuota = 10) {
  let users = state.store.get("users");
  if (!users) {
    users = new Map();
    state.store.set("users", users);
  }
  users.set(uid, { email: `${uid}@example.com`, role, dailyQuota });
}

describe("ttsOpenai", () => {
  beforeEach(() => {
    state.store.clear();
    state.subStore.clear();
    state.verifyIdToken.mockReset();
    process.env.OPENAI_API_KEY = "test-api-key";
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns 401 when authorization header is missing", async () => {
    const req: any = { headers: {}, body: {} };
    const res = makeRes();

    await (ttsOpenai as any)(req, res);

    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: "Unauthorized" });
  });

  it("returns 403 when user role is blocked", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "u-blocked", email: "b@example.com" });
    setUser("u-blocked", "blocked");

    const req: any = { headers: { authorization: "Bearer good" }, body: {} };
    const res = makeRes();

    await (ttsOpenai as any)(req, res);

    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ error: "Access denied" });
  });

  it("forwards request to OpenAI API on valid auth + within quota", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "u1", email: "u1@example.com" });
    setUser("u1", "user", 10);

    const audioBytes = new Uint8Array([1, 2, 3, 4]).buffer;
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      arrayBuffer: async () => audioBytes,
      text: async () => "",
    }));
    vi.stubGlobal("fetch", fetchMock);

    const req: any = {
      headers: { authorization: "Bearer good" },
      body: { input: "hello", voice: "alloy", model: "tts-1" },
    };
    const res = makeRes();

    await (ttsOpenai as any)(req, res);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.openai.com/v1/audio/speech");
    expect((init as any).headers["Authorization"]).toBe("Bearer test-api-key");
    expect(JSON.parse((init as any).body)).toEqual(req.body);
    expect(res.headers["Content-Type"]).toBe("audio/mpeg");
    expect(Buffer.isBuffer(res.body)).toBe(true);
  });

  it("logs usage in Firestore after a successful call", async () => {
    state.verifyIdToken.mockResolvedValue({ uid: "u1", email: "u1@example.com" });
    setUser("u1", "user", 10);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        arrayBuffer: async () => new Uint8Array([0]).buffer,
        text: async () => "",
      }))
    );

    const req: any = { headers: { authorization: "Bearer good" }, body: { input: "hi" } };
    const res = makeRes();

    await (ttsOpenai as any)(req, res);

    const usage = state.subStore.get("usage/u1")?.get("daily")?.get("2026-04-18");
    expect(usage).toBeDefined();
    expect(usage.totalCalls).toBe(1);
    expect(usage.openaiCalls).toBe(1);
  });
});
