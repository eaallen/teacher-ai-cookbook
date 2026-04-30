import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { TranscriptTurn } from "../live/LiveSession";

const APPEND_BATCH_SIZE = 25;

interface AppendArgs {
  recipeId: string;
  modeId: string;
  sessionId: string;
  turns: TranscriptTurn[];
}

const appendFn = httpsCallable<AppendArgs, { ok: true }>(
  functions,
  "appendTranscript"
);

/**
 * Buffers transcript turns and flushes them to the appendTranscript callable.
 * Designed to be cheap to call: most adds just buffer; flush() pushes whatever
 * is buffered.
 */
export class TranscriptFlusher {
  private buffer: TranscriptTurn[] = [];
  private flushing: Promise<void> | null = null;

  constructor(
    private readonly recipeId: string,
    private readonly modeId: string,
    private readonly sessionId: string
  ) {}

  add(turn: TranscriptTurn) {
    this.buffer.push(turn);
    if (this.buffer.length >= APPEND_BATCH_SIZE) {
      void this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.flushing) return this.flushing;
    if (this.buffer.length === 0) return;
    const turns = this.buffer.splice(0, this.buffer.length);
    this.flushing = (async () => {
      try {
        await appendFn({
          recipeId: this.recipeId,
          modeId: this.modeId,
          sessionId: this.sessionId,
          turns,
        });
      } catch (err) {
        // Re-buffer at the front so we don't lose the turns; caller can retry.
        this.buffer = [...turns, ...this.buffer];
        throw err;
      } finally {
        this.flushing = null;
      }
    })();
    return this.flushing;
  }
}
