import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  ArrowRight,
  Trash2,
  Layers,
} from 'lucide-react';
import { MemorizationEntry, MistakeRecord, QuranStatsSummary } from '../types/quran';
import {
  clearAllMistakes,
  getAllMistakes,
  getMemorizationMap,
  markMistakeResolved,
} from '../modules/storage/localDb';
import { getSurahMeta, STATIC_JUZ_LIST } from '../modules/quranData/surahNamesUz';

interface ReviewViewProps {
  stats: QuranStatsSummary;
  onOpenPage: (page: number) => void;
}

export const ReviewView: React.FC<ReviewViewProps> = ({ stats, onOpenPage }) => {
  const [subTab, setSubTab] = useState<'mistakes' | 'juz-review'>('mistakes');
  const [mistakes, setMistakes] = useState<MistakeRecord[]>([]);
  const [memMap, setMemMap] = useState<Record<number, MemorizationEntry>>({});

  const refreshData = async () => {
    const [mList, mMap] = await Promise.all([getAllMistakes(), getMemorizationMap()]);
    setMistakes(mList);
    setMemMap(mMap);
  };

  useEffect(() => {
    refreshData();
  }, []);

  const handleResolve = async (id: string) => {
    await markMistakeResolved(id);
    await refreshData();
  };

  const handleClear = async () => {
    await clearAllMistakes();
    await refreshData();
  };

  const unresolvedCount = mistakes.filter((m) => !m.resolved).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-4 pt-5 pb-28 sm:px-6 lg:py-8">
      <div className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="font-display text-2xl font-semibold text-[#0b4f3a]">
              Takrorlash va oldingi xatolar
            </h1>
            <p className="mt-1 text-xs text-[#5c564d]">
              Xato qilingan so‘zlarni mustahkamlash va tugatilgan sahifalarni takrorlash
            </p>
          </div>
          <div className="flex gap-1.5 rounded-xl bg-[#f4eee1] p-1">
            <button
              type="button"
              onClick={() => setSubTab('mistakes')}
              className={`min-h-[40px] rounded-lg px-3.5 text-xs font-semibold transition cursor-pointer ${
                subTab === 'mistakes' ? 'bg-white text-[#0b4f3a] shadow-sm' : 'text-[#5c564d]'
              }`}
            >
              Oldingi xatolar ({unresolvedCount})
            </button>
            <button
              type="button"
              onClick={() => setSubTab('juz-review')}
              className={`min-h-[40px] rounded-lg px-3.5 text-xs font-semibold transition cursor-pointer ${
                subTab === 'juz-review' ? 'bg-white text-[#0b4f3a] shadow-sm' : 'text-[#5c564d]'
              }`}
            >
              Pora va sahifalar
            </button>
          </div>
        </div>
      </div>

      {subTab === 'mistakes' ? (
        <div className="space-y-3">
          {mistakes.length > 0 && (
            <div className="flex items-center justify-between px-1">
              <p className="text-xs text-[#5c564d]">
                Jami yozilgan xatolar: <strong className="text-[#1a1815]">{mistakes.length}</strong>
              </p>
              <button
                type="button"
                onClick={handleClear}
                className="inline-flex min-h-[36px] items-center gap-1.5 rounded-xl border border-red-200 bg-white px-3 text-xs font-semibold text-red-700 hover:bg-red-50 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Tarixni tozalash</span>
              </button>
            </div>
          )}

          {mistakes.length === 0 ? (
            <div className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-10 text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-[#15803d]" />
              <h2 className="mt-3 text-base font-semibold text-[#0b4f3a]">
                Hozircha qayd etilgan xatolar yo‘q
              </h2>
              <p className="mt-1 text-xs text-[#5c564d]">
                Qur&apos;on o‘qish paytida talaffuz xatolari aniqlansa, ularni takrorlash uchun shu yerda saqlab boramiz.
              </p>
            </div>
          ) : (
            mistakes.map((m) => (
              <div
                key={m.id}
                className="flex flex-col justify-between gap-4 rounded-2xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-4 sm:flex-row sm:items-center"
              >
                <div className="flex items-start gap-3.5">
                  {m.resolved ? (
                    <CheckCircle2 className="mt-1 h-5 w-5 shrink-0 text-[#15803d]" />
                  ) : (
                    <AlertCircle className="mt-1 h-5 w-5 shrink-0 text-red-600" />
                  )}
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <span dir="rtl" lang="ar" className="font-quran text-2xl font-bold text-[#0b4f3a]">
                        {m.wordArabic}
                      </span>
                      <span className="text-xs text-[#5c564d]">
                        {m.surahNameUz} surasi · {m.ayahNumber}-oyat · {m.page}-sahifa
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-[#3d3830]">{m.feedbackUz}</p>
                    <p className="mt-1 text-[11px] text-[#78716c]">
                      {m.resolved ? 'Tuzatilgan' : 'Qayta mashq kutilmoqda'}
                      {m.confusedLetters ? ` · Harflar: ${m.confusedLetters}` : ''}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!m.resolved && (
                    <button
                      type="button"
                      onClick={() => handleResolve(m.id)}
                      className="min-h-[40px] rounded-xl border border-[#0b4f3a]/20 bg-white px-3 text-xs font-semibold text-[#0b4f3a] hover:bg-[#f4eee1] cursor-pointer"
                    >
                      Tuzatildi
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onOpenPage(m.page)}
                    className="inline-flex min-h-[40px] items-center gap-1.5 rounded-xl bg-[#0b4f3a] px-4 text-xs font-semibold text-[#fbf8f1] hover:bg-[#11694d] cursor-pointer"
                  >
                    <span>Sahifada ochish</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Completed Pages & Memorized Surahs */}
          <section className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5">
            <h2 className="flex items-center gap-2 text-base font-semibold text-[#0b4f3a]">
              <RotateCcw className="h-4 w-4" />
              <span>Tugatilgan sahifalarni takrorlash</span>
            </h2>
            {stats.completedPageNumbers.length === 0 ? (
              <p className="mt-2 text-xs text-[#5c564d]">
                Hali to‘liq tugatilgan sahifalar yo‘q. Sahifani mikrofon bilan o‘qib tugatganingizdan so‘ng bu yerda ko‘rinadi.
              </p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {stats.completedPageNumbers.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onOpenPage(p)}
                    className="min-h-[40px] rounded-xl border border-[#b8892b]/40 bg-[#fbf8f1] px-3.5 text-xs font-semibold text-[#0b4f3a] hover:bg-[#f4eee1] tabular-nums cursor-pointer"
                  >
                    {p}-sahifa
                  </button>
                ))}
              </div>
            )}

            {Object.keys(memMap).length > 0 && (
              <div className="mt-5 border-t border-[#0b4f3a]/10 pt-4">
                <h3 className="text-sm font-semibold text-[#1a1815]">Yodlangan suralar</h3>
                <div className="mt-2 flex flex-wrap gap-2">
                  {Object.values(memMap).map((entry) => {
                    const meta = getSurahMeta(entry.surahNumber);
                    return (
                      <button
                        key={entry.surahNumber}
                        type="button"
                        onClick={() => onOpenPage(meta.startPage)}
                        className="min-h-[40px] rounded-xl bg-[#0b4f3a]/8 px-3.5 text-xs font-semibold text-[#0b4f3a] hover:bg-[#0b4f3a]/15 cursor-pointer"
                      >
                        {meta.nameUz} ({entry.memorizedAyahs.length} oyat)
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 30 Juz Revision Grid */}
          <section className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-[#0b4f3a]">
              <Layers className="h-4 w-4" />
              <span>30 pora bo‘yicha takrorlash</span>
            </h2>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {STATIC_JUZ_LIST.map((j) => (
                <button
                  key={j.juz}
                  type="button"
                  onClick={() => onOpenPage(j.startPage)}
                  className="flex min-h-[50px] items-center justify-between rounded-xl border border-[#0b4f3a]/10 bg-[#fbf8f1] px-3.5 py-2 text-left hover:border-[#0b4f3a]/35 cursor-pointer"
                >
                  <span className="text-xs font-semibold text-[#1a1815]">{j.titleUz}</span>
                  <span className="text-xs text-[#0b4f3a] tabular-nums">{j.startPage}-sahifa</span>
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
};
