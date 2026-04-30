import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { AssessmentRubric } from "./modes";

interface GenerateRubricRequest {
  courseMaterial: string;
  currentRubric: AssessmentRubric;
}

interface GenerateRubricResponse {
  rubric: AssessmentRubric;
}

const generateRubricFn = httpsCallable<
  GenerateRubricRequest,
  GenerateRubricResponse
>(functions, "generateOralAssessmentRubric");

/**
 * Generates an oral assessment rubric from recipe course material.
 * @param {string} courseMaterial - Recipe-level course material markdown.
 * @param {AssessmentRubric} currentRubric - Current rubric to improve or replace.
 */
export async function generateOralAssessmentRubric(
  courseMaterial: string,
  currentRubric: AssessmentRubric
): Promise<AssessmentRubric> {
  const result = await generateRubricFn({ courseMaterial, currentRubric });
  return result.data.rubric;
}
