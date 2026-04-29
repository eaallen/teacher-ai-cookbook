/**
 * Canonical Live URL shape shared with the student app.
 * Both apps must use this exact path.
 */
export function buildLiveUrl(origin: string, recipeId: string): string {
  const trimmed = origin.replace(/\/+$/, "");
  return `${trimmed}/r/${encodeURIComponent(recipeId)}`;
}
