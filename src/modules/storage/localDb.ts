import {
  AppSettings,
  DailyProgress,
  MemorizationEntry,
  MistakeRecord,
  QuranPageData,
  QuranStatsSummary,
} from '../../types/quran';

const DB_NAME = 'zulxumor_quran_db';
const DB_VERSION = 1;

const DEFAULT_SETTINGS: AppSettings = {
  vibrationEnabled: true,
  arabicFontSize: 32,
  showTajweedLegend: true,
  offlineBundleDownloaded: false,
  offlineBundleDate: null,
  lastPage: 1,
  lastSurah: 1,
  lastAyah: 1,
  micSensitivity: 'ortacha',
  preferOfflineSpeechWhenDisconnected: true,
};

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('quran_pages')) {
        db.createObjectStore('quran_pages', { keyPath: 'page' });
      }
      if (!db.objectStoreNames.contains('mistakes')) {
        db.createObjectStore('mistakes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('daily_progress')) {
        db.createObjectStore('daily_progress', { keyPath: 'dateKey' });
      }
      if (!db.objectStoreNames.contains('memorization')) {
        db.createObjectStore('memorization', { keyPath: 'surahNumber' });
      }
      if (!db.objectStoreNames.contains('kv')) {
        db.createObjectStore('kv', { keyPath: 'key' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function getTodayKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export async function getCachedPage(page: number): Promise<QuranPageData | null> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('quran_pages', 'readonly');
      const req = tx.objectStore('quran_pages').get(page);
      req.onsuccess = () => resolve((req.result as QuranPageData) || null);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return null;
  }
}

export async function saveCachedPage(pageData: QuranPageData): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('quran_pages', 'readwrite');
      tx.objectStore('quran_pages').put(pageData);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Graceful no-op if IndexedDB unavailable
  }
}

