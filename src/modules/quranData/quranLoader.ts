import { QuranPageData } from '../../types/quran';
import {
  countCachedPages,
  getCachedPage,
  saveAllPagesBulk,
  saveCachedPage,
  saveSettings,
} from '../storage/localDb';
import { VERIFIED_SEED_PAGES } from './verifiedSeedPages';

export async function loadQuranPage(pageNumber: number): Promise<{
  data: QuranPageData | null;
  source: 'cache' | 'network' | 'seed' | 'unavailable';
  error?: string;
}> {
  const safePage = Math.max(1, Math.min(604, Math.floor(pageNumber)));

  // 1. Check IndexedDB offline cache first
  const cached = await getCachedPage(safePage);
  if (cached && cached.ayahs && cached.ayahs.length > 0) {
    return { data: cached, source: 'cache' };
  }

  // 2. Fetch from verified backend API if online
  if (typeof navigator === 'undefined' || navigator.onLine) {
    try {
      const res = await fetch(`/api/quran/page/${safePage}`);
      if (res.ok) {
        const pageData = (await res.json()) as QuranPageData;
        await saveCachedPage(pageData);
        return { data: pageData, source: 'network' };
      }
    } catch {
      // Fall through to seed check
    }
  }

  // 3. Fallback to verbatim embedded seed pages (Page 1 & 604)
  if (VERIFIED_SEED_PAGES[safePage]) {
    return { data: VERIFIED_SEED_PAGES[safePage], source: 'seed' };
  }

  return {
    data: null,
    source: 'unavailable',
    error: 'Ushbu sahifa hali qurilma xotirasiga yuklanmagan. Oflayn o‘qish uchun internetga ulanib to‘liq Qur’onni yuklab oling.',
  };
}

export async function downloadFullQuranOffline(
  onProgress?: (percent: number, labelUz: string) => void
): Promise<{ success: boolean; totalPages: number; error?: string }> {
  try {
    onProgress?.(10, 'Tasdiqlangan Qur’on matni serverdan olinmoqda...');
    const res = await fetch('/api/quran/bundle');
    if (!res.ok) {
      return {
        success: false,
        totalPages: 0,
        error: 'Serverdan Qur’on to‘plamini yuklab bo‘lmadi.',
      };
    }
    onProgress?.(55, '604 ta sahifa va tajvid belgilari tayyorlanmoqda...');
    const payload = (await res.json()) as { pages: QuranPageData[] };
    if (!payload.pages || payload.pages.length < 604) {
      return {
        success: false,
        totalPages: payload.pages?.length ?? 0,
        error: 'Qur’on ma’lumotlari to‘liq emas.',
      };
    }

    onProgress?.(80, 'Qurilma xotirasiga (IndexedDB) saqlanmoqda...');
    await saveAllPagesBulk(payload.pages);
    await saveSettings({
      offlineBundleDownloaded: true,
      offlineBundleDate: Date.now(),
    });
    const count = await countCachedPages();
    onProgress?.(100, `Tayyor! ${count} ta sahifa oflayn saqlandi.`);
    return { success: true, totalPages: count };
  } catch (err) {
    return {
      success: false,
      totalPages: 0,
      error: err instanceof Error ? err.message : 'Yuklab olishda tarmoq xatoligi yuz berdi.',
    };
  }
}
