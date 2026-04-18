import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("firebase-admin", async () => {
  const { createFirebaseAdminMock } = await import("./__mocks__/firebase-admin-mock");
  return createFirebaseAdminMock();
});

import * as admin from "firebase-admin";
import { checkAndIncrementUsage } from "./index";

const state = (admin as any).__state as {
  store: Map<string, Map<string, any>>;
  subStore: Map<string, Map<string, Map<string, any>>>;
};

function setUser(uid: string, dailyQuota = 10) {
  let users = state.store.get("users");
  if (!users) {
    users = new Map();
    state.store.set("users", users);
  }
  users.set(uid, { email: `${uid}@example.com`, role: "user", dailyQuota });
}

function getUsageDoc(uid: string, dateKey: string): any {
  return state.subStore.get(`usage/${uid}`)?.get("daily")?.get(dateKey);
}

describe("checkAndIncrementUsage()", () => {
  beforeEach(() => {
    state.store.clear();
    state.subStore.clear();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-18T10:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("first request of the day initializes counter to 1", async () => {
    setUser("u1", 10);

    const result = await checkAndIncrementUsage("u1", "openai");

    expect(result.allowed).toBe(true);
    expect(result.used).toBe(1);
    expect(result.quota).toBe(10);
    const usage = getUsageDoc("u1", "2026-04-18");
    expect(usage.totalCalls).toBe(1);
    expect(usage.openaiCalls).toBe(1);
  });

  it("resets daily on date change (mock date)", async () => {
    setUser("u1", 10);
    await checkAndIncrementUsage("u1", "openai");
    await checkAndIncrementUsage("u1", "openai");
    expect(getUsageDoc("u1", "2026-04-18").totalCalls).toBe(2);

    // Advance to next day
    vi.setSystemTime(new Date("2026-04-19T01:00:00Z"));

    const result = await checkAndIncrementUsage("u1", "openai");
    expect(result.used).toBe(1);
    expect(getUsageDoc("u1", "2026-04-19").totalCalls).toBe(1);
    // Previous day untouched
    expect(getUsageDoc("u1", "2026-04-18").totalCalls).toBe(2);
  });

  it("returns allowed=false (429-equivalent) when quota exceeded", async () => {
    setUser("u1", 2);
    await checkAndIncrementUsage("u1", "openai");
    await checkAndIncrementUsage("u1", "openai");

    const result = await checkAndIncrementUsage("u1", "openai");
    expect(result.allowed).toBe(false);
    expect(result.used).toBe(2);
    expect(result.quota).toBe(2);
    // Counter should NOT have been incremented past quota
    expect(getUsageDoc("u1", "2026-04-18").totalCalls).toBe(2);
  });

  it("different users have separate counters", async () => {
    setUser("u1", 10);
    setUser("u2", 10);

    await checkAndIncrementUsage("u1", "openai");
    await checkAndIncrementUsage("u1", "openai");
    await checkAndIncrementUsage("u2", "openai");

    expect(getUsageDoc("u1", "2026-04-18").totalCalls).toBe(2);
    expect(getUsageDoc("u2", "2026-04-18").totalCalls).toBe(1);
  });

  it("concurrent requests increment atomically via Firestore merge", async () => {
    setUser("u1", 100);

    // Fire 10 in parallel
    const results = await Promise.all(
      Array.from({ length: 10 }, () => checkAndIncrementUsage("u1", "openai"))
    );

    expect(results.every((r) => r.allowed)).toBe(true);
    // Atomic increment via FieldValue.increment merge means total = 10
    expect(getUsageDoc("u1", "2026-04-18").totalCalls).toBe(10);
    expect(getUsageDoc("u1", "2026-04-18").openaiCalls).toBe(10);
  });
});