export async function saveAllPagesBulk(pages: QuranPageData[]): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('quran_pages', 'readwrite');
    const store = tx.objectStore('quran_pages');
    for (const p of pages) {
      store.put(p);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function countCachedPages(): Promise<number> {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('quran_pages', 'readonly');
      const req = tx.objectStore('quran_pages').count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

export async function getSettings(): Promise<AppSettings> {
  try {
    const db = await openDb();
    const saved = await new Promise<AppSettings | null>((resolve, reject) => {
      const tx = db.transaction('kv', 'readonly');
      const req = tx.objectStore('kv').get('settings');
      req.onsuccess = () => resolve(req.result?.value ?? null);
      req.onerror = () => reject(req.error);
    });
    return { ...DEFAULT_SETTINGS, ...(saved || {}) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export async function saveSettings(partial: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const next = { ...current, ...partial };
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction('kv', 'readwrite');
      tx.objectStore('kv').put({ key: 'settings', value: next });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // Ignore storage quota error
  }
  return next;
}

export async function addMistakeRecord(record: MistakeRecord): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('mistakes', 'readwrite');
    tx.objectStore('mistakes').put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function markMistakeResolved(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('mistakes', 'readwrite');
    const store = tx.objectStore('mistakes');
    const getReq = store.get(id);
    getReq.onsuccess = () => {
      const item = getReq.result as MistakeRecord | undefined;
      if (item) {
        item.resolved = true;
        store.put(item);
      }
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllMistakes(): Promise<MistakeRecord[]> {
  try {
    const db = await openDb();
    const list = await new Promise<MistakeRecord[]>((resolve, reject) => {
      const tx = db.transaction('mistakes', 'readonly');
      const req = tx.objectStore('mistakes').getAll();
      req.onsuccess = () => resolve((req.result as MistakeRecord[]) || []);
      req.onerror = () => reject(req.error);
    });
    return list.sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}

export async function clearAllMistakes(): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('mistakes', 'readwrite');
    tx.objectStore('mistakes').clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function recordReadingActivity(delta: {
  completedPage?: number;
  ayahsRead?: number;
  wordsCorrect?: number;
  errorsCount?: number;
  errorsCorrected?: number;
}): Promise<void> {
  const dateKey = getTodayKey();
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('daily_progress', 'readwrite');
    const store = tx.objectStore('daily_progress');
    const req = store.get(dateKey);
    req.onsuccess = () => {
      const existing: DailyProgress = (req.result as DailyProgress) || {
        dateKey,
        pagesCompleted: [],
        ayahsRead: 0,
        wordsCorrect: 0,
        errorsCount: 0,
        errorsCorrected: 0,
      };
      if (delta.completedPage && !existing.pagesCompleted.includes(delta.completedPage)) {
        existing.pagesCompleted.push(delta.completedPage);
      }
      existing.ayahsRead += delta.ayahsRead ?? 0;
      existing.wordsCorrect += delta.wordsCorrect ?? 0;
      existing.errorsCount += delta.errorsCount ?? 0;
      existing.errorsCorrected += delta.errorsCorrected ?? 0;
      store.put(existing);
    };
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getStatsSummary(): Promise<QuranStatsSummary> {
  try {
    const db = await openDb();
    const days = await new Promise<DailyProgress[]>((resolve, reject) => {
      const tx = db.transaction('daily_progress', 'readonly');
      const req = tx.objectStore('daily_progress').getAll();
      req.onsuccess = () => resolve((req.result as DailyProgress[]) || []);
      req.onerror = () => reject(req.error);
    });

    const todayKey = getTodayKey();
    let todayPages = 0;
    let totalAyahsRead = 0;
    let totalWordsCorrect = 0;
    let totalErrors = 0;
    let totalErrorsCorrected = 0;
    const completedSet = new Set<number>();

    const activeDateKeys = new Set<string>();

    for (const day of days) {
      if (day.dateKey === todayKey) {
        todayPages = day.pagesCompleted.length;
      }
      totalAyahsRead += day.ayahsRead;
      totalWordsCorrect += day.wordsCorrect;
      totalErrors += day.errorsCount;
      totalErrorsCorrected += day.errorsCorrected;
      day.pagesCompleted.forEach((p) => completedSet.add(p));
      if (day.wordsCorrect > 0 || day.pagesCompleted.length > 0) {
        activeDateKeys.add(day.dateKey);
      }
    }

    // Calculate consecutive streak up to today or yesterday
    let streakDays = 0;
    const cursor = new Date();
    const checkDate = (d: Date) => {
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayNum = String(d.getDate()).padStart(2, '0');
      return `${y}-${m}-${dayNum}`;
    };

    if (!activeDateKeys.has(checkDate(cursor))) {
      cursor.setDate(cursor.getDate() - 1);
    }
    while (activeDateKeys.has(checkDate(cursor))) {
      streakDays += 1;
      cursor.setDate(cursor.getDate() - 1);
    }

    return {
      todayPages,
      totalAyahsRead,
      totalWordsCorrect,
      totalErrors,
      totalErrorsCorrected,
      streakDays,
      completedPageNumbers: Array.from(completedSet).sort((a, b) => a - b),
    };
  } catch {
    return {
      todayPages: 0,
      totalAyahsRead: 0,
      totalWordsCorrect: 0,
      totalErrors: 0,
      totalErrorsCorrected: 0,
      streakDays: 0,
      completedPageNumbers: [],
    };
  }
}

export async function getMemorizationMap(): Promise<Record<number, MemorizationEntry>> {
  try {
    const db = await openDb();
    const list = await new Promise<MemorizationEntry[]>((resolve, reject) => {
      const tx = db.transaction('memorization', 'readonly');
      const req = tx.objectStore('memorization').getAll();
      req.onsuccess = () => resolve((req.result as MemorizationEntry[]) || []);
      req.onerror = () => reject(req.error);
    });
    const out: Record<number, MemorizationEntry> = {};
    for (const item of list) {
      out[item.surahNumber] = item;
    }
    return out;
  } catch {
    return {};
  }
}

export async function saveMemorizationEntry(entry: MemorizationEntry): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('memorization', 'readwrite');
    tx.objectStore('memorization').put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
