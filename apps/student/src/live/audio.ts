/**
 * Browser audio plumbing for the Live API.
 *
 * Capture: 16 kHz, 16-bit PCM, mono. We use a ScriptProcessorNode for
 * simplicity (per the user rule: prefer simplicity over efficiency). Modern
 * browsers still support it; if Chrome ever removes it we'll move to an
 * AudioWorklet.
 *
 * Playback: 24 kHz PCM chunks scheduled on a single AudioContext clock.
 */

const INPUT_SAMPLE_RATE = 16000;
const OUTPUT_SAMPLE_RATE = 24000;
const CAPTURE_BUFFER_SIZE = 2048;

export type CaptureHandler = (base64Pcm: string) => void;

export interface CaptureSession {
  stop(): void;
  setMuted(muted: boolean): void;
}

export async function startCapture(
  deviceId: string | undefined,
  onChunk: CaptureHandler
): Promise<CaptureSession> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      channelCount: 1,
      echoCancellation: true,
      noiseSuppression: true,
    },
  });

  const ctx = new AudioContext({ sampleRate: INPUT_SAMPLE_RATE });
  // Some browsers require a resume() inside a user gesture. The caller invokes
  // startCapture() from a click handler so this is safe.
  if (ctx.state === "suspended") await ctx.resume();

  const source = ctx.createMediaStreamSource(stream);
  const processor = ctx.createScriptProcessor(CAPTURE_BUFFER_SIZE, 1, 1);
  let muted = false;

  processor.onaudioprocess = (e) => {
    if (muted) return;
    const input = e.inputBuffer.getChannelData(0);
    const pcm16 = floatTo16BitPCM(input);
    onChunk(arrayBufferToBase64(pcm16.buffer));
  };

  source.connect(processor);
  // ScriptProcessorNode requires a destination connection to fire callbacks
  // in some browsers; route to a muted gain so we don't echo.
  const muteGain = ctx.createGain();
  muteGain.gain.value = 0;
  processor.connect(muteGain);
  muteGain.connect(ctx.destination);

  return {
    stop() {
      try {
        processor.disconnect();
        source.disconnect();
        muteGain.disconnect();
        ctx.close();
        stream.getTracks().forEach((t) => t.stop());
      } catch {
        // ignore teardown errors
      }
    },
    setMuted(v) {
      muted = v;
    },
  };
}

function floatTo16BitPCM(input: Float32Array): Int16Array {
  const out = new Int16Array(input.length);
  for (let i = 0; i < input.length; i++) {
    const s = Math.max(-1, Math.min(1, input[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

function arrayBufferToBase64(buf: ArrayBufferLike): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out.buffer;
}

export class PlaybackQueue {
  private ctx: AudioContext | null = null;
  private nextStart = 0;
  private active: AudioBufferSourceNode[] = [];

  ensureContext() {
    if (!this.ctx || this.ctx.state === "closed") {
      this.ctx = new AudioContext({ sampleRate: OUTPUT_SAMPLE_RATE });
      this.nextStart = this.ctx.currentTime;
    }
    return this.ctx;
  }

  enqueue(base64Pcm: string) {
    const ctx = this.ensureContext();
    const buf = base64ToArrayBuffer(base64Pcm);
    const pcm16 = new Int16Array(buf);
    const float32 = new Float32Array(pcm16.length);
    for (let i = 0; i < pcm16.length; i++) float32[i] = pcm16[i] / 0x8000;

    const audioBuf = ctx.createBuffer(1, float32.length, OUTPUT_SAMPLE_RATE);
    audioBuf.copyToChannel(float32, 0);

    const src = ctx.createBufferSource();
    src.buffer = audioBuf;
    src.connect(ctx.destination);

    const startAt = Math.max(this.nextStart, ctx.currentTime);
    src.start(startAt);
    this.nextStart = startAt + audioBuf.duration;

    src.onended = () => {
      this.active = this.active.filter((s) => s !== src);
    };
    this.active.push(src);
  }

  /** Called when the model signals an interruption — flush playback. */
  interrupt() {
    for (const s of this.active) {
      try {
        s.stop();
      } catch {
        // ignore
      }
    }
    this.active = [];
    if (this.ctx) this.nextStart = this.ctx.currentTime;
  }

  close() {
    this.interrupt();
    if (this.ctx) {
      try {
        this.ctx.close();
      } catch {
        // ignore
      }
      this.ctx = null;
    }
  }
}
