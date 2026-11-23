import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Brain,
  Eye,
  EyeOff,
  Mic,
  MicOff,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import {
  AppSettings,
  MicStatusState,
  QuranWord,
  RawQuranAyah,
  WordRecitationStatus,
} from '../types/quran';
import { getSurahMeta, STATIC_SURAHS_LIST } from '../modules/quranData/surahNamesUz';
import { VERIFIED_SEED_PAGES } from '../modules/quranData/verifiedSeedPages';
import {
  parsePageWords,
  TAJWEED_RULES_MAP,
  toArabicDigits,
} from '../modules/tajweed/tajweedParser';
import { RecitationMicEngine, evaluateOfflineArabicTranscript } from '../modules/audio/micEngine';
import { verifyRecitationAudio } from '../modules/recitation/recitationEngine';
import { triggerErrorVibration, triggerSuccessVibration } from '../modules/haptics/vibration';
import {
  getMemorizationMap,
  recordReadingActivity,
  saveMemorizationEntry,
} from '../modules/storage/localDb';

interface MemorizationViewProps {
  settings: AppSettings;
  isOnline: boolean;
  onStatsUpdated: () => void;
}

type HideMode = 'full-hidden' | 'first-word' | 'visible';

export const MemorizationView: React.FC<MemorizationViewProps> = ({
  settings,
  isOnline,
  onStatsUpdated,
}) => {
  const [selectedSurah, setSelectedSurah] = useState(112); // Ixlos default for quick Hifz start
  const [ayahs, setAyahs] = useState<RawQuranAyah[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hideMode, setHideMode] = useState<HideMode>('first-word');
  const [peekWordIdx, setPeekWordIdx] = useState<number | null>(null);

  const [wordStatuses, setWordStatuses] = useState<WordRecitationStatus[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [errorWordIndex, setErrorWordIndex] = useState<number | null>(null);
  const [feedbackUz, setFeedbackUz] = useState<string | null>(null);
  const [isMicOn, setIsMicOn] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatusState>('idle');
  const [hifzCompleted, setHifzCompleted] = useState(false);

  const micEngineRef = useRef<RecitationMicEngine | null>(null);
  const wordsRef = useRef<QuranWord[]>([]);
  const cursorRef = useRef(0);
  const errorIndexRef = useRef<number | null>(null);
  const queuePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);
  const geminiCooldownUntilRef = useRef(0);

  const words = useMemo(() => parsePageWords(ayahs), [ayahs]);

  useEffect(() => {
    wordsRef.current = words;
  }, [words]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      micEngineRef.current?.stop();
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(null);
      setHifzCompleted(false);
      micEngineRef.current?.stop();
      setIsMicOn(false);
      setMicStatus('idle');

      try {
        if (navigator.onLine) {
          const res = await fetch(`/api/quran/surah/${selectedSurah}`);
          if (res.ok) {
            const data = (await res.json()) as { ayahs: RawQuranAyah[] };
            if (!cancelled) {
              setAyahs(data.ayahs.slice(0, 20)); // Focus on up to 20 ayahs per Hifz session
              const w = parsePageWords(data.ayahs.slice(0, 20));
              setWordStatuses(Array(w.length).fill('unread'));
              setCurrentWordIndex(0);
              cursorRef.current = 0;
              setErrorWordIndex(null);
              errorIndexRef.current = null;
              setFeedbackUz(null);
              setLoading(false);
              return;
            }
          }
        }

        // Offline seed check for Surah 1 & 112-114
        const seedAyahs = [
          ...VERIFIED_SEED_PAGES[1].ayahs,
          ...VERIFIED_SEED_PAGES[604].ayahs,
        ].filter((a) => a.surahNumber === selectedSurah);

        if (seedAyahs.length > 0 && !cancelled) {
          setAyahs(seedAyahs);
          const w = parsePageWords(seedAyahs);
          setWordStatuses(Array(w.length).fill('unread'));
          setCurrentWordIndex(0);
          cursorRef.current = 0;
          setErrorWordIndex(null);
          errorIndexRef.current = null;
          setFeedbackUz(null);
          setLoading(false);
          return;
        }

        if (!cancelled) {
          setAyahs([]);
          setLoadError('Ushbu surani yodlash uchun internetga ulaning yoki Sozlamalardan to‘liq Qur’onni yuklab oling.');
        }
      } catch {
        if (!cancelled) {
          setLoadError('Surani yuklab bo‘lmadi.');
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedSurah]);

  const processHifzResult = useCallback(
    async (
      result: Awaited<ReturnType<typeof verifyRecitationAudio>>,
      startIdxSnapshot: number
    ) => {
      const allWords = wordsRef.current;
      if (!isMountedRef.current || cursorRef.current !== startIdxSnapshot || startIdxSnapshot >= allWords.length) {
        return;
      }

      if (result.status === 'silence' || result.status === 'unclear') {
        setMicStatus(result.status === 'silence' ? 'listening' : 'unclear');
        if (result.status === 'unclear') {
          setFeedbackUz(result.feedbackUz || 'Ovozni aniq tekshira olmadim, qayta o‘qing.');
        }
        return;
      }

      const rawMatched = Math.max(0, result.matchedCount);
      const errOffset =
        result.status === 'error'
          ? Math.max(0, result.errorWordIndex >= 0 ? result.errorWordIndex : rawMatched)
          : rawMatched;
      const matched = result.status === 'error' ? Math.min(rawMatched, errOffset) : rawMatched;

      if (matched > 0) {
        const nextCursor = Math.min(allWords.length, startIdxSnapshot + matched);
        cursorRef.current = nextCursor;
        setCurrentWordIndex(nextCursor);
        setWordStatuses((prev) => {
          const copy = [...prev];
          for (let i = startIdxSnapshot; i < nextCursor; i++) copy[i] = 'correct';
          return copy;
        });
        errorIndexRef.current = null;
        setErrorWordIndex(null);
        setFeedbackUz('Barakalloh! Yoddan to‘g‘ri aytildi.');
        await recordReadingActivity({ wordsCorrect: matched });
        onStatsUpdated();

        if (nextCursor >= allWords.length) {
          setMicStatus('correct');
          micEngineRef.current?.stop();
          setIsMicOn(false);
          setHifzCompleted(true);
          await triggerSuccessVibration(settings.vibrationEnabled);
          const existing = await getMemorizationMap();
          const prev = existing[selectedSurah];
          const ayahSet = new Set(prev?.memorizedAyahs ?? []);
          ayahs.forEach((a) => ayahSet.add(a.numberInSurah));
          await saveMemorizationEntry({
            surahNumber: selectedSurah,
            memorizedAyahs: Array.from(ayahSet),
            lastPracticedAt: Date.now(),
            accuracyPercent: 100,
          });
          return;
        }

        if (result.status === 'matched') {
          setMicStatus('correct');
          return;
        }
      }

      if (result.status === 'error') {
        const errIdx = Math.min(allWords.length - 1, startIdxSnapshot + matched);
        const isRepeat = errorIndexRef.current === errIdx;
        errorIndexRef.current = errIdx;
        setErrorWordIndex(errIdx);
        setWordStatuses((prev) => {
          const copy = [...prev];
          copy[errIdx] = 'error';
          return copy;
        });
        setMicStatus('error');
        setFeedbackUz(result.feedbackUz || 'Yodlagan so‘zingizni qayta eslab o‘qing.');
        await triggerErrorVibration(isRepeat, settings.vibrationEnabled);
      }
    },
    [ayahs, onStatsUpdated, selectedSurah, settings.vibrationEnabled]
  );

  const enqueueVerification = useCallback(
    (base64Wav: string, mimeType: string, latestTranscript?: string) => {
      queuePromiseRef.current = queuePromiseRef.current.then(async () => {
        if (!isMountedRef.current) return;
        const allWords = wordsRef.current;
        const startIdx = cursorRef.current;
        if (startIdx >= allWords.length) return;

        const expectedSlice = allWords.slice(startIdx, startIdx + 5);

        if (!navigator.onLine || Date.now() < geminiCooldownUntilRef.current) {
          if (latestTranscript) {
            await processHifzResult(evaluateOfflineArabicTranscript(latestTranscript, expectedSlice), startIdx);
            return;
          }
          if (!navigator.onLine) {
            setMicStatus('unclear');
            setFeedbackUz('Yodlashni AI orqali tekshirish uchun internet aloqasi kerak.');
          }
          return;
        }

        setMicStatus('checking');
        const prevWord = startIdx > 0 ? allWords[startIdx - 1]?.displayArabic : '';
        const surahMeta = getSurahMeta(selectedSurah);

        try {
          const result = await verifyRecitationAudio({
            audioBase64: base64Wav,
            mimeType,
            expectedWords: expectedSlice,
            previousWord: prevWord,
            surahNameUz: surahMeta.nameUz,
            ayahNumber: expectedSlice[0].ayahNumber,
          });
          await processHifzResult(result, startIdx);
        } catch (err) {
          geminiCooldownUntilRef.current = Date.now() + 14000;
          if (latestTranscript) {
            await processHifzResult(evaluateOfflineArabicTranscript(latestTranscript, expectedSlice), startIdx);
            return;
          }
          setMicStatus('unclear');
          setFeedbackUz(err instanceof Error ? err.message : 'Tekshiruvda xatolik yuz berdi.');
        }
      });
    },
    [processHifzResult, selectedSurah]
  );

  const handleLiveTranscript = useCallback(
    (transcript: string, isFinal: boolean) => {
      if (navigator.onLine && Date.now() >= geminiCooldownUntilRef.current) return;
      if (!isFinal) return;
      queuePromiseRef.current = queuePromiseRef.current.then(async () => {
        const allWords = wordsRef.current;
        const startIdx = cursorRef.current;
        if (startIdx >= allWords.length) return;
        const consumed = micEngineRef.current?.consumePendingTranscript() || transcript;
        if (!consumed) return;
        const expectedSlice = allWords.slice(startIdx, startIdx + 5);
        await processHifzResult(evaluateOfflineArabicTranscript(consumed, expectedSlice), startIdx);
      });
    },
    [processHifzResult]
  );

  const toggleMic = async () => {
    if (isMicOn) {
      micEngineRef.current?.stop();
      setIsMicOn(false);
      setMicStatus('stopped');
      return;
    }

    const engine = new RecitationMicEngine({
      onVolume: () => {},
      onSpeechState: () => {},
      onAudioSegment: (b64, mime, transcript) => enqueueVerification(b64, mime, transcript),
      onLiveTranscript: handleLiveTranscript,
      onError: (msg) => {
        setFeedbackUz(msg);
        setIsMicOn(false);
        setMicStatus('stopped');
      },
    });
    engine.setSensitivity(settings.micSensitivity);
    micEngineRef.current = engine;
    const ok = await engine.start(true);
    if (ok) {
      setIsMicOn(true);
      setMicStatus(errorIndexRef.current !== null ? 'retry' : 'listening');
      setFeedbackUz(null);
    }
  };

  const resetHifz = () => {
    micEngineRef.current?.stop();
    setIsMicOn(false);
    setMicStatus('idle');
    setWordStatuses(Array(words.length).fill('unread'));
    setCurrentWordIndex(0);
    cursorRef.current = 0;
    errorIndexRef.current = null;
    setErrorWordIndex(null);
    setFeedbackUz(null);
    setHifzCompleted(false);
    setPeekWordIdx(null);
  };

  const surahMeta = getSurahMeta(selectedSurah);

  // Group words per ayah for clean display
  const ayahGroups = useMemo(() => {
    const map = new Map<number, { ayah: RawQuranAyah; words: QuranWord[] }>();
    for (const a of ayahs) {
      map.set(a.numberInSurah, { ayah: a, words: [] });
    }
    for (const w of words) {
      map.get(w.ayahNumber)?.words.push(w);
    }
    return Array.from(map.values());
  }, [ayahs, words]);

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pt-5 pb-32 sm:px-6 lg:py-8">
      <div className="flex flex-col justify-between gap-4 rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-[#0b4f3a]" />
            <h1 className="font-display text-2xl font-semibold text-[#0b4f3a]">
              Yodlash (Hifz) mashqi
            </h1>
          </div>
          <p className="mt-1 text-xs text-[#5c564d]">
            Yashirilgan oyatlarni yoddan o‘qing — to‘g‘ri aytgan so‘zlaringiz tajvid ranglarida ochiladi
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Yodlash uchun sura tanlang"
            value={selectedSurah}
            onChange={(e) => setSelectedSurah(Number(e.target.value))}
            className="min-h-[44px] rounded-xl border border-[#0b4f3a]/20 bg-white px-3 text-sm font-semibold text-[#1a1815] outline-none focus:border-[#0b4f3a]"
          >
            {STATIC_SURAHS_LIST.map((s) => (
              <option key={s.number} value={s.number}>
                {s.number}. {s.nameUz}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={resetHifz}
            aria-label="Qaytadan boshlash"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#0b4f3a]/20 bg-white text-[#0b4f3a] hover:bg-[#f4eee1] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Hiding Mode Selector */}
      <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-[#f4eee1] p-1.5">
        {[
          { id: 'first-word' as HideMode, label: 'Bosh so‘z ko‘rinsin' },
          { id: 'full-hidden' as HideMode, label: 'To‘liq yoddan' },
          { id: 'visible' as HideMode, label: 'Ko‘rib yodlash' },
        ].map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setHideMode(opt.id)}
            className={`min-h-[42px] rounded-xl px-2 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              hideMode === opt.id
                ? 'bg-white text-[#0b4f3a] shadow-sm'
                : 'text-[#5c564d] hover:text-[#1a1815]'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {!isOnline && (
        <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          Oflayn holatdasiz: matnni yashirib mustaqil takrorlashingiz mumkin. Ovozli AI tekshiruvi uchun internet zarur.
        </div>
      )}

      {feedbackUz && (
        <div
          className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
            errorWordIndex !== null
              ? 'border-red-300 bg-red-50 text-red-900'
              : 'border-[#0b4f3a]/20 bg-[#fffdf7] text-[#0b4f3a]'
          }`}
        >
          {errorWordIndex !== null ? (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          ) : (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-[#15803d]" />
          )}
          <span className="flex-1">{feedbackUz}</span>
          {errorWordIndex !== null && (
            <button
              type="button"
              onClick={() => setPeekWordIdx(peekWordIdx === errorWordIndex ? null : errorWordIndex)}
              className="inline-flex min-h-[36px] items-center gap-1 rounded-xl border border-red-300 bg-white px-3 text-xs font-semibold text-red-700 cursor-pointer"
            >
              {peekWordIdx === errorWordIndex ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              <span>{peekWordIdx === errorWordIndex ? 'Yashirish' : 'Ko‘rib olish'}</span>
            </button>
          )}
        </div>
      )}

      {hifzCompleted && (
        <div className="rounded-3xl border border-[#b8892b]/50 bg-[#fffdf7] p-6 text-center shadow-sm">
          <p className="text-xs font-bold tracking-widest text-[#b8892b]">MASHAALLOH!</p>
          <h2 className="mt-1 font-display text-xl font-semibold text-[#0b4f3a]">
            Zulxumor, {surahMeta.nameUz} surasini yoddan muvaffaqiyatli o‘qidingiz!
          </h2>
        </div>
      )}

      {/* Hifz Canvas */}
      <div className="mushaf-parchment mushaf-frame rounded-3xl p-5 sm:p-8">
        {loading ? (
          <div className="flex min-h-[260px] items-center justify-center gap-2 text-[#5c564d]">
            <Loader2 className="h-5 w-5 animate-spin text-[#0b4f3a]" />
            <span className="text-sm">Sura yuklanmoqda...</span>
          </div>
        ) : loadError ? (
          <p className="py-12 text-center text-sm text-[#5c564d]">{loadError}</p>
        ) : (
          <div dir="rtl" lang="ar" className="font-quran space-y-4 leading-[2.4]" style={{ fontSize: `${settings.arabicFontSize}px` }}>
            {ayahGroups.map(({ ayah, words: aWords }) => (
              <div key={ayah.number} className="border-b border-[#b8892b]/15 pb-3 last:border-b-0">
                {aWords.map((w, idxInAyah) => {
                  const status = wordStatuses[w.globalWordIndex] ?? 'unread';
                  const isFirstHint = hideMode === 'first-word' && idxInAyah === 0;
                  const isVisible =
                    status === 'correct' ||
                    hideMode === 'visible' ||
                    isFirstHint ||
                    peekWordIdx === w.globalWordIndex;

                  if (status === 'correct') {
                    return (
                      <React.Fragment key={w.id}>
                        <span>
                          {w.segments.map((seg, sIdx) => (
                            <span key={sIdx} style={{ color: TAJWEED_RULES_MAP[seg.rule]?.color ?? '#1a1815' }}>
                              {seg.text}
                            </span>
                          ))}
                        </span>{' '}
                      </React.Fragment>
                    );
                  }

                  if (status === 'error') {
                    return (
                      <React.Fragment key={w.id}>
                        <span
                          style={{ color: '#dc2626' }}
                          className="rounded-lg bg-red-100 px-2 py-0.5 font-bold ring-2 ring-red-500"
                        >
                          {isVisible ? w.displayArabic : '••••'}
                        </span>{' '}
                      </React.Fragment>
                    );
                  }

                  if (isVisible) {
                    return (
                      <React.Fragment key={w.id}>
                        <span className="text-[#8e887e]">{w.displayArabic}</span>{' '}
                      </React.Fragment>
                    );
                  }

                  return (
                    <React.Fragment key={w.id}>
                      <button
                        type="button"
                        onClick={() => setPeekWordIdx(peekWordIdx === w.globalWordIndex ? null : w.globalWordIndex)}
                        title="So‘zni ko‘rish uchun bosing"
                        className={`mx-1 inline-flex h-[1.15em] min-w-[2.2em] items-center justify-center rounded-xl border px-2 align-middle text-[0.48em] font-sans transition cursor-pointer ${
                          w.globalWordIndex === currentWordIndex && isMicOn
                            ? 'border-[#b8892b] bg-[#f4eee1] text-[#8a651b]'
                            : 'border-[#d6cebf] bg-[#f7f3e8] text-[#9c9487]'
                        }`}
                      >
                        •••
                      </button>{' '}
                    </React.Fragment>
                  );
                })}
                <span className="mx-1.5 inline-flex h-[1.3em] min-w-[1.3em] items-center justify-center rounded-full border border-[#c5bdb0] bg-[#f4eee1] px-1 text-[0.5em] text-[#5c564d] align-middle">
                  {toArabicDigits(ayah.numberInSurah)}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex flex-col items-center justify-between gap-3 rounded-2xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-4 sm:flex-row">
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-[#0b4f3a]">
            {micStatus === 'listening'
              ? 'Tinglanmoqda — yoddan o‘qing'
              : micStatus === 'checking'
                ? 'Ovoz tekshirilmoqda...'
                : micStatus === 'error'
                  ? 'Xato aniqlandi — qayta o‘qing'
                  : 'Yodlashni ovozli tekshirish'}
          </p>
          <p className="text-xs text-[#5c564d] tabular-nums">
            Ochilgan so‘zlar: {wordStatuses.filter((s) => s === 'correct').length} / {words.length}
          </p>
        </div>
        <button
          type="button"
          onClick={toggleMic}
          className={`flex min-h-[50px] items-center gap-2 rounded-2xl px-6 text-sm font-semibold text-white transition cursor-pointer ${
            isMicOn ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0b4f3a] hover:bg-[#11694d]'
          }`}
        >
          {isMicOn ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
          <span>{isMicOn ? 'To‘xtatish' : 'Yoddan o‘qishni boshlash'}</span>
        </button>
      </div>
    </div>
  );
};
