# Student Live Agent

Vite + React + TypeScript + MUI student-facing app. A student opens
`/r/:recipeId`, taps the big circular button, and starts a Gemini Live
voice conversation tailored by the recipe's teacher.

## Local development

```sh
# edit .env (or .env.local) with your Firebase web SDK values
# and ensure VITE_USE_EMULATOR=0 to mirror production behavior.

# from repo root:
npm install
npm --workspace apps/student run dev
```

Open http://localhost:5174/r/<published-recipe-id>.

## Build & deploy

```sh
npm --workspace apps/student run build
firebase deploy --only hosting:student
```

## Notes

- Uses **Firebase Anonymous Auth** so we can attribute transcripts.
- Mints an ephemeral Live API token via the `createLiveSessionToken` callable.
- Streams 16 kHz mono PCM audio to Gemini, plays back 24 kHz PCM responses on
  a single `AudioContext` clock.
- Tool calls (`addTopic`, `markCovered`, `setTopics`) drive the bottom
  Coverage panel.
- Transcripts are flushed to `appendTranscript` in batches and on `pagehide`.
