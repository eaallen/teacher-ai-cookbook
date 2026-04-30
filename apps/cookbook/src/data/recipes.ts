import {
  collection,
  deleteDoc,
  doc,
  type DocumentReference,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  DEFAULT_CONVERSATIONAL_MODE,
  cloneModesForRecipe,
  type RecipeMode,
} from "./modes";

export interface Recipe {
  id: string;
  ownerUid: string;
  title: string;
  icon: string;
  level: string;
  tags: string[];
  courseMaterial: string;
  modes: DocumentReference[];
  createdAt?: { seconds: number; nanoseconds: number };
  updatedAt?: { seconds: number; nanoseconds: number };
}

export type RecipeDraft = Omit<
  Recipe,
  "id" | "ownerUid" | "createdAt" | "updatedAt"
>;

export interface CreateRecipeDraft extends Partial<RecipeDraft> {
  systemPrompt?: string;
  modeTitle?: string;
  courseMaterial?: string;
  initialModes?: RecipeMode[];
}

export interface LegacyRecipeFields {
  systemPrompt?: string;
  courseMaterial?: string;
  initialTopics?: { id: string; title: string }[];
}

/**
 * Converts a Firestore document into the Cookbook recipe shape.
 * @param {string} id - Firestore recipe document id.
 * @param {Record<string, unknown>} data - Raw Firestore recipe data.
 */
function toRecipe(id: string, data: Record<string, unknown>): Recipe {
  return {
    id,
    ownerUid: String(data.ownerUid ?? ""),
    title: String(data.title ?? ""),
    icon: String(data.icon ?? "📘"),
    level: String(data.level ?? "grade5"),
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    courseMaterial: String(data.courseMaterial ?? ""),
    modes: Array.isArray(data.modes)
      ? (data.modes as DocumentReference[])
      : [],
    createdAt: data.createdAt as Recipe["createdAt"],
    updatedAt: data.updatedAt as Recipe["updatedAt"],
  };
}

/**
 * Listens to recipes owned by the given teacher.
 * @param {string} ownerUid - Teacher uid used to filter recipes.
 * @param {(recipes: Recipe[]) => void} cb - Callback invoked with sorted recipes.
 */
export function listenRecipes(
  ownerUid: string,
  cb: (recipes: Recipe[]) => void
): Unsubscribe {
  const q = query(collection(db, "recipes"), where("ownerUid", "==", ownerUid));
  return onSnapshot(q, (snap) => {
    const items: Recipe[] = snap.docs.map((d) => toRecipe(d.id, d.data()));
    items.sort((a, b) => {
      const at = a.updatedAt?.seconds ?? 0;
      const bt = b.updatedAt?.seconds ?? 0;
      return bt - at;
    });
    cb(items);
  });
}

/**
 * Loads a single recipe document for editor use.
 * @param {string} id - Recipe document id.
 */
export async function getRecipe(id: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(db, "recipes", id));
  if (!snap.exists()) return null;
  return toRecipe(snap.id, snap.data());
}

/**
 * Creates a recipe and attaches its default conversational mode in one batch.
 * @param {string} ownerUid - Teacher uid that owns the new recipe.
 * @param {CreateRecipeDraft} draft - Initial recipe metadata and default mode fields.
 */
export async function createRecipe(
  ownerUid: string,
  draft: CreateRecipeDraft
): Promise<string> {
  const batch = writeBatch(db);
  const recipeRef = doc(collection(db, "recipes"));
  const initialModes =
    draft.initialModes && draft.initialModes.length > 0
      ? draft.initialModes
      : [
          {
            ...DEFAULT_CONVERSATIONAL_MODE,
            id: "",
            ownerUid,
            recipeId: recipeRef.id,
            title: draft.modeTitle ?? "Conversational",
            systemPrompt:
              draft.systemPrompt ?? DEFAULT_CONVERSATIONAL_MODE.systemPrompt,
            published: false,
            publishedAt: null,
          } satisfies RecipeMode,
        ];
  const modeRefs = initialModes.map(() => doc(collection(db, "modes")));

  batch.set(recipeRef, {
    ownerUid,
    title: draft.title ?? "Untitled recipe",
    icon: draft.icon ?? "📘",
    level: draft.level ?? "grade5",
    tags: draft.tags ?? [],
    courseMaterial: draft.courseMaterial ?? "",
    modes: modeRefs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  initialModes.forEach((mode, index) => {
    const modeRef = modeRefs[index];
    const modeData =
      mode.type === "conversational"
        ? {
            title: mode.title,
            type: mode.type,
            systemPrompt: mode.systemPrompt,
          }
        : {
            title: mode.title,
            type: mode.type,
            rubric: mode.rubric,
          };

    batch.set(modeRef, {
      ...modeData,
      ownerUid,
      recipeId: recipeRef.id,
      published: false,
      publishedAt: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  });

  await batch.commit();
  return recipeRef.id;
}

/**
 * Updates recipe-level metadata.
 * @param {string} id - Recipe document id.
 * @param {Partial<RecipeDraft>} patch - Metadata fields to update.
 */
export async function updateRecipe(
  id: string,
  patch: Partial<RecipeDraft>
): Promise<void> {
  await updateDoc(doc(db, "recipes", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Deletes a recipe document.
 * @param {string} id - Recipe document id.
 */
export async function deleteRecipe(id: string): Promise<void> {
  await deleteDoc(doc(db, "recipes", id));
}

/**
 * Clones a recipe and all of its mode documents into a new draft.
 * @param {string} ownerUid - Teacher uid that owns the cloned recipe.
 * @param {Recipe} sourceRecipe - Recipe metadata and mode refs to clone.
 * @param {RecipeMode[]} sourceModes - Loaded mode documents to duplicate.
 */
export async function cloneRecipe(
  ownerUid: string,
  sourceRecipe: Recipe,
  sourceModes: RecipeMode[]
): Promise<string> {
  const batch = writeBatch(db);
  const recipeRef = doc(collection(db, "recipes"));
  const clonedModeRefs = cloneModesForRecipe(
    batch,
    ownerUid,
    recipeRef.id,
    sourceModes
  );

  batch.set(recipeRef, {
    ownerUid,
    title: `${sourceRecipe.title} copy`,
    icon: sourceRecipe.icon,
    level: sourceRecipe.level,
    tags: sourceRecipe.tags,
    courseMaterial: sourceRecipe.courseMaterial,
    modes: clonedModeRefs,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await batch.commit();
  return recipeRef.id;
}
