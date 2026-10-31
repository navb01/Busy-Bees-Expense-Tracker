import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';
import { LogoVariant, ScreenType, UserProfile } from '../types';
import { BusyBeesLogo } from './BusyBeesLogo';

interface HeaderProps {
  currentScreen: ScreenType;
  title?: string;
  onBack: () => void;
  onOpenDrawer: () => void;
  onOpenProfile: () => void;
  profile: UserProfile;
  logoVariant?: LogoVariant;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  title,
  onBack,
  onOpenDrawer,
  logoVariant = 'swoosh',
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
      case 'backup':
        return 'Backup & Restore';
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
    <header className="shrink-0 z-30 flex items-center justify-between px-5 pt-10 pb-3.5 sm:py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200/80 dark:border-slate-800 transition-colors">
      <div className="flex items-center gap-2.5 min-w-0">
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
              ? 'font-brand text-[15.5px] sm:text-[18px] tracking-wide'
              : 'font-semibold text-lg'
          }`}
        >
          {screenTitle}
        </h1>
      </div>

      {/* Static Rupee-Bee Brand Emblem in Top Header */}
      <div className="shrink-0 ml-2">
        <BusyBeesLogo variant={logoVariant} size={40} animated={false} />
      </div>
    </header>
  );
};

