import type { QuranWord, VerificationResult } from '../../types/quran';

export function stripArabicText(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200C\u200D\uFEFF]/g, '')
    .replace(/[أإآٱٲٳٵ]/g, 'ا')
    .replace(/[ىٮ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A\s]/g, '')
    .trim();
}

export function expandUthmaniForSpeech(displayArabic: string): string {
  const withDaggerAlif = displayArabic
    .replace(/\u0640\u0670/g, 'ا')
    .replace(/[\u066E\u0649]\u0670/g, 'ا')
    .replace(/\u0670/g, 'ا');
  return stripArabicText(withDaggerAlif);
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

export interface ExpectedWordLike {
  displayArabic: string;
  plainArabic: string;
}

export function isArabicWordMatch(
  expected: ExpectedWordLike,
  spokenPlain: string
): { matched: boolean; confusedPair: string | null } {
  const formA = stripArabicText(expected.plainArabic || expected.displayArabic);
  const formB = expandUthmaniForSpeech(expected.displayArabic);
  if (!spokenPlain || (!formA && !formB)) {
    return { matched: false, confusedPair: null };
  }
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

export function evaluateArabicTranscriptWords(
  transcript: string,
  expectedWords: Array<QuranWord | ExpectedWordLike>,
  engine: VerificationResult['engine'] = 'offline-speech'
): VerificationResult {
  const spokenTokens = transcript
    .split(/\s+/)
    .map((t) => stripArabicText(t))
    .filter(Boolean);

  if (spokenTokens.length === 0) {
    return {
      status: 'unclear',
      matchedCount: 0,
      heardArabic: '',
      errorWordIndex: -1,
      errorCategory: 'none',
      feedbackUz: 'Ovozni aniq tekshira olmadim, qayta o‘qing.',
      engine,
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
        engine,
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
    engine,
  };
}
