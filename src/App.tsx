/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { useCallback, useEffect, useState } from 'react';
import { AppSettings, AppTab, QuranStatsSummary } from './types/quran';
import {
  countCachedPages,
  getSettings,
  getStatsSummary,
  saveSettings,
} from './modules/storage/localDb';
import { downloadFullQuranOffline } from './modules/quranData/quranLoader';
import { getSurahMeta } from './modules/quranData/surahNamesUz';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { WelcomeScreen } from './components/WelcomeScreen';
import { NavigationBar } from './components/NavigationBar';
import { HomeDashboardView } from './components/HomeDashboardView';
import { QuranReaderView } from './components/QuranReaderView';
import { MemorizationView } from './components/MemorizationView';
import { ReviewView } from './components/ReviewView';
import { StatsView } from './components/StatsView';
import { SettingsView } from './components/SettingsView';
import { QuranNavigatorSheet } from './components/QuranNavigatorSheet';

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

const EMPTY_STATS: QuranStatsSummary = {
  todayPages: 0,
  totalAyahsRead: 0,
  totalWordsCorrect: 0,
  totalErrors: 0,
  totalErrorsCorrected: 0,
  streakDays: 0,
  completedPageNumbers: [],
};

export default function App() {
  const isOnline = useOnlineStatus();
  const [activeTab, setActiveTab] = useState<AppTab>('welcome');
  const [currentPage, setCurrentPage] = useState(1);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [stats, setStats] = useState<QuranStatsSummary>(EMPTY_STATS);
  const [cachedPagesCount, setCachedPagesCount] = useState(0);
  const [isNavigatorOpen, setIsNavigatorOpen] = useState(false);

  const [downloadingOffline, setDownloadingOffline] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<{
    percent: number;
    label: string;
  } | null>(null);

  const refreshStatsAndCache = useCallback(async () => {
    const [nextStats, count] = await Promise.all([
      getStatsSummary(),
      countCachedPages(),
    ]);
    setStats(nextStats);
    setCachedPagesCount(count);
  }, []);

  useEffect(() => {
    (async () => {
      const [loadedSettings, loadedStats, count] = await Promise.all([
        getSettings(),
        getStatsSummary(),
        countCachedPages(),
      ]);
      setSettings(loadedSettings);
      setCurrentPage(loadedSettings.lastPage || 1);
      setStats(loadedStats);
      setCachedPagesCount(count);
    })();
  }, []);

  const handleUpdateSettings = async (partial: Partial<AppSettings>) => {
    const updated = await saveSettings(partial);
    setSettings(updated);
  };

  const handleStartDownloadOffline = async () => {
    if (downloadingOffline) return;
    setDownloadingOffline(true);
    setDownloadProgress({ percent: 5, label: 'Tayyorlanmoqda...' });
    const res = await downloadFullQuranOffline((percent, label) => {
      setDownloadProgress({ percent, label });
    });
    if (res.success) {
      const updated = await getSettings();
      setSettings(updated);
      setCachedPagesCount(res.totalPages);
    } else if (res.error) {
      setDownloadProgress({ percent: 0, label: res.error });
    }
    setDownloadingOffline(false);
  };

  const handleOpenPage = (pageNum: number) => {
    setCurrentPage(pageNum);
    setActiveTab('quran');
  };

  const lastSurahMeta = getSurahMeta(settings.lastSurah);
  const hasPreviousProgress =
    settings.lastPage > 1 ||
    stats.totalWordsCorrect > 0 ||
    stats.completedPageNumbers.length > 0;

  if (activeTab === 'welcome') {
    return (
      <WelcomeScreen
        lastPage={settings.lastPage}
        lastSurahNameUz={lastSurahMeta.nameUz}
        hasPreviousProgress={hasPreviousProgress}
        onStart={() => setActiveTab('home')}
        onResumeLast={() => handleOpenPage(settings.lastPage)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fbf8f1] text-[#1a1815]">
      <NavigationBar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        isOnline={isOnline}
      />

      <main>
        {activeTab === 'home' && (
          <HomeDashboardView
            settings={settings}
            stats={stats}
            cachedPagesCount={cachedPagesCount}
            isOnline={isOnline}
            downloadingOffline={downloadingOffline}
            downloadProgress={downloadProgress}
            onStartDownloadOffline={handleStartDownloadOffline}
            onOpenPage={handleOpenPage}
            onSelectTab={setActiveTab}
            onOpenNavigator={() => setIsNavigatorOpen(true)}
          />
        )}

        {activeTab === 'quran' && (
          <QuranReaderView
            page={currentPage}
            settings={settings}
            isOnline={isOnline}
            onPageChange={(next) => setCurrentPage(next)}
            onOpenNavigator={() => setIsNavigatorOpen(true)}
            onStatsUpdated={refreshStatsAndCache}
          />
        )}

        {activeTab === 'memorize' && (
          <MemorizationView
            settings={settings}
            isOnline={isOnline}
            onStatsUpdated={refreshStatsAndCache}
          />
        )}

        {activeTab === 'review' && (
          <ReviewView stats={stats} onOpenPage={handleOpenPage} />
        )}

        {activeTab === 'stats' && (
          <StatsView stats={stats} onOpenPage={handleOpenPage} />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            settings={settings}
            cachedPagesCount={cachedPagesCount}
            isOnline={isOnline}
            downloadingOffline={downloadingOffline}
            downloadProgress={downloadProgress}
            onUpdateSettings={handleUpdateSettings}
            onStartDownloadOffline={handleStartDownloadOffline}
          />
        )}
      </main>

      <QuranNavigatorSheet
        isOpen={isNavigatorOpen}
        currentPage={currentPage}
        onClose={() => setIsNavigatorOpen(false)}
        onJumpToPage={(pageNum) => handleOpenPage(pageNum)}
      />
    </div>
  );
}
