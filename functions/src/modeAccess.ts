import { HttpsError, onCall } from "firebase-functions/v2/https";
import {
  DocumentReference,
  DocumentSnapshot,
  getFirestore,
} from "firebase-admin/firestore";

export type ModeType = "conversational" | "oral_assessment";

export interface ModeAccess {
  recipeSnap: DocumentSnapshot;
  modeSnap: DocumentSnapshot;
  ownerUid: string;
  modeType: ModeType;
}

type StudentRecipeModeSummary =
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

interface ModeAccessRequest {
  recipeId?: string;
  modeId?: string;
}

/**
 * Normalizes a raw mode type from Firestore.
 * @param {DocumentSnapshot} modeSnap - Mode document snapshot to inspect.
 */
function getModeType(modeSnap: DocumentSnapshot): ModeType {
  const type = modeSnap.get("type");
  return type === "oral_assessment" ? "oral_assessment" : "conversational";
}

/**
 * Creates the public recipe payload shared by student callables.
 * @param {DocumentSnapshot} recipeSnap - Recipe document snapshot to expose.
 * @param {string} courseMaterialFallback - Optional legacy material from a mode.
 */
function toStudentRecipe(
  recipeSnap: DocumentSnapshot,
  courseMaterialFallback = ""
) {
  return {
    id: recipeSnap.id,
    title: String(recipeSnap.get("title") ?? ""),
    icon: String(recipeSnap.get("icon") ?? "📘"),
    level: String(recipeSnap.get("level") ?? "grade5"),
    tags: Array.isArray(recipeSnap.get("tags")) ? recipeSnap.get("tags") : [],
    courseMaterial: String(
      recipeSnap.get("courseMaterial") ?? courseMaterialFallback
    ),
  };
}

/**
 * Reads learning objectives from an oral assessment rubric.
 * @param {unknown} rubric - Raw rubric field from Firestore.
 */
function getLearningObjectives(rubric: unknown): string[] {
  if (!rubric || typeof rubric !== "object") return [];
  const learningObjectives = (rubric as { learningObjectives?: unknown })
    .learningObjectives;
  if (!Array.isArray(learningObjectives)) return [];
  return learningObjectives
    .map((objective) =>
      String(
        objective && typeof objective === "object"
          ? (objective as { learningObjective?: unknown }).learningObjective ??
              ""
          : ""
      ).trim()
    )
    .filter((objective) => objective.length > 0);
}

/**
 * Converts a published mode snapshot into a student-facing picker summary.
 * @param {DocumentSnapshot} modeSnap - Published mode document snapshot.
 */
function toStudentModeSummary(
  modeSnap: DocumentSnapshot
): StudentRecipeModeSummary {
  const common = {
    id: modeSnap.id,
    title: String(modeSnap.get("title") ?? "Mode"),
    published: true as const,
  };
  const modeType = getModeType(modeSnap);
  if (modeType === "oral_assessment") {
    return {
      ...common,
      type: "oral_assessment",
      learningObjectives: getLearningObjectives(modeSnap.get("rubric")),
    };
  }
  return {
    ...common,
    type: "conversational",
  };
}

/**
 * Converts a validated mode snapshot into a full student session mode.
 * @param {DocumentSnapshot} modeSnap - Validated published mode snapshot.
 * @param {ModeType} modeType - Normalized mode type.
 */
function toStudentSessionMode(modeSnap: DocumentSnapshot, modeType: ModeType) {
  const commonMode = {
    id: modeSnap.id,
    title: String(modeSnap.get("title") ?? "Mode"),
    type: modeType,
    published: true,
  };

  return modeType === "oral_assessment"
    ? {
        ...commonMode,
        type: "oral_assessment" as const,
        rubric: modeSnap.get("rubric") ?? { learningObjectives: [] },
      }
    : {
        ...commonMode,
        type: "conversational" as const,
        systemPrompt: String(modeSnap.get("systemPrompt") ?? ""),
      };
}

/**
 * Reads attached mode references from a recipe document.
 * @param {DocumentSnapshot} recipeSnap - Recipe snapshot containing mode refs.
 */
function getRecipeModeRefs(recipeSnap: DocumentSnapshot): DocumentReference[] {
  const modes = recipeSnap.get("modes");
  if (!Array.isArray(modes)) return [];
  return modes.filter(
    (modeRef): modeRef is DocumentReference => modeRef instanceof DocumentReference
  );
}

