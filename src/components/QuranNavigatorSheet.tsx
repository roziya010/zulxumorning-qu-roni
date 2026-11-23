import React, { useMemo, useState } from 'react';
import { X, Search, BookOpen, Layers, FileText, Hash } from 'lucide-react';
import { STATIC_JUZ_LIST, STATIC_SURAHS_LIST } from '../modules/quranData/surahNamesUz';

interface QuranNavigatorSheetProps {
  isOpen: boolean;
  currentPage: number;
  onClose: () => void;
  onJumpToPage: (page: number, focusSurah?: number, focusAyah?: number) => void;
}

type NavMode = 'surah' | 'juz' | 'page' | 'ayah';

export const QuranNavigatorSheet: React.FC<QuranNavigatorSheetProps> = ({
  isOpen,
  currentPage,
  onClose,
  onJumpToPage,
}) => {
  const [mode, setMode] = useState<NavMode>('surah');
  const [search, setSearch] = useState('');
  const [pageInput, setPageInput] = useState(String(currentPage));
  const [selectedSurahForAyah, setSelectedSurahForAyah] = useState(1);
  const [ayahInput, setAyahInput] = useState('1');
  const [ayahJumpLoading, setAyahJumpLoading] = useState(false);

  const filteredSurahs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return STATIC_SURAHS_LIST;
    return STATIC_SURAHS_LIST.filter(
      (s) =>
        s.nameUz.toLowerCase().includes(q) ||
        s.meaningUz.toLowerCase().includes(q) ||
        String(s.number) === q
    );
  }, [search]);

  if (!isOpen) return null;

  const handlePageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const num = Number(pageInput);
    if (Number.isInteger(num) && num >= 1 && num <= 604) {
      onJumpToPage(num);
      onClose();
    }
  };

  const handleAyahSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const surah = STATIC_SURAHS_LIST[selectedSurahForAyah - 1];
    const ayahNum = Math.max(1, Math.min(surah.numberOfAyahs, Number(ayahInput) || 1));
    setAyahJumpLoading(true);
    try {
      const res = await fetch(`/api/quran/surah/${surah.number}`);
      if (res.ok) {
        const data = (await res.json()) as {
          ayahs: Array<{ numberInSurah: number; page: number }>;
        };
        const found = data.ayahs.find((a) => a.numberInSurah === ayahNum);
        onJumpToPage(found?.page ?? surah.startPage, surah.number, ayahNum);
        onClose();
        return;
      }
    } catch {
      // Fallback to surah start page if offline
    } finally {
      setAyahJumpLoading(false);
    }
    onJumpToPage(surah.startPage, surah.number, ayahNum);
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Qur'on bo'ylab o'tish"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 backdrop-blur-sm sm:items-center sm:p-4"
    >
      <div className="flex max-h-[88vh] w-full max-w-2xl flex-col rounded-t-3xl bg-[#fffdf7] shadow-2xl sm:rounded-3xl">
        {/* Grab handle on mobile */}
        <div className="mx-auto my-2.5 h-1.5 w-10 rounded-full bg-[#d8d0c1] sm:hidden" />

        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#0b4f3a]/10 px-5 py-3.5">
          <h2 className="font-display text-lg font-semibold text-[#0b4f3a]">
            Qur&apos;ondan kerakli joyni tanlang
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Yopish"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl text-[#5c564d] hover:bg-[#f4eee1] cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="grid grid-cols-4 gap-1 bg-[#f4eee1] p-1.5 mx-5 mt-4 rounded-xl">
          {[
            { id: 'surah' as NavMode, label: 'Sura', icon: BookOpen },
            { id: 'juz' as NavMode, label: 'Pora', icon: Layers },
            { id: 'page' as NavMode, label: 'Sahifa', icon: FileText },
            { id: 'ayah' as NavMode, label: 'Oyat', icon: Hash },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = mode === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMode(tab.id)}
                className={`flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-white text-[#0b4f3a] shadow-sm'
                    : 'text-[#5c564d] hover:text-[#1a1815]'
                }`}
              >
                <Icon className="h-3.5 w-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {mode === 'surah' && (
            <div>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[#78716c]" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Sura nomi yoki raqamini yozing (masalan: Fotiha, 36)..."
                  className="w-full rounded-xl border border-[#0b4f3a]/15 bg-white py-2.5 pl-10 pr-4 text-sm text-[#1a1815] outline-none focus:border-[#0b4f3a]"
                />
              </div>
              <div className="divide-y divide-[#0b4f3a]/8">
                {filteredSurahs.map((s) => (
                  <button
                    key={s.number}
                    type="button"
                    onClick={() => {
                      onJumpToPage(s.startPage, s.number, 1);
                      onClose();
                    }}
                    className="flex min-h-[58px] w-full items-center justify-between gap-3 px-2 py-2.5 text-left transition hover:bg-[#f4eee1]/70 rounded-xl cursor-pointer"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#0b4f3a]/8 text-xs font-bold text-[#0b4f3a] tabular-nums">
                        {s.number}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#1a1815] truncate">
                          {s.nameUz}
                        </p>
                        <p className="text-xs text-[#5c564d] truncate">
                          {s.meaningUz} · {s.numberOfAyahs} oyat · {s.startPage}-sahifa
                        </p>
                      </div>
                    </div>
                    <span dir="rtl" lang="ar" className="font-quran text-xl text-[#0b4f3a] shrink-0">
                      {s.nameArabic}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {mode === 'juz' && (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {STATIC_JUZ_LIST.map((j) => (
                <button
                  key={j.juz}
                  type="button"
                  onClick={() => {
                    onJumpToPage(j.startPage, j.startSurah, j.startAyah);
                    onClose();
                  }}
                  className="flex min-h-[56px] items-center justify-between rounded-2xl border border-[#0b4f3a]/12 bg-white px-4 py-3 text-left transition hover:border-[#0b4f3a]/35 hover:bg-[#f4eee1]/60 cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-semibold text-[#1a1815]">{j.titleUz}</p>
                    <p className="text-xs text-[#5c564d] tabular-nums">
                      {j.startPage}-sahifadan boshlanadi
                    </p>
                  </div>
                  <span className="text-xs font-bold text-[#0b4f3a] tabular-nums">
                    {j.juz}/30
                  </span>
                </button>
              ))}
            </div>
          )}

          {mode === 'page' && (
            <form onSubmit={handlePageSubmit} className="space-y-4">
              <div>
                <label htmlFor="mushaf-page-input" className="block text-sm font-medium text-[#3d3830]">
                  Mushaf sahifa raqami (1 dan 604 gacha)
                </label>
                <div className="mt-2 flex gap-2">
                  <input
                    id="mushaf-page-input"
                    type="number"
                    min={1}
                    max={604}
                    value={pageInput}
                    onChange={(e) => setPageInput(e.target.value)}
                    className="w-full rounded-xl border border-[#0b4f3a]/20 bg-white px-4 py-3 text-base font-semibold text-[#1a1815] tabular-nums outline-none focus:border-[#0b4f3a]"
                  />
                  <button
                    type="submit"
                    className="min-h-[48px] rounded-xl bg-[#0b4f3a] px-6 text-sm font-semibold text-[#fbf8f1] hover:bg-[#11694d] whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    Ochish
                  </button>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-medium text-[#5c564d]">
                  Tezkor sahifalar
                </p>
                <div className="grid grid-cols-4 gap-2">
                  {[1, 2, 50, 282, 440, 562, 582, 604].map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => {
                        onJumpToPage(p);
                        onClose();
                      }}
                      className="min-h-[44px] rounded-xl border border-[#0b4f3a]/15 bg-white text-xs font-semibold text-[#0b4f3a] hover:bg-[#f4eee1] tabular-nums cursor-pointer"
                    >
                      {p}-sahifa
                    </button>
                  ))}
                </div>
              </div>
            </form>
          )}

          {mode === 'ayah' && (
            <form onSubmit={handleAyahSubmit} className="space-y-4">
              <div>
                <label htmlFor="ayah-surah-select" className="block text-sm font-medium text-[#3d3830]">
                  Surani tanlang
                </label>
                <select
                  id="ayah-surah-select"
                  value={selectedSurahForAyah}
                  onChange={(e) => setSelectedSurahForAyah(Number(e.target.value))}
                  className="mt-1.5 w-full rounded-xl border border-[#0b4f3a]/20 bg-white px-3.5 py-3 text-sm font-medium text-[#1a1815] outline-none focus:border-[#0b4f3a]"
                >
                  {STATIC_SURAHS_LIST.map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.number}. {s.nameUz} ({s.numberOfAyahs} oyat)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="ayah-number-input" className="block text-sm font-medium text-[#3d3830]">
                  Oyat raqami (1–{STATIC_SURAHS_LIST[selectedSurahForAyah - 1].numberOfAyahs})
                </label>
                <input
                  id="ayah-number-input"
                  type="number"
                  min={1}
                  max={STATIC_SURAHS_LIST[selectedSurahForAyah - 1].numberOfAyahs}
                  value={ayahInput}
                  onChange={(e) => setAyahInput(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-[#0b4f3a]/20 bg-white px-4 py-3 text-base font-semibold text-[#1a1815] tabular-nums outline-none focus:border-[#0b4f3a]"
                />
              </div>
              <button
                type="submit"
                disabled={ayahJumpLoading}
                className="min-h-[48px] w-full rounded-xl bg-[#0b4f3a] px-6 text-sm font-semibold text-[#fbf8f1] hover:bg-[#11694d] disabled:opacity-60 cursor-pointer"
              >
                {ayahJumpLoading ? 'Sahifa aniqlanmoqda...' : 'Oyatga o‘tish'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
