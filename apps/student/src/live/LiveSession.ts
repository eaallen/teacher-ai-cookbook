import {
  GoogleGenAI,
  Modality,
  type LiveServerMessage,
  type Session,
} from "@google/genai";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import type { Recipe, RecipeMode } from "../data/recipe";
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
import {
  ASSESSMENT_TOOL_DECLARATIONS,
  assessmentReducer,
  createInitialAssessmentState,
  type AssessmentLevel,
  type AssessmentState,
} from "./assessment";

const DEFAULT_MODEL =
  import.meta.env.VITE_LIVE_MODEL ?? "gemini-3.1-flash-live-preview";

export interface TranscriptTurn {
  role: "user" | "model";
  text: string;
  ts: number;
}

export interface SessionEvents {
  onCoverage: (state: CoverageState) => void;
  onAssessment: (state: AssessmentState) => void;
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
  mode: RecipeMode;
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
  private assessment: AssessmentState = [];
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
    this.assessment =
      opts.mode.type === "oral_assessment"
        ? createInitialAssessmentState(opts.mode.rubric)
        : [];
    opts.events.onCoverage(this.coverage);
    opts.events.onAssessment(this.assessment);
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

  private async fetchToken(
    recipeId: string,
    modeId: string
  ): Promise<TokenResponse> {
    const fn = httpsCallable<{ recipeId: string; modeId: string }, TokenResponse>(
      functions,
      "createLiveSessionToken"
    );
    const res = await fn({ recipeId, modeId });
    return res.data;
  }

  private async connect(): Promise<void> {
    if (!this.opts || !this.events) throw new Error("Session not initialized.");
    const tokenRes = await this.fetchToken(
      this.opts.recipe.id,
      this.opts.mode.id
    );
    const ai = new GoogleGenAI({
      apiKey: tokenRes.token,
      httpOptions: { apiVersion: "v1alpha" },
    });

    const systemInstruction = buildSystemPrompt(
      this.opts.recipe,
      this.opts.mode
    );
    const tools =
      this.opts.mode.type === "oral_assessment"
        ? ASSESSMENT_TOOL_DECLARATIONS
        : TOOL_DECLARATIONS;

    this.session = await ai.live.connect({
      model: DEFAULT_MODEL,
      config: {
        responseModalities: [Modality.AUDIO],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        inputAudioTranscription: {},
        outputAudioTranscription: {},
        tools: [{ functionDeclarations: tools }],
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

  /**
   * Handles one Live API server message, including batched tool calls.
   * @param {LiveServerMessage} msg - Server message from the Live API socket.
   */
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
      const functionResponses = msg.toolCall.functionCalls.map((call) =>
        this.handleToolCall(call.id ?? "", call.name ?? "", call.args ?? {})
      );
      this.session?.sendToolResponse({ functionResponses });
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

  /**
   * Applies a model tool call locally and returns a Live API function response.
   * @param {string} id - Tool call id from the Live API.
   * @param {string} name - Tool function name requested by the model.
   * @param {Record<string, unknown>} args - Raw tool call arguments.
   */
  private handleToolCall(
    id: string,
    name: string,
    args: Record<string, unknown>
  ): { id: string; name: string; response: { ok: boolean; error?: string } } {
    let nextState = this.coverage;
    try {
      switch (name) {
        case "addTopic":
          nextState = coverageReducer(nextState, {
            type: "addTopic",
            id: String(args.id ?? ""),
            title: String(args.title ?? ""),
          });
          break;
        case "markCovered":
          nextState = coverageReducer(nextState, {
            type: "markCovered",
            id: String(args.id ?? ""),
          });
          break;
        case "setTopics":
          nextState = coverageReducer(nextState, {
            type: "setTopics",
            topics: (args.topics as { id: string; title: string }[]) ?? [],
          });
          break;
        case "scoreLearningObjective":
          this.handleAssessmentTool(args);
          break;
        default:
          // Unknown tool — still ack so the model doesn't hang.
          break;
      }
    } catch (e) {
      const message = (e as Error).message;
      this.events?.onError(`Tool handler failed: ${message}`);
      return { id, name, response: { ok: false, error: message } };
    }

    if (nextState !== this.coverage) {
      this.coverage = nextState;
      this.events?.onCoverage(nextState);
    }

    return { id, name, response: { ok: true } };
  }

  /**
   * Applies oral assessment scoring tool calls to local assessment state.
   * @param {Record<string, unknown>} args - Raw model tool call arguments.
   */
  private handleAssessmentTool(args: Record<string, unknown>) {
    const level = String(args.level ?? "");
    if (!this.isAssessmentLevel(level)) {
      throw new Error(`Invalid assessment level: ${level}`);
    }
    this.assessment = assessmentReducer(this.assessment, {
      type: "scoreLearningObjective",
      objectiveId: String(args.objectiveId ?? ""),
      level,
      points: Number(args.points ?? 0),
      feedback:
        typeof args.feedback === "string" ? args.feedback : undefined,
    });
    this.events?.onAssessment(this.assessment);
  }

  /**
   * Narrows model-provided strings to supported rubric levels.
   * @param {string} value - Candidate assessment level.
   */
  private isAssessmentLevel(value: string): value is AssessmentLevel {
    return (
      value === "beginning" ||
      value === "developing" ||
      value === "proficient" ||
      value === "exemplary"
    );
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
