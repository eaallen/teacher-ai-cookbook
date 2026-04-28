import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";

export interface Recipe {
  id: string;
  title: string;
  icon: string;
  level: string;
  tags: string[];
  courseMaterial: string;
  systemPrompt: string;
  initialTopics?: { id: string; title: string }[];
  published: boolean;
}

export async function loadRecipe(recipeId: string): Promise<Recipe | null> {
  const snap = await getDoc(doc(db, "recipes", recipeId));
  if (!snap.exists()) return null;
  const data = snap.data() as Omit<Recipe, "id">;
  if (!data.published) return null;
  return { id: snap.id, ...data };
}
