import React from 'react';
import {
  BookOpen,
  Brain,
  RotateCcw,
  Compass,
  Download,
  CheckCircle2,
  ArrowRight,
  Flame,
} from 'lucide-react';
import { AppSettings, AppTab, QuranStatsSummary } from '../types/quran';
import { getSurahMeta } from '../modules/quranData/surahNamesUz';

interface HomeDashboardViewProps {
  settings: AppSettings;
  stats: QuranStatsSummary;
  cachedPagesCount: number;
  isOnline: boolean;
  downloadingOffline: boolean;
  downloadProgress: { percent: number; label: string } | null;
  onStartDownloadOffline: () => void;
  onOpenPage: (page: number) => void;
  onSelectTab: (tab: AppTab) => void;
  onOpenNavigator: () => void;
}

const FEATURED_SHORTCUTS = [
  { label: 'Fotiha surasi', sub: '1-sahifa · 7 oyat', page: 1 },
  { label: 'Yosin surasi', sub: '440-sahifa · 83 oyat', page: 440 },
  { label: 'Mulk surasi', sub: '562-sahifa · 30 oyat', page: 562 },
  { label: 'Amma porasi (30)', sub: '582-sahifadan', page: 582 },
];

export const HomeDashboardView: React.FC<HomeDashboardViewProps> = ({
  settings,
  stats,
  cachedPagesCount,
  isOnline,
  downloadingOffline,
  downloadProgress,
  onStartDownloadOffline,
  onOpenPage,
  onSelectTab,
  onOpenNavigator,
}) => {
  const lastSurah = getSurahMeta(settings.lastSurah);

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 pt-5 pb-28 sm:px-6 lg:py-8">
      {/* Greeting & Resume Hero Card */}
      <section className="grid gap-5 lg:grid-cols-12 items-stretch">
        <div className="flex flex-col justify-between rounded-3xl border border-[#b8892b]/35 bg-[#fffdf7] p-6 shadow-sm lg:col-span-7">
          <div>
            <p className="text-xs font-semibold text-[#8a651b]">
              Assalomu alaykum, Zulxumor!
            </p>
            <h1 className="mt-1.5 font-display text-2xl font-semibold text-[#0b4f3a] sm:text-3xl text-balance">
              Bugungi Qur&apos;on tilovatiga xush kelibsiz
            </h1>
            <p className="mt-2 text-sm text-[#5c564d]">
              Oxirgi o‘qilgan joy: <strong className="text-[#1a1815]">{lastSurah.nameUz} surasi</strong> ·{' '}
              {settings.lastAyah}-oyat · {settings.lastPage}-sahifa
            </p>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onOpenPage(settings.lastPage)}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl bg-[#0b4f3a] px-5 py-3 text-sm font-semibold text-[#fbf8f1] transition hover:bg-[#11694d] cursor-pointer"
            >
              <BookOpen className="h-4 w-4 text-[#e9d9b4]" />
              <span>Oxirgi joydan davom etish</span>
              <ArrowRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onOpenNavigator}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-2xl border border-[#0b4f3a]/20 bg-white px-5 py-3 text-sm font-semibold text-[#0b4f3a] transition hover:bg-[#f4eee1] cursor-pointer"
            >
              <Compass className="h-4 w-4" />
              <span>Sura / Pora / Sahifa tanlash</span>
            </button>
          </div>
        </div>

        {/* Today's Real Summary Metrics */}
        <div className="grid grid-cols-2 gap-3 rounded-3xl border border-[#0b4f3a]/12 bg-[#f4eee1]/65 p-5 lg:col-span-5">
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-[#5c564d]">Bugun o‘qilgan sahifa</p>
            <p className="mt-1 text-2xl font-bold text-[#0b4f3a] tabular-nums">
              {stats.todayPages} ta
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-[#5c564d]">Ketma-ket kunlar</p>
            <div className="mt-1 flex items-center gap-1.5">
              <Flame className="h-5 w-5 text-[#b8892b]" />
              <p className="text-2xl font-bold text-[#0b4f3a] tabular-nums">
                {stats.streakDays} kun
              </p>
            </div>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-[#5c564d]">To‘g‘ri so‘zlar</p>
            <p className="mt-1 text-2xl font-bold text-[#0b4f3a] tabular-nums">
              {stats.totalWordsCorrect}
            </p>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <p className="text-xs text-[#5c564d]">Tuzatilgan xatolar</p>
            <p className="mt-1 text-2xl font-bold text-[#b8892b] tabular-nums">
              {stats.totalErrorsCorrected}
            </p>
          </div>
        </div>
      </section>

      {/* Primary Learning Modules */}
      <section className="grid gap-4 sm:grid-cols-3">
        <button
          type="button"
          onClick={() => onSelectTab('quran')}
          className="flex flex-col items-start justify-between rounded-2xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 text-left transition hover:border-[#0b4f3a]/35 hover:shadow-sm cursor-pointer"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b4f3a]/10 text-[#0b4f3a]">
            <BookOpen className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <h2 className="text-base font-semibold text-[#1a1815]">Qur&apos;on o‘qish</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#5c564d]">
              Mikrofon orqali so‘zma-so‘z tajvid tekshiruvi va xato joyida to‘xtash
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('memorize')}
          className="flex flex-col items-start justify-between rounded-2xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 text-left transition hover:border-[#0b4f3a]/35 hover:shadow-sm cursor-pointer"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#b8892b]/15 text-[#8a651b]">
            <Brain className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <h2 className="text-base font-semibold text-[#1a1815]">Yodlash (Hifz)</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#5c564d]">
              Oyatlarni yashirib yoddan o‘qish va to‘g‘ri aytilgan so‘zlarni ochish
            </p>
          </div>
        </button>

        <button
          type="button"
          onClick={() => onSelectTab('review')}
          className="flex flex-col items-start justify-between rounded-2xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 text-left transition hover:border-[#0b4f3a]/35 hover:shadow-sm cursor-pointer"
        >
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0b4f3a]/10 text-[#0b4f3a]">
            <RotateCcw className="h-5 w-5" />
          </div>
          <div className="mt-4">
            <h2 className="text-base font-semibold text-[#1a1815]">Takrorlash va xatolar</h2>
            <p className="mt-1 text-xs leading-relaxed text-[#5c564d]">
              Oldingi xato so‘zlar ustida ishlash va poralar bo‘yicha takrorlash
            </p>
          </div>
        </button>
      </section>

      {/* Quick Mushaf Shortcuts */}
      <section className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-[#0b4f3a]">
            Tezkor ochish
          </h2>
          <button
            type="button"
            onClick={onOpenNavigator}
            className="text-xs font-semibold text-[#0b4f3a] hover:underline cursor-pointer"
          >
            Barcha 114 sura
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURED_SHORTCUTS.map((item) => (
            <button
              key={item.page}
              type="button"
              onClick={() => onOpenPage(item.page)}
              className="flex min-h-[56px] items-center justify-between rounded-2xl border border-[#0b4f3a]/12 bg-[#fbf8f1] px-4 py-3 text-left transition hover:border-[#0b4f3a]/35 cursor-pointer"
            >
              <div>
                <p className="text-sm font-semibold text-[#1a1815]">{item.label}</p>
                <p className="text-xs text-[#5c564d] tabular-nums">{item.sub}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[#0b4f3a]" />
            </button>
          ))}
        </div>
      </section>

      {/* Offline Storage Card */}
      <section className="rounded-3xl border border-[#b8892b]/30 bg-[#f4eee1]/75 p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="flex items-center gap-2">
              {cachedPagesCount >= 604 ? (
                <CheckCircle2 className="h-5 w-5 text-[#15803d]" />
              ) : (
                <Download className="h-5 w-5 text-[#0b4f3a]" />
              )}
              <h2 className="text-base font-semibold text-[#0b4f3a]">
                Oflayn Qur&apos;on xotirasi ({cachedPagesCount} / 604 sahifa)
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#5c564d]">
              {cachedPagesCount >= 604
                ? "Barcha 114 sura, 30 pora va tajvid belgilari telefoningiz xotirasiga saqlangan — internetsiz ham o‘qishingiz mumkin."
                : "Wi-Fi orqali bir marta to‘liq 604 sahifali Mushafni yuklab oling, keyin internet o‘chsa ham bemalol o‘qiysiz."}
            </p>
            {downloadProgress && (
              <div className="mt-3 max-w-md">
                <div className="h-2 w-full overflow-hidden rounded-full bg-white">
                  <div
                    className="h-full bg-[#0b4f3a] transition-all duration-300"
                    style={{ width: `${downloadProgress.percent}%` }}
                  />
                </div>
                <p className="mt-1 text-xs font-medium text-[#0b4f3a]">{downloadProgress.label}</p>
              </div>
            )}
          </div>

          <button
            type="button"
            disabled={downloadingOffline || !isOnline || cachedPagesCount >= 604}
            onClick={onStartDownloadOffline}
            className="inline-flex min-h-[48px] items-center justify-center gap-2 rounded-2xl bg-[#0b4f3a] px-5 py-3 text-xs font-semibold text-[#fbf8f1] transition hover:bg-[#11694d] disabled:opacity-55 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Download className="h-4 w-4" />
            <span>
              {cachedPagesCount >= 604
                ? 'To‘liq yuklangan'
                : downloadingOffline
                  ? 'Yuklanmoqda...'
                  : 'To‘liq Qur’onni yuklash'}
            </span>
          </button>
        </div>
      </section>
    </div>
  );
};
