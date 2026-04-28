import { onCall, HttpsError } from "firebase-functions/v2/https";
import { getFirestore, FieldValue } from "firebase-admin/firestore";

interface Turn {
  role: "user" | "model";
  text: string;
  ts: number;
}

interface RequestBody {
  recipeId?: string;
  sessionId?: string;
  turns?: Turn[];
}

const MAX_TURNS_PER_CALL = 50;
const MAX_BYTES_PER_CALL = 50 * 1024;

function bytesOf(s: string): number {
  return new TextEncoder().encode(s).length;
}

export const appendTranscript = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { recipeId, sessionId, turns } = (request.data ?? {}) as RequestBody;
    if (
      !recipeId ||
      !sessionId ||
      !Array.isArray(turns) ||
      turns.length === 0
    ) {
      throw new HttpsError(
        "invalid-argument",
        "recipeId, sessionId, and a non-empty turns array are required."
      );
    }
    if (turns.length > MAX_TURNS_PER_CALL) {
      throw new HttpsError(
        "invalid-argument",
        `Too many turns; max ${MAX_TURNS_PER_CALL} per call.`
      );
    }
    let totalBytes = 0;
    for (const t of turns) {
      if (
        (t.role !== "user" && t.role !== "model") ||
        typeof t.text !== "string" ||
        typeof t.ts !== "number"
      ) {
        throw new HttpsError("invalid-argument", "Malformed turn.");
      }
      totalBytes += bytesOf(t.text);
    }
    if (totalBytes > MAX_BYTES_PER_CALL) {
      throw new HttpsError("invalid-argument", "Payload too large.");
    }

    const db = getFirestore();
    const recipeSnap = await db.doc(`recipes/${recipeId}`).get();
    if (!recipeSnap.exists || recipeSnap.get("published") !== true) {
      throw new HttpsError("not-found", "Recipe not found or not published.");
    }
    const ownerUid = recipeSnap.get("ownerUid") as string;

    const ref = db.doc(`recipes/${recipeId}/transcripts/${sessionId}`);
    const existing = await ref.get();
    const studentUid = request.auth.uid;

    if (existing.exists) {
      await ref.set(
        {
          lastAppendedAt: FieldValue.serverTimestamp(),
          turns: FieldValue.arrayUnion(...turns),
        },
        { merge: true }
      );
    } else {
      await ref.set({
        ownerUid,
        recipeId,
        studentUid,
        startedAt: FieldValue.serverTimestamp(),
        lastAppendedAt: FieldValue.serverTimestamp(),
        turns,
      });
    }

    return { ok: true };
  }
);
