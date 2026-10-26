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
  onOpenProfile,
  profile,
}) => {
  const isDashboard = currentScreen === 'dashboard';

  // Compute initials from profile name or default to 'BB'
  const getInitials = () => {
    if (!profile.name || profile.name.trim() === '') return 'BB';
    const parts = profile.name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return profile.name.substring(0, 2).toUpperCase();
  };

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

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-4 bg-slate-50/95 backdrop-blur-sm border-b border-slate-100">
      <div className="flex items-center gap-3">
        {isDashboard ? (
          <button
            onClick={onOpenDrawer}
            aria-label="Open menu"
            className="p-2 -ml-2 text-slate-700 hover:text-slate-900 active:scale-95 transition rounded-lg hover:bg-slate-200/50"
          >
            <Menu className="w-6 h-6 stroke-[2.2]" />
          </button>
        ) : (
          <button
            onClick={onBack}
            aria-label="Go back"
            className="p-2 -ml-2 text-slate-700 hover:text-slate-900 active:scale-95 transition rounded-lg hover:bg-slate-200/50"
          >
            <ArrowLeft className="w-5 h-5 stroke-[2.2]" />
          </button>
        )}

        <h1
          className={`text-slate-900 text-lg leading-tight ${
            isDashboard
              ? 'font-bold tracking-tight font-heading'
              : 'font-semibold'
          }`}
        >
          {getScreenTitle()}
        </h1>
      </div>

      {/* Busy Bees "BB" Logo Badge as designed in Figma */}
      <div
        className="w-10 h-10 rounded-full border-2 border-[#2357A4] flex items-center justify-center text-[#2357A4] font-bold text-sm bg-white shadow-xs select-none shrink-0"
        aria-label="Busy Bees Logo"
        title="Busy Bees Expense Tracker"
      >
        BB
      </div>
    </header>
  );
};
