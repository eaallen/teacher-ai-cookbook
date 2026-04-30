import { Type, type FunctionDeclaration } from "@google/genai";
import type { AssessmentRubric } from "../data/recipe";

export type AssessmentLevel =
  | "beginning"
  | "developing"
  | "proficient"
  | "exemplary";

export interface AssessmentObjectiveState {
  id: string;
  title: string;
  assessed: boolean;
  level?: AssessmentLevel;
  points?: number;
  feedback?: string;
}

export type AssessmentState = AssessmentObjectiveState[];

export type AssessmentAction = {
  type: "scoreLearningObjective";
  objectiveId: string;
  level: AssessmentLevel;
  points: number;
  feedback?: string;
};

/**
 * Creates initial assessment UI state from an oral assessment rubric.
 * @param {AssessmentRubric} rubric - Rubric configured by the teacher.
 */
export function createInitialAssessmentState(
  rubric: AssessmentRubric
): AssessmentState {
  return (rubric.learningObjectives ?? []).map((objective, index) => ({
    id: objective.id || `objective-${index + 1}`,
    title: objective.learningObjective || `Objective ${index + 1}`,
    assessed: false,
  }));
}

/**
 * Applies model assessment tool calls to the assessment UI state.
 * @param {AssessmentState} state - Current assessment state.
 * @param {AssessmentAction} action - Assessment update requested by the model.
 */
export function assessmentReducer(
  state: AssessmentState,
  action: AssessmentAction
): AssessmentState {
  const existing = state.find((objective) => objective.id === action.objectiveId);
  const scored = {
    id: action.objectiveId,
    title: existing?.title ?? action.objectiveId,
    assessed: true,
    level: action.level,
    points: action.points,
    feedback: action.feedback,
  };

  if (!existing) return [...state, scored];
  return state.map((objective) =>
    objective.id === action.objectiveId ? scored : objective
  );
}

export const ASSESSMENT_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "scoreLearningObjective",
    description:
      "Record the student's assessed mastery for one learning objective after enough evidence has been gathered.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        objectiveId: { type: Type.STRING },
        level: {
          type: Type.STRING,
          enum: ["beginning", "developing", "proficient", "exemplary"],
        },
        points: { type: Type.NUMBER },
        feedback: { type: Type.STRING },
      },
      required: ["objectiveId", "level", "points"],
    },
  },
];
