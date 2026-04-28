import { onCall, HttpsError } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getFirestore } from "firebase-admin/firestore";
import Stripe from "stripe";
import {
  STRIPE_SECRET_KEY,
  STRIPE_PRICE_ID,
  APP_BASE_URL_COOKBOOK,
} from "./secrets";

function stripeClient(): Stripe {
  return new Stripe(STRIPE_SECRET_KEY.value(), { apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion });
}

function assertTeacher(request: { auth?: { uid: string; token: { firebase?: { sign_in_provider?: string } } } }) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in required.");
  }
  if (request.auth.token.firebase?.sign_in_provider === "anonymous") {
    throw new HttpsError("permission-denied", "Teachers only.");
  }
  return request.auth.uid;
}

async function findOrCreateCustomer(
  uid: string,
  email: string | undefined,
  stripe: Stripe
): Promise<string> {
  const db = getFirestore();
  const userRef = db.doc(`users/${uid}`);
  const snap = await userRef.get();
  const existing = snap.get("stripeCustomerId") as string | undefined;
  if (existing) return existing;

  const customer = await stripe.customers.create({
    email,
    metadata: { firebaseUid: uid },
  });
  // Webhook will eventually set this too, but writing here makes the upgrade
  // flow idempotent if the webhook is delayed.
  await userRef.set({ stripeCustomerId: customer.id }, { merge: true });
  return customer.id;
}

export const createStripeCheckoutSession = onCall(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    const uid = assertTeacher(request);
    const stripe = stripeClient();

    try {
      const customerId = await findOrCreateCustomer(
        uid,
        request.auth?.token.email as string | undefined,
        stripe
      );
      const baseUrl = APP_BASE_URL_COOKBOOK.value();
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: customerId,
        line_items: [{ price: STRIPE_PRICE_ID.value(), quantity: 1 }],
        client_reference_id: uid,
        success_url: `${baseUrl}/billing?status=success`,
        cancel_url: `${baseUrl}/billing?status=cancelled`,
      });
      if (!session.url) {
        throw new Error("Stripe did not return a session URL.");
      }
      return { url: session.url };
    } catch (err) {
      logger.error("createStripeCheckoutSession failed", err);
      throw new HttpsError("internal", "Could not start checkout.");
    }
  }
);

export const createStripeBillingPortalSession = onCall(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY],
  },
  async (request) => {
    const uid = assertTeacher(request);
    const db = getFirestore();
    const snap = await db.doc(`users/${uid}`).get();
    const customerId = snap.get("stripeCustomerId") as string | undefined;
    if (!customerId) {
      throw new HttpsError(
        "failed-precondition",
        "No Stripe customer for this user yet."
      );
    }

    try {
      const portal = await stripeClient().billingPortal.sessions.create({
        customer: customerId,
        return_url: `${APP_BASE_URL_COOKBOOK.value()}/billing`,
      });
      return { url: portal.url };
    } catch (err) {
      logger.error("createStripeBillingPortalSession failed", err);
      throw new HttpsError("internal", "Could not open billing portal.");
    }
  }
);
