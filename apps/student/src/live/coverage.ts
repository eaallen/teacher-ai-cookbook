import { Type, type FunctionDeclaration } from "@google/genai";

export interface Topic {
  id: string;
  title: string;
  covered: boolean;
}

export type CoverageState = Topic[];

export type CoverageAction =
  | { type: "addTopic"; id: string; title: string }
  | { type: "markCovered"; id: string }
  | { type: "setTopics"; topics: { id: string; title: string }[] };

export function coverageReducer(
  state: CoverageState,
  action: CoverageAction
): CoverageState {
  switch (action.type) {
    case "addTopic": {
      if (state.some((t) => t.id === action.id)) return state;
      return [...state, { id: action.id, title: action.title, covered: false }];
    }
    case "markCovered": {
      return state.map((t) =>
        t.id === action.id ? { ...t, covered: true } : t
      );
    }
    case "setTopics": {
      const existing = new Map(state.map((t) => [t.id, t]));
      return action.topics.map((t) => ({
        id: t.id,
        title: t.title,
        covered: existing.get(t.id)?.covered ?? false,
      }));
    }
  }
}

export const TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: "addTopic",
    description: "Register a new topic to be covered in the conversation.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
      },
      required: ["id", "title"],
    },
  },
  {
    name: "markCovered",
    description: "Mark a previously-registered topic as covered.",
    parameters: {
      type: Type.OBJECT,
      properties: { id: { type: Type.STRING } },
      required: ["id"],
    },
  },
  {
    name: "setTopics",
    description:
      "Replace the topic list with a new set. Call this once after greeting the student.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        topics: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              title: { type: Type.STRING },
            },
            required: ["id", "title"],
          },
        },
      },
      required: ["topics"],
    },
  },
];
