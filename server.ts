import express from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'server', 'data');
const QURAN_DATA_FILE = path.join(DATA_DIR, 'quran-tajweed.json');

interface ApiAyah {
  number: number;
  text: string;
  numberInSurah: number;
  juz: number;
  manzil: number;
  page: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
}

interface ApiSurah {
  number: number;
  name: string;
  englishName: string;
  englishNameTranslation: string;
  revelationType: 'Meccan' | 'Medinan';
  ayahs: ApiAyah[];
}

interface RawQuranResponse {
  code: number;
  status: string;
  data: {
    surahs: ApiSurah[];
  };
}

interface IndexedAyah {
  number: number;
  numberInSurah: number;
  surahNumber: number;
  surahNameArabic: string;
  text: string;
  juz: number;
  page: number;
  manzil: number;
  ruku: number;
  hizbQuarter: number;
  sajda: boolean | { id: number; recommended: boolean; obligatory: boolean };
}

interface IndexedPage {
  page: number;
  juz: number;
  hizbQuarter: number;
  ayahs: IndexedAyah[];
}

const pageIndex = new Map<number, IndexedPage>();
const surahIndex = new Map<number, {
  number: number;
  nameArabic: string;
  revelationType: 'Meccan' | 'Medinan';
  numberOfAyahs: number;
  startPage: number;
  endPage: number;
  juzStart: number;
  ayahs: IndexedAyah[];
}>();
const juzIndex = new Map<number, {
  juz: number;
  startPage: number;
  startSurah: number;
  startAyah: number;
  ayahs: IndexedAyah[];
}>();

let isQuranLoaded = false;

async function ensureQuranDataset(): Promise<void> {
  if (isQuranLoaded) return;

  if (!fs.existsSync(QURAN_DATA_FILE)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    console.log('Downloading verified Hafs Tajweed Quran dataset...');
    const res = await fetch('https://api.alquran.cloud/v1/quran/quran-tajweed');
    if (!res.ok) {
      throw new Error(`Failed to fetch Quran dataset: ${res.status}`);
    }
    const text = await res.text();
    fs.writeFileSync(QURAN_DATA_FILE, text, 'utf-8');
  }

  const rawText = fs.readFileSync(QURAN_DATA_FILE, 'utf-8');
  const parsed = JSON.parse(rawText) as RawQuranResponse;

  pageIndex.clear();
  surahIndex.clear();
  juzIndex.clear();

  for (const surah of parsed.data.surahs) {
    const surahAyahs: IndexedAyah[] = [];
    let startPage = 604;
    let endPage = 1;
    const juzStart = surah.ayahs[0]?.juz ?? 1;

    for (const ayah of surah.ayahs) {
      const entry: IndexedAyah = {
        number: ayah.number,
        numberInSurah: ayah.numberInSurah,
        surahNumber: surah.number,
        surahNameArabic: surah.name,
        text: ayah.text,
        juz: ayah.juz,
        page: ayah.page,
        manzil: ayah.manzil,
        ruku: ayah.ruku,
        hizbQuarter: ayah.hizbQuarter,
        sajda: ayah.sajda,
      };
      surahAyahs.push(entry);

      if (ayah.page < startPage) startPage = ayah.page;
      if (ayah.page > endPage) endPage = ayah.page;

      let pg = pageIndex.get(ayah.page);
      if (!pg) {
        pg = {
          page: ayah.page,
          juz: ayah.juz,
          hizbQuarter: ayah.hizbQuarter,
          ayahs: [],
        };
        pageIndex.set(ayah.page, pg);
      }
      pg.ayahs.push(entry);

      let jz = juzIndex.get(ayah.juz);
      if (!jz) {
        jz = {
          juz: ayah.juz,
          startPage: ayah.page,
          startSurah: surah.number,
          startAyah: ayah.numberInSurah,
          ayahs: [],
        };
        juzIndex.set(ayah.juz, jz);
      }
      jz.ayahs.push(entry);
    }

    surahIndex.set(surah.number, {
      number: surah.number,
      nameArabic: surah.name,
      revelationType: surah.revelationType,
      numberOfAyahs: surah.ayahs.length,
      startPage,
      endPage,
      juzStart,
      ayahs: surahAyahs,
    });
  }

  isQuranLoaded = true;
  console.log(`Loaded verified Quran dataset: ${surahIndex.size} surahs, ${pageIndex.size} pages, ${juzIndex.size} juz.`);
}

function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function stripDiacriticsServer(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED\u0640\u200C\u200D\uFEFF]/g, '')
    .replace(/[أإآٱٲٳٵ]/g, 'ا')
    .replace(/[ىٮ]/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\u0621-\u064A\s]/g, '')
    .trim();
}

