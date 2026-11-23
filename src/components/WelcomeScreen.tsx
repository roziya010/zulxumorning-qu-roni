import React from 'react';
import { BookOpen, ArrowRight, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

interface WelcomeScreenProps {
  lastPage: number;
  lastSurahNameUz: string;
  hasPreviousProgress: boolean;
  onStart: () => void;
  onResumeLast: () => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  lastPage,
  lastSurahNameUz,
  hasPreviousProgress,
  onStart,
  onResumeLast,
}) => {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#fbf8f1] text-[#1a1815]">
      {/* Subtle Islamic geometric pattern backdrop */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-[0.14]"
        style={{
          backgroundImage: `url('/src/assets/images/islamic_geometric_banner_1795442177862.jpg')`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#fbf8f1]/75 via-[#fbf8f1]/88 to-[#f4eee1]"
      />

      <main className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col justify-between px-5 py-8 lg:px-10 lg:py-12">
        {/* Top Wordmark */}
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/src/assets/images/zulxumor_app_emblem_1795442177740.jpg"
              alt="Zulxumor Qur'on ramzi"
              referrerPolicy="no-referrer"
              className="h-11 w-11 rounded-xl object-cover border border-[#b8892b]/40 shadow-sm"
            />
            <div>
              <p className="font-display text-lg font-bold tracking-tight text-[#0b4f3a]">
                ZULXUMOR QUR&apos;ON
              </p>
              <p className="text-xs text-[#5c564d]">
                Tajvidli o‘qish · Yodlash · Takrorlash
              </p>
            </div>
          </div>
        </header>

        {/* Main Hero Split */}
        <div className="my-auto grid items-stretch gap-8 py-8 lg:grid-cols-12 lg:gap-12">
          {/* Left Content */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col justify-center lg:col-span-7"
          >
            <h1 className="font-display text-3xl font-semibold leading-tight text-[#0b4f3a] sm:text-4xl lg:text-5xl text-balance">
              Zulxumor, Alloh ilmingizni ziyoda qilsin!
            </h1>

            {/* Arabic Dua Box */}
            <div className="mt-6 rounded-2xl border border-[#b8892b]/35 bg-[#fffdf7]/95 px-6 py-5 shadow-sm">
              <p
                dir="rtl"
                lang="ar"
                className="font-quran text-center text-3xl leading-relaxed text-[#0b4f3a] sm:text-4xl"
              >
                رَبِّ زِدْنِي عِلْمًا
              </p>
              <p className="mt-2 text-center text-sm font-medium text-[#8a651b]">
                «Robbim, ilmimni ziyoda qilgin».
              </p>
            </div>

            <p className="mt-6 max-w-2xl text-base leading-relaxed text-[#3d3830] sm:text-lg">
              Har bir o‘qilgan oyat qalbga nur, har bir takror esa ilmga bir qadamdir. Qur&apos;on bilan o‘tgan har bir kuningiz hayotingizga baraka olib kelsin.
            </p>

            {/* Primary CTA Buttons */}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="button"
                onClick={onStart}
                className="inline-flex min-h-[52px] items-center justify-center gap-3 rounded-2xl bg-[#0b4f3a] px-7 py-3.5 text-base font-semibold text-[#fbf8f1] shadow-md shadow-[#0b4f3a]/20 transition hover:bg-[#11694d] active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="h-5 w-5 text-[#e9d9b4]" />
                <span>QUR&apos;ONNI BOSHLASH</span>
                <ArrowRight className="h-5 w-5" />
              </button>

              {hasPreviousProgress && (
                <button
                  type="button"
                  onClick={onResumeLast}
                  className="inline-flex min-h-[52px] items-center justify-center gap-2 rounded-2xl border border-[#0b4f3a]/25 bg-white/85 px-6 py-3.5 text-sm font-semibold text-[#0b4f3a] transition hover:bg-white active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-[#b8892b]" />
                  <span>Oxirgi joydan: {lastSurahNameUz} · {lastPage}-sahifa</span>
                </button>
              )}
            </div>
          </motion.section>

          {/* Right Editorial Hero Visual */}
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="lg:col-span-5"
          >
            <div className="relative h-64 w-full overflow-hidden rounded-3xl border border-[#b8892b]/35 bg-[#f4eee1] shadow-lg sm:h-80 lg:h-full lg:min-h-[420px]">
              <img
                src="/src/assets/images/welcome_quran_hero_1795442178897.jpg"
                alt="Ochiq Qur'oni Karim mushafi"
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b4f3a]/70 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-[#fbf8f1]">
                <p className="text-xs font-medium text-[#e9d9b4]">
                  Hafs an Osim · Madina mushafi
                </p>
                <p className="mt-0.5 text-sm font-semibold">
                  114 sura · 30 pora · 604 sahifa
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Quiet Editorial Footer */}
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[#0b4f3a]/10 pt-4 text-xs text-[#5c564d]">
          <span>Zulxumor Qur&apos;on · Haqiqiy ovozli tajvid tekshiruvi</span>
          <span>To‘liq o‘zbekcha interfeys · Asl arabcha mushaf</span>
        </footer>
      </main>
    </div>
  );
};
