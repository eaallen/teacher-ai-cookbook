import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  updateDoc,
  type DocumentReference,
  type WriteBatch,
} from "firebase/firestore";
import { db } from "../firebase";

export type ModeType = "conversational" | "oral_assessment";

export interface RubricLevel {
  description: string;
  points: number;
}

export interface RubricObjective {
  id: string;
  learningObjective: string;
  evaluation: {
    beginning: RubricLevel;
    developing: RubricLevel;
    proficient: RubricLevel;
    exemplary: RubricLevel;
  };
}

export interface AssessmentRubric {
  learningObjectives: RubricObjective[];
}

interface BaseMode {
  id: string;
  ownerUid: string;
  recipeId: string;
  title: string;
  type: ModeType;
  published: boolean;
  createdAt?: { seconds: number; nanoseconds: number };
  updatedAt?: { seconds: number; nanoseconds: number };
  publishedAt?: { seconds: number; nanoseconds: number } | null;
}

export interface ConversationalMode extends BaseMode {
  type: "conversational";
  systemPrompt: string;
}

export interface OralAssessmentMode extends BaseMode {
  type: "oral_assessment";
  rubric: AssessmentRubric;
}

export type RecipeMode = ConversationalMode | OralAssessmentMode;

export type ModeDraft =
  | Omit<ConversationalMode, "id" | "createdAt" | "updatedAt" | "publishedAt">
  | Omit<OralAssessmentMode, "id" | "createdAt" | "updatedAt" | "publishedAt">;

export const DEFAULT_CONVERSATIONAL_MODE = {
  type: "conversational",
  title: "Conversational",
  systemPrompt:
    "You are a friendly tutor. Greet the student warmly, then guide them through the course material. Use the addTopic, setTopics, and markCovered tools to track which topics you've discussed.",
} satisfies Pick<
  ConversationalMode,
  "type" | "title" | "systemPrompt"
>;

export const DEFAULT_RUBRIC: AssessmentRubric = {
  learningObjectives: [
    {
      id: "objective-1",
      learningObjective: "Explain the core idea from the course material.",
      evaluation: {
        beginning: { description: "Shows minimal understanding.", points: 0 },
        developing: { description: "Shows partial understanding.", points: 8 },
        proficient: { description: "Shows solid understanding.", points: 12 },
        exemplary: {
          description: "Shows deep, accurate understanding.",
          points: 15,
        },
      },
    },
  ],
};

/**
 * Converts a mode snapshot into a typed mode object.
 * @param {string} id - Firestore mode document id.
 * @param {Record<string, unknown>} data - Raw mode document data.
 */
function toMode(id: string, data: Record<string, unknown>): RecipeMode {
  const base = {
    id,
    ownerUid: String(data.ownerUid ?? ""),
    recipeId: String(data.recipeId ?? ""),
    title: String(data.title ?? "Mode"),
    published: Boolean(data.published),
    createdAt: data.createdAt as RecipeMode["createdAt"],
    updatedAt: data.updatedAt as RecipeMode["updatedAt"],
    publishedAt: data.publishedAt as RecipeMode["publishedAt"],
  };

  if (data.type === "oral_assessment") {
    return {
      ...base,
      type: "oral_assessment",
      rubric: (data.rubric as AssessmentRubric | undefined) ?? DEFAULT_RUBRIC,
    };
  }

  return {
    ...base,
    type: "conversational",
    systemPrompt: String(
      data.systemPrompt ?? DEFAULT_CONVERSATIONAL_MODE.systemPrompt
    ),
  };
}

/**
 * Reads the first legacy mode-scoped course material from recipe mode refs.
 * @param {DocumentReference[]} refs - Mode references attached to the recipe.
 */
export async function getLegacyCourseMaterialForRecipeRefs(
  refs: DocumentReference[]
): Promise<string> {
  for (const ref of refs) {
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;
    if (snap.get("type") !== "oral_assessment") {
      const material = String(snap.get("courseMaterial") ?? "");
      if (material.trim()) return material;
    }
  }
  return "";
}

/**
 * Loads a mode from a document reference.
 * @param {DocumentReference} ref - Reference to a top-level mode document.
 */
export async function getMode(ref: DocumentReference): Promise<RecipeMode | null> {
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return toMode(snap.id, snap.data());
}

/**
 * Loads all mode documents referenced by a recipe.
 * @param {DocumentReference[]} refs - Mode document references from a recipe.
 */
export async function getModesForRecipeRefs(
  refs: DocumentReference[]
): Promise<RecipeMode[]> {
  const modes = await Promise.all(refs.map((ref) => getMode(ref)));
  return modes.filter((mode): mode is RecipeMode => Boolean(mode));
}

/**
 * Creates a new top-level mode and attaches its reference to a recipe.
 * @param {ModeDraft} draft - Mode data to create.
 */
export async function createMode(draft: ModeDraft): Promise<DocumentReference> {
  const modeRef = await addDoc(collection(db, "modes"), {
    ...draft,
    published: draft.published ?? false,
    publishedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  await updateDoc(doc(db, "recipes", draft.recipeId), {
    modes: arrayUnion(modeRef),
    updatedAt: serverTimestamp(),
  });
  return modeRef;
}

/**
 * Updates a mode document.
 * @param {string} id - Mode document id.
 * @param {Partial<ModeDraft>} patch - Mode fields to update.
 */
export async function updateMode(
  id: string,
  patch: Partial<ModeDraft>
): Promise<void> {
  await updateDoc(doc(db, "modes", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Publishes a mode for student access.
 * @param {string} id - Mode document id.
 */
export async function publishMode(id: string): Promise<void> {
  await updateDoc(doc(db, "modes", id), {
    published: true,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Removes student access to a mode.
 * @param {string} id - Mode document id.
 */
export async function unpublishMode(id: string): Promise<void> {
  await updateDoc(doc(db, "modes", id), {
    published: false,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a mode and removes its reference from the parent recipe.
 * @param {string} recipeId - Recipe document id that owns the mode.
 * @param {string} modeId - Mode document id to remove.
 */
export async function deleteMode(
  recipeId: string,
  modeId: string
): Promise<void> {
  const modeRef = doc(db, "modes", modeId);
  await updateDoc(doc(db, "recipes", recipeId), {
    modes: arrayRemove(modeRef),
    updatedAt: serverTimestamp(),
  });
  await deleteDoc(modeRef);
}

/**
 * Adds cloned mode docs to a batch for a newly cloned recipe.
 * @param {WriteBatch} batch - Batch that will create the cloned recipe.
 * @param {string} ownerUid - Owner of the cloned mode docs.
 * @param {string} recipeId - New recipe id to attach to cloned modes.
 * @param {RecipeMode[]} modes - Source modes to duplicate.
 */
export function cloneModesForRecipe(
  batch: WriteBatch,
  ownerUid: string,
  recipeId: string,
  modes: RecipeMode[]
): DocumentReference[] {
  const sourceModes =
    modes.length > 0
      ? modes
      : [
          {
            id: "",
            ownerUid,
            recipeId,
            published: false,
            publishedAt: null,
            createdAt: undefined,
            updatedAt: undefined,
            ...DEFAULT_CONVERSATIONAL_MODE,
          } satisfies ConversationalMode,
        ];

  return sourceModes.map((mode) => {
    const modeRef = doc(collection(db, "modes"));
    const { id, createdAt, updatedAt, publishedAt, ...modeData } = mode;
    void id;
    void createdAt;
    void updatedAt;
    void publishedAt;
    batch.set(modeRef, {
      ...modeData,
      ownerUid,
      recipeId,
      published: false,
      publishedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return modeRef;
  });
}
