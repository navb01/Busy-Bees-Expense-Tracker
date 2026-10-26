import React from 'react';
import { X, SlidersHorizontal, Download, Info, UserRound, LogOut } from 'lucide-react';
import { ScreenType } from '../types';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (screen: ScreenType) => void;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  onNavigate,
}) => {
  if (!isOpen) return null;

  const handleItemClick = (screen: ScreenType) => {
    onClose();
    onNavigate(screen);
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Dimmed backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-[2px] transition-opacity duration-300"
      />

      {/* Drawer content */}
      <div className="relative z-10 w-[80%] max-w-xs h-full bg-white shadow-2xl flex flex-col animate-in slide-in-from-left duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-6">
          <h2 className="text-xl font-bold text-slate-900 leading-snug">
            Busy Bees Expense
            <br />
            Tracker
          </h2>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5 stroke-[2.2]" />
          </button>
        </div>

        {/* Navigation list */}
        <div className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
          <button
            onClick={() => handleItemClick('settings')}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-slate-800 hover:bg-slate-50 rounded-xl transition font-medium text-[15px]"
          >
            <SlidersHorizontal className="w-5 h-5 text-slate-600 stroke-[1.8]" />
            <span>Settings</span>
          </button>

          <button
            onClick={() => handleItemClick('export')}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-slate-800 hover:bg-slate-50 rounded-xl transition font-medium text-[15px]"
          >
            <Download className="w-5 h-5 text-slate-600 stroke-[1.8]" />
            <span>Export</span>
          </button>

          <button
            onClick={() => handleItemClick('about')}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-slate-800 hover:bg-slate-50 rounded-xl transition font-medium text-[15px]"
          >
            <Info className="w-5 h-5 text-slate-600 stroke-[1.8]" />
            <span>About</span>
          </button>

          <button
            onClick={() => handleItemClick('profile')}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-slate-800 hover:bg-slate-50 rounded-xl transition font-medium text-[15px]"
          >
            <UserRound className="w-5 h-5 text-slate-600 stroke-[1.8]" />
            <span>User profile</span>
          </button>

          <button
            onClick={() => handleItemClick('exit')}
            className="w-full flex items-center gap-4 px-4 py-3.5 text-slate-800 hover:bg-slate-50 rounded-xl transition font-medium text-[15px]"
          >
            <LogOut className="w-5 h-5 text-slate-600 stroke-[1.8]" />
            <span>Exit</span>
          </button>
        </div>

        {/* Footer */}
        <div className="px-6 py-6 border-t border-slate-100 bg-slate-50/50">
          <p className="text-xs text-slate-500 font-normal">A little clarity, every day.</p>
          <p className="text-xs text-slate-400 mt-1">Version 1.0.0</p>
        </div>
      </div>
    </div>
  );
};
