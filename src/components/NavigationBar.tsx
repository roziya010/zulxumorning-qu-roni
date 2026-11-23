import React from 'react';
import {
  Home,
  BookOpen,
  Brain,
  RotateCcw,
  BarChart3,
  Settings,
} from 'lucide-react';
import { AppTab } from '../types/quran';

interface NavigationBarProps {
  activeTab: AppTab;
  onSelectTab: (tab: AppTab) => void;
  isOnline: boolean;
}

const NAV_ITEMS: Array<{
  id: AppTab;
  label: string;
  icon: React.FC<{ className?: string }>;
}> = [
  { id: 'home', label: 'Bosh sahifa', icon: Home },
  { id: 'quran', label: "Qur'on", icon: BookOpen },
  { id: 'memorize', label: 'Yodlash', icon: Brain },
  { id: 'review', label: 'Takrorlash', icon: RotateCcw },
  { id: 'stats', label: 'Natijalar', icon: BarChart3 },
  { id: 'settings', label: 'Sozlamalar', icon: Settings },
];

export const NavigationBar: React.FC<NavigationBarProps> = ({
  activeTab,
  onSelectTab,
  isOnline,
}) => {
  return (
    <>
      {/* Desktop Top Navigation Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 hidden border-b border-[#0b4f3a]/12 bg-[#fbf8f1]/95 backdrop-blur-md lg:block">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-8 px-6">
          <button
            type="button"
            onClick={() => onSelectTab('welcome')}
            className="font-display text-lg font-bold tracking-tight text-[#0b4f3a] whitespace-nowrap shrink-0 cursor-pointer"
          >
            Zulxumor Qur&apos;on
          </button>

          <nav className="flex items-center gap-6" aria-label="Asosiy menyu">
            {NAV_ITEMS.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectTab(item.id)}
                  className={`relative py-2 text-sm font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? 'text-[#0b4f3a] font-semibold'
                      : 'text-[#5c564d] hover:text-[#1a1815]'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full bg-[#0b4f3a]" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onSelectTab('quran')}
              className="rounded-xl bg-[#0b4f3a] px-4 py-2 text-xs font-semibold text-[#fbf8f1] transition hover:bg-[#11694d] whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isOnline ? "O'qishni davom ettirish" : "Oflayn o'qish"}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Compact Bottom Tab Bar (6 items, thumb-zone ergonomics) */}
      <nav
        aria-label="Pastki menyu"
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-[#0b4f3a]/14 bg-[#fffdf7]/95 backdrop-blur-md pb-safe lg:hidden"
      >
        <div className="grid grid-cols-6 items-center h-16">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                className={`flex min-h-[48px] flex-col items-center justify-center gap-0.5 px-1 transition-colors cursor-pointer ${
                  isActive ? 'text-[#0b4f3a]' : 'text-[#6e675c]'
                }`}
              >
                <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.3]' : 'stroke-[1.75]'}`} />
                <span className="text-[10px] font-medium tracking-tight truncate max-w-full">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
