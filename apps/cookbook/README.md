# Teacher Cookbook

Vite + React + TypeScript + MUI admin app for teachers to manage their AI
voice tutor recipes.

## Local development

```sh
# edit .env (or .env.local) with your Firebase web SDK values
# and ensure VITE_USE_EMULATOR=0 to mirror production behavior.

# from repo root:
npm install
npm --workspace apps/cookbook run dev
```

Open http://localhost:5173.

## Build & deploy

```sh
npm --workspace apps/cookbook run build
firebase deploy --only hosting:cookbook
```

## Routes

- `/login` — Email/password + Google sign-in.
- `/` — Recipe dashboard (filter by title/tag/level, group by tag).
- `/recipes/new` — New recipe.
- `/recipes/:id` — Edit recipe metadata, course material, and modes.
- `/recipes/:id/transcripts` — Read-only transcripts viewer.
- `/billing` — Stripe checkout / billing portal entry points.

## Env vars

See `.env.example`. `VITE_STUDENT_APP_ORIGIN` is used to build published mode
URLs copied to the teacher's clipboard.
