---
name: add-new-mode
description: Add a new recipe mode type across cookbook, student, and functions with complete type, UI, callable, and runtime updates. Use when asked to create a new mode or mode variant.
disable-model-invocation: true
---

# Add New Mode

Use this skill when the user asks to create a new mode type (for example, a new alternative to `conversational` or `oral_assessment`).

Keep implementation simple and checklist-driven. Do not optimize early; prioritize correctness and full coverage.

## Outcomes

Following this skill should produce:

- A new mode type that can be created and edited in cookbook.
- A published mode that appears in the student picker.
- A student session that uses the right prompt/runtime behavior for the new mode.
- Backend callable payloads that match student-side contracts.
- Transcript metadata and docs updated to include the new mode type.

## Required Files

Update these files together.

- `apps/cookbook/src/data/modes.ts`
- `apps/cookbook/src/data/recipes.ts`
- `apps/cookbook/src/pages/RecipeEditorPage.tsx`
- `functions/src/modeAccess.ts`
- `apps/student/src/data/recipe.ts`
- `apps/student/src/pages/RecipePage.tsx`
- `apps/student/src/live/systemPrompt.ts`
- `apps/student/src/live/LiveSession.ts`
- `functions/src/appendTranscript.ts`
- `apps/cookbook/src/data/transcripts.ts`
- `docs/backend-contracts.md`

## Step-by-Step Workflow

### 1) Add mode type and shape in cookbook data layer

In `apps/cookbook/src/data/modes.ts`:

- Add the new literal to `ModeType`.
- Extend the `RecipeMode` union with a new discriminated type object.
- Add defaults for new mode creation.
- Update `toMode(...)` so Firestore data deserializes to the new mode shape.
- Update draft/create/update payload types so new fields persist cleanly.

Important: if unknown types currently fall back to conversational behavior, add explicit handling for the new type so it never silently falls back.

### 2) Ensure recipe create/clone paths preserve new fields

In `apps/cookbook/src/data/recipes.ts` and related mode cloning paths:

- Update mode creation branches to include the new type.
- Update clone/copy logic so new mode-specific fields are preserved.

### 3) Add editor support in cookbook

In `apps/cookbook/src/pages/RecipeEditorPage.tsx`:

- Add a selectable option in `MODE_OPTIONS`.
- Add draft constructor logic for the new mode.
- Update display labels for the new type.
- Update save logic to write mode-specific fields.
- Add UI inputs for any new mode configuration fields.
- Verify publish/unpublish flow still works for the new type.

### 4) Update backend validation and callable contracts

In `functions/src/modeAccess.ts`:

- Add new type to type unions.
- Update mode-type normalization logic.
- Update summary payload builder (`getStudentRecipeConfig` path).
- Update full session payload builder (`getStudentSessionConfig` path).

Keep existing ownership/attachment/publication validation intact unless the new mode requires stricter rules.

### 5) Update student contracts and mode picker behavior

In `apps/student/src/data/recipe.ts`:

- Extend `RecipeMode` and `RecipeModeSummary` unions to include the new type.

In `apps/student/src/pages/RecipePage.tsx`:

- Add new-mode badge/style mapping.
- Add mode description text for picker cards.
- Update start-session text/UX for the new mode.
- Add any mode-specific panel rendering if required.

### 6) Update live prompt/runtime behavior

In `apps/student/src/live/systemPrompt.ts`:

- Add a branch in prompt builder for the new mode.

In `apps/student/src/live/LiveSession.ts`:

- Add mode branch for tool declarations and runtime behavior.
- Add mode-specific tool handling/state paths if needed.

If new tools are introduced, keep them minimal and consistent with existing `coverage` / `assessment` patterns.

### 7) Keep transcripts and docs in sync

Update mode type unions and docs:

- `functions/src/appendTranscript.ts`
- `apps/cookbook/src/data/transcripts.ts`
- `docs/backend-contracts.md`

The backend contract should list the new enum value and any new type-specific fields.

## Validation Checklist

Run lint/typecheck for changed areas, then manual checks:

1. Create a recipe and add the new mode in cookbook.
2. Edit mode settings and save; refresh and confirm values persist.
3. Publish the mode.
4. Open student recipe page and confirm the mode appears in picker.
5. Start a session for that mode; verify expected prompt/runtime behavior.
6. Complete a short session and confirm transcript writes with correct `modeId` and `modeType`.
7. Confirm no callable payload shape mismatch between functions and student app.

## Common Pitfalls

- Missing one union update across cookbook/student/functions.
- New mode not included in create/clone path, causing dropped fields.
- Backend callable summary/session payload not aligned with student type definitions.
- Mode editor UI added, but save path does not serialize all mode fields.
- `toMode` or backend type parser silently falling back to conversational behavior.
- Docs/contract not updated, causing future drift.

## Execution Notes for Agents

- Make changes in small, testable increments.
- Prefer explicit branches over clever abstraction for mode handling.
- Re-check all files in **Required Files** before finishing.