function levenshteinServer(a: string, b: string): number {
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

function compareTranscriptToExpected(
  transcript: string,
  expectedWords: Array<{ arabic: string; plain: string }>
) {
  const spokenTokens = transcript
    .split(/\s+/)
    .map((t) => stripDiacriticsServer(t))
    .filter(Boolean);

  if (spokenTokens.length === 0) {
    return {
      status: 'unclear' as const,
      matchedCount: 0,
      heardArabic: transcript,
      errorWordIndex: -1,
      errorCategory: 'none' as const,
      confusedLetters: '',
      feedbackUz: 'Ovozni aniq tekshira olmadim, qayta o‘qing.',
    };
  }

  let matchedCount = 0;
  for (let i = 0; i < Math.min(spokenTokens.length, expectedWords.length); i++) {
    const target = stripDiacriticsServer(expectedWords[i].plain || expectedWords[i].arabic);
    const spoken = spokenTokens[i];
    const maxLen = Math.max(target.length, spoken.length, 1);
    const dist = levenshteinServer(target, spoken);
    if (dist / maxLen <= 0.36) {
      matchedCount += 1;
    } else {
      return {
        status: 'error' as const,
        matchedCount,
        heardArabic: transcript,
        errorWordIndex: i,
        errorCategory: 'harf' as const,
        confusedLetters: '',
        feedbackUz: `«${expectedWords[i].arabic}» so‘zida talaffuz xatosi aniqlandi. Iltimos, so‘zni qayta to‘g‘ri o‘qing.`,
      };
    }
  }

  return {
    status: matchedCount > 0 ? ('matched' as const) : ('unclear' as const),
    matchedCount,
    heardArabic: transcript,
    errorWordIndex: -1,
    errorCategory: 'none' as const,
    confusedLetters: '',
    feedbackUz: matchedCount > 0 ? 'To‘g‘ri o‘qildi.' : 'Ovozni aniq tekshira olmadim, qayta o‘qing.',
  };
}

async function startServer() {
  await ensureQuranDataset().catch((err) => {
    console.error('Initial Quran dataset load warning:', err);
  });

  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      quranLoaded: isQuranLoaded,
      pagesCount: pageIndex.size,
      surahsCount: surahIndex.size,
      aiConfigured: Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY'),
    });
  });

  app.get('/api/quran/meta', async (_req, res) => {
    try {
      await ensureQuranDataset();
      const surahs = Array.from(surahIndex.values()).map((s) => ({
        number: s.number,
        nameArabic: s.nameArabic,
        revelationType: s.revelationType,
        numberOfAyahs: s.numberOfAyahs,
        startPage: s.startPage,
        endPage: s.endPage,
        juzStart: s.juzStart,
      }));
      const juzs = Array.from(juzIndex.values()).map((j) => ({
        juz: j.juz,
        startPage: j.startPage,
        startSurah: j.startSurah,
        startAyah: j.startAyah,
      }));
      res.json({ surahs, juzs, totalPages: pageIndex.size });
    } catch (err) {
      console.error('/api/quran/meta error:', err);
      res.status(500).json({ error: 'Qur’on ma’lumotlarini yuklashda xatolik yuz berdi.' });
    }
  });

  app.get('/api/quran/page/:page', async (req, res) => {
    try {
      await ensureQuranDataset();
      const pageNum = Number(req.params.page);
      if (!Number.isInteger(pageNum) || pageNum < 1 || pageNum > 604) {
        res.status(400).json({ error: 'Sahifa raqami 1 dan 604 gacha bo‘lishi kerak.' });
        return;
      }
      const pageData = pageIndex.get(pageNum);
      if (!pageData) {
        res.status(404).json({ error: 'Sahifa topilmadi.' });
        return;
      }
      res.json(pageData);
    } catch (err) {
      console.error('/api/quran/page error:', err);
      res.status(500).json({ error: 'Sahifani yuklashda xatolik yuz berdi.' });
    }
  });

  app.get('/api/quran/surah/:surah', async (req, res) => {
    try {
      await ensureQuranDataset();
      const surahNum = Number(req.params.surah);
      if (!Number.isInteger(surahNum) || surahNum < 1 || surahNum > 114) {
        res.status(400).json({ error: 'Sura raqami 1 dan 114 gacha bo‘lishi kerak.' });
        return;
      }
      const surahData = surahIndex.get(surahNum);
      if (!surahData) {
        res.status(404).json({ error: 'Sura topilmadi.' });
        return;
      }
      res.json(surahData);
    } catch (err) {
      console.error('/api/quran/surah error:', err);
      res.status(500).json({ error: 'Surani yuklashda xatolik yuz berdi.' });
    }
  });

  app.get('/api/quran/juz/:juz', async (req, res) => {
    try {
      await ensureQuranDataset();
      const juzNum = Number(req.params.juz);
      if (!Number.isInteger(juzNum) || juzNum < 1 || juzNum > 30) {
        res.status(400).json({ error: 'Pora raqami 1 dan 30 gacha bo‘lishi kerak.' });
        return;
      }
      const juzData = juzIndex.get(juzNum);
      if (!juzData) {
        res.status(404).json({ error: 'Pora topilmadi.' });
        return;
      }
      res.json(juzData);
    } catch (err) {
      console.error('/api/quran/juz error:', err);
      res.status(500).json({ error: 'Porani yuklashda xatolik yuz berdi.' });
    }
  });

  app.get('/api/quran/bundle', async (_req, res) => {
    try {
      await ensureQuranDataset();
      const pages = Array.from(pageIndex.values()).sort((a, b) => a.page - b.page);
      res.json({ pages });
    } catch (err) {
      console.error('/api/quran/bundle error:', err);
      res.status(500).json({ error: 'To‘liq Qur’on to‘plamini yuklashda xatolik yuz berdi.' });
    }
  });

  app.post('/api/recitation/verify', async (req, res) => {
    try {
      const { audioBase64, mimeType, expectedWords, previousWord, surahName, ayahNumber } = req.body as {
        audioBase64?: string;
        mimeType?: string;
        expectedWords?: Array<{ arabic: string; plain: string; rules?: string[] }>;
        previousWord?: string;
        surahName?: string;
        ayahNumber?: number;
      };

      if (!audioBase64 || !Array.isArray(expectedWords) || expectedWords.length === 0) {
        res.status(400).json({ error: 'Audio yoki kutilayotgan so‘zlar yuborilmadi.' });
        return;
      }

      const ai = getAiClient();
      if (!ai) {
        res.status(503).json({
          error: 'AI ovoz tekshiruvi kaliti sozlanmagan. Iltimos, AI Studio Secrets panelida GEMINI_API_KEY ni tekshiring.',
        });
        return;
      }

      const wordsListing = expectedWords
        .map((w, idx) => `${idx}: "${w.arabic}" (oddiy: ${w.plain}${w.rules?.length ? `, tajvid: ${w.rules.join(', ')}` : ''})`)
        .join('\n');

      const systemInstruction = `Sen Qur'oni Karim tilovati, arab tili fonetikasi (makhraj) va Hafs an Osim rivoyati tajvidi bo‘yicha professional ustozsan.
Sening vazifang — foydalanuvchi (Zulxumor) mikrofon orqali o‘qigan arabcha audio yozuvni berilgan kutilayotgan Qur'on so‘zlari bilan ADOLATLI va ANIQ taqqoslash.

ASOSIY QOIDALAR:
1. Audio faqat mutlaqo jimlik yoki tushunarsiz shovqin bo‘lsa:
   - Agar sukut bo‘lsa: status="silence", matchedCount=0, errorWordIndex=-1, errorCategory="none", feedbackUz="Ovoz eshitilmadi, marhamat o‘qing."
   - Agar umuman arabcha nutq ajratib bo‘lmasa: status="unclear", matchedCount=0, errorWordIndex=-1, errorCategory="none", feedbackUz="Ovozni aniq tekshira olmadim, qayta o‘qing."
2. Agar foydalanuvchi oldingi so‘zni ("${previousWord || ''}") takrorlab qo‘ygan bo‘lsa va 0-indeksdagi yangi so‘zni hali o‘qimagan bo‘lsa -> status="unclear", matchedCount=0, feedbackUz="Keyingi so‘zdan davom eting: ${expectedWords[0].arabic}".
3. 0-indeksdan boshlab ketma-ket tekshir:
   - Tabiiy tilovatdagi oddiy mikrofon tembri farqlari uchun foydalanuvchini asossiz xatoda ayblama!
   - LEKIN aniq talaffuz xatolari bo‘lsa QAT'IY ushla:
     • Noto‘g‘ri arabcha so‘z o‘qilsa yoki so‘z tashlab ketilsa;
     • O‘xshash harflar almashtirilsa: س – ص, ت – ط, د – ض, ذ – ز, ح – ه, ع – أ, ق – ك, ث – س;
     • Harakat xatosi (masalan: fatha o‘rniga kasra/damma yoki aksincha);
     • Tajvid xatosi (masalan: aniq g‘unna yoki madd tashlab ketilsa).
4. TO‘XTATISH QOIDASI (JUDA MUHIM):
   - 0-indeksdan boshlab to‘g‘ri o‘qilgan ketma-ket so‘zlar sonini "matchedCount" ga yoz.
   - Birinchi xato so‘zga yetganda TO‘XTA: xato so‘z indeksini "errorWordIndex" ga yoz, status="error" qil va xatodan keyingi so‘zlarni matchedCount ga qo‘shma.
   - Masalan: 0-so‘z to‘g‘ri, 1-so‘z xato bo‘lsa -> status="error", matchedCount=1, errorWordIndex=1.
   - Agar 0-so‘zning o‘zi xato bo‘lsa -> status="error", matchedCount=0, errorWordIndex=0.
   - Agar eshitilgan barcha so‘zlar (kamida 1 ta) to‘g‘ri bo‘lsa -> status="matched", errorWordIndex=-1, errorCategory="none".
5. Barcha izohlar ("feedbackUz") samimiy va aniq o‘zbek lotin tilida bo‘lsin.`;

      const prompt = `Sura: ${surahName || 'Qur’on'}, Oyat: ${ayahNumber ?? ''}
Kutilayotgan ketma-ket so‘zlar (0-indeksdan boshlab o‘qilishi kerak):
${wordsListing}

Audio yozuvdagi arabcha tilovatni tahlil qil va JSON natija qaytar.`;

      const responseSchema = {
        type: Type.OBJECT,
        properties: {
          status: {
            type: Type.STRING,
            enum: ['matched', 'error', 'unclear', 'silence'],
          },
          matchedCount: {
            type: Type.INTEGER,
          },
          heardArabic: {
            type: Type.STRING,
          },
          errorWordIndex: {
            type: Type.INTEGER,
          },
          errorCategory: {
            type: Type.STRING,
            enum: ['harf', 'harakat', 'tajvid', 'tashlab_ketildi', 'ortiqcha', 'none'],
          },
          confusedLetters: {
            type: Type.STRING,
          },
          feedbackUz: {
            type: Type.STRING,
          },
        },
        required: ['status', 'matchedCount', 'heardArabic', 'errorWordIndex', 'errorCategory', 'feedbackUz'],
      };

      const audioPart = {
        inlineData: {
          mimeType: mimeType || 'audio/wav',
          data: audioBase64,
        },
      };

      const modelCandidates: Array<{ model: string; thinkingLevel?: ThinkingLevel }> = [
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
        { model: 'gemini-3.1-flash-lite' },
        { model: 'gemini-4-hydrogen', thinkingLevel: ThinkingLevel.LOW },
      ];

      let lastErr: { status?: number; message?: string } | null = null;
      const attemptErrors: string[] = [];

      for (let i = 0; i < modelCandidates.length; i++) {
        const candidate = modelCandidates[i];
        try {
          if (i === 2) {
            await new Promise((r) => setTimeout(r, 1200));
          }
          const response = await ai.models.generateContent({
            model: candidate.model,
            contents: {
              parts: [audioPart, { text: prompt }],
            },
            config: {
              systemInstruction,
              ...(candidate.thinkingLevel
                ? { thinkingConfig: { thinkingLevel: candidate.thinkingLevel } }
                : {}),
              responseMimeType: 'application/json',
              responseSchema,
            },
          });

          const rawJson = (response.text ?? '{}').trim();
          const result = JSON.parse(rawJson);

          res.json({
            status: result.status ?? 'unclear',
            matchedCount: Math.max(0, Math.min(expectedWords.length, Number(result.matchedCount) || 0)),
            heardArabic: result.heardArabic ?? '',
            errorWordIndex: typeof result.errorWordIndex === 'number' ? result.errorWordIndex : -1,
            errorCategory: result.errorCategory ?? 'none',
            confusedLetters: result.confusedLetters ?? '',
            feedbackUz: result.feedbackUz || 'Ovozni aniq tekshira olmadim, qayta o‘qing.',
            engine: 'gemini-audio',
          });
          return;
        } catch (err: unknown) {
          const errObj = err as { status?: number; message?: string };
          if (errObj?.status !== 404 || !lastErr) {
            lastErr = errObj;
          }
          attemptErrors.push(`${candidate.model}:${errObj?.status ?? 'err'}`);
          console.warn(`Model ${candidate.model} (attempt ${i + 1}) failed (${errObj?.status}):`, errObj?.message?.slice(0, 180));
        }
      }

      const status = lastErr?.status && lastErr.status >= 400 && lastErr.status < 600 ? lastErr.status : 503;
      res.status(status).json({
        error:
          status === 429
            ? 'AI so‘rovlar limiti vaqtincha to‘ldi. Bir necha soniyadan so‘ng davom eting.'
            : `AI ovoz tekshiruvi vaqtincha band (${attemptErrors.join(', ')}). Qayta urinib ko‘ring.`,
      });
    } catch (err: unknown) {
      const errorObj = err as { status?: number; message?: string };
      console.error('/api/recitation/verify error:', errorObj);
      const status = errorObj?.status && errorObj.status >= 400 && errorObj.status < 600 ? errorObj.status : 500;
      res.status(status).json({
        error: errorObj?.message || 'Ovozni tekshirishda server xatoligi yuz berdi.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Zulxumor Qur'on server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
