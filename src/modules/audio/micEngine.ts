import { QuranWord, VerificationResult } from '../../types/quran';
import { stripArabicDiacritics } from '../tajweed/tajweedParser';

export interface MicEngineCallbacks {
  onVolume: (rms: number) => void;
  onSpeechState: (isSpeaking: boolean) => void;
  onAudioSegment: (base64Wav: string, mimeType: string, latestTranscript?: string) => void;
  onLiveTranscript?: (transcript: string, isFinal: boolean) => void;
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

export class RecitationMicEngine {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private callbacks: MicEngineCallbacks;
  private isRunning = false;

  // Adaptive VAD & buffering state
  private preRollChunks: Float32Array[] = [];
  private activeChunks: Float32Array[] = [];
  private isSpeaking = false;
  private speechStartMs = 0;
  private silenceStartMs = 0;
  private peakRms = 0;
  private baseThreshold = 0.0045;
  private noiseFloor = 0.0015;
  private calibrationFrames = 0;

  // Parallel browser SpeechRecognition
  private recognition: unknown = null;
  private latestTranscript = '';
  private lastTranscriptCursor = 0;

  constructor(callbacks: MicEngineCallbacks) {
    this.callbacks = callbacks;
  }

  setSensitivity(level: 'yuqori' | 'ortacha' | 'past'): void {
    if (level === 'yuqori') this.baseThreshold = 0.0022;
    else if (level === 'past') this.baseThreshold = 0.011;
    else this.baseThreshold = 0.0045;
  }

  private getEffectiveThreshold(): number {
    return Math.min(0.032, Math.max(this.baseThreshold, this.noiseFloor * 2.15));
  }

  async start(enableSpeechRecognitionBackup: boolean): Promise<boolean> {
    if (this.isRunning) return true;

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

      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtx();
      if (this.audioCtx.state === 'suspended') {
        await this.audioCtx.resume();
      }

      this.source = this.audioCtx.createMediaStreamSource(this.stream);
      this.processor = this.audioCtx.createScriptProcessor(2048, 1, 1);

      const silentGain = this.audioCtx.createGain();
      silentGain.gain.value = 0;

      this.source.connect(this.processor);
      this.processor.connect(silentGain);
      silentGain.connect(this.audioCtx.destination);

      this.isRunning = true;
      this.preRollChunks = [];
      this.activeChunks = [];
      this.isSpeaking = false;
      this.peakRms = 0;
      this.noiseFloor = 0.0015;
      this.calibrationFrames = 0;
      this.latestTranscript = '';
      this.lastTranscriptCursor = 0;

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
          if (this.calibrationFrames < 10) {
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
        this.callbacks.onVolume(Math.min(1, rms * 18));

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

          if ((silenceElapsed >= 460 && speechElapsed >= 240) || speechElapsed >= 2200) {
            this.emitCurrentSegment();
          }
        }
      };

      if (enableSpeechRecognitionBackup) {
        this.startBrowserSpeechRecognition();
      }

