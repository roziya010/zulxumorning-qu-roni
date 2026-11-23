import React from 'react';
import {
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Sparkles,
  FileCheck2,
} from 'lucide-react';
import { QuranStatsSummary } from '../types/quran';

interface StatsViewProps {
  stats: QuranStatsSummary;
  onOpenPage: (page: number) => void;
}

export const StatsView: React.FC<StatsViewProps> = ({ stats, onOpenPage }) => {
  const totalChecks = stats.totalWordsCorrect + stats.totalErrors;
  const accuracy =
    totalChecks > 0 ? Math.round((stats.totalWordsCorrect / totalChecks) * 100) : 0;

  const metricCards = [
    {
      label: 'Bugun o‘qilgan sahifalar',
      value: `${stats.todayPages} ta`,
      icon: FileCheck2,
      accent: 'text-[#0b4f3a]',
    },
    {
      label: 'Jami o‘qilgan oyatlar',
      value: `${stats.totalAyahsRead} ta`,
      icon: BookOpen,
      accent: 'text-[#0b4f3a]',
    },
    {
      label: 'To‘g‘ri o‘qilgan so‘zlar',
      value: `${stats.totalWordsCorrect} ta`,
      icon: CheckCircle2,
      accent: 'text-[#15803d]',
    },
    {
      label: 'Xatolar soni',
      value: `${stats.totalErrors} ta`,
      icon: AlertTriangle,
      accent: 'text-red-600',
    },
    {
      label: 'Tuzatilgan xatolar',
      value: `${stats.totalErrorsCorrected} ta`,
      icon: Sparkles,
      accent: 'text-[#b8892b]',
    },
    {
      label: 'Ketma-ket o‘qilgan kunlar',
      value: `${stats.streakDays} kun`,
      icon: Flame,
      accent: 'text-[#b8892b]',
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 pt-5 pb-28 sm:px-6 lg:py-8">
      <div className="rounded-3xl border border-[#b8892b]/35 bg-[#fffdf7] p-6">
        <p className="text-xs font-semibold text-[#8a651b]">Shaxsiy natijalar</p>
        <h1 className="mt-1 font-display text-2xl font-semibold text-[#0b4f3a] sm:text-3xl">
          Zulxumorning Qur&apos;on o‘qish statistikasi
        </h1>
        <p className="mt-1.5 text-xs text-[#5c564d]">
          Faqat mikrofon orqali haqiqiy tekshirilgan so‘z va sahifalar hisobga olinadi.
        </p>
      </div>

      {/* 6 Core Metrics Grid */}
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
        {metricCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="flex items-center justify-between rounded-2xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5"
            >
              <div>
                <p className="text-xs font-medium text-[#5c564d]">{card.label}</p>
                <p className={`mt-1.5 text-2xl font-bold tabular-nums ${card.accent}`}>
                  {card.value}
                </p>
              </div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f4eee1]">
                <Icon className={`h-5 w-5 ${card.accent}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Mushaf 604-page Completion Overview */}
      <section className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold text-[#0b4f3a]">
              Mushaf bo‘yicha umumiy rivojlanish
            </h2>
            <p className="text-xs text-[#5c564d]">
              {totalChecks > 0
                ? `O‘qish aniqligi: ${accuracy}% · Tugatilgan sahifalar: ${stats.completedPageNumbers.length} / 604`
                : 'Hali mikrofon bilan tekshirilgan tilovat yozilmagan'}
            </p>
          </div>
          <span className="text-sm font-bold text-[#0b4f3a] tabular-nums">
            {stats.completedPageNumbers.length} / 604 sahifa
          </span>
        </div>

        <div className="mt-4 h-3 w-full overflow-hidden rounded-full bg-[#f4eee1]">
          <div
            className="h-full rounded-full bg-[#0b4f3a] transition-all duration-300"
            style={{ width: `${Math.min(100, (stats.completedPageNumbers.length / 604) * 100)}%` }}
          />
        </div>

        {stats.completedPageNumbers.length > 0 && (
          <div className="mt-5">
            <p className="mb-2 text-xs font-semibold text-[#5c564d]">
              Tugatilgan sahifalar (ochish uchun bosing):
            </p>
            <div className="flex flex-wrap gap-2">
              {stats.completedPageNumbers.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => onOpenPage(p)}
                  className="min-h-[38px] rounded-xl border border-[#0b4f3a]/20 bg-[#fbf8f1] px-3 text-xs font-semibold text-[#0b4f3a] hover:bg-[#f4eee1] tabular-nums cursor-pointer"
                >
                  {p}-sahifa
                </button>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
