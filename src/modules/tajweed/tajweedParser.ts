import { QuranWord, RawQuranAyah, TajweedRuleCode, TajweedSegment } from '../../types/quran';

export interface TajweedRuleInfo {
  code: TajweedRuleCode;
  labelUz: string;
  descriptionUz: string;
  color: string;
}

// Authentic Dar Al-Maarifah / Madina Tajweed Mushaf color palette
export const TAJWEED_RULES_MAP: Record<TajweedRuleCode, TajweedRuleInfo> = {
  normal: {
    code: 'normal',
    labelUz: 'Asl o‘qish',
    descriptionUz: 'Oddiy harf va harakatlar talaffuzi',
    color: '#1a1815',
  },
  g: {
    code: 'g',
    labelUz: 'G‘unna (2 harakat)',
    descriptionUz: 'Tashdidli Nun (نّ) va Mim (مّ) dimog‘dan cho‘zib o‘qiladi',
    color: '#15803d',
  },
  a: {
    code: 'a',
    labelUz: 'Idg‘om bi-g‘unna',
    descriptionUz: 'Sokin Nun yoki tanvindan keyin ي ن م و kelsa dimog‘ bilan qo‘shiladi',
    color: '#15803d',
  },
  w: {
    code: 'w',
    labelUz: 'Idg‘om Shafawi',
    descriptionUz: 'Sokin Mimdan keyin Mim kelsa g‘unna bilan qo‘shib o‘qiladi',
    color: '#15803d',
  },
  f: {
    code: 'f',
    labelUz: 'Ixfo',
    descriptionUz: 'Sokin Nun yoki tanvin yashirinib, g‘unna bilan o‘qiladi',
    color: '#0d9488',
  },
  c: {
    code: 'c',
    labelUz: 'Ixfoyi Shafawi',
    descriptionUz: 'Sokin Mimdan keyin Bo (ب) kelsa lablar yumshoq yopiladi',
    color: '#0d9488',
  },
  i: {
    code: 'i',
    labelUz: 'Iqlob',
    descriptionUz: 'Sokin Nun yoki tanvin Бо (ب) oldida Mim tovushiga aylanadi',
    color: '#047857',
  },
  q: {
    code: 'q',
    labelUz: 'Qalqalah',
    descriptionUz: 'ق ط ب ج د harflari sokin bo‘lganda tebranib aks-sado beradi',
    color: '#1d4ed8',
  },
  n: {
    code: 'n',
    labelUz: 'Madd Tabiiy (2 harakat)',
    descriptionUz: 'Tabiiy cho‘zish: 2 harakat miqdorida cho‘ziladi',
    color: '#b45309',
  },
  p: {
    code: 'p',
    labelUz: 'Madd Orid lissukun',
    descriptionUz: 'To‘xtashda 2, 4 yoki 6 harakat cho‘zib o‘qiladi',
    color: '#d97706',
  },
  o: {
    code: 'o',
    labelUz: 'Madd Vojib / Joiz (4–5 harakat)',
    descriptionUz: 'Hamza sababli 4–5 harakat cho‘zib o‘qiladi',
    color: '#be123c',
  },
  m: {
    code: 'm',
    labelUz: 'Madd Lozim (6 harakat)',
    descriptionUz: 'Majburiy 6 harakat cho‘zib o‘qiladigan madd',
    color: '#7e22ce',
  },
  u: {
    code: 'u',
    labelUz: 'Idg‘om bila g‘unna',
    descriptionUz: 'Sokin Nun ل yoki ر harfiga g‘unnasiz to‘liq qo‘shiladi',
    color: '#64748b',
  },
  d: {
    code: 'd',
    labelUz: 'Idg‘om Mutajonisayn',
    descriptionUz: 'Bir xil maxrajdagi harf keyingisiga qo‘shiladi',
    color: '#64748b',
  },
  b: {
    code: 'b',
    labelUz: 'Idg‘om Mutaqoribayn',
    descriptionUz: 'Yaqin maxrajdagi harf keyingisiga qo‘shiladi',
    color: '#64748b',
  },
  h: {
    code: 'h',
    labelUz: 'Hamzatul Vasl',
    descriptionUz: 'Qo‘shib o‘qilganda talaffuz qilinmaydigan alif',
    color: '#78716c',
  },
  l: {
    code: 'l',
    labelUz: 'Lom Shamsiyya',
    descriptionUz: 'Keyingi shamsiy harfga singib, o‘qilmaydigan lom',
    color: '#78716c',
  },
  s: {
    code: 's',
    labelUz: 'O‘qilmaydigan harf',
    descriptionUz: 'Yozuvda bor, lekin talaffuz qilinmaydigan harf',
    color: '#78716c',
  },
};

export const TAJWEED_LEGEND_GROUPS: Array<{
  titleUz: string;
  color: string;
  summaryUz: string;
}> = [
  { titleUz: 'G‘unna va Idg‘om', color: '#15803d', summaryUz: '2 harakat dimog‘ bilan (نّ, مّ, ي ن م و)' },
  { titleUz: 'Ixfo va Iqlob', color: '#0d9488', summaryUz: 'Yashirin talaffuz va iqlob' },
  { titleUz: 'Qalqalah', color: '#1d4ed8', summaryUz: 'Tebranib o‘qish (ق ط ب ج د)' },
  { titleUz: 'Madd Tabiiy / Orid', color: '#b45309', summaryUz: '2 yoki 2–6 harakat cho‘zish' },
  { titleUz: 'Madd Vojib / Joiz', color: '#be123c', summaryUz: '4–5 harakat cho‘zish' },
  { titleUz: 'Madd Lozim', color: '#7e22ce', summaryUz: '6 harakat majburiy cho‘zish' },
  { titleUz: 'O‘qilmaydigan harf', color: '#78716c', summaryUz: 'Vasla, Lom Shamsiyya, sokin harflar' },
];

