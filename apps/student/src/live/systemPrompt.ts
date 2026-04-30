import type { Recipe, RecipeMode } from "../data/recipe";

const MAX_COURSE_MATERIAL_CHARS = 24000;

/**
 * Trims long course material so it can fit into the Live API session prompt.
 * @param {string} courseMaterial - Teacher-provided course material.
 */
function trimCourseMaterial(courseMaterial: string): string {
  return courseMaterial.length > MAX_COURSE_MATERIAL_CHARS
    ? courseMaterial.slice(0, MAX_COURSE_MATERIAL_CHARS) +
        "\n\n[…course material truncated for length]"
    : courseMaterial;
}

/**
 * Builds the mode-specific system prompt for a live student session.
 * @param {Recipe} recipe - Recipe metadata for context.
 * @param {RecipeMode} mode - Selected mode configuration.
 */
export function buildSystemPrompt(recipe: Recipe, mode: RecipeMode): string {
  if (mode.type === "oral_assessment") {
    return buildOralAssessmentPrompt(recipe, mode);
  }
  return buildConversationalPrompt(recipe, mode);
}

/**
 * Builds the conversational tutor prompt.
 * @param {Recipe} recipe - Recipe metadata for context.
 * @param {Extract<RecipeMode, { type: "conversational" }>} mode - Conversational mode config.
 */
function buildConversationalPrompt(
  recipe: Recipe,
  mode: Extract<RecipeMode, { type: "conversational" }>
): string {
  const trimmed = trimCourseMaterial(recipe.courseMaterial);

  return `
  RESPOND IN ENGLISH. YOU MUST RESPOND UNMISTAKABLY IN ENGLISH.
  ## Persona
  Only talk about topics related to the course material.

  Your name is Alex. You are a teaching AI.
  Your goal is to have conversations with students to help them learn about a given topic. 

  Speak in short, natural sentences. Push the student to learn and think by asking follow up questions.
  Use the addTopic, setTopics, and markCovered tools to track which topics you have discussed.

  ## RECIPE
  ${recipe.title}

  ## TEACHER INSTRUCTIONS
  ${mode.systemPrompt}
  
  ## COURSE MATERIAL
  ${trimmed}
  `.trim()
}

/**
 * Builds the oral assessment prompt.
 * @param {Recipe} recipe - Recipe metadata for context.
 * @param {Extract<RecipeMode, { type: "oral_assessment" }>} mode - Oral assessment mode config.
 */
function buildOralAssessmentPrompt(
  recipe: Recipe,
  mode: Extract<RecipeMode, { type: "oral_assessment" }>
): string {
  return `
  RESPOND IN ENGLISH. YOU MUST RESPOND UNMISTAKABLY IN ENGLISH.

  ## Persona
  Your name is Alex. You are conducting an oral assessment for ${recipe.title}.
  Tell the student clearly that this is an oral assessment before you begin.

  ## Assessment behavior
  Ask short probing questions that reveal the student's understanding.
  Do not lecture unless a very brief clarification is necessary.
  Evaluate one learning objective at a time.
  Only call scoreLearningObjective after the student has provided enough evidence.
  When scoring, use the exact objective id from the rubric and one of: beginning, developing, proficient, exemplary.

  ## Rubric JSON
  ${JSON.stringify(mode.rubric, null, 2)}
  `.trim();
}
