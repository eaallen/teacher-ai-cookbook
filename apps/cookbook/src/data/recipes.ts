import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";

export interface Recipe {
  id: string;
  ownerUid: string;
  title: string;
  icon: string;
  level: string;
  tags: string[];
  courseMaterial: string;
  systemPrompt: string;
  initialTopics?: { id: string; title: string }[];
  published: boolean;
  liveUrl?: string;
  createdAt?: { seconds: number; nanoseconds: number };
  updatedAt?: { seconds: number; nanoseconds: number };
  publishedAt?: { seconds: number; nanoseconds: number } | null;
}

export type RecipeDraft = Omit<
  Recipe,
  "id" | "createdAt" | "updatedAt" | "publishedAt" | "liveUrl"
>;

export function listenRecipes(
  ownerUid: string,
  cb: (recipes: Recipe[]) => void
): Unsubscribe {
  const q = query(collection(db, "recipes"), where("ownerUid", "==", ownerUid));
  return onSnapshot(q, (snap) => {
    const items: Recipe[] = snap.docs.map((d) => ({
      id: d.id,
      ...(d.data() as Omit<Recipe, "id">),
    }));
    items.sort((a, b) => {
      const at = a.updatedAt?.seconds ?? 0;
      const bt = b.updatedAt?.seconds ?? 0;
      return bt - at;
    });
    cb(items);
  });
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(db, "recipes", id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Recipe, "id">) };
}

export async function createRecipe(
  ownerUid: string,
  draft: Partial<RecipeDraft>
): Promise<string> {
  const ref = await addDoc(collection(db, "recipes"), {
    ownerUid,
    title: draft.title ?? "Untitled recipe",
    icon: draft.icon ?? "📘",
    level: draft.level ?? "grade5",
    tags: draft.tags ?? [],
    courseMaterial: draft.courseMaterial ?? "",
    systemPrompt:
      draft.systemPrompt ??
      "You are a friendly tutor. Greet the student warmly, then guide them through the course material below. Use the addTopic, setTopics, and markCovered tools to track which topics you've discussed.",
    initialTopics: draft.initialTopics ?? [],
    published: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    publishedAt: null,
  });
  return ref.id;
}

export async function updateRecipe(
  id: string,
  patch: Partial<RecipeDraft>
): Promise<void> {
  await updateDoc(doc(db, "recipes", id), {
    ...patch,
    updatedAt: serverTimestamp(),
  });
}

export async function deleteRecipe(id: string): Promise<void> {
  await deleteDoc(doc(db, "recipes", id));
}

export async function publishRecipe(
  id: string,
  liveUrl: string
): Promise<void> {
  await updateDoc(doc(db, "recipes", id), {
    published: true,
    liveUrl,
    publishedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
}

export async function unpublishRecipe(id: string): Promise<void> {
  await updateDoc(doc(db, "recipes", id), {
    published: false,
    updatedAt: serverTimestamp(),
  });
}
