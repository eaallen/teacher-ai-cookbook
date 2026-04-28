# Teacher AI Cookbook

Configurable AI Voice Tutor — two web apps on a single Firebase project:

- **`apps/cookbook/`** — Teacher admin UI (Firebase Auth + Firestore CRUD,
  MDXEditor for course material, Stripe billing entry).
- **`apps/student/`** — Student-facing live agent (`/r/:recipeId`, anonymous
  Firebase Auth, Gemini Live voice + text, coverage panel).
- **`functions/`** — Cloud Functions: `createLiveSessionToken`,
  `appendTranscript`, Stripe checkout/portal/webhook.

See [`docs/backend-contracts.md`](./docs/backend-contracts.md) for the
canonical Firestore + callable contract.

## Quick start

```sh
# 1. Install everything
npm install

# 2. Configure your Firebase project
#    - Edit .firebaserc and replace REPLACE_WITH_PROJECT_ID
#    - Create two Hosting sites in the Firebase console:
#        <project>-cookbook  and  <project>-student
#    - Run:
firebase target:apply hosting cookbook  <project>-cookbook
firebase target:apply hosting student   <project>-student

# 3. Set the Cloud Functions secrets
firebase functions:secrets:set GOOGLE_GENAI_API_KEY
firebase functions:secrets:set STRIPE_SECRET_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET

# 4. Copy the example env files
cp apps/cookbook/.env.example apps/cookbook/.env
cp apps/student/.env.example apps/student/.env
# then fill in the Firebase web SDK values from Firebase Console → Project Settings.

# 5. Local development against the emulator
npm --workspace functions run build:watch # in one terminal, updates to functions are always rebuilt
npm run emulators                         # in another
npm run dev:cookbook                      # in another  → http://localhost:5173
npm run dev:student                       # in another  → http://localhost:5174

# 6. Build everything
npm run build

# 7. Deploy
firebase deploy --only firestore
firebase deploy --only functions
firebase deploy --only hosting:cookbook
firebase deploy --only hosting:student
```

## Project layout

```
.
├── apps/
│   ├── cookbook/                # Teacher admin app
│   └── student/                 # Student live agent app
├── functions/                   # Cloud Functions (TS, v2)
├── docs/backend-contracts.md    # Schema + callable contract
├── firestore.rules
├── firestore.indexes.json
├── firebase.json                # Two Hosting targets, single Functions codebase
└── .firebaserc                  # Project + Hosting target mapping
```

## Field naming

Firestore uses **camelCase** for all document fields. The source brief
sketched PascalCase (`Title`, `CourseMaterial`, …); the master plan
reconciled to camelCase for Firestore-idiomatic naming. Both frontends use
the same shape.

## Models

- **Live API model:** `gemini-3.1-flash-live-preview` (override via
  `VITE_LIVE_MODEL`).

## Stripe assumption

Single flat monthly subscription tier with one `STRIPE_PRICE_ID`. Source
brief did not specify a pricing model — revisit before launch.