const KNOWN_CODES = new Set<string>([
  'h', 'l', 's', 'n', 'p', 'o', 'm', 'g', 'q', 'f', 'c', 'i', 'a', 'u', 'w', 'd', 'b',
]);

/**
 * Strips Tajweed bracket tags (including nested tags) and returns pure Uthmani Arabic text.
 */
export function stripTajweedTags(rawText: string): string {
  let out = rawText;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(/\[[a-z]+(?::[0-9]+)?\[([^\[\]]*)\]/g, '$1');
  }
  return out.replace(/\[([^\[\]a-zA-Z0-9:]*)\]/g, '$1');
}

/**
 * Strips Arabic diacritics for comparison helpers while keeping core letters.
 */
export function stripArabicDiacritics(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200C\u200D\uFEFF]/g, '')
    .replace(/[أإآٱٲٳٵ]/g, 'ا')
    .replace(/[ىٮ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .trim();
}

/**
 * Parses a raw Tajweed-annotated ayah into discrete word tokens,
 * preserving letter-level Tajweed rules even when tags nest or span spaces.
 */
export function parseAyahToTajweedWords(
  ayah: RawQuranAyah,
  ayahIndexInPage: number,
  startingWordIndex: number
): QuranWord[] {
  const charTokens: Array<{ ch: string; rule: TajweedRuleCode }> = [];
  const raw = ayah.text;
  const ruleStack: TajweedRuleCode[] = ['normal'];
  let i = 0;

  while (i < raw.length) {
    if (raw[i] === '[') {
      const openMatch = raw.slice(i).match(/^\[([a-z]+)(?::[0-9]+)?\[/);
      if (openMatch) {
        const rawCode = openMatch[1];
        const rule: TajweedRuleCode = KNOWN_CODES.has(rawCode) ? (rawCode as TajweedRuleCode) : 'normal';
        ruleStack.push(rule);
        i += openMatch[0].length;
        continue;
      }
      // Handle rare upstream malformed bracket like [ٮٰ]
      if (/^\[[^\[\]a-zA-Z0-9:]+\]/.test(raw.slice(i))) {
        ruleStack.push('normal');
        i += 1;
        continue;
      }
    }
    if (raw[i] === ']' && ruleStack.length > 1) {
      ruleStack.pop();
      i += 1;
      continue;
    }
    charTokens.push({ ch: raw[i], rule: ruleStack[ruleStack.length - 1] });
    i += 1;
  }

  // Group charTokens into words separated by whitespace
  const words: QuranWord[] = [];
  let currentChars: Array<{ ch: string; rule: TajweedRuleCode }> = [];

  const flushWord = () => {
    if (currentChars.length === 0) return;
    // Merge adjacent characters with the same rule into TajweedSegments
    const segments: TajweedSegment[] = [];
    const rulesSet = new Set<TajweedRuleCode>();
    let displayArabic = '';

    for (const item of currentChars) {
      displayArabic += item.ch;
      if (item.rule !== 'normal') {
        rulesSet.add(item.rule);
      }
      const last = segments[segments.length - 1];
      if (last && last.rule === item.rule) {
        last.text += item.ch;
      } else {
        segments.push({ text: item.ch, rule: item.rule });
      }
    }

    // Ignore pure pause-mark-only tokens if they contain no Arabic letters
    const hasArabicLetter = /[\u0621-\u064A\u0671-\u06D3]/.test(displayArabic);
    if (!hasArabicLetter) {
      if (words.length > 0) {
        const prev = words[words.length - 1];
        prev.displayArabic += ' ' + displayArabic;
        prev.segments.push({ text: ' ' + displayArabic, rule: 'normal' });
      }
      currentChars = [];
      return;
    }

    const globalWordIndex = startingWordIndex + words.length;
    words.push({
      id: `s${ayah.surahNumber}-a${ayah.numberInSurah}-w${words.length}`,
      globalWordIndex,
      ayahNumberInPage: ayahIndexInPage,
      surahNumber: ayah.surahNumber,
      ayahNumber: ayah.numberInSurah,
      displayArabic,
      plainArabic: stripArabicDiacritics(displayArabic),
      segments,
      rules: Array.from(rulesSet),
    });
    currentChars = [];
  };

  for (const token of charTokens) {
    if (/\s/.test(token.ch)) {
      flushWord();
    } else {
      currentChars.push(token);
    }
  }
  flushWord();

  return words;
}

export function parsePageWords(ayahs: RawQuranAyah[]): QuranWord[] {
  const allWords: QuranWord[] = [];
  ayahs.forEach((ayah, ayahIdx) => {
    const ayahWords = parseAyahToTajweedWords(ayah, ayahIdx, allWords.length);
    allWords.push(...ayahWords);
  });
  return allWords;
}

export function toArabicDigits(num: number): string {
  const digits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num)
    .split('')
    .map((d) => digits[Number(d)] ?? d)
    .join('');
}
