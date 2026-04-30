import {
  collection,
  onSnapshot,
  orderBy,
  query,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";

export interface TranscriptTurn {
  role: "user" | "model";
  text: string;
  ts: number;
}

export interface TranscriptDoc {
  id: string;
  ownerUid: string;
  recipeId: string;
  modeId?: string;
  modeType?: "conversational" | "oral_assessment";
  studentUid: string;
  startedAt?: { seconds: number };
  lastAppendedAt?: { seconds: number };
  turns: TranscriptTurn[];
}

export function listenTranscripts(
  recipeId: string,
  cb: (items: TranscriptDoc[]) => void
): Unsubscribe {
  const q = query(
    collection(db, "recipes", recipeId, "transcripts"),
    orderBy("lastAppendedAt", "desc")
  );
  return onSnapshot(q, (snap) => {
    cb(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<TranscriptDoc, "id">),
      }))
    );
  });
}
