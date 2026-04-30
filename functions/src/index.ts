/**
 * Cloud Functions entry point. We split each callable / handler into its own
 * module so that the Cloud Functions emulator can isolate cold-starts and so
 * each piece is testable on its own.
 */

import { initializeApp } from "firebase-admin/app";

initializeApp();

export { createLiveSessionToken } from "./createLiveSessionToken";
export { appendTranscript } from "./appendTranscript";
export { generateOralAssessmentRubric } from "./generateOralAssessmentRubric";
export { getStudentRecipeConfig, getStudentSessionConfig } from "./modeAccess";
export {
  createStripeCheckoutSession,
  createStripeBillingPortalSession,
} from "./stripeCallables";
export { stripeWebhook } from "./stripeWebhook";
