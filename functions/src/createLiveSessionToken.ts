import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { GoogleGenAI } from "@google/genai";
import { GOOGLE_GENAI_API_KEY, LIVE_MODEL } from "./secrets";
import { validateModeAccess } from "./modeAccess";

interface RequestBody {
  recipeId?: string;
  modeId?: string;
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
    const { recipeId, modeId } = (request.data ?? {}) as RequestBody;
    if (!recipeId || typeof recipeId !== "string") {
      throw new HttpsError("invalid-argument", "recipeId is required.");
    }
    if (!modeId || typeof modeId !== "string") {
      throw new HttpsError("invalid-argument", "modeId is required.");
    }
    await validateModeAccess(request.data);

    // 30 minute absolute lifetime, 1 minute window to start the session.
    const now = Date.now();
    const expiresAt = new Date(now + 30 * 60 * 1000);
    const newSessionExpireTime = new Date(now + 60 * 1000);

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
        modeId,
      };
    } catch (err) {
      logger.error("authTokens.create failed", err);
      throw new HttpsError(
        "failed-precondition",
        "Could not mint a live session token."
      );
    }
  }
);
