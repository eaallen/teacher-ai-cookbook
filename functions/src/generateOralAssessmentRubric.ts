import { GoogleGenAI } from "@google/genai";
import { logger } from "firebase-functions/v2";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { GOOGLE_GENAI_API_KEY } from "./secrets";

const RUBRIC_MODEL = "gemini-2.5-flash";
const MAX_COURSE_MATERIAL_CHARS = 24000;

interface RubricLevel {
  description: string;
  points: number;
}

interface RubricObjective {
  id: string;
  learningObjective: string;
  evaluation: {
    beginning: RubricLevel;
    developing: RubricLevel;
    proficient: RubricLevel;
    exemplary: RubricLevel;
  };
}

interface AssessmentRubric {
  learningObjectives: RubricObjective[];
}

interface RequestBody {
  courseMaterial?: string;
  currentRubric?: AssessmentRubric;
}

/**
 * Checks whether the caller is a signed-in teacher account.
 * @param {unknown} authToken - Firebase Auth token from the callable request.
 */
function isTeacherAuth(authToken: unknown): boolean {
  const token = authToken as
    | { firebase?: { sign_in_provider?: string } }
    | undefined;
  return token?.firebase?.sign_in_provider !== "anonymous";
}

/**
 * Builds the prompt used to generate an oral assessment rubric.
 * @param {string} courseMaterial - Recipe-level course material markdown.
 * @param {AssessmentRubric | undefined} currentRubric - Existing rubric to improve when present.
 */
function buildRubricPrompt(
  courseMaterial: string,
  currentRubric: AssessmentRubric | undefined
): string {
  return `
You create concise oral assessment rubrics for teachers.

Use the course material to generate or improve an oral assessment rubric.
Return only valid JSON with this exact shape:
{
  "learningObjectives": [
    {
      "id": "objective-1",
      "learningObjective": "One clear measurable objective.",
      "evaluation": {
        "beginning": { "description": "Observable criteria.", "points": 0 },
        "developing": { "description": "Observable criteria.", "points": 8 },
        "proficient": { "description": "Observable criteria.", "points": 12 },
        "exemplary": { "description": "Observable criteria.", "points": 15 }
      }
    }
  ]
}

Requirements:
- Create 3 to 5 objectives.
- Use short objective ids like objective-1, objective-2, objective-3.
- Keep criteria specific to what a student can demonstrate aloud.
- Keep the four point values exactly 0, 8, 12, and 15.
- If a current rubric is provided, improve it rather than ignoring it.

Current rubric JSON:
${JSON.stringify(currentRubric ?? null, null, 2)}

Course material:
${courseMaterial.slice(0, MAX_COURSE_MATERIAL_CHARS)}
`.trim();
}

/**
 * Pulls JSON out of a model response that may include markdown fences.
 * @param {string} text - Raw model response text.
 */
function parseRubricJson(text: string): unknown {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  return JSON.parse(fenced ? fenced[1] : trimmed);
}

/**
 * Normalizes one rubric level from model output.
 * @param {unknown} value - Raw rubric level value.
 * @param {number} points - Required point value for this level.
 */
function toRubricLevel(value: unknown, points: number): RubricLevel {
  const level = value as { description?: unknown } | undefined;
  return {
    description: String(level?.description ?? "").trim(),
    points,
  };
}

/**
 * Validates and normalizes model output into the app's rubric shape.
 * @param {unknown} value - Raw parsed model response.
 */
function toAssessmentRubric(value: unknown): AssessmentRubric {
  const rawObjectives = (value as { learningObjectives?: unknown })
    .learningObjectives;
  if (!Array.isArray(rawObjectives)) {
    throw new Error("Missing learningObjectives array.");
  }

  const learningObjectives = rawObjectives
    .slice(0, 5)
    .map((objective, index): RubricObjective => {
      const raw = objective as {
        id?: unknown;
        learningObjective?: unknown;
        evaluation?: Record<string, unknown>;
      };
      const evaluation = raw.evaluation ?? {};
      return {
        id: String(raw.id ?? `objective-${index + 1}`).trim(),
        learningObjective: String(raw.learningObjective ?? "").trim(),
        evaluation: {
          beginning: toRubricLevel(evaluation.beginning, 0),
          developing: toRubricLevel(evaluation.developing, 8),
          proficient: toRubricLevel(evaluation.proficient, 12),
          exemplary: toRubricLevel(evaluation.exemplary, 15),
        },
      };
    })
    .filter((objective) => objective.learningObjective.length > 0);

  if (learningObjectives.length === 0) {
    throw new Error("No usable learning objectives.");
  }

  return { learningObjectives };
}

export const generateOralAssessmentRubric = onCall(
  {
    region: "us-central1",
    secrets: [GOOGLE_GENAI_API_KEY],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "Sign in required.");
    }
    if (!isTeacherAuth(request.auth.token)) {
      throw new HttpsError("permission-denied", "Teacher account required.");
    }

    const { courseMaterial, currentRubric } = (request.data ?? {}) as RequestBody;
    const material = String(courseMaterial ?? "").trim();
    if (!material) {
      throw new HttpsError("invalid-argument", "Course material is required.");
    }

    try {
      const ai = new GoogleGenAI({ apiKey: GOOGLE_GENAI_API_KEY.value() });
      const response = await ai.models.generateContent({
        model: RUBRIC_MODEL,
        contents: buildRubricPrompt(material, currentRubric),
        config: {
          responseMimeType: "application/json",
        },
      });
      const text = response.text ?? "";
      return { rubric: toAssessmentRubric(parseRubricJson(text)) };
    } catch (err) {
      logger.error("generateOralAssessmentRubric failed", err);
      throw new HttpsError(
        "internal",
        "Could not generate an oral assessment rubric."
      );
    }
  }
);
