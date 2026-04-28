# Backend Contracts

This document is the canonical contract between the backend Firebase project
and the two frontend apps. Field naming uses **camelCase** (per the master
plan reconciliation).

## Live URL shape

```
https://<student-app-domain>/r/:recipeId
```

Cookbook computes this on publish via `buildLiveUrl(origin, recipeId)`.
Student app routes on `/r/:recipeId`.

## Firestore collections

### `users/{uid}`

Teacher profile. Created on first login by the cookbook client; subscription
fields are written exclusively by the Stripe webhook via Admin SDK.

| Field             | Type                  | Notes |
|-------------------|-----------------------|-------|
| `email`           | string                | Required |
| `displayName`     | string                | Required |
| `createdAt`       | Timestamp             | Required |
| `stripeCustomerId`| string                | Webhook-only |
| `subscription`    | object                | Webhook-only — `{status, priceId, subscriptionId, currentPeriodEnd, cancelAtPeriodEnd}` |

### `recipes/{recipeId}`

Canonical Recipe.

| Field          | Type      | Notes |
|----------------|-----------|-------|
| `ownerUid`     | string    | Teacher uid |
| `title`        | string    | |
| `icon`         | string    | Emoji or single letter |
| `level`        | string    | `kindergarten` \| `grade1` … `grade12` \| `collegeFreshman` … |
| `tags`         | string[]  | Free-form tags |
| `courseMaterial` | string  | Markdown |
| `systemPrompt` | string    | Teacher-configured system prompt |
| `initialTopics`| array?    | Optional `[{id, title}]` seed for coverage panel |
| `published`    | boolean   | False on create |
| `liveUrl`      | string    | Computed on publish |
| `createdAt`    | Timestamp | |
| `updatedAt`    | Timestamp | |
| `publishedAt`  | Timestamp\|null | |

### `recipes/{recipeId}/transcripts/{sessionId}`

One document per student session. **Only writable by `appendTranscript`.**

| Field            | Type      | Notes |
|------------------|-----------|-------|
| `ownerUid`       | string    | Denormalized from parent recipe |
| `recipeId`       | string    | |
| `studentUid`     | string    | Anonymous Firebase Auth uid |
| `startedAt`      | Timestamp | |
| `lastAppendedAt` | Timestamp | |
| `turns`          | array     | `[{role: 'user'|'model', text, ts}]` |

## Cloud Function callables

All callables live in `us-central1`, use `firebase-functions/v2/https.onCall`,
and throw `HttpsError` with one of: `unauthenticated`, `permission-denied`,
`not-found`, `invalid-argument`, `failed-precondition`, `internal`.

### `createLiveSessionToken`

- Auth: required (anonymous OK).
- Request: `{ recipeId: string }`
- Response: `{ token: string, expiresAt: string, model: string, recipeId: string }`
- Behavior: Loads `recipes/{recipeId}`; throws `not-found` if missing or
  `published !== true`. Mints an ephemeral token via `@google/genai`
  `authTokens.create`.

### `appendTranscript`

- Auth: required.
- Request: `{ recipeId: string, sessionId: string, turns: Array<{ role: 'user'|'model', text: string, ts: number }> }`
- Response: `{ ok: true }`
- Behavior: Writes/merges `recipes/{recipeId}/transcripts/{sessionId}` with
  `ownerUid` denormalized from the parent recipe. Validates `turns.length <= 50`.

### `createStripeCheckoutSession`

- Auth: required, **non-anonymous teacher** only.
- Request: `{}`
- Response: `{ url: string }`

### `createStripeBillingPortalSession`

- Auth: required, non-anonymous teacher only.
- Request: `{}`
- Response: `{ url: string }`

### `stripeWebhook` (HTTPS, raw body)

- Stripe-signature-verified.
- Handles `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted`.

## Secrets

Set via `firebase functions:secrets:set <NAME>`:

- `GOOGLE_GENAI_API_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_ID`
- `APP_BASE_URL_COOKBOOK`
- `APP_BASE_URL_STUDENT`