/**
 * Checks whether a recipe document has a reference to a mode document.
 * @param {unknown} modes - Raw modes field from the recipe document.
 * @param {string} modePath - Firestore path for the requested mode document.
 */
function recipeContainsMode(modes: unknown, modePath: string): boolean {
  if (!Array.isArray(modes)) return false;
  return modes.some((modeRef) => {
    if (modeRef instanceof DocumentReference) {
      return modeRef.path === modePath;
    }
    if (modeRef && typeof modeRef === "object" && "path" in modeRef) {
      return String((modeRef as { path?: unknown }).path) === modePath;
    }
    return false;
  });
}

/**
 * Validates that a route recipe and mode form a published student session.
 * @param {unknown} data - Callable request payload containing recipeId and modeId.
 */
export async function validateModeAccess(data: unknown): Promise<ModeAccess> {
  const { recipeId, modeId } = (data ?? {}) as ModeAccessRequest;
  if (!recipeId || typeof recipeId !== "string") {
    throw new HttpsError("invalid-argument", "recipeId is required.");
  }
  if (!modeId || typeof modeId !== "string") {
    throw new HttpsError("invalid-argument", "modeId is required.");
  }

  const db = getFirestore();
  const [recipeSnap, modeSnap] = await Promise.all([
    db.doc(`recipes/${recipeId}`).get(),
    db.doc(`modes/${modeId}`).get(),
  ]);

  if (!recipeSnap.exists || !modeSnap.exists) {
    throw new HttpsError("not-found", "Recipe mode not found.");
  }

  const ownerUid = recipeSnap.get("ownerUid");
  if (!ownerUid || typeof ownerUid !== "string") {
    throw new HttpsError("failed-precondition", "Recipe owner is missing.");
  }
  if (modeSnap.get("ownerUid") !== ownerUid) {
    throw new HttpsError("permission-denied", "Mode owner does not match.");
  }
  if (modeSnap.get("recipeId") !== recipeId) {
    throw new HttpsError("permission-denied", "Mode is not attached.");
  }
  if (!recipeContainsMode(recipeSnap.get("modes"), modeSnap.ref.path)) {
    throw new HttpsError("permission-denied", "Mode is not attached.");
  }
  if (modeSnap.get("published") !== true) {
    throw new HttpsError("not-found", "Recipe mode is not published.");
  }

  const modeType = getModeType(modeSnap);

  return { recipeSnap, modeSnap, ownerUid, modeType };
}

/**
 * Returns the validated public configuration needed by the student app.
 */
export const getStudentSessionConfig = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const { recipeSnap, modeSnap, modeType } = await validateModeAccess(
      request.data
    );

    const recipe = toStudentRecipe(
      recipeSnap,
      String(modeSnap.get("courseMaterial") ?? "")
    );
    const mode = toStudentSessionMode(modeSnap, modeType);

    return { recipe, mode };
  }
);

/**
 * Returns the public recipe shell and its published mode choices.
 */
export const getStudentRecipeConfig = onCall(
  { region: "us-central1" },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }

    const { recipeId } = (request.data ?? {}) as ModeAccessRequest;
    if (!recipeId || typeof recipeId !== "string") {
      throw new HttpsError("invalid-argument", "recipeId is required.");
    }

    const db = getFirestore();
    const recipeSnap = await db.doc(`recipes/${recipeId}`).get();
    if (!recipeSnap.exists) {
      throw new HttpsError("not-found", "Recipe not found.");
    }

    const ownerUid = recipeSnap.get("ownerUid");
    if (!ownerUid || typeof ownerUid !== "string") {
      throw new HttpsError("failed-precondition", "Recipe owner is missing.");
    }

    const modeSnaps = await Promise.all(
      getRecipeModeRefs(recipeSnap).map((modeRef) => modeRef.get())
    );
    const modes = modeSnaps
      .filter(
        (modeSnap) =>
          modeSnap.exists &&
          modeSnap.get("ownerUid") === ownerUid &&
          modeSnap.get("recipeId") === recipeId &&
          modeSnap.get("published") === true
      )
      .map(toStudentModeSummary);

    return {
      recipe: toStudentRecipe(recipeSnap),
      modes,
    };
  }
);
