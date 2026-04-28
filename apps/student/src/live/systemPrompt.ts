import type { Recipe } from "../data/recipe";

const MAX_COURSE_MATERIAL_CHARS = 24000;

export function buildSystemPrompt(recipe: Recipe): string {
  const trimmed =
    recipe.courseMaterial.length > MAX_COURSE_MATERIAL_CHARS
      ? recipe.courseMaterial.slice(0, MAX_COURSE_MATERIAL_CHARS) +
        "\n\n[…course material truncated for length]"
      : recipe.courseMaterial;

  // const seedTopics =
  //   recipe.initialTopics && recipe.initialTopics.length > 0
  //     ? `\n\n## Suggested topic seed\n\n${recipe.initialTopics
  //         .map((t) => `- ${t.id}: ${t.title}`)
  //         .join("\n")}`
  //     : "";

  // return [
  //   recipe.systemPrompt,
  //   "",
  //   "## Course Material",
  //   "",
  //   trimmed,
  //   seedTopics,
  //   "",
  //   "## Tools",
  //   "",
  //   "You have three tools to track what's been covered with the student:",
  //   "- setTopics({topics:[{id,title}]}) — call this once after greeting to register the topic list.",
  //   "- addTopic({id,title}) — register an additional topic mid-conversation.",
  //   "- markCovered({id}) — mark a topic as covered after you've discussed it.",
  //   "",
  //   "Greet the student warmly first. Speak in short, natural sentences.",
  // ].join("\n");


  return `
  RESPOND IN ENGLISH. YOU MUST RESPOND UNMISTAKABLY IN ENGLISH.
  ## Persona
  Only talk about topics related to the course material.

  Your name is Alex. You are a teaching AI.
  Your goal is to have conversations with students to help them learn about a given topic. 

  Speak in short, natural sentences. Push the student to learn and think by asking follow up questions.

  ## COURSE MATERIAL
  ${trimmed}
  `.trim()
}
