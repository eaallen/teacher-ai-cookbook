import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

export interface Recipe {
  id: string;
  title: string;
  icon: string;
  level: string;
  tags: string[];
  courseMaterial: string;
}

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

export type RecipeMode =
  | {
      id: string;
      title: string;
      type: "conversational";
      published: true;
      systemPrompt: string;
    }
  | {
      id: string;
      title: string;
      type: "oral_assessment";
      published: true;
      rubric: AssessmentRubric;
    };

export type RecipeModeSummary =
  | {
      id: string;
      title: string;
      type: "conversational";
      published: true;
    }
  | {
      id: string;
      title: string;
      type: "oral_assessment";
      published: true;
      learningObjectives: string[];
    };

export interface StudentRecipeConfig {
  recipe: Recipe;
  modes: RecipeModeSummary[];
}

export interface StudentSessionConfig {
  recipe: Recipe;
  mode: RecipeMode;
}

interface LoadSessionArgs {
  recipeId: string;
  modeId: string;
}

interface LoadRecipeArgs {
  recipeId: string;
}

const loadRecipeFn = httpsCallable<LoadRecipeArgs, StudentRecipeConfig>(
  functions,
  "getStudentRecipeConfig"
);

const loadSessionFn = httpsCallable<LoadSessionArgs, StudentSessionConfig>(
  functions,
  "getStudentSessionConfig"
);

/**
 * Loads the public recipe shell and published mode choices.
 * @param {string} recipeId - Recipe id from the route.
 */
export async function loadStudentRecipe(
  recipeId: string
): Promise<StudentRecipeConfig | null> {
  try {
    const res = await loadRecipeFn({ recipeId });
    return res.data;
  } catch {
    return null;
  }
}

/**
 * Loads the validated public recipe and selected mode for a student session.
 * @param {string} recipeId - Recipe id from the route.
 * @param {string} modeId - Mode id from the route.
 */
export async function loadStudentSession(
  recipeId: string,
  modeId: string
): Promise<StudentSessionConfig | null> {
  try {
    const res = await loadSessionFn({ recipeId, modeId });
    return res.data;
  } catch {
    return null;
  }
}
