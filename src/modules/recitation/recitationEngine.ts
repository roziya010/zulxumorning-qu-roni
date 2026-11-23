import { QuranWord, VerificationResult } from '../../types/quran';
import { TAJWEED_RULES_MAP } from '../tajweed/tajweedParser';

export async function verifyRecitationAudio(params: {
  audioBase64: string;
  mimeType: string;
  expectedWords: QuranWord[];
  previousWord?: string;
  surahNameUz: string;
  ayahNumber: number;
}): Promise<VerificationResult> {
  const payload = {
    audioBase64: params.audioBase64,
    mimeType: params.mimeType,
    previousWord: params.previousWord ?? '',
    surahName: params.surahNameUz,
    ayahNumber: params.ayahNumber,
    expectedWords: params.expectedWords.map((w) => ({
      arabic: w.displayArabic,
      plain: w.plainArabic,
      rules: w.rules.map((r) => TAJWEED_RULES_MAP[r]?.labelUz || r),
    })),
  };

  const res = await fetch('/api/recitation/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    let errText = 'Ovozni tekshirishda xatolik yuz berdi.';
    try {
      const data = (await res.json()) as { error?: string };
      if (data.error) errText = data.error;
    } catch {
      // ignore
    }
    throw new Error(errText);
  }

  return (await res.json()) as VerificationResult;
}
