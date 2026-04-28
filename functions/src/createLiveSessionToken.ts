import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import { GoogleGenAI } from "@google/genai";
import { GOOGLE_GENAI_API_KEY, LIVE_MODEL } from "./secrets";

interface RequestBody {
  recipeId?: string;
}

export const createLiveSessionToken = onCall(
  {
    region: "us-central1",
    secrets: [GOOGLE_GENAI_API_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    const { recipeId } = (request.data ?? {}) as RequestBody;
    if (!recipeId || typeof recipeId !== "string") {
      throw new HttpsError("invalid-argument", "recipeId is required.");
    }

    const db = getFirestore();
    const snap = await db.doc(`recipes/${recipeId}`).get();
    if (!snap.exists || snap.get("published") !== true) {
      throw new HttpsError("not-found", "Recipe not found or not published.");
    }

    // 30 minute absolute lifetime, 1 minute window to start the session.
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 60 * 1000);
    const newSessionExpireTime = new Date(now + 60 * 1000);

   logger.info("GOOGLE_GENAI_API_KEY", GOOGLE_GENAI_API_KEY.value());

    try {
      const ai = new GoogleGenAI({ apiKey: GOOGLE_GENAI_API_KEY.value() });
      // The @google/genai SDK exposes ephemeral-token minting under
      // `authTokens.create`. Shape per the Live API docs:
      // {
      //   uses: 1,
      //   expireTime: ISO,
      //   newSessionExpireTime: ISO,
      //   liveConnectConstraints: { model, config: { responseModalities, ... } }
      // }
      const token = await ai.authTokens.create({
        config: {
          httpOptions: { apiVersion: 'v1alpha' },
          uses: 1,
          expireTime: expiresAt.toISOString(),
          newSessionExpireTime: newSessionExpireTime.toISOString(),
        },
      });

      return {
        token: token.name,
        expiresAt: expiresAt.toISOString(),
        model: LIVE_MODEL,
        recipeId,
      };
    } catch (err) {
      logger.error("authTokens.create failed", err);
      throw new HttpsError(
        "failed-precondition",
        "ELI WAS HERE:Could not mint a live session token."
      );
    }
  }
);
