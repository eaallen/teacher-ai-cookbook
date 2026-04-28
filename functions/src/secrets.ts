import { defineSecret, defineString } from "firebase-functions/params";

export const GOOGLE_GENAI_API_KEY = defineSecret("GOOGLE_GENAI_API_KEY");
export const STRIPE_SECRET_KEY = defineSecret("STRIPE_SECRET_KEY");
export const STRIPE_WEBHOOK_SECRET = defineSecret("STRIPE_WEBHOOK_SECRET");

// Non-secret runtime params. `defineString` lets us configure these per project
// without baking them into source.
export const STRIPE_PRICE_ID = defineString("STRIPE_PRICE_ID", {
  default: "price_REPLACE_ME",
});
export const APP_BASE_URL_COOKBOOK = defineString("APP_BASE_URL_COOKBOOK", {
  default: "http://localhost:5173",
});
export const APP_BASE_URL_STUDENT = defineString("APP_BASE_URL_STUDENT", {
  default: "http://localhost:5174",
});

export const LIVE_MODEL = "gemini-3.1-flash-live-preview";
