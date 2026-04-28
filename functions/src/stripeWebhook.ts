import { onRequest } from "firebase-functions/v2/https";
import { logger } from "firebase-functions/v2";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import Stripe from "stripe";
import { STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET } from "./secrets";

export const stripeWebhook = onRequest(
  {
    region: "us-central1",
    secrets: [STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET],
  },
  async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig || typeof sig !== "string") {
      res.status(400).send("Missing stripe-signature header.");
      return;
    }
    const stripe = new Stripe(STRIPE_SECRET_KEY.value(), {
      apiVersion: "2024-12-18.acacia" as Stripe.LatestApiVersion,
    });

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(
        (req as unknown as { rawBody: Buffer }).rawBody,
        sig,
        STRIPE_WEBHOOK_SECRET.value()
      );
    } catch (err) {
      logger.warn("stripeWebhook signature verification failed", err);
      res.status(400).send("Invalid signature.");
      return;
    }

    const db = getFirestore();

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;
          const uid = session.client_reference_id;
          const customerId = session.customer as string | null;
          const subscriptionId = session.subscription as string | null;
          if (!uid || !customerId || !subscriptionId) break;
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          await db.doc(`users/${uid}`).set(
            {
              stripeCustomerId: customerId,
              subscription: subscriptionToObject(sub),
            },
            { merge: true }
          );
          break;
        }
        case "customer.subscription.updated": {
          const sub = event.data.object as Stripe.Subscription;
          await updateByCustomer(db, sub.customer as string, {
            subscription: subscriptionToObject(sub),
          });
          break;
        }
        case "customer.subscription.deleted": {
          const sub = event.data.object as Stripe.Subscription;
          await updateByCustomer(db, sub.customer as string, {
            subscription: { ...subscriptionToObject(sub), status: "canceled" },
          });
          break;
        }
        default:
          // Unhandled event types: acknowledge so Stripe stops retrying.
          break;
      }
      res.status(200).send("ok");
    } catch (err) {
      logger.error("stripeWebhook handler failed", err);
      res.status(500).send("internal");
    }
  }
);

function subscriptionToObject(sub: Stripe.Subscription) {
  const priceId = sub.items.data[0]?.price.id ?? null;
  return {
    status: sub.status,
    priceId,
    subscriptionId: sub.id,
    currentPeriodEnd: Timestamp.fromMillis(sub.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
  };
}

async function updateByCustomer(
  db: FirebaseFirestore.Firestore,
  customerId: string,
  data: Record<string, unknown>
) {
  const usersSnap = await db
    .collection("users")
    .where("stripeCustomerId", "==", customerId)
    .limit(1)
    .get();
  if (usersSnap.empty) {
    logger.warn(`No user matching stripeCustomerId=${customerId}`);
    return;
  }
  await usersSnap.docs[0].ref.set(data, { merge: true });
}
