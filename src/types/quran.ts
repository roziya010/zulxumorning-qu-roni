export type TajweedRuleCode =
  | 'normal'
  | 'h' // Hamzatul Wasl
  | 'l' // Lam Shamsiyyah
  | 's' // Silent letter
  | 'n' // Madd Tabiiy (2 harakat)
  | 'p' // Madd Arid Lissukun (2-4-6)
  | 'o' // Madd Wajib / Jaiz (4-5)
  | 'm' // Madd Lazim (6)
  | 'g' // G'unna
  | 'q' // Qalqalah
  | 'f' // Ixfo
  | 'c' // Ixfoyi Shafawi
  | 'i' // Iqlob
  | 'a' // Idg'om bi-g'unna
  | 'u' // Idg'om bila g'unna
  | 'w' // Idg'om Shafawi
  | 'd' // Idg'om Mutajanisayn
  | 'b'; // Idg'om Mutaqaribayn

export interface TajweedSegment {
  text: string;
  rule: TajweedRuleCode;
}

export type WordRecitationStatus = 'unread' | 'correct' | 'error';

export interface QuranWord {
  id: string;
  globalWordIndex: number;
  ayahNumberInPage: number;
  surahNumber: number;
  ayahNumber: number;
  displayArabic: string;
  plainArabic: string;
  segments: TajweedSegment[];
  rules: TajweedRuleCode[];
}

export interface RawQuranAyah {
  number: number; // global 1..6236
  numberInSurah: number;
  surahNumber: number;
  surahNameArabic: string;
  text: string; // raw tajweed-tagged text
  juz: number;
  page: number;
  manzil: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
}

export interface QuranPageData {
  page: number;
  juz: number;
  hizbQuarter: number;
  ayahs: RawQuranAyah[];
}

export interface SurahSummary {
  number: number;
  nameArabic: string;
  nameUz: string;
  meaningUz: string;
  revelationType: 'Meccan' | 'Medinan';
  numberOfAyahs: number;
  startPage: number;
  endPage: number;
  juzStart: number;
}

export interface JuzSummary {
  juz: number;
  titleUz: string;
  startPage: number;
  startSurah: number;
  startAyah: number;
}

export type MicStatusState =
  | 'idle'          // Mikrofonni yoqish
  | 'listening'     // Tinglanmoqda
  | 'checking'      // Ovoz tekshirilmoqda
  | 'correct'       // To'g'ri o'qildi
  | 'error'         // Xato aniqlandi
  | 'retry'         // Qayta o'qing
  | 'unclear'       // Ovozni aniq tekshira olmadim, qayta o'qing
  | 'stopped';      // Mikrofon o'chirildi

export type ErrorCategory =
  | 'harf'
  | 'harakat'
  | 'tajvid'
  | 'tashlab_ketildi'
  | 'ortiqcha'
  | 'none';

export interface VerificationResult {
  status: 'matched' | 'error' | 'unclear' | 'silence';
  matchedCount: number;
  heardArabic: string;
  errorWordIndex: number;
  errorCategory: ErrorCategory;
  confusedLetters?: string;
  feedbackUz: string;
  engine: 'gemini-audio' | 'offline-speech';
}

export interface MistakeRecord {
  id: string;
  page: number;
  surahNumber: number;
  surahNameUz: string;
  ayahNumber: number;
  wordArabic: string;
  plainArabic: string;
  errorCategory: ErrorCategory;
  confusedLetters?: string;
  feedbackUz: string;
  timestamp: number;
  resolved: boolean;
  attempts: number;
}

export interface DailyProgress {
  dateKey: string; // YYYY-MM-DD
  pagesCompleted: number[];
  ayahsRead: number;
  wordsCorrect: number;
  errorsCount: number;
  errorsCorrected: number;
}

export interface QuranStatsSummary {
  todayPages: number;
  totalAyahsRead: number;
  totalWordsCorrect: number;
  totalErrors: number;
  totalErrorsCorrected: number;
  streakDays: number;
  completedPageNumbers: number[];
}

export interface MemorizationEntry {
  surahNumber: number;
  memorizedAyahs: number[];
  lastPracticedAt: number;
  accuracyPercent: number;
}

export interface AppSettings {
  vibrationEnabled: boolean;
  arabicFontSize: number; // px, e.g., 28..42
  showTajweedLegend: boolean;
  offlineBundleDownloaded: boolean;
  offlineBundleDate: number | null;
  lastPage: number;
  lastSurah: number;
  lastAyah: number;
  micSensitivity: 'yuqori' | 'ortacha' | 'past';
  preferOfflineSpeechWhenDisconnected: boolean;
}

export type AppTab =
  | 'welcome'
  | 'home'
  | 'quran'
  | 'memorize'
  | 'review'
  | 'stats'
  | 'settings';
