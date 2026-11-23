import React, { useState } from 'react';
import {
  Vibrate,
  Download,
  Wifi,
  WifiOff,
  Smartphone,
  CheckCircle2,
  Type as TypeIcon,
  Mic,
} from 'lucide-react';
import { AppSettings } from '../types/quran';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface SettingsViewProps {
  settings: AppSettings;
  cachedPagesCount: number;
  isOnline: boolean;
  downloadingOffline: boolean;
  downloadProgress: { percent: number; label: string } | null;
  onUpdateSettings: (partial: Partial<AppSettings>) => void;
  onStartDownloadOffline: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  cachedPagesCount,
  isOnline,
  downloadingOffline,
  downloadProgress,
  onUpdateSettings,
  onStartDownloadOffline,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  return (
    <div className="mx-auto max-w-4xl space-y-5 px-4 pt-5 pb-28 sm:px-6 lg:py-8">
      <div className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-6">
        <h1 className="font-display text-2xl font-semibold text-[#0b4f3a]">
          Sozlamalar
        </h1>
        <p className="mt-1 text-xs text-[#5c564d]">
          Mikrofon, vibratsiya, arabcha yozuv kattaligi va oflayn Qur&apos;on xotirasini boshqarish
        </p>
      </div>

      {/* Vibration & Haptics */}
      <section className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Vibrate className="mt-0.5 h-5 w-5 text-[#0b4f3a]" />
            <div>
              <h2 className="text-sm font-semibold text-[#1a1815]">
                Xato aniqlanganda telefon vibratsiyasi
              </h2>
              <p className="text-xs text-[#5c564d]">
                Birinchi xatoda 1 marta, takroriy xatoda 2 marta qisqa tebranish beradi. To‘g‘ri o‘qilganda vibratsiya bo‘lmaydi.
              </p>
            </div>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.vibrationEnabled}
            onClick={() => onUpdateSettings({ vibrationEnabled: !settings.vibrationEnabled })}
            className={`relative inline-flex h-8 w-14 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
              settings.vibrationEnabled ? 'bg-[#0b4f3a]' : 'bg-[#d6cebf]'
            }`}
          >
            <span
              className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
                settings.vibrationEnabled ? 'translate-x-7' : 'translate-x-1'
              }`}
            />
          </button>
        </div>

        {/* Microphone Sensitivity */}
        <div className="border-t border-[#0b4f3a]/10 pt-4">
          <div className="flex items-center gap-2 mb-2">
            <Mic className="h-4 w-4 text-[#0b4f3a]" />
            <h2 className="text-sm font-semibold text-[#1a1815]">Mikrofon sezgirligi</h2>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'yuqori' as const, label: 'Yuqori (sokin xona)' },
              { id: 'ortacha' as const, label: 'O‘rtacha (tavsiya)' },
              { id: 'past' as const, label: 'Past (shovqinli joy)' },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onUpdateSettings({ micSensitivity: opt.id })}
                className={`min-h-[44px] rounded-xl border px-2 text-xs font-semibold transition cursor-pointer ${
                  settings.micSensitivity === opt.id
                    ? 'border-[#0b4f3a] bg-[#0b4f3a] text-white'
                    : 'border-[#0b4f3a]/15 bg-white text-[#5c564d]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Arabic Font Size */}
        <div className="border-t border-[#0b4f3a]/10 pt-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TypeIcon className="h-4 w-4 text-[#0b4f3a]" />
              <label htmlFor="font-size-range" className="text-sm font-semibold text-[#1a1815]">
                Arabcha Mushaf yozuvi kattaligi
              </label>
            </div>
            <span className="text-xs font-bold text-[#0b4f3a] tabular-nums">
              {settings.arabicFontSize}px
            </span>
          </div>
          <input
            id="font-size-range"
            type="range"
            min={24}
            max={44}
            step={2}
            value={settings.arabicFontSize}
            onChange={(e) => onUpdateSettings({ arabicFontSize: Number(e.target.value) })}
            className="mt-3 w-full accent-[#0b4f3a] cursor-pointer"
          />
          <p
            dir="rtl"
            lang="ar"
            className="font-quran mt-3 rounded-2xl bg-[#fbf8f1] py-3 text-center text-[#0b4f3a]"
            style={{ fontSize: `${settings.arabicFontSize}px` }}
          >
            بِسْمِ ٱللَّهِ ٱلرَّحْمَـٰنِ ٱلرَّحِيمِ
          </p>
        </div>
      </section>

      {/* Offline Quran Storage */}
      <section className="rounded-3xl border border-[#0b4f3a]/12 bg-[#fffdf7] p-5 space-y-4">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-base font-semibold text-[#0b4f3a]">
              To‘liq Qur&apos;onni oflayn yuklash (604 sahifa)
            </h2>
            <p className="mt-0.5 text-xs text-[#5c564d]">
              Hozir qurilma xotirasida: <strong>{cachedPagesCount} / 604 sahifa</strong> saqlangan
            </p>
          </div>
          <button
            type="button"
            disabled={downloadingOffline || !isOnline || cachedPagesCount >= 604}
            onClick={onStartDownloadOffline}
            className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-xl bg-[#0b4f3a] px-4 text-xs font-semibold text-white hover:bg-[#11694d] disabled:opacity-55 whitespace-nowrap cursor-pointer"
          >
            {cachedPagesCount >= 604 ? (
              <>
                <CheckCircle2 className="h-4 w-4" />
                <span>To‘liq yuklangan</span>
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                <span>{downloadingOffline ? 'Yuklanmoqda...' : 'Wi-Fi orqali yuklash'}</span>
              </>
            )}
          </button>
        </div>

        {downloadProgress && (
          <div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#f4eee1]">
              <div
                className="h-full bg-[#0b4f3a] transition-all"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-[#0b4f3a]">{downloadProgress.label}</p>
          </div>
        )}
      </section>

      {/* Transparent Offline vs Online Capabilities */}
      <section className="rounded-3xl border border-[#b8892b]/30 bg-[#f4eee1]/65 p-5 space-y-3">
        <h2 className="text-sm font-semibold text-[#0b4f3a]">
          Oflayn va Onlayn imkoniyatlar haqida aniq ma&apos;lumot
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-4">
            <div className="flex items-center gap-2 text-[#15803d]">
              <WifiOff className="h-4 w-4" />
              <p className="text-xs font-bold">100% Oflayn ishlaydi (internetsiz)</p>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-[#3d3830]">
              <li>· 114 sura, 30 pora va 604 sahifa (yuklab olingach)</li>
              <li>· Haqiqiy tajvid ranglari va qo‘llanmasi</li>
              <li>· Yodlash (oyatlarni yashirish) va Takrorlash</li>
              <li>· Natijalar, xatolar tarixi va vibratsiya</li>
            </ul>
          </div>
          <div className="rounded-2xl bg-white p-4">
            <div className="flex items-center gap-2 text-[#0b4f3a]">
              <Wifi className="h-4 w-4" />
              <p className="text-xs font-bold">Internet talab qiladi</p>
            </div>
            <ul className="mt-2 space-y-1 text-xs text-[#3d3830]">
              <li>· Chuqur AI arabcha harf (س–ص, ت–ط, د–ض...), harakat va tajvid tekshiruvi</li>
              <li>· Birinchi marta 604 sahifali mushaf to‘plamini yuklab olish</li>
            </ul>
          </div>
        </div>
      </section>

      {/* PWA Android / iOS Install Card */}
      {!isInstalled && (isInstallable || isIOS) && (
        <section className="rounded-3xl border border-[#0b4f3a]/15 bg-[#fffdf7] p-5">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-start gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 text-[#0b4f3a]" />
              <div>
                <h2 className="text-sm font-semibold text-[#0b4f3a]">
                  Telefon ekraniga ilova sifatida o‘rnatish
                </h2>
                <p className="text-xs text-[#5c564d]">
                  Android telefonda to‘liq ekranli ilova ko‘rinishida tezkor ochish uchun o‘rnating.
                </p>
              </div>
            </div>
            {isInstallable ? (
              <button
                type="button"
                onClick={install}
                className="min-h-[46px] rounded-xl bg-[#0b4f3a] px-5 text-xs font-semibold text-white hover:bg-[#11694d] whitespace-nowrap cursor-pointer"
              >
                Ilovani o‘rnatish
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowIOSGuide(true)}
                className="min-h-[46px] rounded-xl border border-[#0b4f3a]/25 bg-white px-4 text-xs font-semibold text-[#0b4f3a] whitespace-nowrap cursor-pointer"
              >
                iPhone’da o‘rnatish yo‘riqnomasi
              </button>
            )}
          </div>
        </section>
      )}

      {showIOSGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-3xl bg-white p-6 shadow-xl">
            <h3 className="text-base font-semibold text-[#0b4f3a]">iPhone / iPad’da o‘rnatish</h3>
            <p className="mt-2 text-sm text-[#3d3830]">
              1. Safari pastki panelidan <strong>Ulashish (Share)</strong> tugmasini bosing.
              <br />
              2. Pastga surib <strong>Bosh ekranga qo‘shish (Add to Home Screen)</strong> bandini tanlang.
            </p>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              className="mt-4 min-h-[44px] w-full rounded-xl bg-[#0b4f3a] text-sm font-semibold text-white cursor-pointer"
            >
              Tushunarli
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
