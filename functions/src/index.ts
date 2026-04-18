import * as admin from "firebase-admin";
import { onRequest } from "firebase-functions/v2/https";

admin.initializeApp();
const db = admin.firestore();

const OWNER_EMAIL = "blcktgr73@gmail.com";
const DEFAULT_DAILY_QUOTA = 10;

// -------------------------------------------------------------------
// Auth helper: verify Firebase ID token and check user role
// -------------------------------------------------------------------
interface AuthUser {
  uid: string;
  email: string;
  role: string;
}

export async function authenticate(req: any): Promise<AuthUser | null> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return null;

  try {
    const token = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(token);
    if (!decoded.email) return null;

    const userRef = db.collection("users").doc(decoded.uid);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      // 첫 로그인 — 자동 등록
      const isOwner = decoded.email === OWNER_EMAIL;
      const newUser = {
        email: decoded.email,
        name: decoded.name || decoded.email.split("@")[0],
        role: isOwner ? "owner" : "user",
        dailyQuota: isOwner ? 9999 : DEFAULT_DAILY_QUOTA,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      await userRef.set(newUser);
      return { uid: decoded.uid, email: decoded.email, role: newUser.role };
    }

    const data = userDoc.data()!;
    // lastActiveAt 업데이트
    await userRef.update({ lastActiveAt: admin.firestore.FieldValue.serverTimestamp() });
    return { uid: decoded.uid, email: decoded.email, role: data.role };
  } catch {
    return null;
  }
}

export function requireRole(user: AuthUser | null, ...roles: string[]): boolean {
  return user !== null && roles.includes(user.role);
}

// -------------------------------------------------------------------
// Usage tracking
// -------------------------------------------------------------------
export async function checkAndIncrementUsage(uid: string, provider: string): Promise<{ allowed: boolean; used: number; quota: number }> {
  const userDoc = await db.collection("users").doc(uid).get();
  const quota = userDoc.data()?.dailyQuota ?? DEFAULT_DAILY_QUOTA;

  const today = new Date().toISOString().split("T")[0];
  const usageRef = db.collection("usage").doc(uid).collection("daily").doc(today);
  const usageDoc = await usageRef.get();

  const field = `${provider}Calls`;
  const current = usageDoc.exists ? (usageDoc.data()?.[field] ?? 0) : 0;
  const totalField = "totalCalls";
  const totalCurrent = usageDoc.exists ? (usageDoc.data()?.[totalField] ?? 0) : 0;

  if (totalCurrent >= quota) {
    return { allowed: false, used: totalCurrent, quota };
  }

  await usageRef.set(
    { [field]: admin.firestore.FieldValue.increment(1), [totalField]: admin.firestore.FieldValue.increment(1) },
    { merge: true }
  );
  return { allowed: true, used: totalCurrent + 1, quota };
}

// -------------------------------------------------------------------
// TTS Proxy: OpenAI
// -------------------------------------------------------------------
export const ttsOpenai = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  const user = await authenticate(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role === "blocked") { res.status(403).json({ error: "Access denied" }); return; }

  const usage = await checkAndIncrementUsage(user.uid, "openai");
  if (!usage.allowed) {
    res.status(429).json({ error: "Daily quota exceeded", used: usage.used, quota: usage.quota });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "Server API key not configured" }); return; }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(req.body),
    });

    if (!response.ok) {
      const error = await response.text();
      res.status(response.status).json({ error });
      return;
    }

    const audioBuffer = await response.arrayBuffer();
    res.set("Content-Type", "audio/mpeg");
    res.send(Buffer.from(audioBuffer));
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// TTS Proxy: Gemini (WebSocket은 프록시 불가, REST fallback)
// -------------------------------------------------------------------
export const ttsGemini = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  const user = await authenticate(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
  if (user.role === "blocked") { res.status(403).json({ error: "Access denied" }); return; }

  const usage = await checkAndIncrementUsage(user.uid, "gemini");
  if (!usage.allowed) {
    res.status(429).json({ error: "Daily quota exceeded", used: usage.used, quota: usage.quota });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) { res.status(500).json({ error: "Server Gemini key not configured" }); return; }

  // Gemini REST TTS endpoint
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err: any) {
    res.status(502).json({ error: err.message });
  }
});

// -------------------------------------------------------------------
// Admin API: List users
// -------------------------------------------------------------------
export const adminListUsers = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  const user = await authenticate(req);
  if (!requireRole(user, "owner", "admin")) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const snapshot = await db.collection("users").orderBy("createdAt", "desc").get();
  const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() }));
  res.json({ users });
});

// -------------------------------------------------------------------
// Admin API: Update user role
// -------------------------------------------------------------------
export const adminUpdateRole = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  const user = await authenticate(req);
  if (!requireRole(user, "owner", "admin")) {
    res.status(403).json({ error: "Admin access required" });
    return;
  }

  const { uid, role } = req.body;
  if (!uid || !["user", "admin", "blocked"].includes(role)) {
    res.status(400).json({ error: "Invalid uid or role" });
    return;
  }

  // owner 변경 방지
  const targetDoc = await db.collection("users").doc(uid).get();
  if (targetDoc.data()?.role === "owner") {
    res.status(400).json({ error: "Cannot change owner role" });
    return;
  }

  await db.collection("users").doc(uid).update({ role });
  res.json({ success: true });
});

// -------------------------------------------------------------------
// Admin API: Update user quota
// -------------------------------------------------------------------
export const adminUpdateQuota = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  const user = await authenticate(req);
  if (!requireRole(user, "owner")) {
    res.status(403).json({ error: "Owner access required" });
    return;
  }

  const { uid, dailyQuota } = req.body;
  if (!uid || typeof dailyQuota !== "number" || dailyQuota < 0) {
    res.status(400).json({ error: "Invalid uid or quota" });
    return;
  }

  await db.collection("users").doc(uid).update({ dailyQuota });
  res.json({ success: true });
});

// -------------------------------------------------------------------
// User API: Get my profile + usage
// -------------------------------------------------------------------
export const userProfile = onRequest({ cors: true, region: "asia-northeast3" }, async (req, res) => {
  const user = await authenticate(req);
  if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

  const userDoc = await db.collection("users").doc(user.uid).get();
  const today = new Date().toISOString().split("T")[0];
  const usageDoc = await db.collection("usage").doc(user.uid).collection("daily").doc(today).get();

  res.json({
    profile: { uid: user.uid, ...userDoc.data() },
    todayUsage: usageDoc.exists ? usageDoc.data() : { totalCalls: 0 },
  });
});
