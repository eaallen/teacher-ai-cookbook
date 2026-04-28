# functions

Firebase 2nd-gen Cloud Functions for the teacher-ai-cookbook project.

## Build

```sh
npm install            # from repo root (workspaces)
npm --workspace functions run build
```

## Local development

```sh
firebase emulators:start --import=./.emu --export-on-exit
```

The emulator UI is at http://localhost:4000.

## Secrets

Before deploying or invoking against the live project, set:

```sh
firebase functions:secrets:set GOOGLE_GENAI_API_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
```

And configure non-secret params in `firebase.json` or via env at deploy time:

- `STRIPE_PRICE_ID` — single flat-tier monthly subscription price id
- `APP_BASE_URL_COOKBOOK` — e.g. `https://<project>-cookbook.web.app`
- `APP_BASE_URL_STUDENT`  — e.g. `https://<project>-student.web.app`

## Hosting prerequisites

The Firebase project **must already have two Hosting sites** named
`<project>-cookbook` and `<project>-student` before
`firebase target:apply hosting cookbook|student <site>` will succeed. Create
them once in the Firebase Console under Hosting → Add another site.

## Stripe local testing

```sh
stripe listen --forward-to http://localhost:5001/<project>/us-central1/stripeWebhook
stripe trigger checkout.session.completed
```

## Functions inventory

| Name | Type | Purpose |
|------|------|---------|
| `createLiveSessionToken` | onCall | Mints an ephemeral Live API token |
| `appendTranscript`       | onCall | Appends turns to a session transcript |
| `createStripeCheckoutSession` | onCall | Subscription checkout |
| `createStripeBillingPortalSession` | onCall | Manage existing subscription |
| `stripeWebhook` | onRequest | Receives Stripe events |
