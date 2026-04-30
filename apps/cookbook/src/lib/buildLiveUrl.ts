/**
 * Canonical Live URL shape shared with the student app.
 * Both apps must use this exact path.
 * @param {string} origin - Student app origin.
 * @param {string} recipeId - Recipe document id.
 * @param {string} modeId - Mode document id.
 */
export function buildLiveUrl(
  origin: string,
  recipeId: string,
  modeId: string
): string {
  const trimmed = origin.replace(/\/+$/, "");
  return `${trimmed}/r/${encodeURIComponent(recipeId)}/m/${encodeURIComponent(
    modeId
  )}`;
}

const DEFAULT_STUDENT_APP_ORIGIN = "https://teacher-ai-student.web.app";

/**
 * Resolves the student app origin for copied links.
 * @param {string | undefined} configuredOrigin - Optional local development origin.
 */
export function resolveStudentAppOrigin(configuredOrigin: string | undefined): string {
  if (window.location.hostname === "localhost") {
    const origin = configuredOrigin?.trim();
    return origin && origin.length > 0 ? origin : DEFAULT_STUDENT_APP_ORIGIN;
  }
  return DEFAULT_STUDENT_APP_ORIGIN;
}

/**
 * Builds a student URL that opens a recipe's mode picker.
 * @param {string} origin - Student app origin.
 * @param {string} recipeId - Recipe document id.
 */
export function buildRecipeLiveUrl(origin: string, recipeId: string): string {
  const trimmed = origin.replace(/\/+$/, "");
  return `${trimmed}/r/${encodeURIComponent(recipeId)}`;
}