      return true;
    } catch (err) {
      const msg =
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Mikrofonga ruxsat berilmadi. Telefon yoki brauzer sozlamalaridan mikrofon ruxsatini yoqing.'
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

    if (durationMs >= 240 && this.peakRms > this.baseThreshold * 0.75) {
      const merged = new Float32Array(totalLen);
      let offset = 0;
      for (const chunk of this.activeChunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      const base64Wav = encodeWavBase64(merged);
      const transcriptHint = this.latestTranscript;
      this.latestTranscript = '';
      this.callbacks.onAudioSegment(base64Wav, 'audio/wav', transcriptHint || undefined);
    }

    this.activeChunks = [];
    this.isSpeaking = false;
    this.silenceStartMs = 0;
    this.peakRms = 0;
    this.callbacks.onSpeechState(false);
  }

  private startBrowserSpeechRecognition(): void {
    const SpeechRec =
      (window as unknown as { SpeechRecognition?: new () => unknown }).SpeechRecognition ||
      (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;

    if (!SpeechRec) return;
    try {
      const rec = new SpeechRec() as {
        lang: string;
        continuous: boolean;
        interimResults: boolean;
        onresult: ((ev: { resultIndex?: number; results: ArrayLike<{ isFinal?: boolean } & ArrayLike<{ transcript: string }>> }) => void) | null;
        onerror: ((ev: { error?: string }) => void) | null;
        onend: (() => void) | null;
        start: () => void;
        stop: () => void;
      };
      rec.lang = 'ar-SA';
      rec.continuous = true;
      rec.interimResults = true;
      this.lastTranscriptCursor = 0;
      rec.onresult = (ev) => {
        const startIdx = Math.max(this.lastTranscriptCursor, ev.resultIndex ?? 0);
        const parts: string[] = [];
        let sawFinal = false;
        for (let i = startIdx; i < ev.results.length; i++) {
          const item = ev.results[i];
          const txt = item[0]?.transcript?.trim();
          if (txt) parts.push(txt);
          if (item.isFinal) {
            this.lastTranscriptCursor = i + 1;
            sawFinal = true;
          }
        }
        const combined = parts.join(' ').trim();
        if (combined) {
          this.latestTranscript = combined;
          this.callbacks.onLiveTranscript?.(combined, sawFinal);
        }
      };
      rec.onerror = (ev) => {
        if (ev?.error === 'not-allowed' || ev?.error === 'service-not-allowed') {
          this.recognition = null;
        }
      };
      rec.onend = () => {
        if (this.isRunning && this.recognition === rec) {
          this.lastTranscriptCursor = 0;
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
      // Browser SpeechRecognition unavailable
    }
  }

  consumePendingTranscript(): string {
    const t = this.latestTranscript;
    this.latestTranscript = '';
    return t;
  }

  stop(): void {
    if (this.isSpeaking && this.activeChunks.length > 0) {
      this.emitCurrentSegment();
    }
    this.isRunning = false;
    this.callbacks.onVolume(0);
    this.callbacks.onSpeechState(false);

    if (this.recognition) {
      const rec = this.recognition as { onend: (() => void) | null; stop: () => void };
      rec.onend = null;
      this.recognition = null;
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }

    if (this.processor) {
      try {
        this.processor.disconnect();
      } catch {
        // ignore
      }
      this.processor.onaudioprocess = null;
      this.processor = null;
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

const CONFUSED_LETTER_PAIRS: Array<[string, string]> = [
  ['س', 'ص'],
  ['ت', 'ط'],
  ['د', 'ض'],
  ['ذ', 'ز'],
  ['ح', 'ه'],
  ['ع', 'ا'],
  ['ق', 'ك'],
  ['ث', 'س'],
];

function expandUthmaniForSpeech(displayArabic: string): string {
  const withDaggerAlif = displayArabic
    .replace(/\u0640\u0670/g, 'ا')
    .replace(/[\u066E\u0649]\u0670/g, 'ا')
    .replace(/\u0670/g, 'ا');
  return stripArabicDiacritics(withDaggerAlif);
}

function countChar(str: string, ch: string): number {
  let count = 0;
  for (let i = 0; i < str.length; i++) {
    if (str[i] === ch) count += 1;
  }
  return count;
}

function findConfusedPair(target: string, spoken: string): string | null {
  for (const [a, b] of CONFUSED_LETTER_PAIRS) {
    const tA = countChar(target, a);
    const sA = countChar(spoken, a);
    const tB = countChar(target, b);
    const sB = countChar(spoken, b);
    if ((tA > sA && sB > tB) || (tB > sB && sA > tA)) {
      return `${a} ↔ ${b}`;
    }
  }
  return null;
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function isArabicWordMatch(expected: QuranWord, spokenPlain: string): {
  matched: boolean;
  confusedPair: string | null;
} {
  const formA = expected.plainArabic;
  const formB = expandUthmaniForSpeech(expected.displayArabic);
  if (spokenPlain === formA || spokenPlain === formB) {
    return { matched: true, confusedPair: null };
  }

  const confused = findConfusedPair(formA, spokenPlain);
  if (confused) {
    return { matched: false, confusedPair: confused };
  }

  const distA = levenshtein(formA, spokenPlain);
  const distB = levenshtein(formB, spokenPlain);
  const bestDist = Math.min(distA, distB);
  const minLen = Math.min(formA.length, formB.length);

  // Strict threshold: 0 edits for <=4 chars, max 1 edit for >=5 chars
  if (minLen >= 5 && bestDist <= 1) {
    return { matched: true, confusedPair: null };
  }

  return { matched: false, confusedPair: null };
}

/**
 * Evaluates Arabic transcript strictly word-by-word against expected Quran words.
 */
export function evaluateOfflineArabicTranscript(
  transcript: string,
  expectedWords: QuranWord[]
): VerificationResult {
  const spokenTokens = transcript
    .split(/\s+/)
    .map((t) => stripArabicDiacritics(t))
    .filter(Boolean);

  if (spokenTokens.length === 0) {
    return {
      status: 'unclear',
      matchedCount: 0,
      heardArabic: '',
      errorWordIndex: -1,
      errorCategory: 'none',
      feedbackUz: 'Ovozni aniq tekshira olmadim, qayta o‘qing.',
      engine: 'offline-speech',
    };
  }

  let matchedCount = 0;
  for (let i = 0; i < Math.min(spokenTokens.length, expectedWords.length); i++) {
    const check = isArabicWordMatch(expectedWords[i], spokenTokens[i]);
    if (check.matched) {
      matchedCount += 1;
    } else {
      return {
        status: 'error',
        matchedCount,
        heardArabic: transcript,
        errorWordIndex: i,
        errorCategory: 'harf',
        confusedLetters: check.confusedPair ?? undefined,
        feedbackUz: check.confusedPair
          ? `«${expectedWords[i].displayArabic}» so‘zida ${check.confusedPair} harfi adashib ketdi. Qayta aniq o‘qing.`
          : `«${expectedWords[i].displayArabic}» so‘zida xato aniqlandi. Qizil so‘zni qayta to‘g‘ri o‘qing.`,
        engine: 'offline-speech',
      };
    }
  }

  return {
    status: matchedCount > 0 ? 'matched' : 'unclear',
    matchedCount,
    heardArabic: transcript,
    errorWordIndex: -1,
    errorCategory: 'none',
    feedbackUz:
      matchedCount > 0
        ? 'To‘g‘ri o‘qildi.'
        : 'Ovozni aniq tekshira olmadim, qayta o‘qing.',
    engine: 'offline-speech',
  };
}
