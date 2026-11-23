import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, ArrowRight, RotateCcw, BookOpen } from 'lucide-react';

interface PageCompleteModalProps {
  isOpen: boolean;
  pageNumber: number;
  ayahCount: number;
  correctWordsCount: number;
  correctedMistakesCount: number;
  onNextPage: () => void;
  onReplayPage: () => void;
  onReturnToQuran: () => void;
}

const STAR_POSITIONS = [
  { x: '-38%', y: '-34%', delay: 0.05, size: 'h-5 w-5' },
  { x: '36%', y: '-30%', delay: 0.12, size: 'h-6 w-6' },
  { x: '-44%', y: '10%', delay: 0.18, size: 'h-4 w-4' },
  { x: '42%', y: '14%', delay: 0.24, size: 'h-5 w-5' },
  { x: '0%', y: '-44%', delay: 0.08, size: 'h-7 w-7' },
];

export const PageCompleteModal: React.FC<PageCompleteModalProps> = ({
  isOpen,
  pageNumber,
  ayahCount,
  correctWordsCount,
  correctedMistakesCount,
  onNextPage,
  onReplayPage,
  onReturnToQuran,
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="page-complete-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-md overflow-hidden rounded-3xl border border-[#b8892b]/50 bg-[#fffdf7] p-6 shadow-2xl sm:p-8"
          >
            {/* Golden stars celebration */}
            <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
              {STAR_POSITIONS.map((s, idx) => (
                <motion.div
                  key={idx}
                  initial={{ opacity: 0, scale: 0.4 }}
                  animate={{ opacity: [0, 1, 0.85], scale: [0.5, 1.15, 1] }}
                  transition={{ delay: s.delay, duration: 0.6 }}
                  style={{ transform: `translate(${s.x}, ${s.y})` }}
                  className="absolute text-[#d4a84f]"
                >
                  <Star className={`${s.size} fill-[#d4a84f]`} />
                </motion.div>
              ))}
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0b4f3a] text-[#e9d9b4] shadow-md">
                <Star className="h-8 w-8 fill-[#d4a84f] text-[#d4a84f]" />
              </div>
            </div>

            <div className="mt-3 text-center">
              <p className="text-xs font-bold tracking-widest text-[#b8892b]">
                MASHAALLOH!
              </p>
              <h2
                id="page-complete-title"
                className="mt-1.5 font-display text-2xl font-semibold text-[#0b4f3a]"
              >
                Zulxumor, bir sahifani muvaffaqiyatli o‘qib tugatdingiz!
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-[#4f4940]">
                Alloh ilmingizni ziyoda qilsin, Qur&apos;onni qalbingizga nur, hayotingizga hidoyat qilsin!
              </p>
            </div>

            {/* Verified Metrics */}
            <div className="mt-6 grid grid-cols-2 gap-3 border-y border-[#0b4f3a]/12 py-4">
              <div className="rounded-xl bg-[#f4eee1]/75 px-3 py-2.5 text-center">
                <p className="text-xs text-[#5c564d]">Tugatilgan sahifa</p>
                <p className="mt-0.5 text-lg font-bold text-[#0b4f3a] tabular-nums">
                  {pageNumber}-sahifa
                </p>
              </div>
              <div className="rounded-xl bg-[#f4eee1]/75 px-3 py-2.5 text-center">
                <p className="text-xs text-[#5c564d]">O‘qilgan oyatlar</p>
                <p className="mt-0.5 text-lg font-bold text-[#0b4f3a] tabular-nums">
                  {ayahCount} oyat
                </p>
              </div>
              <div className="rounded-xl bg-[#f4eee1]/75 px-3 py-2.5 text-center">
                <p className="text-xs text-[#5c564d]">To‘g‘ri o‘qilgan so‘zlar</p>
                <p className="mt-0.5 text-lg font-bold text-[#0b4f3a] tabular-nums">
                  {correctWordsCount} ta
                </p>
              </div>
              <div className="rounded-xl bg-[#f4eee1]/75 px-3 py-2.5 text-center">
                <p className="text-xs text-[#5c564d]">Tuzatilgan xatolar</p>
                <p className="mt-0.5 text-lg font-bold text-[#b8892b] tabular-nums">
                  {correctedMistakesCount} ta
                </p>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="mt-6 flex flex-col gap-2.5">
              {pageNumber < 604 && (
                <button
                  type="button"
                  onClick={onNextPage}
                  className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl bg-[#0b4f3a] px-5 py-3 text-sm font-semibold text-[#fbf8f1] transition hover:bg-[#11694d] cursor-pointer"
                >
                  <span>Keyingi sahifa</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <div className="grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={onReplayPage}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#0b4f3a]/20 bg-white px-3 py-2.5 text-xs font-semibold text-[#0b4f3a] transition hover:bg-[#f4eee1] cursor-pointer"
                >
                  <RotateCcw className="h-4 w-4" />
                  <span>Sahifani qayta o‘qish</span>
                </button>
                <button
                  type="button"
                  onClick={onReturnToQuran}
                  className="inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-xl border border-[#0b4f3a]/20 bg-white px-3 py-2.5 text-xs font-semibold text-[#5c564d] transition hover:bg-[#f4eee1] cursor-pointer"
                >
                  <BookOpen className="h-4 w-4" />
                  <span>Qur&apos;onga qaytish</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
