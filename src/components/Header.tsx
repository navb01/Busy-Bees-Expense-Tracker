import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';
import { ScreenType, UserProfile } from '../types';

interface HeaderProps {
  currentScreen: ScreenType;
  title?: string;
  onBack: () => void;
  onOpenDrawer: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  title,
  onBack,
  onOpenDrawer,
}) => {
  const isDashboard = currentScreen === 'dashboard';

  const getScreenTitle = () => {
    if (title) return title;
    switch (currentScreen) {
      case 'dashboard':
        return 'Busy Bees Expense Tracker';
      case 'add-income':
      case 'add-expense':
        return 'Busy Bees Expense Tracker';
      case 'settings':
        return 'Settings';
      case 'export':
        return 'Export';
      case 'about':
        return 'About';
      case 'profile':
        return 'User profile';
      case 'exit':
        return 'Exit';
      default:
        return 'Busy Bees Expense Tracker';
    }
  };

  const screenTitle = getScreenTitle();
  const isBrandTitle = screenTitle === 'Busy Bees Expense Tracker';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-3 min-w-0">
        {isDashboard ? (
          <button
            onClick={onOpenDrawer}
            aria-label="Open menu"
            className="p-2 -ml-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white active:scale-95 transition rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 shrink-0"
          >
            <Menu className="w-6 h-6 stroke-[2.2]" />
          </button>
        ) : (
          <button
            onClick={onBack}
            aria-label="Go back"
            className="p-2 -ml-2 text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white active:scale-95 transition rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800 shrink-0"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
        )}

        <h1
          className={`text-slate-900 dark:text-slate-100 leading-tight truncate ${
            isBrandTitle
              ? 'font-brand text-[17px] sm:text-[19px] tracking-wide'
              : 'font-semibold text-lg'
          }`}
        >
          {screenTitle}
        </h1>
      </div>

      {/* Busy Bees "BB" Logo Badge */}
      <div
        className="w-10 h-10 rounded-full border-2 border-[#2357A4] dark:border-blue-400 flex items-center justify-center text-[#2357A4] dark:text-blue-400 font-bold text-sm bg-white dark:bg-slate-800 shadow-xs select-none shrink-0 ml-2"
        aria-label="Busy Bees Logo"
        title="Busy Bees Expense Tracker"
      >
        BB
      </div>
    </header>
  );
};
