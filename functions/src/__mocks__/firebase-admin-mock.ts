// Shared in-memory firebase-admin mock used by tests via vi.mock factory.
// Each test file calls `vi.mock("firebase-admin", () => createFirebaseAdminMock())`.
import { vi } from "vitest";

export interface MockState {
  // collection -> docId -> data
  store: Map<string, Map<string, any>>;
  // subcollections: parent path "collection/docId" -> subcoll name -> docId -> data
  subStore: Map<string, Map<string, Map<string, any>>>;
  verifyIdToken: ReturnType<typeof vi.fn>;
}

export function createState(): MockState {
  return {
    store: new Map(),
    subStore: new Map(),
    verifyIdToken: vi.fn(),
  };
}

function getCollection(state: MockState, name: string): Map<string, any> {
  let coll = state.store.get(name);
  if (!coll) {
    coll = new Map();
    state.store.set(name, coll);
  }
  return coll;
}

function getSubCollection(state: MockState, parentPath: string, subName: string): Map<string, any> {
  let subs = state.subStore.get(parentPath);
  if (!subs) {
    subs = new Map();
    state.subStore.set(parentPath, subs);
  }
  let coll = subs.get(subName);
  if (!coll) {
    coll = new Map();
    subs.set(subName, coll);
  }
  return coll;
}

// FieldValue sentinels
const INCREMENT = Symbol("increment");
const SERVER_TS = Symbol("serverTimestamp");

function applyFieldValues(existing: any, incoming: any): any {
  const out: any = { ...(existing ?? {}) };
  for (const [k, v] of Object.entries(incoming ?? {})) {
    if (v && typeof v === "object" && (v as any).__sentinel === INCREMENT) {
      out[k] = (typeof out[k] === "number" ? out[k] : 0) + (v as any).delta;
    } else if (v && typeof v === "object" && (v as any).__sentinel === SERVER_TS) {
      out[k] = new Date();
    } else {
      out[k] = v;
    }
  }
  return out;
}

function makeDocRef(state: MockState, collName: string, docId: string, parentPath?: string) {
  const get = (): Map<string, any> =>
    parentPath ? getSubCollection(state, parentPath, collName) : getCollection(state, collName);

  const docRef: any = {
    id: docId,
    get: vi.fn(async () => {
      const coll = get();
      const data = coll.get(docId);
      return {
        exists: data !== undefined,
        id: docId,
        data: () => (data ? { ...data } : undefined),
      };
    }),
    set: vi.fn(async (data: any, options?: { merge?: boolean }) => {
      const coll = get();
      if (options?.merge) {
        const existing = coll.get(docId);
        coll.set(docId, applyFieldValues(existing, data));
      } else {
        coll.set(docId, applyFieldValues(undefined, data));
      }
    }),
    update: vi.fn(async (data: any) => {
      const coll = get();
      const existing = coll.get(docId);
      if (!existing) throw new Error(`No document to update at ${collName}/${docId}`);
      coll.set(docId, applyFieldValues(existing, data));
    }),
    collection: vi.fn((subName: string) => makeCollectionRef(state, subName, `${collName}/${docId}`)),
  };
  return docRef;
}

function makeCollectionRef(state: MockState, name: string, parentPath?: string) {
  const collRef: any = {
    doc: vi.fn((docId: string) => makeDocRef(state, name, docId, parentPath)),
    orderBy: vi.fn(() => collRef),
    get: vi.fn(async () => {
      const coll = parentPath ? getSubCollection(state, parentPath, name) : getCollection(state, name);
      const docs = Array.from(coll.entries()).map(([id, data]) => ({
        id,
        data: () => ({ ...data }),
      }));
      return { docs };
    }),
  };
  return collRef;
}

export function createFirebaseAdminMock() {
  const state = createState();

  const firestore: any = () => ({
    collection: (name: string) => makeCollectionRef(state, name),
  });
  firestore.FieldValue = {
    increment: (delta: number) => ({ __sentinel: INCREMENT, delta }),
    serverTimestamp: () => ({ __sentinel: SERVER_TS }),
  };

  const auth = () => ({ verifyIdToken: state.verifyIdToken });

  return {
    __state: state,
    initializeApp: vi.fn(),
    firestore,
    auth,
    default: { initializeApp: vi.fn(), firestore, auth },
  };
}
