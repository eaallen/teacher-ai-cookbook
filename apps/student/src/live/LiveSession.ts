import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { Recipe } from "../data/recipe";
import {
  PlaybackQueue,
  startCapture,
  type CaptureSession,
} from "./audio";
import { buildSystemPrompt } from "./systemPrompt";
import {
  TOOL_DECLARATIONS,
  coverageReducer,
  type CoverageState,
} from "./coverage";

const DEFAULT_MODEL =
  import.meta.env.VITE_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";

export interface TranscriptTurn {
  role: "user" | "model";
  text: string;
  ts: number;
}

export interface SessionEvents {
  onCoverage: (state: CoverageState) => void;
  onTranscript: (turn: TranscriptTurn) => void;
  onStatus: (status: SessionStatus) => void;
  onError: (message: string) => void;
}

export type SessionStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "ended"
  | "error";

interface StartOptions {
  recipe: Recipe;
  micDeviceId?: string;
  voiceName?: string;
  events: SessionEvents;
}

interface TokenResponse {
  token: string;
  expiresAt: string;
  model: string;
}

export class LiveSession {
  private session: Session | null = null;
  private capture: CaptureSession | null = null;
  private playback = new PlaybackQueue();
  private coverage: CoverageState = [];
  private events: SessionEvents | null = null;
  private opts: StartOptions | null = null;
  private endedByUser = false;
  private currentInputTurn = "";
  private currentOutputTurn = "";

  async start(opts: StartOptions): Promise<void> {
    this.opts = opts;
    this.events = opts.events;
    this.endedByUser = false;
    this.coverage = [];
    opts.events.onStatus("connecting");
    try {
      await this.connect();
      this.capture = await startCapture(opts.micDeviceId, (b64) => {
        this.session?.sendRealtimeInput({
          audio: { data: b64, mimeType: "audio/pcm;rate=16000" },
        });
      });
      opts.events.onStatus("connected");
    } catch (e) {
      opts.events.onError((e as Error).message);
      opts.events.onStatus("error");
      this.cleanup();
      throw e;
    }
  }

  private async fetchToken(recipeId: string): Promise<TokenResponse> {
    const fn = httpsCallable<{ recipeId: string }, TokenResponse>(
      functions,
      "createLiveSessionToken"
    );
    const res = await fn({ recipeId });
    return res.data;
  }

  private async connect(): Promise<void> {
    if (!this.opts || !this.events) throw new Error("Session not initialized.");
    const tokenRes = await this.fetchToken(this.opts.recipe.id);
    const ai = new GoogleGenAI({
      apiKey: tokenRes.token,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const systemInstruction = buildSystemPrompt(this.opts.recipe);

    this.session = await ai.live.connect({
      model: DEFAULT_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: TOOL_DECLARATIONS }],
        ...(this.opts.voiceName
          ? {
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: this.opts.voiceName },
                },
              },
            }
          : {}),
      },
      callbacks: {
        onopen: () => {
          // No-op: we surface 'connected' once capture is wired.
        },
        onmessage: (msg) => this.handleMessage(msg),
        onerror: (err: unknown) => {
          const msg =
            err && typeof err === "object" && "message" in err
              ? String((err as { message?: unknown }).message)
              : String(err);
          this.events?.onError(msg);
        },
        onclose: () => {
          if (!this.endedByUser) {
            this.events?.onStatus("reconnecting");
            void this.attemptReconnect();
          }
        },
      },
    });
  }

  private async attemptReconnect(): Promise<void> {
    try {
      await new Promise((r) => setTimeout(r, 500));
      await this.connect();
      this.events?.onStatus("connected");
    } catch (e) {
      this.events?.onError(`Reconnect failed: ${(e as Error).message}`);
      this.events?.onStatus("error");
    }
  }

  private handleMessage(msg: LiveServerMessage) {
    const content = msg.serverContent;
    if (content) {
      if (content.modelTurn?.parts) {
        for (const part of content.modelTurn.parts) {
          const inline = part.inlineData;
          if (inline?.data && inline.mimeType?.startsWith("audio/pcm")) {
            this.playback.enqueue(inline.data);
          }
        }
      }
      if (content.inputTranscription?.text) {
        this.currentInputTurn += content.inputTranscription.text;
      }
      if (content.outputTranscription?.text) {
        this.currentOutputTurn += content.outputTranscription.text;
      }
      if (content.interrupted) {
        this.playback.interrupt();
      }
      if (content.turnComplete) {
        this.flushTurn();
      }
    }

    if (msg.toolCall?.functionCalls) {
      for (const call of msg.toolCall.functionCalls) {
        this.handleToolCall(call.id ?? "", call.name ?? "", call.args ?? {});
      }
    }
  }

  private flushTurn() {
    const ts = Date.now();
    if (this.currentInputTurn.trim()) {
      this.events?.onTranscript({
        role: "user",
        text: this.currentInputTurn.trim(),
        ts,
      });
    }
    if (this.currentOutputTurn.trim()) {
      this.events?.onTranscript({
        role: "model",
        text: this.currentOutputTurn.trim(),
        ts,
      });
    }
    this.currentInputTurn = "";
    this.currentOutputTurn = "";
  }

  private handleToolCall(
    id: string,
    name: string,
    args: Record<string, unknown>
  ) {
    let nextState = this.coverage;
    try {
      switch (name) {
        case "addTopic":
          nextState = coverageReducer(this.coverage, {
            type: "addTopic",
            id: String(args.id ?? ""),
            title: String(args.title ?? ""),
          });
          break;
        case "markCovered":
          nextState = coverageReducer(this.coverage, {
            type: "markCovered",
            id: String(args.id ?? ""),
          });
          break;
        case "setTopics":
          nextState = coverageReducer(this.coverage, {
            type: "setTopics",
            topics: (args.topics as { id: string; title: string }[]) ?? [],
          });
          break;
        default:
          // Unknown tool — still ack so the model doesn't hang.
          break;
      }
    } catch (e) {
      this.events?.onError(`Tool handler failed: ${(e as Error).message}`);
    }

    if (nextState !== this.coverage) {
      this.coverage = nextState;
      this.events?.onCoverage(nextState);
    }

    this.session?.sendToolResponse({
      functionResponses: [{ id, name, response: { ok: true } }],
    });
  }

  sendText(text: string) {
    this.session?.sendRealtimeInput({ text });
    this.events?.onTranscript({ role: "user", text, ts: Date.now() });
  }

  setMuted(muted: boolean) {
    this.capture?.setMuted(muted);
  }

  async end(): Promise<void> {
    this.endedByUser = true;
    this.cleanup();
    this.events?.onStatus("ended");
  }

  private cleanup() {
    try {
      this.capture?.stop();
    } catch {
      // ignore
    }
    this.capture = null;
    try {
      this.session?.close();
    } catch {
      // ignore
    }
    this.session = null;
    this.playback.close();
  }
}
