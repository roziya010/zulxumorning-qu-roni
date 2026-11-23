import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Mic,
  MicOff,
  RotateCcw,
  BookOpen,
  Info,
  AlertCircle,
  CheckCircle2,
  WifiOff,
  Loader2,
} from 'lucide-react';
import {
  AppSettings,
  ErrorCategory,
  MicStatusState,
  QuranPageData,
  QuranWord,
  WordRecitationStatus,
} from '../types/quran';
import { loadQuranPage } from '../modules/quranData/quranLoader';
import { getSurahMeta } from '../modules/quranData/surahNamesUz';
import {
  parsePageWords,
  TAJWEED_LEGEND_GROUPS,
  TAJWEED_RULES_MAP,
  toArabicDigits,
} from '../modules/tajweed/tajweedParser';
import { RecitationMicEngine, evaluateOfflineArabicTranscript } from '../modules/audio/micEngine';
import { verifyRecitationAudio } from '../modules/recitation/recitationEngine';
import { triggerErrorVibration, triggerSuccessVibration } from '../modules/haptics/vibration';
import {
  addMistakeRecord,
  markMistakeResolved,
  recordReadingActivity,
  saveSettings,
} from '../modules/storage/localDb';
import { PageCompleteModal } from './PageCompleteModal';

interface QuranReaderViewProps {
  page: number;
  settings: AppSettings;
  isOnline: boolean;
  onPageChange: (nextPage: number) => void;
  onOpenNavigator: () => void;
  onStatsUpdated: () => void;
}

const MIC_STATUS_LABELS: Record<MicStatusState, string> = {
  idle: 'Mikrofonni yoqish',
  listening: 'Tinglanmoqda',
  checking: 'Ovoz tekshirilmoqda',
  correct: 'To‘g‘ri o‘qildi',
  error: 'Xato aniqlandi',
  retry: 'Qayta o‘qing',
  unclear: 'Ovozni aniq tekshira olmadim, qayta o‘qing',
  stopped: 'Mikrofon o‘chirildi',
};

const ERROR_CATEGORY_LABELS: Record<ErrorCategory, string> = {
  harf: 'Harf talaffuzi xatosi',
  harakat: 'Harakat (fatha/kasra/damma/sukun) xatosi',
  tajvid: 'Tajvid qoidasi xatosi',
  tashlab_ketildi: 'So‘z tashlab ketildi',
  ortiqcha: 'Ortiqcha so‘z qo‘shildi',
  none: '',
};

