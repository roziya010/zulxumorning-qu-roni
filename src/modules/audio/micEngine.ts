import { QuranWord, VerificationResult } from '../../types/quran';
import { evaluateArabicTranscriptWords, stripArabicText } from '../recitation/arabicMatcher';

export interface MicEngineCallbacks {
  onVolume: (rms: number) => void;
  onSpeechState: (isSpeaking: boolean) => void;
  onAudioSegment: (base64Wav: string, mimeType: string, latestTranscript?: string) => void;
  onLiveTokens?: (tokens: string[], markConsumed: (count: number) => void) => void;
  onEngineChange?: (mode: 'speech-live' | 'gemini-audio') => void;
  onError: (messageUz: string) => void;
}

const TARGET_SAMPLE_RATE = 16000;

function downsampleTo16k(input: Float32Array, inputSampleRate: number): Float32Array {
  if (inputSampleRate === TARGET_SAMPLE_RATE) return input;
  const ratio = inputSampleRate / TARGET_SAMPLE_RATE;
  const outputLength = Math.floor(input.length / ratio);
  const output = new Float32Array(outputLength);
  for (let i = 0; i < outputLength; i++) {
    const start = Math.floor(i * ratio);
    const end = Math.min(input.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    let count = 0;
    for (let j = start; j < end; j++) {
      sum += input[j];
      count++;
    }
    output[i] = count > 0 ? sum / count : input[start] || 0;
  }
  return output;
}

function encodeWavBase64(samples16k: Float32Array): string {
  const buffer = new ArrayBuffer(44 + samples16k.length * 2);
  const view = new DataView(buffer);

  const writeStr = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeStr(0, 'RIFF');
  view.setUint32(4, 36 + samples16k.length * 2, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeStr(36, 'data');
  view.setUint32(40, samples16k.length * 2, true);

  let offset = 44;
  for (let i = 0; i < samples16k.length; i++) {
    const s = Math.max(-1, Math.min(1, samples16k[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

interface BrowserSpeechRec {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives?: number;
  onresult:
    | ((ev: {
        resultIndex?: number;
        results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>>;
      }) => void)
    | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export class RecitationMicEngine {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private silentGain: GainNode | null = null;
  private callbacks: MicEngineCallbacks;
  private isRunning = false;

  // Real PCM VAD & recording state
  private preRollChunks: Float32Array[] = [];
  private activeChunks: Float32Array[] = [];
  private isSpeaking = false;
  private speechStartMs = 0;
  private silenceStartMs = 0;
  private peakRms = 0;
  private baseThreshold = 0.004;
  private noiseFloor = 0.0012;
  private calibrationFrames = 0;

  // Parallel Web Speech API state (runs alongside PCM capture when supported)
  private recognition: BrowserSpeechRec | null = null;
  private consumedPerResult = new Map<number, number>();
  private interimDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  private speechHandledAtMs = 0;
  private latestTranscript = '';

  constructor(callbacks: MicEngineCallbacks) {
    this.callbacks = callbacks;
  }

  setSensitivity(level: 'yuqori' | 'ortacha' | 'past'): void {
    if (level === 'yuqori') this.baseThreshold = 0.002;
    else if (level === 'past') this.baseThreshold = 0.01;
    else this.baseThreshold = 0.004;
  }

  private getEffectiveThreshold(): number {
    return Math.min(0.03, Math.max(this.baseThreshold, this.noiseFloor * 2.1));
  }

  async start(enableParallelSpeech = true): Promise<boolean> {
    if (this.isRunning) return true;

    // 1. ALWAYS start real hardware getUserMedia PCM recording first!
    // This guarantees browser permission prompt, live audio bars, and reliable WAV recording.
    const pcmStarted = await this.startPcmCapture();
    if (!pcmStarted) {
      return false;
    }

    this.isRunning = true;
    this.speechHandledAtMs = 0;
    this.latestTranscript = '';
    this.consumedPerResult.clear();
    this.callbacks.onEngineChange?.('gemini-audio');

    // 2. Also start parallel Web Speech API (ar-SA) when online & supported.
    // If it emits tokens, we evaluate immediately with zero Gemini quota;
    // if blocked/unsupported/silently empty, real WAV audio still flows to Gemini.
    if (enableParallelSpeech && navigator.onLine) {
      const SpeechRec =
        (window as unknown as { SpeechRecognition?: new () => BrowserSpeechRec }).SpeechRecognition ||
        (window as unknown as { webkitSpeechRecognition?: new () => BrowserSpeechRec }).webkitSpeechRecognition;

      if (SpeechRec) {
        this.startBrowserSpeechRecognition(SpeechRec);
      }
    }

    return true;
  }

  private async startPcmCapture(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      this.callbacks.onError('Qurilmangiz brauzeri mikrofon yozuvini qo‘llab-quvvatlamaydi.');
      return false;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();

      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);

      this.silentGain = this.audioCtx.createGain();
      this.silentGain.gain.value = 0;

      this.source.connect(this.processor);
      this.processor.connect(this.silentGain);
      this.silentGain.connect(this.audioCtx.destination);

      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.preRollChunks = [];
      this.activeChunks = [];
      this.isSpeaking = false;
      this.peakRms = 0;
      this.noiseFloor = 0.0012;
      this.calibrationFrames = 0;

      this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
        if (!this.isRunning || !this.audioCtx) return;
        const input = event.inputBuffer.getChannelData(0);
        const downsampled = downsampleTo16k(input, this.audioCtx.sampleRate);

        let sumSq = 0;
        for (let i = 0; i < downsampled.length; i++) {
          sumSq += downsampled[i] * downsampled[i];
        }
        const rms = Math.sqrt(sumSq / downsampled.length);

        if (!this.isSpeaking) {
          if (this.calibrationFrames < 8) {
            this.noiseFloor =
              this.calibrationFrames === 0
                ? rms
                : this.noiseFloor * 0.75 + rms * 0.25;
            this.calibrationFrames += 1;
          } else if (rms < this.getEffectiveThreshold()) {
            this.noiseFloor = this.noiseFloor * 0.96 + rms * 0.04;
          }
        }

        const threshold = this.getEffectiveThreshold();
        this.callbacks.onVolume(Math.min(1, rms * 20));

        const now = performance.now();

        if (!this.isSpeaking) {
          this.preRollChunks.push(downsampled);
          if (this.preRollChunks.length > 6) {
            this.preRollChunks.shift();
          }

          if (rms > threshold) {
            this.isSpeaking = true;
            this.speechStartMs = now;
            this.silenceStartMs = 0;
            this.peakRms = rms;
            this.activeChunks = [...this.preRollChunks];
            this.preRollChunks = [];
            this.callbacks.onSpeechState(true);
          }
        } else {
          this.activeChunks.push(downsampled);
          if (rms > this.peakRms) this.peakRms = rms;

          if (rms <= threshold * 0.8) {
            if (this.silenceStartMs === 0) {
              this.silenceStartMs = now;
            }
          } else {
            this.silenceStartMs = 0;
          }

          const speechElapsed = now - this.speechStartMs;
          const silenceElapsed = this.silenceStartMs > 0 ? now - this.silenceStartMs : 0;

          if ((silenceElapsed >= 440 && speechElapsed >= 240) || speechElapsed >= 2600) {
            this.emitCurrentSegment();
          }
        }
      };

      return true;
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Mikrofonga ruxsat berilmadi. Brauzer yoki telefon sozlamalaridan mikrofon ruxsatini yoqing.'
          : 'Mikrofonni ishga tushirib bo‘lmadi. Qurilma mikrofonini tekshiring.';
      this.callbacks.onError(msg);
      this.stop();
      return false;
    }
  }

  private emitCurrentSegment(): void {
    if (this.activeChunks.length === 0) {
      this.isSpeaking = false;
      this.callbacks.onSpeechState(false);
      return;
    }

    const totalLen = this.activeChunks.reduce((acc, c) => acc + c.length, 0);
    const durationMs = (totalLen / TARGET_SAMPLE_RATE) * 1000;
    const handledByLiveSpeech = performance.now() - this.speechHandledAtMs < 2000;

    if (durationMs >= 220 && this.peakRms > this.baseThreshold * 0.7 && !handledByLiveSpeech) {
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const chunk of this.activeChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      const base64Wav = encodeWavBase64(merged);
      const hint = this.latestTranscript;
      this.latestTranscript = '';
      this.callbacks.onAudioSegment(base64Wav, 'audio/wav', hint || undefined);
    }

    this.activeChunks = [];
    this.isSpeaking = false;
    this.silenceStartMs = 0;
    this.peakRms = 0;
    this.callbacks.onSpeechState(false);
  }

  private startBrowserSpeechRecognition(SpeechRec: new () => BrowserSpeechRec): void {
    try {
      const rec = new SpeechRec();
      rec.lang = 'ar-SA';
      rec.continuous = true;
      rec.interimResults = true;
      rec.maxAlternatives = 1;
      this.consumedPerResult.clear();

      const flushResultTokens = (
        results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>>,
        startIdx: number,
        isFinalOnly: boolean
      ) => {
        for (let i = startIdx; i < results.length; i++) {
          const item = results[i];
          if (isFinalOnly && !item.isFinal) continue;
          const rawTranscript = item[0]?.transcript?.trim() ?? '';
          if (!rawTranscript) continue;

          this.latestTranscript = rawTranscript;

          const allTokens = rawTranscript
            .split(/\s+/)
            .map((t) => stripArabicText(t))
            .filter(Boolean);

          const alreadyConsumed = this.consumedPerResult.get(i) ?? 0;
          if (allTokens.length <= alreadyConsumed) continue;

          const pending = allTokens.slice(alreadyConsumed);
          this.speechHandledAtMs = performance.now();
          this.callbacks.onEngineChange?.('speech-live');
          this.callbacks.onLiveTokens?.(pending, (consumedCount) => {
            this.consumedPerResult.set(i, alreadyConsumed + Math.max(0, consumedCount));
          });
        }
      };

      rec.onresult = (ev) => {
        if (!this.isRunning) return;
        const startIdx = ev.resultIndex ?? 0;

        if (this.interimDebounceTimer) {
          clearTimeout(this.interimDebounceTimer);
          this.interimDebounceTimer = null;
        }

        flushResultTokens(ev.results, startIdx, true);

        const hasPendingInterim = Array.from({ length: ev.results.length - startIdx }, (_, k) => startIdx + k).some(
          (idx) => !ev.results[idx]?.isFinal
        );

        if (hasPendingInterim) {
          this.interimDebounceTimer = setTimeout(() => {
            if (!this.isRunning) return;
            flushResultTokens(ev.results, startIdx, false);
          }, 420);
        }
      };

      rec.onerror = (ev) => {
        const errCode = ev?.error ?? '';
        if (errCode === 'no-speech' || errCode === 'aborted') return;
        // If browser speech recognition cannot share hardware mic or is unavailable,
        // stop SpeechRecognition quietly and let getUserMedia PCM recording continue untouched!
        if (
          errCode === 'not-allowed' ||
          errCode === 'service-not-allowed' ||
          errCode === 'audio-capture' ||
          errCode === 'network' ||
          errCode === 'language-not-supported'
        ) {
          this.stopRecognitionOnly();
          this.callbacks.onEngineChange?.('gemini-audio');
        }
      };

      rec.onend = () => {
        if (this.isRunning && this.recognition === rec) {
          this.consumedPerResult.clear();
          try {
            rec.start();
          } catch {
            // ignore restart race
          }
        }
      };

      rec.start();
      this.recognition = rec;
    } catch {
      // SpeechRecognition unavailable; PCM capture remains active
    }
  }

  private stopRecognitionOnly(): void {
    if (this.interimDebounceTimer) {
      clearTimeout(this.interimDebounceTimer);
      this.interimDebounceTimer = null;
    }
    if (this.recognition) {
      const rec = this.recognition;
      rec.onend = null;
      rec.onerror = null;
      rec.onresult = null;
      this.recognition = null;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
  }

  stop(): void {
    if (this.isSpeaking && this.activeChunks.length > 0) {
      this.emitCurrentSegment();
    }
    this.isRunning = false;
    this.callbacks.onVolume(0);
    this.callbacks.onSpeechState(false);

    this.stopRecognitionOnly();

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor.onaudioprocess = null;
      this.processor = null;
    }

    if (this.silentGain) {
      try {
        this.silentGain.disconnect();
      } catch {
        // ignore
      }
      this.silentGain = null;
    }

    if (this.source) {
      try {
        this.source.disconnect();
      } catch {
        // ignore
      }
      this.source = null;
    }

    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }

    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
  }
}

/**
 * Evaluates Arabic transcript strictly word-by-word against expected Quran words.
 */
export function evaluateOfflineArabicTranscript(
  transcript: string,
  expectedWords: QuranWord[]
): VerificationResult {
  return evaluateArabicTranscriptWords(transcript, expectedWords, 'offline-speech');
}