export const QuranReaderView: React.FC<QuranReaderViewProps> = ({
  page,
  settings,
  isOnline,
  onPageChange,
  onOpenNavigator,
  onStatsUpdated,
}) => {
  const [pageData, setPageData] = useState<QuranPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'cache' | 'network' | 'seed' | 'unavailable'>('cache');

  // Word-by-word recitation state
  const [wordStatuses, setWordStatuses] = useState<WordRecitationStatus[]>([]);
  const [currentWordIndex, setCurrentWordIndex] = useState(0);
  const [errorWordIndex, setErrorWordIndex] = useState<number | null>(null);
  const [errorFeedback, setErrorFeedback] = useState<{
    messageUz: string;
    category: ErrorCategory;
    confusedLetters?: string;
    heardArabic?: string;
    mistakeId: string;
    attempts: number;
  } | null>(null);

  // Microphone & audio state
  const [isMicOn, setIsMicOn] = useState(false);
  const [micStatus, setMicStatus] = useState<MicStatusState>('idle');
  const [micVolume, setMicVolume] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [micErrorMsg, setMicErrorMsg] = useState<string | null>(null);
  const [showLegend, setShowLegend] = useState(false);

  // Page completion modal state
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [sessionCorrectedErrors, setSessionCorrectedErrors] = useState(0);

  // Refs to prevent stale closures inside audio callbacks
  const micEngineRef = useRef<RecitationMicEngine | null>(null);
  const wordsRef = useRef<QuranWord[]>([]);
  const cursorRef = useRef(0);
  const errorIndexRef = useRef<number | null>(null);
  const errorMistakeIdRef = useRef<string | null>(null);
  const errorAttemptsRef = useRef(0);
  const queuePromiseRef = useRef<Promise<void>>(Promise.resolve());
  const isMountedRef = useRef(true);
  const completedPagesSessionRef = useRef<Set<number>>(new Set());
  const geminiCooldownUntilRef = useRef(0);

  const words = useMemo(() => {
    if (!pageData) return [];
    return parsePageWords(pageData.ayahs);
  }, [pageData]);

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

  // Load Mushaf page whenever `page` changes
  useEffect(() => {
    let cancelled = false;

    const resetPageState = (newWordsCount: number) => {
      setWordStatuses(Array(newWordsCount).fill('unread'));
      setCurrentWordIndex(0);
      cursorRef.current = 0;
      setErrorWordIndex(null);
      errorIndexRef.current = null;
      errorMistakeIdRef.current = null;
      errorAttemptsRef.current = 0;
      setErrorFeedback(null);
      setShowCompleteModal(false);
      setSessionCorrectedErrors(0);
      queuePromiseRef.current = Promise.resolve();
    };

    (async () => {
      setLoading(true);
      setLoadError(null);
      const result = await loadQuranPage(page);
      if (cancelled) return;

      if (result.data) {
        setPageData(result.data);
        setDataSource(result.source);
        const parsed = parsePageWords(result.data.ayahs);
        resetPageState(parsed.length);
        const firstAyah = result.data.ayahs[0];
        if (firstAyah) {
          saveSettings({
            lastPage: page,
            lastSurah: firstAyah.surahNumber,
            lastAyah: firstAyah.numberInSurah,
          });
        }
      } else {
        setPageData(null);
        setDataSource('unavailable');
        setLoadError(result.error || 'Sahifani yuklab bo‘lmadi.');
      }
      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [page]);

  // Helper to apply verification result strictly word-by-word
  const applyVerificationResult = useCallback(
    async (result: Awaited<ReturnType<typeof verifyRecitationAudio>>, startIdxSnapshot: number) => {
      if (!isMountedRef.current) return;
      const allWords = wordsRef.current;
      if (startIdxSnapshot >= allWords.length) return;

      // If cursor moved past snapshot already, ignore stale packet
      if (cursorRef.current !== startIdxSnapshot) return;

      if (result.status === 'silence') {
        setMicStatus('listening');
        return;
      }

      if (result.status === 'unclear') {
        setMicStatus('unclear');
        setMicErrorMsg(null);
        return;
      }

      setMicErrorMsg(null);

      // Clamp matched words strictly BEFORE any error index
      const rawMatched = Math.max(0, result.matchedCount);
      const errOffset =
        result.status === 'error'
          ? Math.max(0, result.errorWordIndex >= 0 ? result.errorWordIndex : rawMatched)
          : rawMatched;
      const matched = result.status === 'error' ? Math.min(rawMatched, errOffset) : rawMatched;

      if (matched > 0) {
        const prevCursor = cursorRef.current;
        const nextCursor = Math.min(allWords.length, prevCursor + matched);

        // If the first matched word was previously in error, mark mistake resolved!
        if (errorIndexRef.current !== null && errorIndexRef.current === prevCursor) {
          if (errorMistakeIdRef.current) {
            await markMistakeResolved(errorMistakeIdRef.current);
          }
          setSessionCorrectedErrors((c) => c + 1);
          await recordReadingActivity({ errorsCorrected: 1 });
          errorIndexRef.current = null;
          errorMistakeIdRef.current = null;
          errorAttemptsRef.current = 0;
          setErrorWordIndex(null);
          setErrorFeedback(null);
        }

        cursorRef.current = nextCursor;
        setCurrentWordIndex(nextCursor);
        setWordStatuses((prev) => {
          const copy = [...prev];
          for (let i = prevCursor; i < nextCursor; i++) {
            copy[i] = 'correct';
          }
          return copy;
        });

        // Count newly completed ayahs
        let completedAyahs = 0;
        for (let i = prevCursor; i < nextCursor; i++) {
          const w = allWords[i];
          const nextW = allWords[i + 1];
          if (!nextW || nextW.ayahNumber !== w.ayahNumber || nextW.surahNumber !== w.surahNumber) {
            completedAyahs += 1;
          }
        }
        await recordReadingActivity({
          wordsCorrect: matched,
          ayahsRead: completedAyahs,
        });
        onStatsUpdated();

        // Check full page completion ONLY when 100% of words on page are verified
        if (nextCursor >= allWords.length) {
          setMicStatus('correct');
          micEngineRef.current?.stop();
          setIsMicOn(false);
          await triggerSuccessVibration(settings.vibrationEnabled);
          if (!completedPagesSessionRef.current.has(page)) {
            completedPagesSessionRef.current.add(page);
            await recordReadingActivity({ completedPage: page });
            onStatsUpdated();
          }
          setShowCompleteModal(true);
          return;
        }

        if (result.status === 'matched') {
          setMicStatus('correct');
          setTimeout(() => {
            if (isMountedRef.current) {
              setMicStatus((cur) => (cur === 'correct' ? 'listening' : cur));
            }
          }, 900);
          return;
        }
      }

      // Handle explicit error — stop at exact error word and vibrate!
      if (result.status === 'error') {
        const errWordIdx = Math.min(allWords.length - 1, startIdxSnapshot + matched);
        const targetWord = allWords[errWordIdx];
        if (!targetWord) return;

        const isRepeat = errorIndexRef.current === errWordIdx;
        const attempts = isRepeat ? errorAttemptsRef.current + 1 : 1;
        errorIndexRef.current = errWordIdx;
        errorAttemptsRef.current = attempts;

        await triggerErrorVibration(isRepeat, settings.vibrationEnabled);

        const surahMeta = getSurahMeta(targetWord.surahNumber);
        const mistakeId =
          isRepeat && errorMistakeIdRef.current
            ? errorMistakeIdRef.current
            : `m-${Date.now()}-${errWordIdx}`;
        errorMistakeIdRef.current = mistakeId;

        setWordStatuses((prev) => {
          const copy = [...prev];
          copy[errWordIdx] = 'error';
          return copy;
        });
        setErrorWordIndex(errWordIdx);
        setErrorFeedback({
          messageUz: result.feedbackUz || `«${targetWord.displayArabic}» so‘zini qayta aniq o‘qing.`,
          category: result.errorCategory,
          confusedLetters: result.confusedLetters,
          heardArabic: result.heardArabic,
          mistakeId,
          attempts,
        });
        setMicStatus('error');

        await addMistakeRecord({
          id: mistakeId,
          page,
          surahNumber: targetWord.surahNumber,
          surahNameUz: surahMeta.nameUz,
          ayahNumber: targetWord.ayahNumber,
          wordArabic: targetWord.displayArabic,
          plainArabic: targetWord.plainArabic,
          errorCategory: result.errorCategory,
          confusedLetters: result.confusedLetters,
          feedbackUz: result.feedbackUz,
          timestamp: Date.now(),
          resolved: false,
          attempts,
        });
        if (!isRepeat) {
          await recordReadingActivity({ errorsCount: 1 });
          onStatsUpdated();
        }
      }
    },
    [onStatsUpdated, page, settings.vibrationEnabled]
  );

  const enqueueAudioVerification = useCallback(
    (base64Wav: string, mimeType: string, latestTranscript?: string) => {
      queuePromiseRef.current = queuePromiseRef.current.then(async () => {
        if (!isMountedRef.current) return;
        const allWords = wordsRef.current;
        const startIdx = cursorRef.current;
        if (startIdx >= allWords.length) return;

        const expectedSlice = allWords.slice(startIdx, startIdx + 5);

        // If offline or Gemini is currently in rate-limit cooldown, use live SpeechRecognition if captured
        if (!navigator.onLine || Date.now() < geminiCooldownUntilRef.current) {
          if (latestTranscript) {
            const localRes = evaluateOfflineArabicTranscript(latestTranscript, expectedSlice);
            await applyVerificationResult(localRes, startIdx);
            return;
          }
          if (!navigator.onLine) {
            setMicStatus('unclear');
            setMicErrorMsg('Oflayn rejimdasiz. Chuqur AI tajvid tekshiruvi uchun internet kerak.');
          }
          return;
        }

        const prevWord = startIdx > 0 ? allWords[startIdx - 1]?.displayArabic : '';
        const surahMeta = getSurahMeta(expectedSlice[0].surahNumber);

        setMicStatus('checking');
        setMicErrorMsg(null);

        try {
          const res = await verifyRecitationAudio({
            audioBase64: base64Wav,
            mimeType,
            expectedWords: expectedSlice,
            previousWord: prevWord,
            surahNameUz: surahMeta.nameUz,
            ayahNumber: expectedSlice[0].ayahNumber,
          });
          await applyVerificationResult(res, startIdx);
        } catch (err) {
          geminiCooldownUntilRef.current = Date.now() + 14000;
          if (latestTranscript) {
            const fallbackRes = evaluateOfflineArabicTranscript(latestTranscript, expectedSlice);
            await applyVerificationResult(fallbackRes, startIdx);
            return;
          }
          setMicStatus('unclear');
          setMicErrorMsg(
            err instanceof Error
              ? err.message
              : 'Ovozni tekshirishda server bilan aloqa uzildi.'
          );
        }
      });
    },
    [applyVerificationResult]
  );

  const handleLiveTranscript = useCallback(
    (transcript: string, isFinal: boolean) => {
      // Only run immediate transcript evaluation when offline or during Gemini 429/503 cooldown
      if (navigator.onLine && Date.now() >= geminiCooldownUntilRef.current) return;
      if (!isFinal) return;
      queuePromiseRef.current = queuePromiseRef.current.then(async () => {
        const allWords = wordsRef.current;
        const startIdx = cursorRef.current;
        if (startIdx >= allWords.length) return;
        const consumed = micEngineRef.current?.consumePendingTranscript() || transcript;
        if (!consumed) return;
        const expectedSlice = allWords.slice(startIdx, startIdx + 5);
        const res = evaluateOfflineArabicTranscript(consumed, expectedSlice);
        await applyVerificationResult(res, startIdx);
      });
    },
    [applyVerificationResult]
  );

  const toggleMicrophone = async () => {
    if (isMicOn) {
      micEngineRef.current?.stop();
      setIsMicOn(false);
      setIsSpeaking(false);
      setMicVolume(0);
      setMicStatus('stopped');
      return;
    }

    setMicErrorMsg(null);
    const engine = new RecitationMicEngine({
      onVolume: (rms) => setMicVolume(rms),
      onSpeechState: (speaking) => setIsSpeaking(speaking),
      onAudioSegment: (b64, mime, transcript) => enqueueAudioVerification(b64, mime, transcript),
      onLiveTranscript: handleLiveTranscript,
      onError: (msg) => {
        setMicErrorMsg(msg);
        setIsMicOn(false);
        setMicStatus('stopped');
      },
    });
    engine.setSensitivity(settings.micSensitivity);
    micEngineRef.current = engine;

    const started = await engine.start(true);
    if (started) {
      setIsMicOn(true);
      setMicStatus(errorIndexRef.current !== null ? 'retry' : 'listening');
    }
  };

  const resetCurrentPageRecitation = () => {
    micEngineRef.current?.stop();
    setIsMicOn(false);
    setMicStatus('idle');
    setMicErrorMsg(null);
    setWordStatuses(Array(words.length).fill('unread'));
    setCurrentWordIndex(0);
    cursorRef.current = 0;
    setErrorWordIndex(null);
    errorIndexRef.current = null;
    errorMistakeIdRef.current = null;
    errorAttemptsRef.current = 0;
    setErrorFeedback(null);
    setShowCompleteModal(false);
    setSessionCorrectedErrors(0);
    queuePromiseRef.current = Promise.resolve();
  };

  // Group ayahs by surah transitions on this Mushaf page
  const pageSurahBlocks = useMemo(() => {
    if (!pageData) return [];
    const blocks: Array<{
      surahNumber: number;
      surahNameArabic: string;
      showSurahHeader: boolean;
      showBismillah: boolean;
      ayahs: Array<{
        ayah: QuranPageData['ayahs'][number];
        words: QuranWord[];
      }>;
    }> = [];

    pageData.ayahs.forEach((ayah, ayahIdx) => {
      const ayahWords = words.filter((w) => w.ayahNumberInPage === ayahIdx);

      let lastBlock = blocks[blocks.length - 1];
      if (!lastBlock || lastBlock.surahNumber !== ayah.surahNumber) {
        lastBlock = {
          surahNumber: ayah.surahNumber,
          surahNameArabic: ayah.surahNameArabic,
          showSurahHeader: ayah.numberInSurah === 1,
          showBismillah: ayah.numberInSurah === 1 && ayah.surahNumber !== 1 && ayah.surahNumber !== 9,
          ayahs: [],
        };
        blocks.push(lastBlock);
      }
      lastBlock.ayahs.push({ ayah, words: ayahWords });
    });
    return blocks;
  }, [pageData, words]);

  const primarySurah = pageData?.ayahs[0] ? getSurahMeta(pageData.ayahs[0].surahNumber) : getSurahMeta(1);
  const completedCount = wordStatuses.filter((s) => s === 'correct').length;
  const progressPercent = words.length > 0 ? Math.round((completedCount / words.length) * 100) : 0;

  return (
    <div className="mx-auto max-w-5xl px-3 pt-3 pb-44 sm:px-6 lg:pb-36">
      {/* Compact Mushaf Top Toolbar */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[#0b4f3a]/12 bg-[#fffdf7] px-3 py-2 shadow-sm sm:px-4">
        <button
          type="button"
          onClick={onOpenNavigator}
          className="flex min-h-[44px] items-center gap-2.5 rounded-xl px-2 py-1 text-left transition hover:bg-[#f4eee1] cursor-pointer"
        >
          <BookOpen className="h-4 w-4 text-[#0b4f3a] shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[#0b4f3a] truncate">
              {primarySurah.number}. {primarySurah.nameUz}
            </p>
            <p className="text-xs text-[#5c564d] tabular-nums truncate">
              {page}-sahifa · {pageData?.juz ?? primarySurah.juzStart}-pora
            </p>
          </div>
        </button>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowLegend((v) => !v)}
            aria-label="Tajvid ranglari qo‘llanmasi"
            className={`flex min-h-[44px] items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
              showLegend
                ? 'bg-[#0b4f3a] text-[#fbf8f1]'
                : 'border border-[#0b4f3a]/15 bg-white text-[#0b4f3a] hover:bg-[#f4eee1]'
            }`}
          >
            <Info className="h-4 w-4" />
            <span className="hidden sm:inline">Tajvid ranglari</span>
          </button>

          <button
            type="button"
            onClick={resetCurrentPageRecitation}
            aria-label="Sahifani boshidan boshlash"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#0b4f3a]/15 bg-white text-[#5c564d] hover:bg-[#f4eee1] cursor-pointer"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <div className="flex items-center border-l border-[#0b4f3a]/12 pl-1.5 gap-1">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => onPageChange(page - 1)}
              aria-label="Oldingi sahifa"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#0b4f3a]/15 bg-white text-[#0b4f3a] hover:bg-[#f4eee1] disabled:opacity-40 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={page >= 604}
              onClick={() => onPageChange(page + 1)}
              aria-label="Keyingi sahifa"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-[#0b4f3a]/15 bg-white text-[#0b4f3a] hover:bg-[#f4eee1] disabled:opacity-40 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Offline honesty banner */}
      {!isOnline && (
        <div className="mb-3 flex items-center gap-2.5 rounded-2xl border border-amber-300/70 bg-amber-50 px-4 py-2.5 text-xs text-amber-900">
          <WifiOff className="h-4 w-4 shrink-0 text-amber-700" />
          <span>
            Internet o‘chiq: Qur&apos;on matni va tajvid ranglari oflayn ishlaydi. Chuqur AI harf va harakat tekshiruvi uchun internet zarur.
          </span>
        </div>
      )}

      {/* Tajweed Color Legend Drawer */}
      {showLegend && (
        <div className="mb-4 rounded-2xl border border-[#b8892b]/35 bg-[#fffdf7] p-4 shadow-sm">
          <div className="mb-2.5 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#0b4f3a]">
              Tajvid ranglari qo‘llanmasi (Madina mushafi)
            </h3>
            <span className="text-xs text-[#5c564d]">O‘qilmagan so‘zlar kulrang bo‘ladi</span>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {TAJWEED_LEGEND_GROUPS.map((g) => (
              <div key={g.titleUz} className="flex items-start gap-2.5 rounded-xl bg-[#fbf8f1] px-3 py-2">
                <span
                  className="mt-1 h-3 w-3 shrink-0 rounded-sm"
                  style={{ backgroundColor: g.color }}
                />
                <div>
                  <p className="text-xs font-semibold text-[#1a1815]">{g.titleUz}</p>
                  <p className="text-[11px] text-[#5c564d]">{g.summaryUz}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Progress Strip */}
      {!loading && words.length > 0 && (
        <div className="mb-3 flex items-center justify-between gap-3 px-1 text-xs text-[#5c564d]">
          <span className="tabular-nums">
            Tekshirilgan so‘zlar: <strong className="text-[#0b4f3a]">{completedCount}</strong> / {words.length}
          </span>
          <div className="h-1.5 flex-1 max-w-xs overflow-hidden rounded-full bg-[#e8e0cf]">
            <div
              className="h-full rounded-full bg-[#0b4f3a] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="font-semibold text-[#0b4f3a] tabular-nums">{progressPercent}%</span>
        </div>
      )}

      {/* Error Feedback Banner when stopped on a mispronounced word */}
      {errorFeedback && errorWordIndex !== null && (
        <div
          role="alert"
          className="mb-4 rounded-2xl border border-red-300 bg-red-50/95 p-4 text-red-950 shadow-sm"
        >
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold text-red-700">
                  {ERROR_CATEGORY_LABELS[errorFeedback.category] || 'Talaffuz xatosi aniqlandi'}
                </p>
                {errorFeedback.confusedLetters && (
                  <span dir="rtl" lang="ar" className="font-quran text-lg font-bold text-red-700">
                    {errorFeedback.confusedLetters}
                  </span>
                )}
              </div>
              <p className="mt-1 text-sm text-red-900">{errorFeedback.messageUz}</p>
              <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs text-red-800">
                <span>
                  Qayta o‘qiladigan so‘z:{' '}
                  <strong dir="rtl" lang="ar" className="font-quran text-xl text-red-700">
                    {words[errorWordIndex]?.displayArabic}
                  </strong>
                </span>
                {errorFeedback.heardArabic && (
                  <span>
                    Eshitildi:{' '}
                    <span dir="rtl" lang="ar" className="font-quran text-base">
                      {errorFeedback.heardArabic}
                    </span>
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Mushaf Parchment Canvas */}
      <section className="mushaf-parchment mushaf-frame rounded-3xl p-4 sm:p-8 lg:p-10">
        {loading ? (
          <div className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-[#5c564d]">
            <Loader2 className="h-7 w-7 animate-spin text-[#0b4f3a]" />
            <p className="text-sm font-medium">Mushaf sahifasi yuklanmoqda...</p>
          </div>
        ) : loadError || !pageData ? (
          <div className="flex min-h-[320px] flex-col items-center justify-center gap-4 text-center px-4">
            <AlertCircle className="h-10 w-10 text-amber-600" />
            <p className="max-w-md text-sm text-[#3d3830]">{loadError}</p>
            <button
              type="button"
              onClick={onOpenNavigator}
              className="rounded-xl bg-[#0b4f3a] px-5 py-2.5 text-sm font-semibold text-[#fbf8f1] cursor-pointer"
            >
              Boshqa sahifa tanlash
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            {pageSurahBlocks.map((block, bIdx) => {
              const sMeta = getSurahMeta(block.surahNumber);
              return (
                <div key={`${block.surahNumber}-${bIdx}`}>
                  {block.showSurahHeader && (
                    <div className="mb-5 rounded-2xl border border-[#b8892b]/45 bg-gradient-to-r from-[#f4eee1] via-[#fffdf7] to-[#f4eee1] px-4 py-3 text-center">
                      <p dir="rtl" lang="ar" className="font-quran text-2xl font-bold text-[#0b4f3a] sm:text-3xl">
                        {block.surahNameArabic}
                      </p>
                      <p className="mt-0.5 text-xs text-[#5c564d]">
                        {sMeta.number}-sura · {sMeta.nameUz} · {sMeta.numberOfAyahs} oyat ·{' '}
                        {sMeta.revelationType === 'Meccan' ? 'Makkiy' : 'Madaniy'}
                      </p>
                    </div>
                  )}

                  {block.showBismillah && (
                    <p
                      dir="rtl"
                      lang="ar"
                      className="font-quran mb-5 text-center text-2xl text-[#0b4f3a] sm:text-3xl"
                    >
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
                    </p>
                  )}

                  {/* RTL Arabic Mushaf Text Flow */}
                  <div
                    dir="rtl"
                    lang="ar"
                    className="font-quran text-right leading-[2.35] select-none"
                    style={{ fontSize: `${settings.arabicFontSize}px` }}
                  >
                    {block.ayahs.map(({ ayah, words: ayahWords }) => (
                      <span key={ayah.number} className="inline">
                        {ayahWords.map((word) => {
                          const status = wordStatuses[word.globalWordIndex] ?? 'unread';
                          const isCurrent = word.globalWordIndex === currentWordIndex;

                          if (status === 'correct') {
                            return (
                              <span
                                key={word.id}
                                className="inline transition-colors duration-200"
                              >
                                {word.segments.map((seg, sIdx) => (
                                  <span
                                    key={sIdx}
                                    style={{
                                      color: TAJWEED_RULES_MAP[seg.rule]?.color ?? '#1a1815',
                                    }}
                                  >
                                    {seg.text}
                                  </span>
                                ))}
                                {' '}
                              </span>
                            );
                          }

                          if (status === 'error') {
                            return (
                              <React.Fragment key={word.id}>
                                <span
                                  style={{ color: '#dc2626' }}
                                  className="inline rounded-lg bg-red-100 px-1.5 py-0.5 font-bold ring-2 ring-red-500 underline decoration-red-600 decoration-2 underline-offset-8"
                                >
                                  {word.displayArabic}
                                </span>{' '}
                              </React.Fragment>
                            );
                          }

                          // Unread word: legible warm stone-grey; subtle underline on active target word when mic is on
                          return (
                            <React.Fragment key={word.id}>
                              <span
                                className={`inline transition-colors duration-200 ${
                                  isCurrent && isMicOn
                                    ? 'text-[#6e695f] underline decoration-[#b8892b]/65 decoration-dotted underline-offset-8'
                                    : 'text-[#969187]'
                                }`}
                              >
                                {word.displayArabic}
                              </span>{' '}
                            </React.Fragment>
                          );
                        })}

                        {/* Ayah end medallion */}
                        <span
                          aria-label={`${ayah.numberInSurah}-oyat`}
                          className={`mx-1.5 inline-flex h-[1.35em] min-w-[1.35em] items-center justify-center rounded-full border px-1 text-[0.52em] font-semibold align-middle ${
                            ayahWords.every((w) => wordStatuses[w.globalWordIndex] === 'correct')
                              ? 'border-[#b8892b] bg-[#0b4f3a] text-[#fbf8f1]'
                              : 'border-[#c5bdb0] bg-[#f4eee1]/80 text-[#7d766b]'
                          }`}
                        >
                          {toArabicDigits(ayah.numberInSurah)}
                        </span>{' '}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}

            {/* Mushaf Footer Marker */}
            <div className="flex items-center justify-between border-t border-[#b8892b]/25 pt-4 text-xs text-[#5c564d]">
              <span className="tabular-nums">{page}-sahifa</span>
              <span>
                {dataSource === 'cache'
                  ? 'Qurilma xotirasidan (oflayn tayyor)'
                  : dataSource === 'seed'
                    ? 'Asosiy tekshirilgan matn'
                    : 'Hafs an Osim · Tasdiqlangan matn'}
              </span>
            </div>
          </div>
        )}
      </section>

      {/* Thumb-Zone Floating Microphone Control Bar */}
      <div className="fixed bottom-16 left-0 right-0 z-30 border-t border-[#0b4f3a]/12 bg-[#fffdf7]/95 px-4 py-2.5 backdrop-blur-md lg:bottom-0">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
          {/* Status Readout in Uzbek */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {micStatus === 'checking' && (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-[#0b4f3a]" />
              )}
              {micStatus === 'correct' && (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-[#15803d]" />
              )}
              {micStatus === 'error' && (
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              )}
              <p
                className={`text-sm font-semibold truncate ${
                  micStatus === 'error'
                    ? 'text-red-700'
                    : micStatus === 'correct'
                      ? 'text-[#15803d]'
                      : 'text-[#0b4f3a]'
                }`}
              >
                {MIC_STATUS_LABELS[micStatus]}
              </p>
            </div>
            <p className="mt-0.5 text-xs text-[#5c564d] truncate">
              {micErrorMsg
                ? micErrorMsg
                : errorWordIndex !== null
                  ? `Qizil so‘zni qayta o‘qing: ${words[errorWordIndex]?.displayArabic ?? ''}`
                  : isMicOn
                    ? isSpeaking
                      ? 'Ovoz qabul qilinmoqda...'
                      : words[currentWordIndex]
                        ? `Navbatdagi so‘z: ${words[currentWordIndex].displayArabic}`
                        : 'Sahifa yakunlanmoqda...'
                    : 'Mikrofonni yoqib tilovatni boshlang'}
            </p>
          </div>

          {/* Live Audio Level Bars when Mic Active */}
          {isMicOn && (
            <div className="hidden items-end gap-1 h-7 sm:flex" aria-hidden="true">
              {[0.35, 0.7, 1, 0.75, 0.4].map((scale, i) => (
                <span
                  key={i}
                  className="w-1 rounded-full bg-[#0b4f3a] transition-transform duration-75"
                  style={{
                    height: '24px',
                    transform: `scaleY(${Math.max(0.2, Math.min(1, micVolume * scale * 1.4))})`,
                  }}
                />
              ))}
            </div>
          )}

          {/* Primary Large Microphone Button */}
          <button
            type="button"
            onClick={toggleMicrophone}
            aria-label={isMicOn ? "Mikrofonni o'chirish" : 'Mikrofonni yoqish'}
            className={`relative flex min-h-[54px] items-center justify-center gap-2.5 rounded-2xl px-6 py-3 text-sm font-semibold shadow-md transition active:scale-[0.97] whitespace-nowrap shrink-0 cursor-pointer ${
              isMicOn
                ? 'bg-red-600 text-white hover:bg-red-700 shadow-red-600/20'
                : 'bg-[#0b4f3a] text-[#fbf8f1] hover:bg-[#11694d] shadow-[#0b4f3a]/20'
            }`}
          >
            {isMicOn ? (
              <>
                <MicOff className="h-5 w-5" />
                <span>To‘xtatish</span>
              </>
            ) : (
              <>
                <Mic className="h-5 w-5 text-[#e9d9b4]" />
                <span>Mikrofonni yoqish</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Special Zulxumor Page Completion Modal */}
      <PageCompleteModal
        isOpen={showCompleteModal}
        pageNumber={page}
        ayahCount={pageData?.ayahs.length ?? 0}
        correctWordsCount={words.length}
        correctedMistakesCount={sessionCorrectedErrors}
        onNextPage={() => {
          setShowCompleteModal(false);
          if (page < 604) onPageChange(page + 1);
        }}
        onReplayPage={() => resetCurrentPageRecitation()}
        onReturnToQuran={() => setShowCompleteModal(false)}
      />
    </div>
  );
};
